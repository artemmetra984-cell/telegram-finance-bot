// Название кэша
const CACHE_NAME = 'finance-app-v1.2';
const STATIC_CACHE_NAME = 'finance-static-v1.2';

// Файлы для кэширования
const urlsToCache = [
  '/',
  '/static/style.css',
  '/static/script.js',
  '/static/manifest.json',
  '/static/icon-192x192.png',
  '/static/icon-512x512.png'
];

// API эндпоинты, которые нужно кэшировать
const apiUrlsToCache = [
  '/api/health',
  '/api/init'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('🛠️ Service Worker: Установка...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('📦 Кэшируем статические файлы');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Service Worker установлен');
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Активация...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Удаляем старые кэши
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('🗑️ Удаляем старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ Service Worker активирован');
      return self.clients.claim();
    })
  );
});

// Перехват запросов
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Для API запросов используем стратегию "сеть, потом кэш"
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Клонируем ответ для кэширования
          const responseClone = response.clone();
          
          // Кэшируем только успешные ответы
          if (response.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          
          return response;
        })
        .catch(() => {
          // Если нет сети, пробуем взять из кэша
          return caches.match(event.request);
        })
    );
  } else {
    // Для статических файлов используем стратегию "кэш, потом сеть"
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          // Возвращаем из кэша если есть
          if (response) {
            return response;
          }
          
          // Иначе загружаем из сети
          return fetch(event.request)
            .then(response => {
              // Проверяем валидность ответа
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Клонируем для кэширования
              const responseToCache = response.clone();
              
              caches.open(STATIC_CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            })
            .catch(error => {
              console.log('🌐 Нет сети, возвращаем оффлайн-страницу');
              // Можно вернуть кастомную оффлайн страницу
              return caches.match('/')
                .then(response => response || new Response('Нет соединения с интернетом'));
            });
        })
    );
  }
});

// Фоновая синхронизация (если браузер поддерживает)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-transactions') {
    console.log('🔄 Фоновая синхронизация...');
    event.waitUntil(syncTransactions());
  }
});

// Push уведомления
self.addEventListener('push', event => {
  console.log('🔔 Push уведомление получено');
  
  const options = {
    body: event.data ? event.data.text() : 'Новое уведомление',
    icon: '/static/icon-192x192.png',
    badge: '/static/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Финансовый помощник', options)
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
  console.log('👆 Уведомление нажато');
  
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Вспомогательная функция для синхронизации
function syncTransactions() {
  // Здесь можно добавить логику синхронизации оффлайн-данных
  return Promise.resolve();
}