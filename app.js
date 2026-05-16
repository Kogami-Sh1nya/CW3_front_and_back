const contentDiv = document.getElementById('app-content');
const homeBtn = document.getElementById('home-btn');
const aboutBtn = document.getElementById('about-btn');
const enablePushBtn = document.getElementById('enable-push');
const disablePushBtn = document.getElementById('disable-push');

const socket = typeof io !== 'undefined'
  ? io('https://localhost:3443')
  : null;
if (socket) {
  socket.on('connect', () => {
    console.log('Socket.IO подключён:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('Ошибка Socket.IO:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.warn('Socket.IO отключён:', reason);
  });
} else {
  console.error('Socket.IO библиотека не загружена');
}

function setActiveButton(activeId) {
  [homeBtn, aboutBtn].forEach(btn => btn.classList.remove('active'));
  document.getElementById(activeId).classList.add('active');
}

async function loadContent(page) {
  try {
    const response = await fetch(`/content/${page}.html`);
    const html = await response.text();

    contentDiv.innerHTML = html;

    if (page === 'home') {
      initNotes();
    }
  } catch (err) {
    contentDiv.innerHTML = '<p class="is-center text-error">Ошибка загрузки страницы.</p>';
    console.error(err);
  }
}

homeBtn.addEventListener('click', () => {
  setActiveButton('home-btn');
  loadContent('home');
});

aboutBtn.addEventListener('click', () => {
  setActiveButton('about-btn');
  loadContent('about');
});

function getNotes() {
  return JSON.parse(localStorage.getItem('notes') || '[]');
}

function saveNotes(notes) {
  localStorage.setItem('notes', JSON.stringify(notes));
}

function initNotes() {
  const form = document.getElementById('note-form');
  const input = document.getElementById('note-input');

  const reminderForm = document.getElementById('reminder-form');
  const reminderText = document.getElementById('reminder-text');
  const reminderTime = document.getElementById('reminder-time');

  const list = document.getElementById('notes-list');

  function loadNotes() {
    const notes = getNotes();

    list.innerHTML = notes.map(note => {
      let reminderInfo = '';

      if (note.reminder) {
        reminderInfo = `<br><small>Напоминание: ${new Date(note.reminder).toLocaleString()}</small>`;
      }

      return `
        <li class="card note-card">
          <strong>${escapeHtml(note.text)}</strong>
          ${reminderInfo}
        </li>
      `;
    }).join('');
  }

  function addNote(text, reminderTimestamp = null) {
    const notes = getNotes();

    const newNote = {
      id: Date.now(),
      text,
      reminder: reminderTimestamp
    };

    notes.push(newNote);
    saveNotes(notes);
    loadNotes();

    if (socket) {
      if (reminderTimestamp) {
        socket.emit('newReminder', {
          id: newNote.id,
          text: newNote.text,
          reminderTime: reminderTimestamp
        });
      } else {
        socket.emit('newTask', {
          text: newNote.text,
          timestamp: Date.now()
        });
      }
    }
  }

  form.addEventListener('submit', event => {
    event.preventDefault();

    const text = input.value.trim();

    if (text) {
      addNote(text);
      input.value = '';
    }
  });

  reminderForm.addEventListener('submit', event => {
    event.preventDefault();

    const text = reminderText.value.trim();
    const datetime = reminderTime.value;

    if (!text || !datetime) return;

    const timestamp = new Date(datetime).getTime();

    if (timestamp <= Date.now()) {
      alert('Дата напоминания должна быть в будущем');
      return;
    }

    addNote(text, timestamp);

    reminderText.value = '';
    reminderTime.value = '';
  });

  loadNotes();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message) {
  const notification = document.createElement('div');

  notification.textContent = message;
  notification.className = 'toast';

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

if (socket) {
  socket.on('taskAdded', task => {
    showToast(`Новая задача: ${task.text}`);
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Push-уведомления не поддерживаются');
    return;
  }

  const response = await fetch('/vapidPublicKey');
  const { publicKey } = await response.json();

  const registration = await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  await fetch('/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(subscription)
  });
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) return;

  await fetch('/unsubscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint
    })
  });

  await subscription.unsubscribe();
}

async function initPushButtons(registration) {
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    enablePushBtn.style.display = 'none';
    disablePushBtn.style.display = 'inline-block';
  }

  enablePushBtn.addEventListener('click', async () => {
    if (Notification.permission === 'denied') {
      alert('Уведомления запрещены в настройках браузера');
      return;
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        alert('Необходимо разрешить уведомления');
        return;
      }
    }

    await subscribeToPush();

    enablePushBtn.style.display = 'none';
    disablePushBtn.style.display = 'inline-block';
  });

  disablePushBtn.addEventListener('click', async () => {
    await unsubscribeFromPush();

    disablePushBtn.style.display = 'none';
    enablePushBtn.style.display = 'inline-block';
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker зарегистрирован:', registration.scope);

      await initPushButtons(registration);
    } catch (err) {
      console.error('Ошибка регистрации Service Worker:', err);
    }
  });
}

loadContent('home');