// static/js/offline.js (TAM VE GÜNCEL VERSİYON)

// Tarayıcı veritabanını (IndexedDB) kolayca kullanmak için Dexie.js kütüphanesini hazırlıyoruz.
const db = new Dexie('sutaski_offline_db');

// Veritabanı şemasını güncelliyoruz.
// YENİ: pending_deletions tablosunu ekliyoruz.
db.version(3).stores({
    sut_girdileri: '++id, tedarikci_id, litre, fiyat, eklendigi_zaman',
    tedarikciler: 'id, isim',
    yem_urunleri: 'id, yem_adi, stok_miktari_kg, birim_fiyat',
    pending_deletions: '++id, kayit_tipi, kayit_id' // -> Silme işlemlerini tutacak yeni tablo
}).upgrade(tx => {
    console.log("Veritabanı 3. versiyona yükseltildi ve silme tablosu eklendi.");
});


// === SÜT GİRDİSİ EKLEME İŞLEMLERİ ===

/**
 * Yeni bir süt girdisini, internet yokken yerel veritabanına kaydeder.
 * @param {object} girdi - Kaydedilecek girdi verisi (tedarikci_id, litre, fiyat).
 * @returns {boolean} - Kaydetme işleminin başarılı olup olmadığını döndürür.
 */
async function kaydetCevrimdisi(girdi) {
    try {
        girdi.eklendigi_zaman = new Date().toISOString();
        await db.sut_girdileri.add(girdi);
        gosterMesaj('İnternet yok. Girdi yerel olarak kaydedildi, bağlantı kurulunca gönderilecek.', 'info');
        cevrimiciDurumuGuncelle();
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


// === SİLME İŞLEMİ KAYDETME ===

/**
 * Bir silme işlemini, internet yokken yerel veritabanına kaydeder.
 * @param {string} kayitTipi - Silinecek kaydın türü (örn: 'yem_urunu', 'sut_girdisi').
 * @param {number} kayitId - Silinecek kaydın ID'si.
 */
async function kaydetSilmeIslemiCevrimdisi(kayitTipi, kayitId) {
    try {
        const existing = await db.pending_deletions.where({kayit_tipi: kayitTipi, kayit_id: kayitId}).first();
        if (!existing) {
             await db.pending_deletions.add({ kayit_tipi: kayitTipi, kayit_id: kayitId });
             console.log(`${kayitTipi} (ID: ${kayitId}) silme isteği çevrimdışı olarak kaydedildi.`);
             cevrimiciDurumuGuncelle();
        }
    } catch (error) {
        console.error('Çevrimdışı silme kaydı hatası:', error);
    }
}

/**
 * Yerel veritabanında bekleyen tüm silme işlemlerini getirir.
 * @returns {Promise<Array>} - Bekleyen silme işlemlerinin bir dizisini döndürür.
 */
async function bekleyenSilmeleriGetir() {
    return await db.pending_deletions.toArray();
}


// === SENKRONİZASYON (EKLEME VE SİLME İŞLEMLERİNİ İÇERİR) ===

/**
 * İnternet bağlantısı geldiğinde, yerelde bekleyen tüm işlemleri (ekleme ve silme) sunucuya gönderir.
 */
async function senkronizeEt() {
    if (!navigator.onLine) return;

    // Önce listeleri (tedarikçi, yem vb.) sunucuyla senkronize et
    Promise.all([ syncTedarikciler(), syncYemUrunleri() ]);

    // 1. Bekleyen GİRDİLERİ gönder
    const bekleyenGirdiler = await bekleyenGirdileriGetir();
    if (bekleyenGirdiler.length > 0) {
        console.log(`${bekleyenGirdiler.length} adet girdi senkronize ediliyor...`);
        gosterMesaj(`${bekleyenGirdiler.length} adet bekleyen girdi gönderiliyor...`, 'info', 3000);

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
                    await db.sut_girdileri.delete(girdi.id);
                } else {
                    console.error(`Girdi (ID: ${girdi.id}) senkronize edilemedi.`);
                    break;
                }
            } catch (error) {
                console.error('Senkronizasyon sırasında ağ hatası. Daha sonra tekrar denenecek.');
                break;
            }
        }
    }

    // 2. Bekleyen SİLMELERİ gönder
    const bekleyenSilmeler = await bekleyenSilmeleriGetir();
    if (bekleyenSilmeler.length > 0) {
        console.log(`${bekleyenSilmeler.length} adet silme işlemi senkronize ediliyor...`);
        gosterMesaj(`${bekleyenSilmeler.length} adet bekleyen silme işlemi uygulanıyor...`, 'info', 3000);
        
        const endpointMap = {
            'yem_urunu': '/yem/api/urunler/',
            'sut_girdisi': '/api/sut_girdisi_sil/'
            // Buraya gelecekte başka silme türleri eklenebilir
        };

        for (const silme of bekleyenSilmeler) {
            const endpoint = endpointMap[silme.kayit_tipi];
            if (!endpoint) continue;

            const url = endpoint + silme.kayit_id;

            try {
                const response = await fetch(url, { method: 'DELETE' });
                // 404 (Not Found) hatası da başarılı sayılır, çünkü bu, kaydın sunucuda zaten silinmiş olduğu anlamına gelir.
                if (response.ok || response.status === 404) {
                    await db.pending_deletions.delete(silme.id);
                    console.log(`Silme (${silme.kayit_tipi} ID: ${silme.kayit_id}) senkronize edildi.`);
                } else { 
                    console.error(`Silme işlemi (ID: ${silme.kayit_id}) senkronize edilemedi.`);
                    break; 
                }
            } catch (error) { 
                console.error('Silme senkronizasyonu sırasında ağ hatası.');
                break; 
            }
        }
    }


    // 3. Arayüzü güncelle
    await cevrimiciDurumuGuncelle();
    
    // Hangi sayfada olduğumuzu kontrol edip ilgili listeyi yenileyelim
    if (typeof girdileriGoster === 'function' && window.location.pathname === '/') {
        girdileriGoster(); 
    }
    if (typeof yemListesiniGoster === 'function' && window.location.pathname.includes('/yem/yonetim')) {
        yemListesiniGoster(1);
    }
    
    if (bekleyenGirdiler.length > 0 || bekleyenSilmeler.length > 0) {
        gosterMesaj('Senkronizasyon tamamlandı.', 'success');
    } else {
        console.log("Senkronize edilecek bir şey yok.");
    }
}


// === ARAYÜZ GÜNCELLEME ===
/**
 * Arayüzdeki "Çevrimdışı" ve "Bekleyen İşlem" uyarılarını günceller.
 */
async function cevrimiciDurumuGuncelle() {
    const container = document.getElementById('offline-status-container');
    const offlineBadge = document.getElementById('offline-status-badge');
    const syncBadge = document.getElementById('sync-status-badge');
    const syncCount = document.getElementById('sync-count');

    if (!container || !offlineBadge || !syncBadge || !syncCount) return;

    const bekleyenGirdiSayisi = await db.sut_girdileri.count();
    const bekleyenSilmeSayisi = await db.pending_deletions.count();
    const toplamBekleyen = bekleyenGirdiSayisi + bekleyenSilmeSayisi;

    syncCount.textContent = toplamBekleyen;

    if (navigator.onLine) {
        offlineBadge.classList.add('d-none');
        if (toplamBekleyen > 0) {
            syncBadge.classList.remove('d-none');
            container.classList.remove('d-none');
        } else {
            syncBadge.classList.add('d-none');
            container.classList.add('d-none');
        }
    } else {
        offlineBadge.classList.remove('d-none');
        if (toplamBekleyen > 0) {
            syncBadge.classList.remove('d-none');
        } else {
            syncBadge.classList.add('d-none');
        }
        container.classList.remove('d-none');
    }
}


// === ÖNBELLEKLEME FONKSİYONLARI ===
/**
 * API'den gelen tedarikçi listesini yerel veritabanına kaydeder.
 */
async function syncTedarikciler() {
    try {
        const tedarikciler = await api.fetchTedarikciler();
        await db.transaction('rw', db.tedarikciler, async () => {
            await db.tedarikciler.clear();
            await db.tedarikciler.bulkAdd(tedarikciler);
        });
        return tedarikciler;
    } catch (error) {
        console.error("Tedarikçiler yerel veritabanına kaydedilemedi:", error);
        return [];
    }
}

/**
 * API'den gelen yem ürünleri listesini yerel veritabanına kaydeder.
 */
async function syncYemUrunleri() {
    try {
        const yemUrunleri = await api.fetchYemUrunleri();
        await db.transaction('rw', db.yem_urunleri, async () => {
            await db.yem_urunleri.clear();
            await db.yem_urunleri.bulkAdd(yemUrunleri);
        });
        return yemUrunleri;
    } catch (error) {
        console.error("Yem ürünleri yerel veritabanına kaydedilemedi:", error);
        return [];
    }
}

/**
 * Çevrimdışı modda, yerel veritabanından tedarikçi listesini getirir.
 */
async function getOfflineTedarikciler() {
    return await db.tedarikciler.toArray();
}

/**
 * Çevrimdışı modda, yerel veritabanından yem ürünleri listesini getirir.
 */
async function getOfflineYemUrunleri() {
     return await db.yem_urunleri.toArray();
}

// Tarayıcı olaylarını dinleyerek durumu otomatik yönet.
window.addEventListener('online', senkronizeEt);
window.addEventListener('offline', cevrimiciDurumuGuncelle);
window.addEventListener('load', () => {
    cevrimiciDurumuGuncelle();
    if (navigator.onLine) {
        senkronizeEt();
    }
});