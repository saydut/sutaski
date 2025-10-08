// static/js/offline.js (SENKRONİZASYON GÜÇLENDİRİLDİ)

const db = new Dexie('sutaski_offline_db');

// Veritabanı şemasını son versiyona güncelliyoruz.
db.version(5).stores({
    sut_girdileri: '++id, tedarikci_id, litre, fiyat, eklendigi_zaman',
    pending_tedarikciler: '++id, isim, tc_no, telefon_no, adres',
    pending_finans_islemleri: '++id, islem_tipi, tedarikci_id, tutar, islem_tarihi, aciklama', // -> Finans işlemlerini tutacak yeni tablo
    tedarikciler: 'id, isim',
    yem_urunleri: 'id, yem_adi, stok_miktari_kg, birim_fiyat',
    pending_deletions: '++id, [kayit_tipi+kayit_id]' // Silme işlemlerinin tekrarını önlemek için bileşik anahtar
}).upgrade(tx => {
    console.log("Veritabanı 5. versiyona yükseltildi ve finans tablosu eklendi.");
});


// === ÇEVRİMDIŞI KAYIT FONKSİYONLARI ===

async function kaydetCevrimdisi(girdi) {
    try {
        girdi.eklendigi_zaman = new Date().toISOString();
        await db.sut_girdileri.add(girdi);
        gosterMesaj('İnternet yok. Girdi yerel olarak kaydedildi.', 'info');
        cevrimiciDurumuGuncelle();
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
        return true;
    } catch (error) {
        console.error('Çevrimdışı finans işlemi kaydetme hatası:', error);
        gosterMesaj('Finansal işlem yerel olarak kaydedilemedi.', 'danger');
        return false;
    }
}

async function kaydetSilmeIslemiCevrimdisi(kayitTipi, kayitId) {
    try {
        const existing = await db.pending_deletions.where({kayit_tipi: kayitTipi, kayit_id: kayitId}).first();
        if (!existing) {
             await db.pending_deletions.add({ kayit_tipi: kayitTipi, kayit_id: kayitId });
             cevrimiciDurumuGuncelle();
        }
    } catch (error) { console.error('Çevrimdışı silme kaydı hatası:', error); }
}

// === VERİ GETİRME FONKSİYONLARI ===

async function bekleyenGirdileriGetir() { return await db.sut_girdileri.toArray(); }
async function bekleyenTedarikcileriGetir() { return await db.pending_tedarikciler.toArray(); }
async function bekleyenFinansIslemleriniGetir() { return await db.pending_finans_islemleri.toArray(); }
async function bekleyenSilmeleriGetir() { return await db.pending_deletions.toArray(); }


// === SENKRONİZASYON (YENİ VE GÜVENİLİR YAPI) ===

/**
 * Bekleyen tüm çevrimdışı işlemleri sunucu ile senkronize etmeye çalışır.
 * Hatalı olanları atlar ve bir sonraki deneme için yerel veritabanında bırakır.
 */
async function senkronizeEt() {
    if (!navigator.onLine) return;

    // Temel verileri (tedarikçi, yem listesi vb.) arka planda güncelle
    Promise.all([ syncTedarikciler(), syncYemUrunleri() ]);

    let toplamSenkronizeEdilen = 0;

    // Senkronizasyon işlemlerini yürüten yardımcı fonksiyon
    const processQueue = async (dbTable, items, apiEndpoint, method = 'POST') => {
        if (items.length === 0) return 0;

        const results = await Promise.allSettled(items.map(item => {
            const { id, ...payload } = item;
            return fetch(apiEndpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => {
                if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Sunucu hatası') });
                return id; // Başarılı olursa, silinecek olan yerel ID'yi döndür
            });
        }));

        const successfulIds = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successfulIds.push(result.value);
            } else {
                console.error(`Senkronizasyon hatası (${dbTable.name}):`, items[index], result.reason.message);
            }
        });

        if (successfulIds.length > 0) {
            await dbTable.bulkDelete(successfulIds);
        }
        return successfulIds.length;
    };
    
    // Silme işlemlerini yürüten yardımcı fonksiyon
    const processDeletions = async (items) => {
        if (items.length === 0) return 0;
        const endpointMap = { 'yem_urunu': '/yem/api/urunler/', 'sut_girdisi': '/api/sut_girdisi_sil/' };
        
        const results = await Promise.allSettled(items.map(item => {
            const endpoint = endpointMap[item.kayit_tipi];
            if (!endpoint) return Promise.reject(new Error(`Bilinmeyen silme tipi: ${item.kayit_tipi}`));
            
            return fetch(endpoint + item.kayit_id, { method: 'DELETE' })
                .then(res => {
                    // Eğer kayıt zaten sunucuda yoksa (404), bunu bir başarı olarak kabul et
                    if (!res.ok && res.status !== 404) return res.json().then(err => { throw new Error(err.error || 'Sunucu hatası') });
                    return item.id; // Başarılı olursa, silinecek olan yerel ID'yi döndür
                });
        }));

        const successfulIds = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successfulIds.push(result.value);
            } else {
                console.error(`Silme senkronizasyon hatası:`, items[index], result.reason.message);
            }
        });
        
        if (successfulIds.length > 0) {
            await db.pending_deletions.bulkDelete(successfulIds);
        }
        return successfulIds.length;
    };

    // 1. Bekleyen YENİ TEDARİKÇİLERİ gönder
    const bekleyenTedarikciler = await bekleyenTedarikcileriGetir();
    toplamSenkronizeEdilen += await processQueue(db.pending_tedarikciler, bekleyenTedarikciler, '/api/tedarikci_ekle');

    // 2. Bekleyen FİNANS İŞLEMLERİNİ gönder
    const bekleyenFinansIslemleri = await bekleyenFinansIslemleriniGetir();
    toplamSenkronizeEdilen += await processQueue(db.pending_finans_islemleri, bekleyenFinansIslemleri, '/finans/api/islemler');

    // 3. Bekleyen SÜT GİRDİLERİNİ gönder
    const bekleyenGirdiler = await bekleyenGirdileriGetir();
    toplamSenkronizeEdilen += await processQueue(db.sut_girdileri, bekleyenGirdiler, '/api/sut_girdisi_ekle');

    // 4. Bekleyen SİLMELERİ gönder
    const bekleyenSilmeler = await bekleyenSilmeleriGetir();
    toplamSenkronizeEdilen += await processDeletions(bekleyenSilmeler);


    await cevrimiciDurumuGuncelle();
    
    // Sayfaları ve menüleri yenile
    if (toplamSenkronizeEdilen > 0) {
        gosterMesaj(`${toplamSenkronizeEdilen} bekleyen işlem başarıyla senkronize edildi.`, 'success');
        
        // Verilerin yenilenmesi gereken sayfalardaki fonksiyonları kontrol et ve çağır
        if (typeof girdileriGoster === 'function' && window.location.pathname === '/') { girdileriGoster(1); }
        if (typeof yemUrunleriniYukle === 'function' && window.location.pathname.includes('/yem/yonetim')) { yemUrunleriniYukle(1); yemIslemleriniYukle(1); }
        if (typeof verileriYukle === 'function' && window.location.pathname.includes('/tedarikciler')) { verileriYukle(); }
        if (typeof finansalIslemleriYukle === 'function' && window.location.pathname.includes('/finans')) { finansalIslemleriYukle(1); }
        if (typeof tedarikcileriDoldur === 'function') { tedarikcileriDoldur(); }
    }
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
            db.pending_finans_islemleri.count()
        ]);
        const toplamBekleyen = sayilar.reduce((a, b) => a + b, 0);

        syncCount.textContent = toplamBekleyen;

        document.getElementById('offline-status-badge').classList.toggle('d-none', navigator.onLine);
        document.getElementById('sync-status-badge').classList.toggle('d-none', toplamBekleyen === 0);
        container.classList.toggle('d-none', navigator.onLine && toplamBekleyen === 0);
    } catch (error) {
        console.error("Çevrimdışı durum güncellenirken Dexie hatası:", error);
        // Veritabanı açılamazsa veya hata verirse, çevrimdışı ikonlarını gizle.
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
        const yemUrunleri = await api.fetchYemUrunleri();
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
    try {
        return await db.tedarikciler.toArray(); 
    } catch (e) {
        return [];
    }
}
async function getOfflineYemUrunleri() {
    try {
        return await db.yem_urunleri.toArray();
    } catch (e) {
        return [];
    }
}

// Tarayıcı olaylarını dinleyerek durumu otomatik yönet.
window.addEventListener('online', senkronizeEt);
window.addEventListener('offline', cevrimiciDurumuGuncelle);
window.addEventListener('load', () => {
    cevrimiciDurumuGuncelle();
    const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
    if (!isAuthPage && navigator.onLine) {
        // Sayfa yüklendiğinde hemen senkronize etmeye başla
        senkronizeEt();
    }
});
