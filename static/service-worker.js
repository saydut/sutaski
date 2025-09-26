// static/service-worker.js
// Tarayıcının bu yeni dosyayı kesinlikle kurmasını sağlamak için sürümü bir kez daha artırıyoruz.
const CACHE_NAME = 'sut-takip-cache-v8'; 
const APP_SHELL_URL = '/';
const LOGIN_URL = '/login';
const OFFLINE_URL = '/offline';

// Uygulamanın çevrimdışı çalışabilmesi için önbelleğe alınacak temel dosyalar
const ASSETS_TO_CACHE = [
    APP_SHELL_URL,
    LOGIN_URL,
    OFFLINE_URL,
    '/static/style.css',
    '/static/theme.js',
    '/static/js/utils.js',
    '/static/js/main.js',
    '/static/js/login.js',
    '/static/js/offline.js',
    '/static/images/icon.png',
    // --- CDN DOSYALARI ---
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/css/tom-select.bootstrap5.css',
    'https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/js/tom-select.complete.min.js',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
    'https://cdn.jsdelivr.net/npm/flatpickr',
    'https://unpkg.com/dexie@3/dist/dexie.js',
    
    // YENİ EKLENEN İKON DOSYALARI (SORUNUN ÇÖZÜMÜ)
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2?v=1.11.3',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff?v=1.11.3'
];

// Service worker yüklendiğinde (install) tetiklenir
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache açıldı ve temel varlıklar önbelleğe alınıyor.');
        // addAll atomik bir işlemdir. Biri bile başarısız olursa, hiçbiri eklenmez.
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

// Service worker aktif olduğunda (activate) tetiklenir
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

// Bir kaynak talebi (fetch) olduğunda tetiklenir
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    const networkResponse = await fetch(event.request);
                    return networkResponse;
                } catch (error) {
                    console.log('Navigasyon başarısız, önbellekten sunuluyor.', error);
                    const cache = await caches.open(CACHE_NAME);
                    const cachedResponse = await cache.match(event.request);
                    if (cachedResponse) return cachedResponse;
                    const loginPageResponse = await cache.match(LOGIN_URL);
                    if (loginPageResponse) return loginPageResponse;
                    return await cache.match(OFFLINE_URL);
                }
            })()
        );
    } else {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    return response || fetch(event.request);
                })
        );
    }
});