import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.VITE_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.VITE_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;

app.post('/api/checkout', upload.array('stlFiles'), async (req, res) => {
  try {
    const { orderNumber, customerName, phone, email, deliveryMethod, address, comment, items } = req.body;
    const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error('Ошибка: Не заданы TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
      return res.status(500).json({ success: false, error: 'Telegram credentials missing' });
    }

    // 1. Формируем подробный текст заказа
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
      message += `   • Цвет/материал: ${item.materialName}\n`;
      message += `   • Размер: ${item.ringParams.innerDiameter} мм | Ширина: ${item.ringParams.width} мм | Толщина: ${item.ringParams.thickness} мм\n`;
      if (item.inscriptionText) message += `   • Гравировка: «${item.inscriptionText}»\n`;
      if (item.placedInsertsCount > 0) message += `   • Вставки: ${item.placedInsertsCount} шт.\n`;
      message += `   • Стоимость: ${itemTotal.toLocaleString('ru-RU')} ₽\n`;
    });

    message += `\n💰 <b>Итого к оплате:</b> ${total.toLocaleString('ru-RU')} ₽`;

    // 2. Отправка текстового чека
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
      const errText = await textRes.text();
      throw new Error(`Telegram API Error (sendMessage): ${errText}`);
    }

    // 3. Отправка файлов STL 3D-моделей
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('caption', `📦 3D STL Модель к заказу №${orderNumber} (Позиция #${i + 1})`);
        
        const blob = new Blob([file.buffer], { type: 'application/octet-stream' });
        formData.append('document', blob, file.originalname || `Model_${orderNumber}_${i + 1}.stl`);

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
          method: 'POST',
          body: formData,
        });
      }
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Ошибка при отправке в Telegram:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});