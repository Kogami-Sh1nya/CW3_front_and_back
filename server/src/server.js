const fs = require('fs');
const path = require('path');
const https = require('https');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Server } = require('socket.io');
require('dotenv').config();

const { configureWebPush, sendNotification } = require('./push');

const app = express();
const PORT = Number(process.env.PORT || 3443);

app.use(cors());
app.use(bodyParser.json());

const FRONTEND_DIR = path.join(__dirname, '..', '..');
app.use(express.static(FRONTEND_DIR));

const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

configureWebPush({
  subject: process.env.VAPID_SUBJECT || 'mailto:example@example.com',
  publicKey: vapidKeys.publicKey,
  privateKey: vapidKeys.privateKey
});

let subscriptions = [];

const reminders = new Map();

app.get('/vapidPublicKey', (req, res) => {
  res.json({
    publicKey: vapidKeys.publicKey
  });
});

app.post('/subscribe', (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({
      message: 'Некорректная подписка'
    });
  }

  const exists = subscriptions.some(sub => sub.endpoint === subscription.endpoint);

  if (!exists) {
    subscriptions.push(subscription);
  }

  res.status(201).json({
    message: 'Подписка сохранена',
    count: subscriptions.length
  });
});

app.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body;

  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);

  res.status(200).json({
    message: 'Подписка удалена',
    count: subscriptions.length
  });
});

function sendPushToAll(payload) {
  console.log('Отправка push. Подписок:', subscriptions.length);
  console.log('Payload:', payload);

  subscriptions.forEach(subscription => {
    sendNotification(subscription, payload).catch(err => {
      console.error('Push error:', err.message);
    });
  });
}

function scheduleReminder(reminder) {
  const delay = reminder.reminderTime - Date.now();

  console.log('Планируем напоминание через мс:', delay);

  if (delay <= 0) {
    return;
  }

  if (reminders.has(reminder.id)) {
    clearTimeout(reminders.get(reminder.id).timeoutId);
  }

  const timeoutId = setTimeout(() => {
    const payload = JSON.stringify({
      title: 'Напоминание',
      body: reminder.text,
      reminderId: reminder.id
    });

    sendPushToAll(payload);

    reminders.delete(reminder.id);
  }, delay);

  reminders.set(reminder.id, {
    ...reminder,
    timeoutId
  });
}

app.post('/snooze', (req, res) => {
  const reminderId = Number(req.query.reminderId);

  if (!reminderId || !reminders.has(reminderId)) {
    return res.status(404).json({
      error: 'Reminder not found'
    });
  }

  const reminder = reminders.get(reminderId);

  clearTimeout(reminder.timeoutId);

  const newReminder = {
    id: reminder.id,
    text: reminder.text,
    reminderTime: Date.now() + 5 * 60 * 1000
  };

  scheduleReminder(newReminder);

  res.status(200).json({
    message: 'Напоминание отложено на 5 минут'
  });
});

const CERT_DIR = path.join(__dirname, '..', 'certs');
const keyPath = path.join(CERT_DIR, 'localhost-key.pem');
const certPath = path.join(CERT_DIR, 'localhost-cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('Не найдены HTTPS-сертификаты.');
  console.error('Нужно создать файлы:');
  console.error('server/certs/localhost-key.pem');
  console.error('server/certs/localhost-cert.pem');
  process.exit(1);
}

const httpsServer = https.createServer(
  {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  },
  app
);

const io = new Server(httpsServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', socket => {
  console.log('Клиент подключён:', socket.id);

  socket.on('newTask', task => {
    io.emit('taskAdded', task);

    const payload = JSON.stringify({
      title: 'Новая задача',
      body: task.text
    });

    sendPushToAll(payload);
  });

  socket.on('newReminder', reminder => {
    console.log('Получено напоминание:', reminder);
    scheduleReminder(reminder);

    io.emit('taskAdded', {
      text: `${reminder.text} (с напоминанием)`
    });
  });

  socket.on('disconnect', () => {
    console.log('Клиент отключён:', socket.id);
  });
});

httpsServer.listen(PORT, () => {
  console.log(`HTTPS сервер запущен: https://localhost:${PORT}`);
});