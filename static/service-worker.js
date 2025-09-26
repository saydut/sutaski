// static/service-worker.js
const CACHE_NAME = 'sut-takip-cache-v6'; // Önbellek sürümünü artırdık, bu tarayıcıyı yeni dosyaları indirmeye zorlar.
const APP_SHELL_URL = '/'; // Ana uygulama sayfamızın URL'si
const OFFLINE_URL = '/offline';

// Uygulamanın çevrimdışı çalışabilmesi için önbelleğe alınacak temel dosyalar
const ASSETS_TO_CACHE = [
    APP_SHELL_URL,
    OFFLINE_URL,
    '/static/style.css',
    '/static/theme.js',
    '/static/js/utils.js',
    '/static/js/main.js',
    '/static/js/offline.js',
    '/static/images/icon.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/css/tom-select.bootstrap5.css',
    'https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/js/tom-select.complete.min.js',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
    'https://cdn.jsdelivr.net/npm/flatpickr',
    'https://unpkg.com/dexie@3/dist/dexie.js'
];

// Service worker yüklendiğinde (install) tetiklenir
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache açıldı ve temel varlıklar önbelleğe alınıyor.');
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
    // Sadece GET isteklerini ele alıyoruz. API isteklerini pas geçiyoruz.
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    // Sayfa navigasyon istekleri için (bir sayfaya gitmeye çalışırken) özel strateji
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // Önce internetten istemeyi dene.
                    const networkResponse = await fetch(event.request);
                    return networkResponse;
                } catch (error) {
                    // İnternet yoksa veya hata oluşursa...
                    console.log('Navigasyon başarısız, önbellekten sunuluyor.', error);
                    const cache = await caches.open(CACHE_NAME);
                    // Önce ana uygulama sayfasını ('/') önbellekten sunmayı dene.
                    const cachedResponse = await cache.match(APP_SHELL_URL);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Eğer ana sayfa bile önbellekte yoksa, o zaman "offline" sayfasını göster.
                    return await cache.match(OFFLINE_URL);
                }
            })()
        );
    } else {
        // Diğer tüm varlıklar için (CSS, JS, resimler vb.) "önce önbelleğe bak" stratejisi
        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(event.request);
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Önbellekte yoksa internetten almayı dene.
                try {
                    const networkResponse = await fetch(event.request);
                    // Cevap başarılıysa gelecekte kullanmak için önbelleğe de ekle
                    if (networkResponse.ok) {
                        await cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    console.log('Varlık çekilemedi:', event.request.url, error);
                    // Bu bir resim veya stil dosyası olduğu için hata durumunda boş cevap dönüyoruz.
                }
            })()
        );
    }
});

