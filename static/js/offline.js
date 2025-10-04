// static/js/offline.js DOSYASININ YENİ VE GÜNCELLENMİŞ HALİ

// Tarayıcı veritabanını (IndexedDB) kolayca kullanmak için Dexie.js kütüphanesini hazırlıyoruz.
const db = new Dexie('sutaski_offline_db');

// Veritabanı şemasını tanımlıyoruz.
// Versiyonu 3'e yükseltip 'finansal_islemler' tablosunu ekliyoruz.
db.version(3).stores({
    sut_girdileri: '++id, tedarikci_id, litre, fiyat, eklendigi_zaman',
    tedarikciler: 'id, isim',
    yem_urunleri: 'id, yem_adi, stok_miktari_kg, birim_fiyat',
    finansal_islemler: '++id, islem_tipi, tedarikci_id, tutar, aciklama, islem_tarihi' // YENİ TABLO
}).upgrade(tx => {
    console.log("Veritabanı 3. versiyona yükseltildi ve finansal_islemler tablosu eklendi.");
});

// --- ÇEVRİMDIŞI KAYDETME FONKSİYONLARI ---

/**
 * Yeni bir süt girdisini, internet yokken yerel veritabanına kaydeder.
 * @param {object} girdi - Kaydedilecek girdi verisi.
 * @returns {Promise<boolean>}
 */
async function kaydetCevrimdisiSutGirdisi(girdi) {
    try {
        girdi.eklendigi_zaman = new Date().toISOString();
        await db.sut_girdileri.add(girdi);
        console.log('Süt girdisi çevrimdışı olarak kaydedildi:', girdi);
        gosterMesaj('İnternet yok. Süt girdisi yerel olarak kaydedildi, bağlantı kurulunca gönderilecek.', 'info');
        await cevrimiciDurumuGuncelle();
        return true;
    } catch (error) {
        console.error('Çevrimdışı süt girdisi kaydetme hatası:', error);
        gosterMesaj('Süt girdisi yerel olarak kaydedilemedi.', 'danger');
        return false;
    }
}

/**
 * YENİ FONKSİYON: Yeni bir finansal işlemi, internet yokken yerel veritabanına kaydeder.
 * @param {object} islem - Kaydedilecek işlem verisi.
 * @returns {Promise<boolean>}
 */
async function kaydetCevrimdisiFinansIslemi(islem) {
    try {
        // Eğer işlem tarihi belirtilmemişse, şimdiki zamanı ata
        if (!islem.islem_tarihi) {
            islem.islem_tarihi = new Date().toISOString();
        }
        await db.finansal_islemler.add(islem);
        console.log('Finansal işlem çevrimdışı olarak kaydedildi:', islem);
        gosterMesaj('İnternet yok. Finansal işlem yerel olarak kaydedildi, bağlantı kurulunca gönderilecek.', 'info');
        await cevrimiciDurumuGuncelle();
        return true;
    } catch (error) {
        console.error('Çevrimdışı finansal işlem kaydetme hatası:', error);
        gosterMesaj('Finansal işlem yerel olarak kaydedilemedi.', 'danger');
        return false;
    }
}

/**
 * Yerel veritabanında bekleyen tüm girdileri getirir.
 * @returns {Promise<{sut: Array, finans: Array}>}
 */
async function bekleyenKayitlariGetir() {
    const sutGirdileri = await db.sut_girdileri.toArray();
    const finansIslemleri = await db.finansal_islemler.toArray();
    return {
        sut: sutGirdileri,
        finans: finansIslemleri
    };
}


// --- VERİ SENKRONİZASYON VE ÖNBELLEKLEME FONKSİYONLARI ---

/**
 * İnternet bağlantısı geldiğinde, yerelde bekleyen tüm kayıtları sunucuya göndermeyi dener.
 */
async function senkronizeEt() {
    if (!navigator.onLine) return;

    // Listeleri sunucuyla senkronize et
    Promise.all([
        syncTedarikciler(),
        syncYemUrunleri()
    ]);

    const bekleyenKayitlar = await bekleyenKayitlariGetir();
    const toplamBekleyen = bekleyenKayitlar.sut.length + bekleyenKayitlar.finans.length;

    if (toplamBekleyen === 0) {
        console.log('Senkronize edilecek bekleyen kayıt yok.');
        cevrimiciDurumuGuncelle();
        return;
    }

    console.log(`${toplamBekleyen} adet kayıt senkronize ediliyor...`);
    gosterMesaj(`${toplamBekleyen} adet bekleyen kayıt sunucuya gönderiliyor...`, 'info', 3000);

    let senkronizasyonBasarili = true;

    // Önce Süt Girdilerini Senkronize Et
    for (const girdi of bekleyenKayitlar.sut) {
        try {
            const response = await api.postSutGirdisi({
                tedarikci_id: girdi.tedarikci_id,
                litre: girdi.litre,
                fiyat: girdi.fiyat
            });
            await db.sut_girdileri.delete(girdi.id);
            console.log(`Süt Girdisi (ID: ${girdi.id}) başarıyla senkronize edildi.`);
        } catch (error) {
            console.error(`Süt Girdisi (ID: ${girdi.id}) senkronize edilemedi:`, error);
            senkronizasyonBasarili = false;
            break; 
        }
    }

    // YENİ BLOK: Finansal İşlemleri Senkronize Et (Eğer süt senkronizasyonu başarılıysa devam et)
    if (senkronizasyonBasarili) {
        for (const islem of bekleyenKayitlar.finans) {
            try {
                // Sunucuya göndereceğimiz veri, formdan gelenle aynı yapıda olmalı
                const apiVerisi = {
                    islem_tipi: islem.islem_tipi,
                    tedarikci_id: islem.tedarikci_id,
                    tutar: islem.tutar,
                    islem_tarihi: new Date(islem.islem_tarihi).toISOString().slice(0, 19).replace('T', ' '),
                    aciklama: islem.aciklama
                };
                // 'api.js' içinde bu fonksiyonu oluşturacağız
                await api.postFinansIslemi(apiVerisi); 
                await db.finansal_islemler.delete(islem.id);
                console.log(`Finansal İşlem (ID: ${islem.id}) başarıyla senkronize edildi.`);
            } catch (error) {
                console.error(`Finansal İşlem (ID: ${islem.id}) senkronize edilemedi:`, error);
                senkronizasyonBasarili = false;
                break;
            }
        }
    }


    await cevrimiciDurumuGuncelle();
    if (senkronizasyonBasarili) {
        gosterMesaj('Senkronizasyon tamamlandı.', 'success');
        // İlgili sayfalardaki listeleri yenilemek için fonksiyonları çağır
        if (typeof girdileriGoster === 'function') girdileriGoster();
        if (typeof finansalIslemleriYukle === 'function') finansalIslemleriYukle(1);
    } else {
        gosterMesaj('Senkronizasyon sırasında bir hata oluştu. Bazı kayıtlar gönderilemedi.', 'warning');
    }
}


// --- API LİSTE SENKRONİZASYON FONKSİYONLARI (Değişiklik yok) ---

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

async function getOfflineTedarikciler() {
    return await db.tedarikciler.toArray();
}

async function getOfflineYemUrunleri() {
     return await db.yem_urunleri.toArray();
}

// --- ARAYÜZ GÜNCELLEME ---

/**
 * Arayüzdeki "Çevrimdışı" ve "Bekleyen Girdi" uyarılarını günceller.
 */
async function cevrimiciDurumuGuncelle() {
    const container = document.getElementById('offline-status-container');
    const offlineBadge = document.getElementById('offline-status-badge');
    const syncBadge = document.getElementById('sync-status-badge');
    const syncCount = document.getElementById('sync-count');

    if (!container || !offlineBadge || !syncBadge || !syncCount) return;

    // TOPLAM bekleyen sayısını hesapla
    const bekleyenSutSayisi = await db.sut_girdileri.count();
    const bekleyenFinansSayisi = await db.finansal_islemler.count();
    const toplamBekleyen = bekleyenSutSayisi + bekleyenFinansSayisi;
    
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
        syncBadge.classList.remove('d-none');
        container.classList.remove('d-none');
    }
}

// --- OLAY DİNLEYİCİLERİ ---
window.addEventListener('online', senkronizeEt);
window.addEventListener('offline', cevrimiciDurumuGuncelle);
window.addEventListener('load', () => {
    cevrimiciDurumuGuncelle();
    if (navigator.onLine) {
        senkronizeEt();
    }
});