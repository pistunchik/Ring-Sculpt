import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const adminApp = express();
const apiRouter = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 100 * 1024 * 1024, // 100 MB
    fileSize: 100 * 1024 * 1024,  // 100 MB
  },
});

// CORS middleware
const corsMiddleware = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-password');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
};

app.use(corsMiddleware);
adminApp.use(corsMiddleware);

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

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1488';

// In-memory store: paymentId → { orderNumber, orderDetails, items, stlBuffers }
const pendingOrders = new Map();
const completedOrders = new Map();

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function buildOrderNum() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const key = `nebulae_order_seq_${dd}${mo}${yy}`;
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

  // Send text
  const textRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }),
  });
  if (!textRes.ok) {
    console.error('[ERROR] Telegram sendMessage:', await textRes.text());
  } else {
    console.log(`[TELEGRAM] Сообщение по заказу №${orderNumber} успешно отправлено.`);
  }

  // Send STL files
  for (let i = 0; i < stlBuffers.length; i++) {
    const { buffer, filename } = stlBuffers[i];
    try {
      const formData = new FormData();
      formData.append('chat_id', TELEGRAM_CHAT_ID);
      formData.append('caption', `📦 STL-модель к заказу №${orderNumber} (Позиция #${i + 1})`);
      const fileObj = typeof File !== 'undefined'
        ? new File([buffer], filename, { type: 'application/octet-stream' })
        : new Blob([buffer], { type: 'application/octet-stream' });

      formData.append('document', fileObj, filename);
      const docRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: formData,
      });
      if (!docRes.ok) {
        console.error('[ERROR] Telegram sendDocument:', await docRes.text());
      } else {
        console.log(`[TELEGRAM] STL-файл ${filename} отправлен в бот.`);
      }
    } catch (fileErr) {
      console.error(`[ERROR] Telegram sendDocument (${filename}):`, fileErr);
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
    console.warn(`[WARN] SMTP не настроен в .env. Сообщение от support@nebulae.ru для ${userEmail} по заказу №${orderNumber} сформировано.`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to: userEmail,
      subject: `Ваш заказ №${orderNumber} принят | Nebulae`,
      html: htmlContent,
    });
    console.log(`[EMAIL] Письмо о заказе №${orderNumber} отправлено на ${userEmail} (MessageID: ${info.messageId})`);
  } catch (err) {
    console.error(`[ERROR] Ошибка отправки письма на ${userEmail}:`, err);
  }
}

async function processOrderCompletion(pending, source = 'confirmation') {
  if (!pending) return false;
  if (pending.sent) {
    console.log(`[ORDER PROCESSOR] Заказ №${pending.orderNumber} уже был обработан ранее.`);
    return true;
  }

  pending.sent = true;
  const { orderNumber, orderDetails, parsedItems, stlBuffers, paymentId } = pending;

  console.log(`[ORDER PROCESSOR] Обработка заказа №${orderNumber} (источник: ${source})...`);

  try {
    await sendOrderToTelegram(orderNumber, orderDetails, parsedItems, stlBuffers);
  } catch (err) {
    console.error(`[ERROR] Telegram notification failed for order №${orderNumber}:`, err);
  }

  try {
    await sendOrderEmail(orderNumber, orderDetails, parsedItems);
  } catch (err) {
    console.error(`[ERROR] Email notification failed for order №${orderNumber}:`, err);
  }

  if (orderNumber) completedOrders.set(orderNumber, Date.now());
  if (paymentId) pendingOrders.delete(paymentId);
  if (orderNumber) pendingOrders.delete(orderNumber);

  return true;
}

/* ─────────────────────────────────────────────────────────────
   API Router Setup
───────────────────────────────────────────────────────────── */

// Middleware to verify admin password
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['x-admin-password'] || req.headers['authorization'];
  let providedPassword = '';
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      providedPassword = authHeader.substring(7).trim();
    } else {
      providedPassword = authHeader.trim();
    }
  }

  if (!providedPassword || providedPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Неверный пароль администратора' });
  }
  next();
}

// Support raw body for YooKassa webhook
apiRouter.use('/payment-webhook', express.raw({ type: 'application/json' }));
apiRouter.use(express.json({ limit: '100mb' }));
apiRouter.use(express.urlencoded({ limit: '100mb', extended: true }));

// POST /api/admin/verify
apiRouter.post('/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password && password === ADMIN_PASSWORD) {
    return res.json({ success: true, message: 'Авторизация успешна' });
  }
  return res.status(401).json({ success: false, error: 'Неверный пароль' });
});

// POST /api/create-payment
apiRouter.post('/create-payment', upload.array('stlFiles'), async (req, res) => {
  try {
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

    const totalKopecks = parsedItems.reduce(
      (sum, item) => sum + Math.round(item.price * item.quantity * 100),
      0
    );
    const totalRub = (totalKopecks / 100).toFixed(2);

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

    const orderRecord = {
      paymentId: payment.id,
      orderNumber,
      orderDetails: { customerName, phone, email, address, comment, deliveryMethod: 'yandex_market' },
      parsedItems,
      stlBuffers,
      sent: false,
      _createdAt: Date.now(),
    };

    pendingOrders.set(payment.id, orderRecord);
    pendingOrders.set(orderNumber, orderRecord);

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const [key, val] of pendingOrders.entries()) {
      if (val._createdAt && val._createdAt < cutoff) pendingOrders.delete(key);
    }

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

// POST /api/confirm-payment
apiRouter.post('/confirm-payment', async (req, res) => {
  try {
    const { orderNumber, paymentId: reqPaymentId } = req.body;
    let pending = (reqPaymentId && pendingOrders.get(reqPaymentId)) || (orderNumber && pendingOrders.get(orderNumber));

    if (!pending) {
      if (orderNumber && completedOrders.has(orderNumber)) {
        return res.json({ success: true, status: 'succeeded', message: 'Заказ уже обработан.' });
      }
      return res.json({ success: false, status: 'canceled', message: 'Заказ не найден или отменён.' });
    }

    const paymentId = pending.paymentId || reqPaymentId;

    if (paymentId && YUKASSA_SHOP_ID && YUKASSA_SECRET_KEY &&
      YUKASSA_SHOP_ID !== 'ВАШ_SHOP_ID' && YUKASSA_SECRET_KEY !== 'ВАШ_SECRET_KEY') {
      try {
        const yukRes = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
          method: 'GET',
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${YUKASSA_SHOP_ID}:${YUKASSA_SECRET_KEY}`).toString('base64'),
          },
        });

        if (yukRes.ok) {
          const payment = await yukRes.json();
          if (payment.status !== 'succeeded') {
            return res.json({
              success: false,
              status: payment.status,
              message: payment.status === 'canceled' ? 'Платёж был отменён пользователем.' : 'Платёж не завершён.',
            });
          }
        }
      } catch (yukErr) {
        console.error('[CONFIRM PAYMENT] Error checking YooKassa:', yukErr);
      }
    }

    await processOrderCompletion(pending, 'Confirm-Payment Endpoint');
    res.json({ success: true, status: 'succeeded' });
  } catch (err) {
    console.error('[ERROR] /api/confirm-payment:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payment-webhook
apiRouter.post('/payment-webhook', async (req, res) => {
  try {
    const body = Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString('utf8'))
      : req.body;

    if (body?.event === 'payment.succeeded') {
      const paymentId = body.object?.id;
      const pending = pendingOrders.get(paymentId);
      if (pending) {
        await processOrderCompletion(pending, 'YooKassa Webhook');
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[ERROR] /api/payment-webhook:', err);
    res.sendStatus(500);
  }
});

// POST /api/checkout
apiRouter.post('/checkout', upload.array('stlFiles'), async (req, res) => {
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

/* ─────────────────────────────────────────────────────────────
   Catalog Data & Operations
───────────────────────────────────────────────────────────── */
const CATALOG_DIR = path.join(__dirname, 'catalog-data');
const CATALOG_STL_DIR = path.join(CATALOG_DIR, 'stl');
const CATALOG_FILE = path.join(CATALOG_DIR, 'catalog.json');

if (!fs.existsSync(CATALOG_DIR)) fs.mkdirSync(CATALOG_DIR, { recursive: true });
if (!fs.existsSync(CATALOG_STL_DIR)) fs.mkdirSync(CATALOG_STL_DIR, { recursive: true });

async function readCatalogData() {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const data = await fsPromises.readFile(CATALOG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('[CATALOG] Error reading catalog.json:', err);
  }
  return [];
}

async function writeCatalogData(items) {
  try {
    await fsPromises.writeFile(CATALOG_FILE, JSON.stringify(items, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[CATALOG] Error writing catalog.json:', err);
    return false;
  }
}

// GET /api/catalog
apiRouter.get('/catalog', async (req, res) => {
  try {
    const items = await readCatalogData();
    res.json({ success: true, items });
  } catch (err) {
    console.error('[ERROR] GET /api/catalog:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/catalog/stl/:filename
apiRouter.get('/catalog/stl/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(CATALOG_STL_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'STL file not found' });
    }
    res.setHeader('Content-Type', 'model/stl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  } catch (err) {
    console.error('[ERROR] GET /api/catalog/stl:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/catalog — add new item or import STL
apiRouter.post('/catalog', requireAdminAuth, upload.single('stlFile'), async (req, res) => {
  try {
    const {
      name,
      category,
      categoryName,
      description,
      price,
      badge,
      defaultParams,
      defaultMaterial,
      defaultInscription,
      isActive,
      customStlBase64,
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Название изделия обязательно' });
    }

    const items = await readCatalogData();
    const id = 'cat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    let stlFileName = '';

    // If file was uploaded via multipart/form-data
    if (req.file) {
      const cleanOriginal = (req.file.originalname || 'model.stl').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      stlFileName = `${id}_${cleanOriginal}`;
      if (!stlFileName.endsWith('.stl')) stlFileName += '.stl';
      await fsPromises.writeFile(path.join(CATALOG_STL_DIR, stlFileName), req.file.buffer);
    } else if (customStlBase64) {
      const base64Clean = customStlBase64.includes(',') ? customStlBase64.split(',')[1] : customStlBase64;
      const buffer = Buffer.from(base64Clean, 'base64');
      stlFileName = `${id}_model.stl`;
      await fsPromises.writeFile(path.join(CATALOG_STL_DIR, stlFileName), buffer);
    }

    const parsedDefaultParams = typeof defaultParams === 'string'
      ? JSON.parse(defaultParams)
      : defaultParams || { innerDiameter: 17.5, width: 6, thickness: 2.5 };

    const newItem = {
      id,
      name: name.trim(),
      category: category || 'rings',
      categoryName: categoryName || 'Кольца',
      description: description ? description.trim() : '',
      price: Number(price) || 1500,
      badge: badge ? badge.trim() : '',
      defaultParams: parsedDefaultParams,
      defaultMaterial: defaultMaterial || 'pastel_milky',
      defaultInscription: defaultInscription || '',
      stlFileName,
      isActive: isActive === undefined ? true : (isActive === 'true' || isActive === true),
      createdAt: new Date().toISOString(),
    };

    items.unshift(newItem);
    await writeCatalogData(items);

    console.log(`[CATALOG] Добавлен новый товар: ${newItem.name} (${newItem.id})`);
    res.status(201).json({ success: true, item: newItem });
  } catch (err) {
    console.error('[ERROR] POST /api/catalog:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/catalog/:id — update existing item
apiRouter.put('/catalog/:id', requireAdminAuth, upload.single('stlFile'), async (req, res) => {
  try {
    const { id } = req.params;
    const items = await readCatalogData();
    const index = items.findIndex((it) => it.id === id);

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Товар не найден' });
    }

    const existing = items[index];
    const {
      name,
      category,
      categoryName,
      description,
      price,
      badge,
      defaultParams,
      defaultMaterial,
      defaultInscription,
      isActive,
      customStlBase64,
    } = req.body;

    let stlFileName = existing.stlFileName;

    if (req.file) {
      const cleanOriginal = (req.file.originalname || 'model.stl').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      stlFileName = `${id}_${cleanOriginal}`;
      if (!stlFileName.endsWith('.stl')) stlFileName += '.stl';
      await fsPromises.writeFile(path.join(CATALOG_STL_DIR, stlFileName), req.file.buffer);
    } else if (customStlBase64) {
      const base64Clean = customStlBase64.includes(',') ? customStlBase64.split(',')[1] : customStlBase64;
      const buffer = Buffer.from(base64Clean, 'base64');
      stlFileName = `${id}_model.stl`;
      await fsPromises.writeFile(path.join(CATALOG_STL_DIR, stlFileName), buffer);
    }

    const parsedDefaultParams = defaultParams !== undefined
      ? (typeof defaultParams === 'string' ? JSON.parse(defaultParams) : defaultParams)
      : existing.defaultParams;

    const updatedItem = {
      ...existing,
      name: name !== undefined ? name.trim() : existing.name,
      category: category !== undefined ? category : existing.category,
      categoryName: categoryName !== undefined ? categoryName : existing.categoryName,
      description: description !== undefined ? description.trim() : existing.description,
      price: price !== undefined ? Number(price) : existing.price,
      badge: badge !== undefined ? badge.trim() : existing.badge,
      defaultParams: parsedDefaultParams,
      defaultMaterial: defaultMaterial !== undefined ? defaultMaterial : existing.defaultMaterial,
      defaultInscription: defaultInscription !== undefined ? defaultInscription : existing.defaultInscription,
      stlFileName,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : existing.isActive,
      updatedAt: new Date().toISOString(),
    };

    items[index] = updatedItem;
    await writeCatalogData(items);

    console.log(`[CATALOG] Обновлен товар: ${updatedItem.name} (${updatedItem.id})`);
    res.json({ success: true, item: updatedItem });
  } catch (err) {
    console.error('[ERROR] PUT /api/catalog/:id:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/catalog/:id — remove item from catalog
apiRouter.delete('/catalog/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const items = await readCatalogData();
    const item = items.find((it) => it.id === id);

    if (!item) {
      return res.status(404).json({ success: false, error: 'Товар не найден' });
    }

    if (item.stlFileName) {
      const stlPath = path.join(CATALOG_STL_DIR, item.stlFileName);
      if (fs.existsSync(stlPath)) {
        try {
          await fsPromises.unlink(stlPath);
        } catch (delErr) {
          console.warn('[CATALOG] Could not delete STL file:', delErr.message);
        }
      }
    }

    const filtered = items.filter((it) => it.id !== id);
    await writeCatalogData(filtered);

    console.log(`[CATALOG] Удален товар: ${item.name} (${id})`);
    res.json({ success: true, id });
  } catch (err) {
    console.error('[ERROR] DELETE /api/catalog/:id:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────
   Mount API on Main App (port 3001) & Admin App (port 1488)
───────────────────────────────────────────────────────────── */

// Main App (port 3001)
app.use('/api', apiRouter);
app.use('/catalog-data', express.static(CATALOG_DIR));
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Admin App (port 1488)
adminApp.use('/api', apiRouter);
adminApp.use('/catalog-data', express.static(CATALOG_DIR));

const adminDistDir = path.join(__dirname, 'dist-admin');
if (fs.existsSync(adminDistDir)) {
  adminApp.use(express.static(adminDistDir));
  adminApp.get('*', (req, res) => {
    const adminHtml = path.join(adminDistDir, 'admin.html');
    if (fs.existsSync(adminHtml)) {
      res.sendFile(adminHtml);
    } else {
      res.sendFile(path.join(adminDistDir, 'index.html'));
    }
  });
} else {
  adminApp.get('*', (req, res) => {
    const adminHtmlPath = path.join(__dirname, 'dist', 'admin.html');
    if (fs.existsSync(adminHtmlPath)) {
      res.sendFile(adminHtmlPath);
    } else {
      res.sendFile(path.join(__dirname, 'admin.html'));
    }
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[SERVER] Основной сервер запущен на порту ${PORT}`);
});

const ADMIN_PORT = process.env.ADMIN_PORT || 1488;
try {
  adminApp.listen(ADMIN_PORT, () => {
    console.log(`[ADMIN] Админ-панель доступна на отдельном порту http://localhost:${ADMIN_PORT}`);
  });
} catch (adminErr) {
  console.error(`[ADMIN] Не удалось запустить админ-сервер на порту ${ADMIN_PORT}:`, adminErr);
}