// static/js/offline.js

// Tarayıcı veritabanını (IndexedDB) kolayca kullanmak için Dexie.js kütüphanesini hazırlıyoruz.
const db = new Dexie('sutaski_offline_db');

// Veritabanı şemasını tanımlıyoruz.
// 'sut_girdileri' adında bir tablomuz olacak ve her kaydın otomatik artan bir 'id'si olacak.
db.version(1).stores({
    sut_girdileri: '++id, tedarikci_id, litre, fiyat, eklendigi_zaman'
});

/**
 * Yeni bir süt girdisini, internet yokken yerel veritabanına kaydeder.
 * @param {object} girdi - Kaydedilecek girdi verisi (tedarikci_id, litre, fiyat).
 * @returns {boolean} - Kaydetme işleminin başarılı olup olmadığını döndürür.
 */
async function kaydetCevrimdisi(girdi) {
    try {
        // Girdiye, ne zaman eklendiğini belirtmek için bir zaman damgası ekliyoruz.
        girdi.eklendigi_zaman = new Date().toISOString();
        await db.sut_girdileri.add(girdi);
        console.log('Girdi çevrimdışı olarak kaydedildi:', girdi);
        gosterMesaj('İnternet yok. Girdi yerel olarak kaydedildi, bağlantı kurulunca gönderilecek.', 'info');
        cevrimiciDurumuGuncelle(); // Arayüzdeki durumu (bekleyen girdi sayısını) anında güncelle.
        return true;
    } catch (error) {
        console.error('Çevrimdışı kaydetme hatası:', error);
        gosterMesaj('Girdi yerel olarak kaydedilemedi. Lütfen tekrar deneyin.', 'danger');
        return false;
    }
}

/**
 * Yerel veritabanında bekleyen tüm girdileri getirir.
 * @returns {Promise<Array>} - Bekleyen girdilerin bir dizisini döndürür.
 */
async function bekleyenGirdileriGetir() {
    return await db.sut_girdileri.toArray();
}

/**
 * İnternet bağlantısı geldiğinde, yerelde bekleyen tüm girdileri sunucuya göndermeyi dener.
 */
async function senkronizeEt() {
    // Sadece çevrimiçi olduğumuzda bu fonksiyonu çalıştır.
    if (!navigator.onLine) return;

    const bekleyenGirdiler = await bekleyenGirdileriGetir();
    if (bekleyenGirdiler.length === 0) {
        console.log('Senkronize edilecek bekleyen girdi yok.');
        cevrimiciDurumuGuncelle(); // Arayüzü yine de güncelle, belki 'bekleyen' uyarısı kalmıştır.
        return;
    }

    console.log(`${bekleyenGirdiler.length} adet girdi senkronize ediliyor...`);
    gosterMesaj(`${bekleyenGirdiler.length} adet bekleyen girdi sunucuya gönderiliyor...`, 'info', 3000);

    for (const girdi of bekleyenGirdiler) {
        try {
            const response = await fetch('/api/sut_girdisi_ekle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tedarikci_id: girdi.tedarikci_id,
                    litre: girdi.litre,
                    fiyat: girdi.fiyat
                })
            });

            if (response.ok) {
                // Girdi sunucuya başarıyla gönderildiyse, yerel veritabanından siliyoruz.
                await db.sut_girdileri.delete(girdi.id);
                console.log(`Girdi (ID: ${girdi.id}) başarıyla senkronize edildi ve yerelden silindi.`);
            } else {
                const errorData = await response.json();
                console.error(`Girdi (ID: ${girdi.id}) senkronize edilemedi:`, errorData.error);
                // Sunucudan bir hata geldiyse, diğerlerini göndermeyi durdur.
                break;
            }
        } catch (error) {
            console.error('Senkronizasyon sırasında ağ hatası. Daha sonra tekrar denenecek.', error);
            // Ağ hatası olursa, şimdilik dur. İnternet tekrar geldiğinde tekrar deneriz.
            break;
        }
    }

    // Senkronizasyon denemesi sonrası arayüzü ve ana listeyi güncelle.
    await cevrimiciDurumuGuncelle();
    if (typeof girdileriGoster === 'function') {
        girdileriGoster(); // Ana sayfadaki listeyi yenile.
    }
     gosterMesaj('Senkronizasyon tamamlandı.', 'success');
}

/**
 * Arayüzdeki "Çevrimdışı" ve "Bekleyen Girdi" uyarılarını günceller.
 */
async function cevrimiciDurumuGuncelle() {
    const container = document.getElementById('offline-status-container');
    const offlineBadge = document.getElementById('offline-status-badge');
    const syncBadge = document.getElementById('sync-status-badge');
    const syncCount = document.getElementById('sync-count');

    // Elementler sayfada bulunamazsa işlemi durdur.
    if (!container || !offlineBadge || !syncBadge || !syncCount) return;

    const bekleyenSayisi = await db.sut_girdileri.count();
    syncCount.textContent = bekleyenSayisi;

    if (navigator.onLine) {
        // Çevrimiçiysek "Çevrimdışı" uyarısını gizle.
        offlineBadge.classList.add('d-none');
        if (bekleyenSayisi > 0) {
            // Ama bekleyen girdi varsa, "Bekleyen" uyarısını göster.
            syncBadge.classList.remove('d-none');
            container.classList.remove('d-none');
        } else {
            // Bekleyen girdi yoksa, tüm uyarıları gizle.
            syncBadge.classList.add('d-none');
            container.classList.add('d-none');
        }
    } else {
        // Çevrimdışıysak, her iki uyarıyı da göster.
        offlineBadge.classList.remove('d-none');
        syncBadge.classList.remove('d-none');
        container.classList.remove('d-none');
    }
}


// Tarayıcı olaylarını dinleyerek durumu otomatik yönet.
window.addEventListener('online', senkronizeEt);
window.addEventListener('offline', cevrimiciDurumuGuncelle);
// Sayfa ilk yüklendiğinde durumu kontrol et ve gerekirse senkronizasyonu başlat.
window.addEventListener('load', () => {
    cevrimiciDurumuGuncelle();
    if (navigator.onLine) {
        senkronizeEt();
    }
});
