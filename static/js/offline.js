// static/js/offline.js (FİNANS ÖZELLİĞİ EKLENDİ)

const db = new Dexie('sutaski_offline_db');

// Veritabanı şemasını son versiyona güncelliyoruz.
db.version(5).stores({
    sut_girdileri: '++id, tedarikci_id, litre, fiyat, eklendigi_zaman',
    pending_tedarikciler: '++id, isim, tc_no, telefon_no, adres',
    pending_finans_islemleri: '++id, islem_tipi, tedarikci_id, tutar, islem_tarihi, aciklama', // -> Finans işlemlerini tutacak yeni tablo
    tedarikciler: 'id, isim',
    yem_urunleri: 'id, yem_adi, stok_miktari_kg, birim_fiyat',
    pending_deletions: '++id, kayit_tipi, kayit_id' 
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


// === SENKRONİZASYON ===

async function senkronizeEt() {
    if (!navigator.onLine) return;

    Promise.all([ syncTedarikciler(), syncYemUrunleri() ]);

    let toplamSenkronizeEdilen = 0;

    // 1. Bekleyen YENİ TEDARİKÇİLERİ gönder
    const bekleyenTedarikciler = await bekleyenTedarikcileriGetir();
    if (bekleyenTedarikciler.length > 0) {
        toplamSenkronizeEdilen += bekleyenTedarikciler.length;
        for (const tedarikci of bekleyenTedarikciler) {
            try {
                const { id, ...veri } = tedarikci;
                const res = await fetch('/api/tedarikci_ekle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
                if (res.ok) await db.pending_tedarikciler.delete(tedarikci.id); else break;
            } catch (error) { break; }
        }
    }

    // 2. Bekleyen FİNANS İŞLEMLERİNİ gönder
    const bekleyenFinansIslemleri = await bekleyenFinansIslemleriniGetir();
    if (bekleyenFinansIslemleri.length > 0) {
        toplamSenkronizeEdilen += bekleyenFinansIslemleri.length;
        for (const islem of bekleyenFinansIslemleri) {
            try {
                const { id, ...veri } = islem;
                const res = await fetch('/finans/api/islemler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
                if (res.ok) await db.pending_finans_islemleri.delete(islem.id); else break;
            } catch (error) { break; }
        }
    }
    
    // 3. Bekleyen SÜT GİRDİLERİNİ gönder
    const bekleyenGirdiler = await bekleyenGirdileriGetir();
    if (bekleyenGirdiler.length > 0) {
        toplamSenkronizeEdilen += bekleyenGirdiler.length;
        for (const girdi of bekleyenGirdiler) {
            try {
                const res = await fetch('/api/sut_girdisi_ekle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(girdi) });
                if (res.ok) await db.sut_girdileri.delete(girdi.id); else break;
            } catch (error) { break; }
        }
    }

    // 4. Bekleyen SİLMELERİ gönder
    const bekleyenSilmeler = await bekleyenSilmeleriGetir();
    if (bekleyenSilmeler.length > 0) {
        toplamSenkronizeEdilen += bekleyenSilmeler.length;
        const endpointMap = { 'yem_urunu': '/yem/api/urunler/', 'sut_girdisi': '/api/sut_girdisi_sil/' };
        for (const silme of bekleyenSilmeler) {
            const endpoint = endpointMap[silme.kayit_tipi];
            if (!endpoint) continue;
            try {
                const res = await fetch(endpoint + silme.kayit_id, { method: 'DELETE' });
                if (res.ok || res.status === 404) await db.pending_deletions.delete(silme.id); else break;
            } catch (error) { break; }
        }
    }

    await cevrimiciDurumuGuncelle();
    
    // Sayfaları ve menüleri yenile
    if (typeof girdileriGoster === 'function' && window.location.pathname === '/') { girdileriGoster(); }
    if (typeof yemListesiniGoster === 'function' && window.location.pathname.includes('/yem/yonetim')) { yemListesiniGoster(1); }
    if (typeof verileriYukle === 'function' && window.location.pathname.includes('/tedarikciler')) { verileriYukle(); }
    if (typeof finansalIslemleriYukle === 'function' && window.location.pathname.includes('/finans')) { finansalIslemleriYukle(1); }
    
    if (toplamSenkronizeEdilen > 0) {
        gosterMesaj('Tüm bekleyen işlemler senkronize edildi.', 'success');
    }
}


// === ARAYÜZ GÜNCELLEME ===
async function cevrimiciDurumuGuncelle() {
    const container = document.getElementById('offline-status-container');
    const syncCount = document.getElementById('sync-count');
    if (!container || !syncCount) return;

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
    } catch (error) { return []; }
}

async function syncYemUrunleri() {
    try {
        const yemUrunleri = await api.fetchYemUrunleri();
        await db.transaction('rw', db.yem_urunleri, async () => {
            await db.yem_urunleri.clear();
            await db.yem_urunleri.bulkAdd(yemUrunleri);
        });
        return yemUrunleri;
    } catch (error) { return []; }
}

async function getOfflineTedarikciler() { return await db.tedarikciler.toArray(); }
async function getOfflineYemUrunleri() { return await db.yem_urunleri.toArray(); }

// Tarayıcı olaylarını dinleyerek durumu otomatik yönet.
window.addEventListener('online', senkronizeEt);
window.addEventListener('offline', cevrimiciDurumuGuncelle);
window.addEventListener('load', () => {
    cevrimiciDurumuGuncelle();
    const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
    if (!isAuthPage && navigator.onLine) {
        senkronizeEt();
    }
});

