const CACHE_NAME = 'app-shell-v2';
const DYNAMIC_CACHE_NAME = 'dynamic-content-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',

  '/content/home.html',
  '/content/about.html',

  '/assets/icons/favicon.ico',
  '/assets/icons/favicon-16x16.png',
  '/assets/icons/favicon-32x32.png',
  '/assets/icons/favicon-48x48.png',
  '/assets/icons/favicon-64x64.png',
  '/assets/icons/favicon-128x128.png',
  '/assets/icons/favicon-256x256.png',
  '/assets/icons/favicon-512x512.png',
  '/assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
            .map(key => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.origin !== location.origin) {
    return;
  }

  if (url.pathname.startsWith('/content/')) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          const clone = networkResponse.clone();

          caches.open(DYNAMIC_CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });

          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request)
            .then(cached => cached || caches.match('/content/home.html'));
        })
    );

    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});

self.addEventListener('push', event => {
  let data = {
    title: 'Новое уведомление',
    body: '',
    reminderId: null
  };

  if (event.data) {
    data = event.data.json();
  }

  const options = {
    body: data.body,
    icon: '/assets/icons/favicon-128x128.png',
    badge: '/assets/icons/favicon-48x48.png',
    data: {
      reminderId: data.reminderId || null,
      url: '/'
    }
  };

  if (data.reminderId) {
    options.actions = [
      {
        action: 'snooze',
        title: 'Отложить на 5 минут'
      }
    ];
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('push', event => {
  console.log('Push получен в Service Worker');
  event.notification.close();

  const reminderId = event.notification.data?.reminderId;

  if (event.action === 'snooze' && reminderId) {
    event.waitUntil(
      fetch(`/snooze?reminderId=${reminderId}`, {
        method: 'POST'
      })
    );

    return;
  }

  event.waitUntil(
    clients.openWindow('/')
  );
});