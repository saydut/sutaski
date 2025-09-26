// static/service-worker.js
// Önbellek sürümünü artırıyoruz. Bu, tarayıcıyı yeni service worker'ı kurmaya ve dosyaları yeniden önbelleğe almaya zorlar.
const CACHE_NAME = 'sut-takip-cache-v7'; 
const APP_SHELL_URL = '/';
const LOGIN_URL = '/login'; // YENİ: Giriş sayfası URL'sini tanımlıyoruz.
const OFFLINE_URL = '/offline';

// Uygulamanın çevrimdışı çalışabilmesi için önbelleğe alınacak temel dosyalar
const ASSETS_TO_CACHE = [
    APP_SHELL_URL,
    LOGIN_URL, // YENİ: Giriş sayfasını önbelleğe ekliyoruz.
    OFFLINE_URL,
    '/static/style.css',
    '/static/theme.js',
    '/static/js/utils.js',
    '/static/js/main.js',
    '/static/js/login.js', // YENİ: Giriş sayfasının script'ini önbelleğe ekliyoruz.
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

    // GÜNCELLENDİ: Sayfa navigasyon istekleri için (bir sayfaya gitmeye çalışırken) daha akıllı bir strateji
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
                    
                    // 1. Önce istenen sayfanın kendisini önbellekte ara (örn: /login veya /tedarikciler)
                    const cachedResponse = await cache.match(event.request);
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    // 2. Eğer istenen sayfa önbellekte yoksa, kullanıcı büyük ihtimalle giriş yapmamıştır.
                    //    Bu durumda ana panel yerine giriş sayfasını göstermek daha mantıklıdır.
                    const loginPageResponse = await cache.match(LOGIN_URL);
                    if (loginPageResponse) {
                        return loginPageResponse;
                    }

                    // 3. Giriş sayfası bile önbellekte yoksa, son çare olarak genel "offline" sayfasını göster.
                    return await cache.match(OFFLINE_URL);
                }
            })()
        );
    } else {
        // Diğer tüm varlıklar için (CSS, JS, resimler vb.) "önce önbelleğe bak" stratejisi
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    return response || fetch(event.request);
                })
        );
    }
});