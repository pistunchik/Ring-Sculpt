import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// raw body нужен для верификации вебхука ЮКассы
app.use('/api/payment-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || process.env.VITE_TELEGRAM_CHAT_ID;
const YUKASSA_SHOP_ID    = process.env.YUKASSA_SHOP_ID;
const YUKASSA_SECRET_KEY = process.env.YUKASSA_SECRET_KEY;

// In-memory store: paymentId → { orderNumber, orderDetails, items, stlBuffers }
// (persists until server restart; для продакшна — замените на Redis/DB)
const pendingOrders = new Map();

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function buildOrderNum() {
  const now = new Date();
  const dd  = String(now.getDate()).padStart(2, '0');
  const mo  = String(now.getMonth() + 1).padStart(2, '0');
  const yy  = String(now.getFullYear()).slice(-2);
  const key = `nebulae_order_seq_${dd}${mo}${yy}`;
  // простой счётчик в памяти — при рестарте сервера начинается заново
  if (!buildOrderNum._counters) buildOrderNum._counters = {};
  buildOrderNum._counters[key] = (buildOrderNum._counters[key] || 0) + 1;
  return `${dd}${mo}${yy}-${buildOrderNum._counters[key]}`;
}

async function sendOrderToTelegram(orderNumber, orderDetails, parsedItems, stlBuffers) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[ERROR] Telegram Token или Chat ID не заданы в .env!');
    return;
  }

  let message = `✅ <b>ОПЛАЧЕН ЗАКАЗ №${orderNumber}</b>\n\n`;
  message += `👤 <b>Покупатель:</b> ${orderDetails.customerName}\n`;
  message += `📞 <b>Телефон:</b> ${orderDetails.phone}\n`;
  if (orderDetails.email) message += `📧 <b>Email:</b> ${orderDetails.email}\n`;
  message += `🚚 <b>Доставка:</b> Яндекс Маркет (бесплатно)\n`;
  if (orderDetails.address) message += `📍 <b>Пункт выдачи / Адрес:</b> ${orderDetails.address}\n`;
  if (orderDetails.comment) message += `💬 <b>Комментарий:</b> ${orderDetails.comment}\n`;
  message += '\n';

  message += `📦 <b>Состав заказа:</b>\n`;
  let total = 0;
  parsedItems.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    message += `\n<b>${index + 1}. ${item.name}</b> (${item.quantity} шт.)\n`;
    message += `   • Материал: ${item.materialName}\n`;
    message += `   • Размер: ${item.ringParams.innerDiameter} мм | Ширина: ${item.ringParams.width} мм | Толщина: ${item.ringParams.thickness} мм\n`;
    if (item.inscriptionText) message += `   • Гравировка: «${item.inscriptionText}»\n`;
    if (item.placedInsertsCount > 0) message += `   • Вставки: ${item.placedInsertsCount} шт.\n`;
    message += `   • Стоимость: ${itemTotal.toLocaleString('ru-RU')} ₽\n`;
  });
  message += `\n💰 <b>Итого оплачено:</b> ${total.toLocaleString('ru-RU')} ₽`;

  // Отправка текста
  const textRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }),
  });
  if (!textRes.ok) {
    console.error('[ERROR] Telegram sendMessage:', await textRes.text());
  }

  // Отправка STL-файлов
  for (let i = 0; i < stlBuffers.length; i++) {
    const { buffer, filename } = stlBuffers[i];
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('caption', `📦 STL-модель к заказу №${orderNumber} (Позиция #${i + 1})`);
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    formData.append('document', blob, filename);
    const docRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    if (!docRes.ok) {
      console.error('[ERROR] Telegram sendDocument:', await docRes.text());
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   POST /api/create-payment
   Принимает FormData с данными заказа + STL-файлы.
   Создаёт платёж в ЮКассе, возвращает { confirmationUrl, orderNumber }.
───────────────────────────────────────────────────────────── */
app.post('/api/create-payment', upload.array('stlFiles'), async (req, res) => {
  try {
    // Если ЮКасса не настроена — отправляем заказ напрямую в Telegram (режим разработки)
    if (!YUKASSA_SHOP_ID || !YUKASSA_SECRET_KEY ||
        YUKASSA_SHOP_ID === 'ВАШ_SHOP_ID' || YUKASSA_SECRET_KEY === 'ВАШ_SECRET_KEY') {
      console.warn('[WARN] ЮКасса не настроена — отправляем заказ напрямую в Telegram.');
      const { customerName, phone, email, address, comment, items } = req.body;
      const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
      const orderNumber = buildOrderNum();
      const stlBuffers = (req.files || []).map((f, i) => ({
        buffer: f.buffer,
        filename: f.originalname || `Model_${orderNumber}_${i + 1}.stl`,
      }));
      await sendOrderToTelegram(
        orderNumber,
        { customerName, phone, email, address, comment, deliveryMethod: 'yandex_market' },
        parsedItems,
        stlBuffers
      );
      return res.json({
        success: true,
        orderNumber,
        confirmationUrl: `/?order=${orderNumber}&status=paid`,
      });
    }

    const { customerName, phone, email, address, comment, items } = req.body;
    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
    const orderNumber = buildOrderNum();

    // Считаем сумму
    const totalKopecks = parsedItems.reduce(
      (sum, item) => sum + Math.round(item.price * item.quantity * 100),
      0
    );
    const totalRub = (totalKopecks / 100).toFixed(2);

    // Сохраняем STL-буферы для последующей отправки после оплаты
    const stlBuffers = (req.files || []).map((f, i) => ({
      buffer: f.buffer,
      filename: f.originalname || `Model_${orderNumber}_${i + 1}.stl`,
    }));

    const idempotenceKey = crypto.randomUUID();
    const returnUrl = `${req.headers.origin || 'http://localhost:3000'}/?order=${orderNumber}&status=paid`;

    const yukassaBody = {
      amount: { value: totalRub, currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: returnUrl },
      capture: true,
      description: `Заказ Nebulae №${orderNumber}`,
      metadata: { order_number: orderNumber },
      receipt: {
        customer: { email },
        items: parsedItems.map(item => ({
          description: item.name,
          quantity: String(item.quantity),
          amount: { value: String((item.price).toFixed(2)), currency: 'RUB' },
          vat_code: 1,
          payment_mode: 'full_payment',
          payment_subject: 'commodity',
        })),
      },
    };

    const yukRes = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
        Authorization:
          'Basic ' + Buffer.from(`${YUKASSA_SHOP_ID}:${YUKASSA_SECRET_KEY}`).toString('base64'),
      },
      body: JSON.stringify(yukassaBody),
    });

    if (!yukRes.ok) {
      const errText = await yukRes.text();
      console.error('[ERROR] ЮКасса create payment:', errText);
      throw new Error(`ЮКасса API Error: ${errText}`);
    }

    const payment = await yukRes.json();

    // Сохраняем данные заказа в памяти до получения вебхука
    pendingOrders.set(payment.id, {
      orderNumber,
      orderDetails: { customerName, phone, email, address, comment, deliveryMethod: 'yandex_market' },
      parsedItems,
      stlBuffers,
    });

    // Подчищаем старые записи (старше 24 часов) — простая защита от утечки памяти
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [key, val] of pendingOrders.entries()) {
      if (val._createdAt && val._createdAt < cutoff) pendingOrders.delete(key);
    }
    pendingOrders.get(payment.id)._createdAt = Date.now();

    res.json({
      success: true,
      orderNumber,
      confirmationUrl: payment.confirmation.confirmation_url,
    });
  } catch (err) {
    console.error('[ERROR] /api/create-payment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/payment-webhook
   ЮКасса отправляет сюда уведомления об изменении статуса.
   При succeeded — отправляет заказ в Telegram.
───────────────────────────────────────────────────────────── */
app.post('/api/payment-webhook', async (req, res) => {
  try {
    // Тело может прийти как Buffer (из express.raw) или объект
    const body = Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString('utf8'))
      : req.body;

    console.log('[WEBHOOK] ЮКасса:', body?.event, body?.object?.id, body?.object?.status);

    if (body?.event === 'payment.succeeded') {
      const paymentId = body.object?.id;
      const pending = pendingOrders.get(paymentId);

      if (!pending) {
        console.warn('[WEBHOOK] Заказ не найден для paymentId:', paymentId);
        return res.sendStatus(200); // отвечаем 200, чтобы ЮКасса не повторяла
      }

      const { orderNumber, orderDetails, parsedItems, stlBuffers } = pending;
      pendingOrders.delete(paymentId);

      await sendOrderToTelegram(orderNumber, orderDetails, parsedItems, stlBuffers);
      console.log(`[WEBHOOK] Заказ №${orderNumber} успешно отправлен в Telegram.`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[ERROR] /api/payment-webhook:', err);
    res.sendStatus(500);
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/checkout — оригинальный эндпоинт (резервный)
───────────────────────────────────────────────────────────── */
app.post('/api/checkout', upload.array('stlFiles'), async (req, res) => {
  try {
    const { orderNumber, customerName, phone, email, deliveryMethod, address, comment, items } = req.body;
    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    const stlBuffers = (req.files || []).map((f, i) => ({
      buffer: f.buffer,
      filename: f.originalname || `Model_${orderNumber}_${i + 1}.stl`,
    }));

    await sendOrderToTelegram(
      orderNumber,
      { customerName, phone, email, deliveryMethod, address, comment },
      parsedItems,
      stlBuffers
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[ERROR] /api/checkout:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Статика фронтенда
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[SERVER] Запущен на порту ${PORT}`);
});