// static/service-worker.js
const CACHE_NAME = 'sut-takip-cache-v3'; // Önbellek sürümünü güncelledik
const OFFLINE_URL = '/offline';

// Uygulamanın çevrimdışı çalışabilmesi için önbelleğe alınacak temel dosyalar
const ASSETS_TO_CACHE = [
    '/', // Ana sayfa
    OFFLINE_URL,
    '/static/style.css',
    '/static/theme.js',
    '/static/js/utils.js',
    '/static/js/main.js',
    '/static/js/offline.js', // Yeni çevrimdışı dosyamız
    '/static/images/icon.png',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/css/tom-select.bootstrap5.css',
    'https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/js/tom-select.complete.min.js',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
    'https://cdn.jsdelivr.net/npm/flatpickr',
    'https://unpkg.com/dexie@3/dist/dexie.js' // Dexie kütüphanesi
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
  // Yeni service worker'ın beklemeden aktif olmasını sağlar
  self.skipWaiting();
});

// Service worker aktif olduğunda (activate) tetiklenir
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        // Eski sürüm cache'leri silerek temizlik yapar
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eski cache siliniyor:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Aktif olduğunda, kontrolü altındaki tüm sayfaları yönetmeye başlar
  self.clients.claim();
});

// Bir kaynak talebi (fetch) olduğunda tetiklenir
self.addEventListener('fetch', event => {
    // API isteklerini ve POST gibi GET dışı istekleri cache'lemiyoruz, doğrudan internete gitmelerine izin veriyoruz.
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        // event.respondWith(fetch(event.request)); // Bu satır bazen hataya neden olabilir, doğrudan return daha güvenli
        return;
    }

    // "Network falling back to cache" stratejisi: Önce internetten istemeyi dene, olmazsa cache'e bak.
    event.respondWith(
        (async () => {
            try {
                // Önce internetten istemeyi deniyoruz
                const networkResponse = await fetch(event.request);
                
                // Cevap başarılıysa, bu yeni versiyonu cache'e de kaydediyoruz
                if(networkResponse.ok){
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, networkResponse.clone());
                }
                
                return networkResponse;
            } catch (error) {
                // İnternet yoksa veya hata oluşursa, cache'den getirmeyi deniyoruz
                console.log('Ağdan çekilemedi, cache kontrol ediliyor:', event.request.url);
                const cache = await caches.open(CACHE_NAME);
                const cachedResponse = await cache.match(event.request);
                
                if (cachedResponse) {
                    return cachedResponse; // Cache'de varsa onu göster
                }

                // Eğer bu bir sayfa ziyaretiyse ve cache'de de yoksa, genel çevrimdışı sayfasını göster
                if (event.request.mode === 'navigate') {
                    const offlinePage = await cache.match(OFFLINE_URL);
                    return offlinePage;
                }
                
                // Diğer durumlarda (resim, stil vb.) bir şey döndürme
                return;
            }
        })()
    );
});
