// static/service-worker.js
// Önbellek adını son kez güncelleyerek tarayıcının bu dosyayı yenilemesini garantiliyoruz.
const CACHE_NAME = 'sut-takip-cache-v13'; 
const APP_SHELL_URL = '/';
const LOGIN_URL = '/login';
const OFFLINE_URL = '/offline';

const ASSETS_TO_CACHE = [
    // APP_SHELL_URL'i buradan çıkarıyoruz çünkü onu özel başlıkla ayrıca önbelleğe alacağız.
    LOGIN_URL, OFFLINE_URL,
    '/static/style.css', '/static/theme.js',
    '/static/js/utils.js', '/static/js/main.js', '/static/js/login.js', '/static/js/offline.js',
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
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/fonts/bootstrap-icons.woff2?v=1.11.3'
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      console.log('Cache açıldı ve temel varlıklar önbelleğe alınıyor.');
      
      // Ana uygulama kabuğunu özel başlıkla talep et
      const appShellRequest = new Request(APP_SHELL_URL, {
        headers: { 'X-Cache-Me': 'true' }
      });
      try {
        await cache.add(appShellRequest);
      } catch (error) {
        console.error('Uygulama kabuğu önbelleğe alınamadı:', error);
      }

      // Diğer tüm varlıkları normal şekilde ekle
      await cache.addAll(ASSETS_TO_CACHE);
    })()
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
                    console.log('Ağ hatası, önbellekten sunuluyor.', error);
                    const cache = await caches.open(CACHE_NAME);
                    
                    // İstenen sayfa önbellekte varsa onu, yoksa ana kabuğu, o da yoksa offline sayfasını ver
                    const cachedResponse = await cache.match(event.request);
                    return cachedResponse || await cache.match(APP_SHELL_URL) || await cache.match(OFFLINE_URL);
                }
            })()
        );
    } else {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request);
            })
        );
    }
});

