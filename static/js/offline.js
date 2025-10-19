// static/js/offline.js (ARKA PLAN SENKRONİZASYONU VE ÇATIŞMA ÖNLEME EKLENDİ)

const db = new Dexie('sutaski_offline_db');

// Veritabanı şemasını son versiyona güncelliyoruz.
db.version(6).stores({
    sut_girdileri: '++id, tedarikci_id, litre, fiyat, eklendigi_zaman',
    pending_tedarikciler: '++id, isim, tc_no, telefon_no, adres',
    pending_finans_islemleri: '++id, islem_tipi, tedarikci_id, tutar, islem_tarihi, aciklama',
    pending_yem_urunleri: '++id, yem_adi, stok_miktari_kg, birim_fiyat', // YENİ
    pending_yem_islemleri: '++id, tedarikci_id, yem_urun_id, miktar_kg, aciklama', // YENİ
    tedarikciler: 'id, isim',
    yem_urunleri: 'id, yem_adi, stok_miktari_kg, birim_fiyat',
    pending_deletions: '++id, [kayit_tipi+kayit_id]' // Silme işlemlerinin tekrarını önlemek için bileşik anahtar
});


// === YENİ: Arka Plan Senkronizasyonunu Kaydet ===
async function registerBackgroundSync() {
    // Service Worker ve SyncManager desteği varsa arka plan senkronizasyonu için kayıt ol.
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-new-data');
            console.log('Arka plan senkronizasyonu için kayıt yapıldı.');
        } catch (error) {
            console.error('Arka plan senkronizasyonu kaydedilemedi:', error);
        }
    }
}

// === ÇEVRİMDIŞI KAYIT FONKSİYONLARI (GÜNCELLENDİ) ===

async function kaydetCevrimdisi(girdi) {
    try {
        girdi.eklendigi_zaman = new Date().toISOString();
        await db.sut_girdileri.add(girdi);
        gosterMesaj('İnternet yok. Girdi yerel olarak kaydedildi.', 'info');
        cevrimiciDurumuGuncelle();
        registerBackgroundSync(); // Arka plan senkronizasyonunu tetikle
        return true;
    } catch (error) {
        console.error('Çevrimdışı süt girdisi kaydetme hatası:', error);
        gosterMesaj('Girdi yerel olarak kaydedilemedi.', 'danger');
        return false;
    }
}

async function kaydetTedarikciCevrimdisi(tedarikci) {
    try {
        await db.pending_tedarikciler.add(tedarikci);
        gosterMesaj('İnternet yok. Yeni tedarikçi yerel olarak kaydedildi.', 'info');
        cevrimiciDurumuGuncelle();
        registerBackgroundSync();
        return true;
    } catch (error) {
        console.error('Çevrimdışı tedarikçi kaydetme hatası:', error);
        gosterMesaj('Tedarikçi yerel olarak kaydedilemedi.', 'danger');
        return false;
    }
}

async function kaydetFinansIslemiCevrimdisi(islem) {
    try {
        await db.pending_finans_islemleri.add(islem);
        gosterMesaj('İnternet yok. Finansal işlem yerel olarak kaydedildi.', 'info');
        cevrimiciDurumuGuncelle();
        registerBackgroundSync();
        return true;
    } catch (error) {
        console.error('Çevrimdışı finans işlemi kaydetme hatası:', error);
        gosterMesaj('Finansal işlem yerel olarak kaydedilemedi.', 'danger');
        return false;
    }
}

async function kaydetYeniYemUrunuCevrimdisi(urun) {
    try {
        await db.pending_yem_urunleri.add(urun);
        gosterMesaj('İnternet yok. Yeni yem ürünü yerel olarak kaydedildi.', 'info');
        cevrimiciDurumuGuncelle();
        registerBackgroundSync();
        return true;
    } catch (e) {
        gosterMesaj('Yem ürünü yerel olarak kaydedilemedi.', 'danger');
        return false;
    }
}

async function kaydetYemIslemiCevrimdisi(islem) {
    try {
        await db.pending_yem_islemleri.add(islem);
        gosterMesaj('İnternet yok. Yem çıkışı yerel olarak kaydedildi.', 'info');
        cevrimiciDurumuGuncelle();
        registerBackgroundSync();
        return true;
    } catch(e) {
        gosterMesaj('Yem çıkışı yerel olarak kaydedilemedi.', 'danger');
        return false;
    }
}


async function kaydetSilmeIslemiCevrimdisi(kayitTipi, kayitId) {
    try {
        const existing = await db.pending_deletions.where({kayit_tipi: kayitTipi, kayit_id: kayitId}).first();
        if (!existing) {
             await db.pending_deletions.add({ kayit_tipi: kayitTipi, kayit_id: kayitId });
             cevrimiciDurumuGuncelle();
             registerBackgroundSync();
        }
    } catch (error) { console.error('Çevrimdışı silme kaydı hatası:', error); }
}

// === VERİ GETİRME FONKSİYONLARI ===
async function bekleyenGirdileriGetir() { return await db.sut_girdileri.toArray(); }
async function bekleyenTedarikcileriGetir() { return await db.pending_tedarikciler.toArray(); }
async function bekleyenFinansIslemleriniGetir() { return await db.pending_finans_islemleri.toArray(); }
async function bekleyenYemUrunleriniGetir() { return await db.pending_yem_urunleri.toArray(); }
async function bekleyenYemIslemleriniGetir() { return await db.pending_yem_islemleri.toArray(); }
async function bekleyenSilmeleriGetir() { return await db.pending_deletions.toArray(); }


// === SENKRONİZASYON (REFAKTÖR EDİLDİ) ===
async function senkronizeEt() {
    if (!navigator.onLine) return 0;

    let toplamSenkronizeEdilen = 0;

    const processQueue = async (dbTable, items, apiEndpoint) => {
        if (items.length === 0) return 0;
        const results = await Promise.allSettled(items.map(item => {
            const { id, ...payload } = item;
            return api.request(apiEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                .then(() => id);
        }));
        const successfulIds = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        if (successfulIds.length > 0) await dbTable.bulkDelete(successfulIds);
        results.forEach((result, index) => {
            if (result.status !== 'fulfilled') {
                 console.error(`Senkronizasyon hatası (${dbTable.name}):`, items[index], result.reason.message);
            }
        });
        return successfulIds.length;
    };
    
    const processDeletions = async (items) => {
        if (items.length === 0) return 0;
        const endpointMap = { 'yem_urunu': '/yem/api/urunler/', 'sut_girdisi': '/api/sut_girdisi_sil/' };
        const results = await Promise.allSettled(items.map(item => {
            const endpoint = endpointMap[item.kayit_tipi];
            if (!endpoint) return Promise.reject(`Bilinmeyen silme tipi: ${item.kayit_tipi}`);
            return api.request(endpoint + item.kayit_id, { method: 'DELETE' }).then(() => item.id);
        }));
        const successfulIds = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        if (successfulIds.length > 0) await db.pending_deletions.bulkDelete(successfulIds);
         results.forEach((result, index) => {
            if (result.status !== 'fulfilled') {
                console.error(`Silme senkronizasyon hatası:`, items[index], result.reason.message);
            }
        });
        return successfulIds.length;
    };

    toplamSenkronizeEdilen += await processQueue(db.pending_tedarikciler, await bekleyenTedarikcileriGetir(), '/api/tedarikci_ekle');
    toplamSenkronizeEdilen += await processQueue(db.pending_finans_islemleri, await bekleyenFinansIslemleriniGetir(), '/finans/api/islemler');
    toplamSenkronizeEdilen += await processQueue(db.pending_yem_urunleri, await bekleyenYemUrunleriniGetir(), '/yem/api/urunler');
    toplamSenkronizeEdilen += await processQueue(db.pending_yem_islemleri, await bekleyenYemIslemleriniGetir(), '/yem/api/islemler');
    toplamSenkronizeEdilen += await processQueue(db.sut_girdileri, await bekleyenGirdileriGetir(), '/api/sut_girdisi_ekle');
    toplamSenkronizeEdilen += await processDeletions(await bekleyenSilmeleriGetir());

    console.log(`${toplamSenkronizeEdilen} işlem senkronize edildi.`);
    return toplamSenkronizeEdilen;
}

// === ARAYÜZ GÜNCELLEME ===
async function cevrimiciDurumuGuncelle() {
    const container = document.getElementById('offline-status-container');
    const syncCount = document.getElementById('sync-count');
    if (!container || !syncCount) return;

    try {
        const sayilar = await Promise.all([
            db.sut_girdileri.count(),
            db.pending_deletions.count(),
            db.pending_tedarikciler.count(),
            db.pending_finans_islemleri.count(),
            db.pending_yem_urunleri.count(),
            db.pending_yem_islemleri.count()
        ]);
        const toplamBekleyen = sayilar.reduce((a, b) => a + b, 0);

        syncCount.textContent = toplamBekleyen;

        document.getElementById('offline-status-badge').classList.toggle('d-none', navigator.onLine);
        document.getElementById('sync-status-badge').classList.toggle('d-none', toplamBekleyen === 0);
        container.classList.toggle('d-none', navigator.onLine && toplamBekleyen === 0);
    } catch (error) {
        console.error("Çevrimdışı durum güncellenirken Dexie hatası:", error);
        if(container) container.classList.add('d-none');
    }
}


// === ÖNBELLEKLEME FONKSİYONLARI ===
async function syncTedarikciler() {
    try {
        const tedarikciler = await api.fetchTedarikciler();
        await db.transaction('rw', db.tedarikciler, async () => {
            await db.tedarikciler.clear();
            await db.tedarikciler.bulkAdd(tedarikciler);
        });
        return tedarikciler;
    } catch (error) { 
        console.warn("Tedarikçiler senkronize edilemedi:", error.message);
        return []; 
    }
}

async function syncYemUrunleri() {
    try {
        const yemUrunleri = await api.fetchYemUrunleriListe(); // Düzeltme: fetchYemUrunleri -> fetchYemUrunleriListe
        await db.transaction('rw', db.yem_urunleri, async () => {
            await db.yem_urunleri.clear();
            await db.yem_urunleri.bulkAdd(yemUrunleri);
        });
        return yemUrunleri;
    } catch (error) {
        console.warn("Yem ürünleri senkronize edilemedi:", error.message);
        return []; 
    }
}

async function getOfflineTedarikciler() { 
    try { return await db.tedarikciler.toArray(); } catch (e) { return []; }
}
async function getOfflineYemUrunleri() {
    try { return await db.yem_urunleri.toArray(); } catch (e) { return []; }
}

// === OLAY DİNLEYİCİLERİ (GÜNCELLENDİ) ===
window.addEventListener('online', async () => {
    console.log('İnternet bağlantısı geri geldi. Senkronizasyon başlatılıyor...');
    const totalSynced = await senkronizeEt();
    await cevrimiciDurumuGuncelle();
    
    if (totalSynced > 0) {
        gosterMesaj(`${totalSynced} bekleyen işlem başarıyla senkronize edildi. Sayfa yenileniyor...`, 'success');
        setTimeout(() => window.location.reload(), 2000);
    }
});

window.addEventListener('offline', cevrimiciDurumuGuncelle);

window.addEventListener('load', () => {
    cevrimiciDurumuGuncelle();
    const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
    if (!isAuthPage && navigator.onLine) {
        senkronizeEt().then(totalSynced => {
            cevrimiciDurumuGuncelle();
            if (totalSynced > 0) {
                 gosterMesaj(`${totalSynced} bekleyen işlem senkronize edildi.`, 'info');
            }
        });
    }
});

