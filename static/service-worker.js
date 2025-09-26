// static/service-worker.js
// Tarayıcının bu yeni dosyayı KESİNLİKLE kurmasını sağlamak için sürümü artırıyoruz.
const CACHE_NAME = 'sut-takip-cache-v11'; 
const APP_SHELL_URL = '/';
const LOGIN_URL = '/login';
const REGISTER_URL = '/register';
const OFFLINE_URL = '/offline';

// Uygulamanın çevrimdışı çalışabilmesi için önbelleğe alınacak temel dosyalar
const ASSETS_TO_CACHE = [
    // Temel Sayfalar
    APP_SHELL_URL,
    LOGIN_URL,
    REGISTER_URL,
    OFFLINE_URL,
    
    // Temel Stil ve Scriptler
    '/static/style.css',
    '/static/theme.js',
    '/static/js/utils.js',
    '/static/js/main.js',
    '/static/js/login.js',
    '/static/js/register.js',
    '/static/js/offline.js',
    '/static/images/icon.png',
    
    // CDN Dosyaları (Kütüphaneler)
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/css/tom-select.bootstrap5.css',
    'https://cdn.jsdelivr.net/npm/tom-select@2.3.1/dist/js/tom-select.complete.min.js',
    
    // --- DÜZELTME BURADA: flatpickr CDN adresleri birleştirildi ve düzeltildi ---
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.js', 
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/tr.js',

    'https://unpkg.com/dexie@3/dist/dexie.js',
    
    // İKON FONT DOSYALARI
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
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(err => {
        console.error('Önbelleğe alma başarısız oldu:', err);
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
    // Sadece GET isteklerini ve API dışı istekleri dikkate al
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    // Sayfa navigasyonları için (yeni bir sayfa açıldığında)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // Önce internetten yüklemeyi dene
                    const networkResponse = await fetch(event.request);
                    return networkResponse;
                } catch (error) {
                    // İnternet yoksa veya sunucuya ulaşılamıyorsa
                    console.log('Navigasyon başarısız, çevrimdışı sayfası sunuluyor.', error);
                    const cache = await caches.open(CACHE_NAME);
                    // Doğrudan çevrimdışı sayfasını göster
                    return await cache.match(OFFLINE_URL);
                }
            })()
        );
    } else { // Diğer tüm varlıklar için (CSS, JS, resimler vb.)
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    // Varlık önbellekte varsa oradan, yoksa internetten yükle
                    return response || fetch(event.request);
                })
        );
    }
});