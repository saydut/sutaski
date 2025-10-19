// static/js/yem_yonetimi.js (İyimser Arayüz güncellemesi eklendi)

let yemIslemSilmeOnayModal, yemIslemDuzenleModal;
let tedarikciSecici, yemUrunSecici;
let yemUrunuModal, yemSilmeOnayModal;

let mevcutGorunum = 'tablo';
let mevcutIslemGorunumu = 'tablo';
let mevcutYemSayfasi = 1;
let mevcutIslemSayfasi = 1;
let seciliYemUrunu = null; 
let isInputUpdating = false;

const YEMLER_SAYFA_BASI = 10;
const ISLEMLER_SAYFA_BASI = 5;
const KRITIK_STOK_SEVIYESI = 500;

window.onload = function() {
    yemUrunuModal = new bootstrap.Modal(document.getElementById('yemUrunuModal'));
    yemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemSilmeOnayModal'));
    yemIslemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemIslemSilmeOnayModal'));
    yemIslemDuzenleModal = new bootstrap.Modal(document.getElementById('yemIslemDuzenleModal'));
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    
    yemUrunSecici = new TomSelect("#yem-urun-sec", { 
        create: false, 
        sortField: { field: "text", direction: "asc" },
        onChange: handleYemSecimi
    });

    document.getElementById('fiyatlandirma-tipi-sec').addEventListener('change', fiyatlandirmaAlanlariniYonet);

    document.getElementById('miktar-kg-input').addEventListener('input', cuvalGuncelle);
    document.getElementById('miktar-cuval-input').addEventListener('input', kgGuncelle);

    mevcutGorunum = localStorage.getItem('yemGorunum') || 'tablo';
    mevcutIslemGorunumu = localStorage.getItem('yemIslemGorunum') || 'tablo';
    gorunumuAyarla();
    gorunumuAyarlaIslemler();

    tedarikcileriDoldur();
    yemSeciciyiDoldur();
    yemUrunleriniYukle(1);
    yemIslemleriniYukle(1);
};

// ... (diğer fonksiyonlar aynı kalır) ...

async function yemUrunuSil() {
    const id = document.getElementById('silinecek-yem-id').value;
    yemSilmeOnayModal.hide();

    // Çevrimdışı durumu yönet
    if (!navigator.onLine) {
        gosterMesaj('İnternet yok. Silme işlemi kaydedildi, bağlantı kurulunca uygulanacak.', 'info');
        await kaydetSilmeIslemiCevrimdisi('yem_urunu', id);
        store.removeYemUrun(id);
        yemUrunleriniYukle(mevcutYemSayfasi);
        yemSeciciyiDoldur(); // Menüyü de güncelle
        return;
    }

    // İyimser UI Mantığı
    const silinecekElement = document.getElementById(`yem-urun-${id}`);
    if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    const originalHTML = silinecekElement.outerHTML;

    silinecekElement.style.transition = 'opacity 0.4s';
    silinecekElement.style.opacity = '0';
    setTimeout(() => {
        if(silinecekElement.parentNode) silinecekElement.parentNode.removeChild(silinecekElement);
    }, 400);

    try {
        const result = await api.deleteYemUrunu(id);
        gosterMesaj(result.message, 'success');
        store.removeYemUrun(id); // store'dan da kaldır
        // Sayfalama için listeyi baştan yükle
        await Promise.all([yemUrunleriniYukle(1), yemSeciciyiDoldur()]);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
        // Hata durumunda öğeyi geri yükle
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalHTML;
        const restoredElement = tempDiv.firstChild;
        restoredElement.style.opacity = '1';
        parent.insertBefore(restoredElement, nextSibling);
    }
}

async function yemIslemiSil() {
    const id = document.getElementById('silinecek-islem-id').value;
    yemIslemSilmeOnayModal.hide();
    
    if (!navigator.onLine) {
        gosterMesaj("Bu işlemi iptal etmek için internet bağlantısı gereklidir.", "warning");
        return;
    }

    // İyimser UI Mantığı
    const silinecekElement = document.getElementById(`yem-islem-${id}`);
    if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    const originalHTML = silinecekElement.outerHTML;

    silinecekElement.style.transition = 'opacity 0.4s';
    silinecekElement.style.opacity = '0';
    setTimeout(() => {
        if(silinecekElement.parentNode) silinecekElement.parentNode.removeChild(silinecekElement);
    }, 400);

    try {
        const result = await api.deleteYemIslemi(id);
        gosterMesaj(result.message, 'success');
        // Stoklar ve listeler değiştiği için her şeyi yenile
        await Promise.all([yemUrunleriniYukle(1), yemSeciciyiDoldur(), yemIslemleriniYukle(1)]);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
        // Hata durumunda öğeyi geri yükle
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalHTML;
        const restoredElement = tempDiv.firstChild;
        restoredElement.style.opacity = '1';
        parent.insertBefore(restoredElement, nextSibling);
    }
}

// Geri kalan tüm fonksiyonlar (kaydet, düzenle, modal açma vb.) aynı kalır.
// Aşağıya sadece değişmeyen fonksiyonların bir listesini ekliyorum.
// ... (fiyatlandirmaAlanlariniYonet, handleYemSecimi, kgGuncelle, cuvalGuncelle, ...)
// ... (gorunumuDegistir, gorunumuAyarla, gorunumuDegistirIslemler, gorunumuAyarlaIslemler, ...)
// ... (yemUrunleriniYukle, renderYemUrunuAsTable, renderYemUrunuAsCards, ...)
// ... (yemIslemleriniYukle, renderYemIslemiAsTable, renderYemIslemiAsCards, ...)
// ... (tedarikcileriDoldur, yemSeciciyiDoldur, yemCikisiYap, yemUrunuKaydet, ...)
// ... (yemIslemiGuncelle, yeniYemModaliniAc, yemDuzenleAc, yemSilmeOnayiAc, ...)
// ... (yemIslemiSilmeOnayiAc, yemIslemiDuzenleAc)

function fiyatlandirmaAlanlariniYonet() {
    const tip = document.getElementById('fiyatlandirma-tipi-sec').value;
    const kgAlani = document.getElementById('kg-fiyat-alani');
    const cuvalAlani = document.getElementById('cuval-fiyat-alani');
    const stokLabel = document.getElementById('yem-stok-label');
    const stokInput = document.getElementById('yem-stok-input');

    if (tip === 'cuval') {
        kgAlani.style.display = 'none';
        cuvalAlani.style.display = 'block';
        stokLabel.innerHTML = 'Mevcut Stok (Çuval Adedi) <span class="text-danger">*</span>';
        stokInput.placeholder = "Örn: 100";
        stokInput.step = "1";
    } else {
        kgAlani.style.display = 'block';
        cuvalAlani.style.display = 'none';
        stokLabel.innerHTML = 'Mevcut Stok (KG) <span class="text-danger">*</span>';
        stokInput.placeholder = "Örn: 5000";
        stokInput.step = "1";
    }
}

async function handleYemSecimi(value) {
    const cuvalCikisAlani = document.getElementById('cuval-cikis-alani');
    const kgInput = document.getElementById('miktar-kg-input');
    const cuvalInput = document.getElementById('miktar-cuval-input');

    kgInput.value = '';
    cuvalInput.value = '';
    seciliYemUrunu = null;

    if (!value) {
        cuvalCikisAlani.style.display = 'none';
        return;
    }

    try {
        const urunler = await store.getYemUrunleri();
        seciliYemUrunu = urunler.find(u => u.id == value);

        if (seciliYemUrunu && seciliYemUrunu.cuval_agirligi_kg > 0) {
            cuvalCikisAlani.style.display = 'block';
        } else {
            cuvalCikisAlani.style.display = 'none';
        }
    } catch (error) {
        console.error("Seçili yem ürünü bilgisi alınamadı:", error);
        cuvalCikisAlani.style.display = 'none';
    }
}

function kgGuncelle() {
    if (isInputUpdating || !seciliYemUrunu || !seciliYemUrunu.cuval_agirligi_kg) return;
    isInputUpdating = true;

    const cuvalInput = document.getElementById('miktar-cuval-input');
    const kgInput = document.getElementById('miktar-kg-input');
    const cuvalAdedi = parseFloat(cuvalInput.value);
    const cuvalAgirligi = parseFloat(seciliYemUrunu.cuval_agirligi_kg);

    if (!isNaN(cuvalAdedi)) {
        kgInput.value = (cuvalAdedi * cuvalAgirligi).toFixed(2);
    }
    isInputUpdating = false;
}

function cuvalGuncelle() {
    if (isInputUpdating || !seciliYemUrunu || !seciliYemUrunu.cuval_agirligi_kg) return;
    isInputUpdating = true;

    const kgInput = document.getElementById('miktar-kg-input');
    const cuvalInput = document.getElementById('miktar-cuval-input');
    const kgMiktari = parseFloat(kgInput.value);
    const cuvalAgirligi = parseFloat(seciliYemUrunu.cuval_agirligi_kg);

    if (!isNaN(kgMiktari) && cuvalAgirligi > 0) {
        const cuvalAdedi = kgMiktari / cuvalAgirligi;
        cuvalInput.value = cuvalAdedi % 1 === 0 && cuvalAdedi.toString().indexOf('.') === -1 ? cuvalAdedi : cuvalAdedi.toFixed(2);
    }
    isInputUpdating = false;
}

function gorunumuDegistir(yeniGorunum) { 
    if (mevcutGorunum === yeniGorunum) return; 
    mevcutGorunum = yeniGorunum; 
    localStorage.setItem('yemGorunum', yeniGorunum); 
    gorunumuAyarla(); 
    yemUrunleriniYukle(mevcutYemSayfasi); 
}

function gorunumuAyarla() { 
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none'); 
    document.getElementById(`${mevcutGorunum}-gorunumu`).style.display = 'block'; 
    document.getElementById('btn-view-table').classList.toggle('active', mevcutGorunum === 'tablo'); 
    document.getElementById('btn-view-card').classList.toggle('active', mevcutGorunum === 'kart'); 
}

function gorunumuDegistirIslemler(yeniGorunum) { 
    if (mevcutIslemGorunumu === yeniGorunum) return; 
    mevcutIslemGorunumu = yeniGorunum; 
    localStorage.setItem('yemIslemGorunum', yeniGorunum); 
    gorunumuAyarlaIslemler(); 
    yemIslemleriniYukle(mevcutIslemSayfasi); 
}

function gorunumuAyarlaIslemler() { 
    document.querySelectorAll('.gorunum-konteyneri-islemler').forEach(el => el.style.display = 'none'); 
    document.getElementById(`islemler-${mevcutIslemGorunumu}-gorunumu`).style.display = 'block'; 
    document.getElementById('btn-islemler-liste').classList.toggle('active', mevcutIslemGorunumu === 'tablo'); 
    document.getElementById('btn-islemler-kart').classList.toggle('active', mevcutIslemGorunumu === 'kart'); 
}

async function yemUrunleriniYukle(sayfa = 1) {
    mevcutYemSayfasi = sayfa;
    await genelVeriYukleyici({
        apiURL: `/yem/api/urunler?sayfa=${sayfa}`,
        veriAnahtari: 'urunler',
        tabloBodyId: 'yem-urunleri-tablosu',
        kartContainerId: 'yem-urunleri-kart-listesi',
        veriYokId: 'veri-yok-mesaji',
        sayfalamaId: 'yem-urunleri-sayfalama',
        tabloRenderFn: renderYemUrunuAsTable,
        kartRenderFn: renderYemUrunuAsCards,
        yukleFn: yemUrunleriniYukle,
        sayfa: sayfa,
        kayitSayisi: YEMLER_SAYFA_BASI,
        mevcutGorunum: mevcutGorunum
    });
}

function formatFiyat(urun) {
    const cuvalFiyati = parseFloat(urun.cuval_fiyati);
    const cuvalAgirligi = parseFloat(urun.cuval_agirligi_kg);
    if (cuvalFiyati > 0 && cuvalAgirligi > 0) {
        return `${cuvalFiyati.toFixed(2)} TL / Çuval (${cuvalAgirligi.toFixed(1)} KG)`;
    }
    return `${parseFloat(urun.birim_fiyat).toFixed(2)} TL / KG`;
}

function renderYemUrunuAsTable(container, urunler) { 
    urunler.forEach(urun => { 
        const stokMiktari = parseFloat(urun.stok_miktari_kg); 
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI; 
        const uyariIconu = isKritik ? `<i class="bi bi-exclamation-triangle-fill text-danger me-2" title="Stok kritik seviyede!"></i>` : ''; 
        const fiyatGosterim = formatFiyat(urun);
        container.innerHTML += `<tr id="yem-urun-${urun.id}" class="${isKritik ? 'table-warning' : ''}"><td>${uyariIconu}<strong>${urun.yem_adi}</strong></td><td class="text-end">${stokMiktari.toFixed(2)} KG</td><td class="text-end">${fiyatGosterim}</td><td class="text-center"><button class="btn btn-sm btn-outline-primary" onclick='yemDuzenleAc(${JSON.stringify(urun)})'><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemSilmeOnayiAc(${urun.id}, '${urun.yem_adi.replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button></td></tr>`; 
    }); 
}

function renderYemUrunuAsCards(container, urunler) { 
    urunler.forEach(urun => { 
        const stokMiktari = parseFloat(urun.stok_miktari_kg); 
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI; 
        const fiyatGosterim = formatFiyat(urun);
        container.innerHTML += `<div class="col-md-6 col-12" id="yem-urun-${urun.id}"><div class="yem-card ${isKritik ? 'stok-kritik' : ''}"><div class="yem-card-header"><h5>${urun.yem_adi}</h5></div><div class="yem-card-body"><p class="mb-1 text-secondary">Mevcut Stok</p><p class="stok-bilgisi ${isKritik ? 'text-danger' : ''}">${stokMiktari.toFixed(2)} KG</p></div><div class="yem-card-footer"><span class="fiyat-bilgisi">${fiyatGosterim}</span><div class="btn-group"><button class="btn btn-sm btn-outline-primary" onclick='yemDuzenleAc(${JSON.stringify(urun)})'><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemSilmeOnayiAc(${urun.id}, '${urun.yem_adi.replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button></div></div></div></div>`; 
    }); 
}

async function yemIslemleriniYukle(sayfa = 1) {
    mevcutIslemSayfasi = sayfa;
    await genelVeriYukleyici({
        apiURL: `/yem/api/islemler/liste?sayfa=${sayfa}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'yem-islemleri-listesi',
        kartContainerId: 'yem-islemleri-kart-listesi',
        veriYokId: 'yem-islemleri-veri-yok',
        sayfalamaId: 'yem-islemleri-sayfalama',
        tabloRenderFn: renderYemIslemiAsTable,
        kartRenderFn: renderYemIslemiAsCards,
        yukleFn: yemIslemleriniYukle,
        sayfa: sayfa,
        kayitSayisi: ISLEMLER_SAYFA_BASI,
        mevcutGorunum: mevcutIslemGorunumu
    });
}

function renderYemIslemiAsTable(container, islemler) { 
    islemler.forEach(islem => { 
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }); 
        const miktar = parseFloat(islem.miktar_kg).toFixed(2); 
        container.innerHTML += `<tr id="yem-islem-${islem.id}"><td>${tarih}</td><td>${islem.tedarikciler.isim}</td><td>${islem.yem_urunleri.yem_adi}</td><td class="text-end">${miktar} KG</td><td class="text-center"><button class="btn btn-sm btn-outline-primary" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${(islem.aciklama || '').replace(/'/g, "\\'")}')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button></td></tr>`; 
    }); 
}

function renderYemIslemiAsCards(container, islemler) { 
    islemler.forEach(islem => { 
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }); 
        const miktar = parseFloat(islem.miktar_kg).toFixed(2); 
        container.innerHTML += `<div class="col-lg-6 col-12" id="yem-islem-${islem.id}"><div class="card p-2 h-100"><div class="card-body p-2 d-flex flex-column"><div><h6 class="card-title mb-0">${islem.tedarikciler.isim}</h6><small class="text-secondary">${islem.yem_urunleri.yem_adi}</small></div><div class="my-2 flex-grow-1"><span class="fs-4 fw-bold text-primary">${miktar} KG</span></div><div class="d-flex justify-content-between align-items-center"><small class="text-secondary">${tarih}</small><div class="btn-group btn-group-sm"><button class="btn btn-sm btn-outline-primary" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${(islem.aciklama || '').replace(/'/g, "\\'")}')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button></div></div></div></div></div>`; 
    }); 
}

async function tedarikcileriDoldur() {
    try {
        const tedarikciler = await store.getTedarikciler();
        tedarikciSecici.clearOptions();
        tedarikciSecici.addOptions(tedarikciler.map(t => ({ value: t.id, text: t.isim })));
    } catch (error) { 
        gosterMesaj('Tedarikçi menüsü yüklenemedi.', 'warning'); 
    }
}

async function yemSeciciyiDoldur() {
    try {
        const urunler = await store.getYemUrunleri();
        yemUrunSecici.clearOptions();
        yemUrunSecici.addOptions(urunler.map(u => ({ value: u.id, text: `${u.yem_adi} (Stok: ${parseFloat(u.stok_miktari_kg).toFixed(2)} kg)` })));
    } catch (error) { 
        gosterMesaj('Yem ürünleri menüsü yüklenemedi.', 'danger'); 
    }
}

async function yemCikisiYap() {
    const kaydetButton = document.getElementById('yem-cikis-btn');
    const originalButtonText = kaydetButton.innerHTML;
    const veri = {
        tedarikci_id: tedarikciSecici.getValue(),
        yem_urun_id: yemUrunSecici.getValue(),
        miktar_kg: document.getElementById('miktar-kg-input').value,
        aciklama: document.getElementById('aciklama-input').value.trim()
    };
    if (!veri.tedarikci_id || !veri.yem_urun_id || !veri.miktar_kg || parseFloat(veri.miktar_kg) <= 0) {
        gosterMesaj('Lütfen tüm alanları doğru doldurun.', 'warning'); 
        return;
    }
    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    try {
        const result = await api.postYemIslemi(veri);
        gosterMesaj(result.message, 'success');
        document.getElementById('miktar-kg-input').value = '';
        document.getElementById('miktar-cuval-input').value = '';
        document.getElementById('aciklama-input').value = '';
        tedarikciSecici.clear();
        yemUrunSecici.clear();
        document.getElementById('cuval-cikis-alani').style.display = 'none';
        await Promise.all([yemUrunleriniYukle(mevcutYemSayfasi), yemSeciciyiDoldur(), yemIslemleriniYukle(1)]);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

async function yemUrunuKaydet() {
    const kaydetButton = document.querySelector('#yemUrunuModal .btn-primary');
    const originalButtonText = kaydetButton.innerHTML;
    const id = document.getElementById('edit-yem-id').value;
    const veri = {
        yem_adi: document.getElementById('yem-adi-input').value.trim(),
        fiyatlandirma_tipi: document.getElementById('fiyatlandirma-tipi-sec').value
    };
    const stokDegeri = document.getElementById('yem-stok-input').value;
    if (veri.fiyatlandirma_tipi === 'cuval') {
        veri.cuval_agirligi_kg = document.getElementById('cuval-agirlik-input').value;
        veri.cuval_fiyati = document.getElementById('cuval-fiyat-input').value;
        veri.stok_adedi = stokDegeri;
    } else {
        veri.birim_fiyat = document.getElementById('yem-fiyat-input').value;
        veri.stok_miktari_kg = stokDegeri;
    }
    if (!veri.yem_adi || !stokDegeri) {
        gosterMesaj('Lütfen yem adı ve stok miktarını doldurun.', 'warning'); 
        return;
    }
    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    try {
        const result = id ? await api.updateYemUrunu(id, veri) : await api.postYemUrunu(veri);
        gosterMesaj(result.message, 'success');
        yemUrunuModal.hide();
        if (id) { store.updateYemUrun(result.urun); } else { store.addYemUrun(result.urun); }
        yemUrunleriniYukle(mevcutYemSayfasi);
        yemSeciciyiDoldur();
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

async function yemIslemiGuncelle() {
    const id = document.getElementById('edit-islem-id').value;
    const veri = {
        yeni_miktar_kg: document.getElementById('edit-miktar-input').value,
        aciklama: document.getElementById('edit-aciklama-input').value.trim()
    };
    if (!veri.yeni_miktar_kg || parseFloat(veri.yeni_miktar_kg) <= 0) {
        gosterMesaj("Lütfen geçerli bir miktar girin.", "warning");
        return;
    }
    try {
        const result = await api.updateYemIslemi(id, veri);
        gosterMesaj(result.message, 'success');
        yemIslemDuzenleModal.hide();
        await Promise.all([yemIslemleriniYukle(mevcutIslemSayfasi), yemUrunleriniYukle(mevcutYemSayfasi), yemSeciciyiDoldur()]);
    } catch (error) {
        gosterMesaj(error.message, "danger");
    }
}

function yeniYemModaliniAc() {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yeni Yem Ürünü Ekle';
    document.getElementById('yem-urun-form').reset();
    document.getElementById('edit-yem-id').value = '';
    document.getElementById('fiyatlandirma-tipi-sec').value = 'kg';
    fiyatlandirmaAlanlariniYonet();
    yemUrunuModal.show();
}

function yemDuzenleAc(urun) {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yem Ürününü Düzenle';
    document.getElementById('edit-yem-id').value = urun.id;
    document.getElementById('yem-adi-input').value = urun.yem_adi;
    const stokInput = document.getElementById('yem-stok-input');
    const cuvalFiyati = parseFloat(urun.cuval_fiyati);
    const cuvalAgirligi = parseFloat(urun.cuval_agirligi_kg);
    if (cuvalFiyati > 0 && cuvalAgirligi > 0) {
        document.getElementById('fiyatlandirma-tipi-sec').value = 'cuval';
        document.getElementById('cuval-agirlik-input').value = cuvalAgirligi;
        document.getElementById('cuval-fiyat-input').value = cuvalFiyati;
        const cuvalAdedi = parseFloat(urun.stok_miktari_kg) / cuvalAgirligi;
        stokInput.value = Number.isInteger(cuvalAdedi) ? cuvalAdedi : cuvalAdedi.toFixed(2);
    } else {
        document.getElementById('fiyatlandirma-tipi-sec').value = 'kg';
        document.getElementById('yem-fiyat-input').value = parseFloat(urun.birim_fiyat);
        stokInput.value = parseFloat(urun.stok_miktari_kg);
    }
    fiyatlandirmaAlanlariniYonet();
    yemUrunuModal.show();
}

function yemSilmeOnayiAc(id, isim) {
    document.getElementById('silinecek-yem-id').value = id;
    document.getElementById('silinecek-yem-adi').innerText = isim;
    yemSilmeOnayModal.show();
}

function yemIslemiSilmeOnayiAc(id) {
    document.getElementById('silinecek-islem-id').value = id;
    yemIslemSilmeOnayModal.show();
}

function yemIslemiDuzenleAc(id, miktar, aciklama) {
    document.getElementById('edit-islem-id').value = id;
    document.getElementById('edit-miktar-input').value = miktar;
    document.getElementById('edit-aciklama-input').value = aciklama;
    yemIslemDuzenleModal.show();
}
