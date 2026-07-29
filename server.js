import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

// Разрешаем CORS, если клиент и бэкенд работают на разных портах/доменах
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.VITE_TELEGRAM_CHAT_ID;

app.post('/api/checkout', upload.array('stlFiles'), async (req, res) => {
  try {
    const { orderNumber, customerName, phone, email, deliveryMethod, address, comment, items } = req.body;
    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('[ERROR] Telegram Token или Chat ID не заданы в .env!');
      return res.status(500).json({ 
        success: false, 
        error: 'На сервере не настроены TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID в .env' 
      });
    }

    // 1. Формируем подробный чек заказа
    let message = `🛍 <b>НОВЫЙ ЗАКАЗ №${orderNumber}</b>\n\n`;
    message += `👤 <b>Покупатель:</b> ${customerName}\n`;
    message += `📞 <b>Телефон:</b> ${phone}\n`;
    if (email) message += `📧 <b>Email:</b> ${email}\n`;
    message += `🚚 <b>Доставка:</b> ${deliveryMethod.toUpperCase()}\n`;
    if (address) message += `📍 <b>Адрес:</b> ${address}\n`;
    if (comment) message += `💬 <b>Комментарий:</b> ${comment}\n\n`;

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

    message += `\n💰 <b>Итого к оплате:</b> ${total.toLocaleString('ru-RU')} ₽`;

    // 2. Отправка текста в Telegram API
    const textRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!textRes.ok) {
      const errBody = await textRes.text();
      console.error('[ERROR] Ошибка Telegram API (sendMessage):', errBody);
      throw new Error(`Telegram API Error: ${errBody}`);
    }

    // 3. Отправка файлов STL 3D-моделей
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('caption', `📦 STL-модель к заказу №${orderNumber} (Позиция #${i + 1})`);
        
        const blob = new Blob([file.buffer], { type: 'application/octet-stream' });
        formData.append('document', blob, file.originalname || `Model_${orderNumber}_${i + 1}.stl`);

        const docRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
          method: 'POST',
          body: formData,
        });

        if (!docRes.ok) {
          console.error('[ERROR] Ошибка отправки STL файла в Telegram:', await docRes.text());
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[ERROR] Исключение в обработчике заказа:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Роздаём статику фронтенда (папка dist после npm run build)
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[SERVER] Запущен на порту ${PORT}`);
});