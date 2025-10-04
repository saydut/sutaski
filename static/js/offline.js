// static/js/offline.js DOSYASININ TAM VE EKSİKSİZ GÜNCEL HALİ

const db = new Dexie('sutaski_offline_db');

// Veritabanı şemasını tanımlıyoruz.
// Versiyonu 4'e yükseltip 'yeni_tedarikciler_offline' tablosunu ekliyoruz.
db.version(4).stores({
    sut_girdileri: '++id, tedarikci_id, litre, fiyat, eklendigi_zaman',
    tedarikciler: 'id, isim', // Bu tablo sunucudan gelen listenin önbelleğidir.
    yem_urunleri: 'id, yem_adi, stok_miktari_kg, birim_fiyat',
    finansal_islemler: '++id, islem_tipi, tedarikci_id, tutar, aciklama, islem_tarihi',
    yeni_tedarikciler_offline: '++id, isim, tc_no, telefon_no, adres' // YENİ TABLO: Sadece offline oluşturulanlar için.
}).upgrade(tx => {
    console.log("Veritabanı 4. versiyona yükseltildi ve yeni_tedarikciler_offline tablosu eklendi.");
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
        gosterMesaj('İnternet yok. Süt girdisi yerel olarak kaydedildi.', 'info');
        await cevrimiciDurumuGuncelle();
        return true;
    } catch (error) {
        console.error('Çevrimdışı süt girdisi kaydetme hatası:', error);
        gosterMesaj('Süt girdisi yerel olarak kaydedilemedi.', 'danger');
        return false;
    }
}

/**
 * Yeni bir finansal işlemi, internet yokken yerel veritabanına kaydeder.
 * @param {object} islem - Kaydedilecek işlem verisi.
 * @returns {Promise<boolean>}
 */
async function kaydetCevrimdisiFinansIslemi(islem) {
    try {
        if (!islem.islem_tarihi) islem.islem_tarihi = new Date().toISOString();
        await db.finansal_islemler.add(islem);
        gosterMesaj('İnternet yok. Finansal işlem yerel olarak kaydedildi.', 'info');
        await cevrimiciDurumuGuncelle();
        return true;
    } catch (error) {
        console.error('Çevrimdışı finansal işlem kaydetme hatası:', error);
        gosterMesaj('Finansal işlem yerel olarak kaydedilemedi.', 'danger');
        return false;
    }
}

/**
 * YENİ FONKSİYON: Yeni bir tedarikçiyi, internet yokken yerel veritabanına kaydeder.
 * @param {object} tedarikci - Kaydedilecek tedarikçi verisi.
 * @returns {Promise<boolean>}
 */
async function kaydetCevrimdisiYeniTedarikci(tedarikci) {
    try {
        await db.yeni_tedarikciler_offline.add(tedarikci);
        console.log('Yeni tedarikçi çevrimdışı olarak kaydedildi:', tedarikci);
        gosterMesaj('İnternet yok. Yeni tedarikçi yerel olarak kaydedildi, bağlantı kurulunca gönderilecek.', 'info');
        await cevrimiciDurumuGuncelle();
        return true;
    } catch (error) {
        console.error('Çevrimdışı yeni tedarikçi kaydetme hatası:', error);
        gosterMesaj('Yeni tedarikçi yerel olarak kaydedilemedi.', 'danger');
        return false;
    }
}

/**
 * Yerel veritabanında bekleyen tüm kayıtları getirir.
 */
async function bekleyenKayitlariGetir() {
    const sutGirdileri = await db.sut_girdileri.toArray();
    const finansIslemleri = await db.finansal_islemler.toArray();
    const yeniTedarikciler = await db.yeni_tedarikciler_offline.toArray();
    return {
        sut: sutGirdileri,
        finans: finansIslemleri,
        tedarikci: yeniTedarikciler
    };
}


// --- VERİ SENKRONİZASYON VE ÖNBELLEKLEME FONKSİYONLARI ---

async function senkronizeEt() {
    if (!navigator.onLine) return;

    // Arka planda listeleri güncellemeye başla
    Promise.all([ syncTedarikciler(), syncYemUrunleri() ]);

    const bekleyenKayitlar = await bekleyenKayitlariGetir();
    const toplamBekleyen = bekleyenKayitlar.sut.length + bekleyenKayitlar.finans.length + bekleyenKayitlar.tedarikci.length;

    if (toplamBekleyen === 0) {
        cevrimiciDurumuGuncelle();
        return;
    }

    gosterMesaj(`${toplamBekleyen} adet bekleyen kayıt sunucuya gönderiliyor...`, 'info', 3000);

    let senkronizasyonBasarili = true;

    // ÖNCE YENİ TEDARİKÇİLERİ GÖNDER
    for (const tedarikci of bekleyenKayitlar.tedarikci) {
        try {
            await api.postYeniTedarikci(tedarikci);
            await db.yeni_tedarikciler_offline.delete(tedarikci.id);
            console.log(`Yeni Tedarikçi (Yerel ID: ${tedarikci.id}) başarıyla senkronize edildi.`);
        } catch (error) {
            console.error(`Yeni Tedarikçi (ID: ${tedarikci.id}) senkronize edilemedi:`, error);
            senkronizasyonBasarili = false;
            break;
        }
    }
    
    // SONRA SÜT GİRDİLERİNİ GÖNDER
    if (senkronizasyonBasarili) {
        for (const girdi of bekleyenKayitlar.sut) {
            try {
                const apiVerisi = { tedarikci_id: girdi.tedarikci_id, litre: girdi.litre, fiyat: girdi.fiyat };
                await api.postSutGirdisi(apiVerisi);
                await db.sut_girdileri.delete(girdi.id);
                console.log(`Süt Girdisi (ID: ${girdi.id}) başarıyla senkronize edildi.`);
            } catch (error) {
                console.error(`Süt Girdisi (ID: ${girdi.id}) senkronize edilemedi:`, error);
                senkronizasyonBasarili = false;
                break;
            }
        }
    }
    
    // SONRA FİNANSAL İŞLEMLERİ GÖNDER
    if (senkronizasyonBasarili) {
        for (const islem of bekleyenKayitlar.finans) {
            try {
                const apiVerisi = { ...islem, islem_tarihi: new Date(islem.islem_tarihi).toISOString().slice(0, 19).replace('T', ' ') };
                delete apiVerisi.id;
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

    // Senkronizasyon sonrası tüm listeleri yeniden çekelim ki her şey güncel olsun
    if(senkronizasyonBasarili && toplamBekleyen > 0) {
        console.log("Senkronizasyon sonrası listeler güncelleniyor...");
        await syncTedarikciler(); // Tedarikçi listesini tazeleyelim
    }

    await cevrimiciDurumuGuncelle();
    if (senkronizasyonBasarili) {
        gosterMesaj('Senkronizasyon tamamlandı.', 'success');
        if (typeof girdileriGoster === 'function') girdileriGoster();
        if (typeof finansalIslemleriYukle === 'function') finansalIslemleriYukle(1);
        if (typeof verileriYukle === 'function') verileriYukle(1); // Tedarikçiler sayfasını yenile
    } else {
        gosterMesaj('Senkronizasyon sırasında bir hata oluştu. Bazı kayıtlar gönderilemedi.', 'warning');
    }
}


// --- MEVCUT LİSTELERİ ÖNBELLEKLEME FONKSİYONLARI ---
async function syncTedarikciler() {
    try {
        const tedarikciler = await api.fetchTedarikciler();
        await db.transaction('rw', db.tedarikciler, async () => {
            await db.tedarikciler.clear();
            await db.tedarikciler.bulkAdd(tedarikciler);
        });
        console.log(`${tedarikciler.length} tedarikçi yerel veritabanına kaydedildi.`);
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
        console.log(`${yemUrunleri.length} yem ürünü yerel veritabanına kaydedildi.`);
        return yemUrunleri;
    } catch (error) {
        console.error("Yem ürünleri yerel veritabanına kaydedilemedi:", error);
        return [];
    }
}

async function getOfflineTedarikciler() {
    const tedarikciler = await db.tedarikciler.toArray();
    console.log(`Yerel veritabanından ${tedarikciler.length} tedarikçi okundu.`);
    return tedarikciler;
}

async function getOfflineYemUrunleri() {
     const yemler = await db.yem_urunleri.toArray();
     console.log(`Yerel veritabanından ${yemler.length} yem ürünü okundu.`);
     return yemler;
}

// --- ARAYÜZ GÜNCELLEME ---

async function cevrimiciDurumuGuncelle() {
    const container = document.getElementById('offline-status-container');
    const offlineBadge = document.getElementById('offline-status-badge');
    const syncBadge = document.getElementById('sync-status-badge');
    const syncCount = document.getElementById('sync-count');

    if (!container || !syncCount) return;

    const bekleyenSutSayisi = await db.sut_girdileri.count();
    const bekleyenFinansSayisi = await db.finansal_islemler.count();
    const bekleyenTedarikciSayisi = await db.yeni_tedarikciler_offline.count();
    const toplamBekleyen = bekleyenSutSayisi + bekleyenFinansSayisi + bekleyenTedarikciSayisi;
    
    syncCount.textContent = toplamBekleyen;

    if (navigator.onLine) {
        if(offlineBadge) offlineBadge.classList.add('d-none');
        if (toplamBekleyen > 0) {
            if(syncBadge) syncBadge.classList.remove('d-none');
            container.classList.remove('d-none');
        } else {
            if(syncBadge) syncBadge.classList.add('d-none');
            container.classList.add('d-none');
        }
    } else {
        if(offlineBadge) offlineBadge.classList.remove('d-none');
        if(syncBadge) syncBadge.classList.remove('d-none');
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