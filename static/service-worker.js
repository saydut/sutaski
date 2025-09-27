// static/service-worker.js
// Önbellek adını son bir kez güncelleyerek tarayıcının bu dosyayı yenilemesini garantiliyoruz.
const CACHE_NAME = 'sut-takip-cache-v14'; 
const APP_SHELL_URL = '/';
const LOGIN_URL = '/login';
const OFFLINE_URL = '/offline';

// Önbelleğe alınacak tüm temel varlıkların listesi
const ASSETS_TO_CACHE = [
    APP_SHELL_URL, // Ana uygulama kabuğu (index.html)
    LOGIN_URL, 
    OFFLINE_URL,
    '/static/style.css', 
    '/static/theme.js',
    '/static/js/utils.js', 
    '/static/js/main.js', 
    '/static/js/login.js', 
    '/static/js/offline.js',
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

// 1. Yükleme (Install) Adımı: Gerekli tüm dosyaları önbelleğe al
self.addEventListener('install', event => {
  console.log('[Service Worker] Install event in progress.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell and core assets.');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(error => {
        console.error('[Service Worker] Caching failed:', error);
      })
  );
  self.skipWaiting();
});

// 2. Aktifleştirme (Activate) Adımı: Eski önbellekleri temizle
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate event in progress.');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Getirme (Fetch) Adımı: Gelen isteklere nasıl cevap verileceğini belirle
self.addEventListener('fetch', event => {
  // API isteklerini ve POST gibi GET olmayan istekleri görmezden gel
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // Strateji 1: Uygulama içi sayfa gezintileri için (Uygulamayı ilk açılış dahil)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Önce internetten en güncel halini getirmeyi dene
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          // İnternet yoksa veya hata olursa, önbelleğe dön
          console.log('[Service Worker] Navigation failed, serving App Shell from cache.');
          const cache = await caches.open(CACHE_NAME);
          // Ana uygulama kabuğunu (index.html) bul ve onu göster
          const cachedResponse = await cache.match(APP_SHELL_URL);
          // Eğer o da bir şekilde yoksa, en son çare offline sayfasını göster
          return cachedResponse || await cache.match(OFFLINE_URL);
        }
      })()
    );
  } 
  // Strateji 2: Diğer tüm istekler için (CSS, JS, Resimler, Fontlar)
  else {
    event.respondWith(
      // Önce önbellekte var mı diye kontrol et (Cache First)
      caches.match(event.request).then(cachedResponse => {
        // Varsa, direkt önbellekten ver, çok hızlı çalışsın
        if (cachedResponse) {
          return cachedResponse;
        }
        // Yoksa, internetten getirmeyi dene
        return fetch(event.request);
      })
    );
  }
});