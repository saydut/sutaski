const CACHE_NAME = 'sut-takip-cache-v2'; // Sürümü güncelledik
const OFFLINE_URL = '/offline'; // Çevrimdışı sayfamızın yolu

// Yükleme sırasında temel dosyaları ve çevrimdışı sayfasını önbelleğe al
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache açıldı ve offline sayfası önbelleğe alınıyor.');
        // Uygulamanın temel kabuğu (shell) ve offline sayfası
        return cache.addAll([
          OFFLINE_URL,
          '/static/style.css',
          '/static/theme.js'
        ]);
      })
  );
  // Yeni service worker'ın hemen aktif olmasını sağla
  self.skipWaiting();
});

// Aktivasyon sırasında eski önbellekleri temizle
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
  // Aktif olduğunda sayfaları kontrolü altına almasını sağla
  self.clients.claim();
});

// Bir istek geldiğinde (fetch)
self.addEventListener('fetch', event => {
  // Sadece sayfa navigasyon isteklerine müdahale et
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          // Önce internetten istemeyi dene
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (error) {
          // İnternet yoksa veya hata oluşursa, önbelleğe alınmış offline sayfasını göster
          console.log('İnternetten çekilemedi, offline sayfası gösteriliyor.');
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(OFFLINE_URL);
          return cachedResponse;
        }
      })()
    );
  }
  
  // Sayfa dışındaki istekler (CSS, JS, API vs.) için varsayılan davranışı uygula
  // İstersen bunları da cache'leyebilirsin ama şimdilik basit tutalım.
  return;
});