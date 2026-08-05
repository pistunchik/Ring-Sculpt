import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

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
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID;
const YUKASSA_SHOP_ID = process.env.YUKASSA_SHOP_ID;
const YUKASSA_SECRET_KEY = process.env.YUKASSA_SECRET_KEY;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'Nebulae Support <support@nebulae.ru>';

// In-memory store: paymentId → { orderNumber, orderDetails, items, stlBuffers }
// (persists until server restart; для продакшна — замените на Redis/DB)
const pendingOrders = new Map();

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function buildOrderNum() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
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

function createEmailTransporter() {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return null;
}

async function sendOrderEmail(orderNumber, orderDetails, parsedItems) {
  const userEmail = orderDetails?.email?.trim();
  if (!userEmail || !userEmail.includes('@')) {
    console.log(`[INFO] Email для заказа №${orderNumber} не отправлен: не указан адрес электронной почты.`);
    return;
  }

  const transporter = createEmailTransporter();
  const totalAmount = parsedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const itemsHtml = parsedItems
    .map(
      (item, i) => `
    <tr style="border-bottom: 1px solid #eeeeee;">
      <td style="padding: 12px; vertical-align: top;">
        <strong style="color: #111111; font-size: 14px;">${i + 1}. ${item.name}</strong><br/>
        <span style="color: #666666; font-size: 12px;">Материал: ${item.materialName}</span><br/>
        <span style="color: #666666; font-size: 12px;">Размер: ${item.ringParams?.innerDiameter || '—'} мм | Ширина: ${item.ringParams?.width || '—'} мм | Толщина: ${item.ringParams?.thickness || '—'} мм</span>
        ${item.inscriptionText ? `<br/><span style="color: #b45309; font-size: 12px;">Гравировка: «${item.inscriptionText}»</span>` : ''}
        ${item.placedInsertsCount > 0 ? `<br/><span style="color: #666666; font-size: 12px;">Вставки: ${item.placedInsertsCount} шт.</span>` : ''}
      </td>
      <td style="padding: 12px; text-align: center; vertical-align: top; font-size: 13px; color: #333333;">
        ${item.quantity} шт.
      </td>
      <td style="padding: 12px; text-align: right; vertical-align: top; font-size: 14px; font-weight: bold; color: #111111;">
        ${(item.price * item.quantity).toLocaleString('ru-RU')} ₽
      </td>
    </tr>
  `
    )
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Заказ №${orderNumber} принят | Nebulae</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e4e4e7;">
              
              <!-- Header -->
              <tr>
                <td style="background-color: #09090b; padding: 32px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">NEBULAE</h1>
                  <p style="margin: 6px 0 0 0; color: #a1a1aa; font-size: 12px; letter-spacing: 1px;">ЮВЕЛИРНАЯ СТУДИЯ</p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #09090b;">Ваш заказ принят!</h2>
                  <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #52525b;">
                    Здравствуйте, <strong>${orderDetails.customerName}</strong>!<br/>
                    Благодарим вас за заказ в ювелирной студии Nebulae. Мы получили параметры вашего украшения и приступили к работе над моделью.
                  </p>

                  <!-- Order Info Box -->
                  <div style="background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 13px;">
                      <tr>
                        <td style="padding-bottom: 8px; color: #64748b;">Номер заказа:</td>
                        <td style="padding-bottom: 8px; text-align: right; font-weight: bold; color: #0f172a; font-family: monospace; font-size: 14px;">№${orderNumber}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 8px; color: #64748b;">Покупатель:</td>
                        <td style="padding-bottom: 8px; text-align: right; font-weight: bold; color: #0f172a;">${orderDetails.customerName}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 8px; color: #64748b;">Телефон:</td>
                        <td style="padding-bottom: 8px; text-align: right; font-weight: bold; color: #0f172a;">${orderDetails.phone}</td>
                      </tr>
                      ${orderDetails.address ? `
                      <tr>
                        <td style="padding-bottom: 8px; color: #64748b;">Адрес / Пункт выдачи:</td>
                        <td style="padding-bottom: 8px; text-align: right; font-weight: bold; color: #0f172a;">${orderDetails.address}</td>
                      </tr>
                      ` : ''}
                      ${orderDetails.comment ? `
                      <tr>
                        <td style="padding-bottom: 8px; color: #64748b;">Комментарий:</td>
                        <td style="padding-bottom: 8px; text-align: right; color: #0f172a;">${orderDetails.comment}</td>
                      </tr>
                      ` : ''}
                    </table>
                  </div>

                  <!-- Items Table -->
                  <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #09090b;">Состав заказа:</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
                    <thead>
                      <tr style="background-color: #f4f4f5; border-bottom: 1px solid #e4e4e7;">
                        <th align="left" style="padding: 10px 12px; font-size: 12px; color: #71717a; font-weight: 600;">Наименование</th>
                        <th align="center" style="padding: 10px 12px; font-size: 12px; color: #71717a; font-weight: 600;">Кол-во</th>
                        <th align="right" style="padding: 10px 12px; font-size: 12px; color: #71717a; font-weight: 600;">Сумма</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                    </tbody>
                  </table>

                  <!-- Total -->
                  <div style="text-align: right; border-top: 2px solid #18181b; padding-top: 16px; margin-bottom: 28px;">
                    <span style="font-size: 14px; color: #52525b;">Итого к оплате:</span>
                    <span style="font-size: 20px; font-weight: 800; color: #09090b; margin-left: 12px;">${totalAmount.toLocaleString('ru-RU')} ₽</span>
                  </div>

                  <!-- Delivery info -->
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; font-size: 13px; color: #166534; line-height: 1.5; margin-bottom: 28px;">
                    <strong>Информация об изготовлении:</strong><br/>
                    Срок изготовления изделия составляет 5–7 рабочих дней. Мы свяжемся с вами по номеру <strong>${orderDetails.phone}</strong> при необходимости.
                  </div>

                  <p style="margin: 0; font-size: 13px; color: #71717a; line-height: 1.5;">
                    По всем вопросам обращайтесь по адресу <a href="mailto:support@nebulae.ru" style="color: #09090b; font-weight: bold; text-decoration: underline;">support@nebulae.ru</a>.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f4f4f5; padding: 24px 40px; text-align: center; border-top: 1px solid #e4e4e7; font-size: 12px; color: #a1a1aa;">
                  © ${new Date().getFullYear()} Nebulae Jewelry Studio. Все права защищены.<br/>
                  Отправлено от имени support@nebulae.ru
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (!transporter) {
    console.warn(`[WARN] SMTP не настроен в .env. Сообщение от support@nebulae.ru для ${userEmail} по заказу №${orderNumber} сформировано (задайте SMTP_* в .env для отправки).`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: userEmail,
      subject: `Ваш заказ №${orderNumber} принят | Nebulae`,
      html: htmlContent,
    });
    console.log(`[EMAIL] Письмо о заказе №${orderNumber} отправлено от support@nebulae.ru на ${userEmail} (MessageID: ${info.messageId})`);
  } catch (err) {
    console.error(`[ERROR] Ошибка отправки письма от support@nebulae.ru на ${userEmail}:`, err);
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
      await sendOrderEmail(
        orderNumber,
        { customerName, phone, email, address, comment, deliveryMethod: 'yandex_market' },
        parsedItems
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
      await sendOrderEmail(orderNumber, orderDetails, parsedItems);
      console.log(`[WEBHOOK] Заказ №${orderNumber} успешно отправлен в Telegram и на Email.`);
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
    await sendOrderEmail(
      orderNumber,
      { customerName, phone, email, deliveryMethod, address, comment },
      parsedItems
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