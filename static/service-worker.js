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

// --- GÜNCELLENMİŞ FETCH STRATEJİSİ ---
self.addEventListener('fetch', event => {
    // API çağrılarını ve GET olmayan istekleri yoksay
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    // Gezinme istekleri için (sayfa yüklemeleri)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(async () => {
                // Ağ hatası olduğunda (çevrimdışı olunduğunda) bu blok çalışır.
                console.log('Ağ hatası, önbellekten sunuluyor.', event.request.url);
                const cache = await caches.open(CACHE_NAME);
                
                // Hangi sayfaya gidilmeye çalışılırsa çalışılsın,
                // çevrimdışıysak ana uygulama arayüzünü (index.html) sun.
                // Bu, kullanıcının daha önce giriş yapmış olduğu varsayımıyla
                // uygulamayı çevrimdışı modda açmasını sağlar.
                const cachedResponse = await cache.match(APP_SHELL_URL);

                // Eğer ana arayüz önbellekte varsa onu döndür, yoksa son çare olarak
                // genel çevrimdışı sayfasını göster.
                return cachedResponse || await cache.match(OFFLINE_URL);
            })
        );
    } else {
        // Diğer varlıklar için (CSS, JS, resimler vb.) "önbellek öncelikli" stratejisi
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                // Önbellekte varsa hemen döndür, yoksa ağdan getirmeyi dene.
                return cachedResponse || fetch(event.request);
            })
        );
    }
});