// static/service-worker.js
// Önbellek adını son kez güncelleyerek tarayıcının bu dosyayı yenilemesini garantiliyoruz.
const CACHE_NAME = 'sut-takip-cache-v12'; 
const APP_SHELL_URL = '/';
const LOGIN_URL = '/login';
const REGISTER_URL = '/register';
const OFFLINE_URL = '/offline';

const ASSETS_TO_CACHE = [
    APP_SHELL_URL, LOGIN_URL, REGISTER_URL, OFFLINE_URL,
    '/static/style.css', '/static/theme.js',
    '/static/js/utils.js', '/static/js/main.js', '/static/js/login.js', '/static/js/register.js', '/static/js/offline.js',
    '/static/images/icon.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/css/tom-select.bootstrap5.css',
    'https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/js/tom-select.complete.min.js',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.js', 
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/tr.js',
    'https://unpkg.com/dexie@3/dist/dexie.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2?v=1.11.3',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff?v=1.11.3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache açıldı ve temel varlıklar önbelleğe alınıyor.');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(err => console.error('Önbelleğe alma başarısız oldu:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eski cache siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// --- EN KARARLI FETCH STRATEJİSİ ---
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // Önce internetten yüklemeyi dene.
                    const networkResponse = await fetch(event.request);
                    return networkResponse;
                } catch (error) {
                    // İnternet yoksa, önbellekten ana paneli sunmayı dene.
                    console.log('Ağ hatası, önbellekten sunuluyor.', error);
                    const cache = await caches.open(CACHE_NAME);
                    const cachedResponse = await cache.match(APP_SHELL_URL);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Son çare olarak offline sayfasını göster.
                    return await cache.match(OFFLINE_URL);
                }
            })()
        );
    } else { // CSS, JS, resimler vb. için
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    // Varlık önbellekte varsa oradan, yoksa internetten yükle.
                    return response || fetch(event.request);
                })
        );
    }
});