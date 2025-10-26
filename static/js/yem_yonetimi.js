// static/js/yem_yonetimi.js

let yemIslemSilmeOnayModal, yemIslemDuzenleModal;
let tedarikciSecici, yemUrunSecici;
let yemUrunuModal, yemSilmeOnayModal;

let yemMevcutGorunum = 'tablo'; // YENİ İSİM (Ürünler için)
let yemIslemMevcutGorunum = 'tablo'; // YENİ İSİM (İşlemler için)
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

    // yemMevcutGorunum ve yemIslemMevcutGorunum kullanılıyor
    yemMevcutGorunum = localStorage.getItem('yemGorunum') || 'tablo';
    yemIslemMevcutGorunum = localStorage.getItem('yemIslemGorunum') || 'tablo';
    gorunumuAyarla(); // Global değişkeni okuyacak
    gorunumuAyarlaIslemler(); // Global değişkeni okuyacak

    tedarikcileriDoldur();
    yemSeciciyiDoldur();
    yemUrunleriniYukle(1);
    yemIslemleriniYukle(1);
};


// Fiyatlandırma tipi değiştikçe ilgili alanları göster/gizle
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

// Yem ürünü seçildiğinde çuval bilgilerini kontrol et
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
        const urunler = await store.getYemUrunleri(); // store.js'den
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

// KG girildiğinde çuvalı otomatik hesapla
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
    // Timeout ekleyerek sonsuz döngü riskini azaltalım
    setTimeout(() => { isInputUpdating = false; }, 50);
}

// Çuval girildiğinde KG'yi otomatik hesapla
function cuvalGuncelle() {
    if (isInputUpdating || !seciliYemUrunu || !seciliYemUrunu.cuval_agirligi_kg) return;
    isInputUpdating = true;

    const kgInput = document.getElementById('miktar-kg-input');
    const cuvalInput = document.getElementById('miktar-cuval-input');
    const kgMiktari = parseFloat(kgInput.value);
    const cuvalAgirligi = parseFloat(seciliYemUrunu.cuval_agirligi_kg);

    if (!isNaN(kgMiktari) && cuvalAgirligi > 0) {
        const cuvalAdedi = kgMiktari / cuvalAgirligi;
        // Tam sayıysa ondalık gösterme, değilse 2 ondalık göster
        cuvalInput.value = cuvalAdedi % 1 === 0 && cuvalAdedi.toString().indexOf('.') === -1 ? cuvalAdedi : cuvalAdedi.toFixed(2);
    }
     // Timeout ekleyerek sonsuz döngü riskini azaltalım
    setTimeout(() => { isInputUpdating = false; }, 50);
}

// Yem ürünleri için Liste/Kart görünümünü değiştir
function gorunumuDegistir(yeniGorunum) {
    // yemMevcutGorunum kullanılıyor
    if (yemMevcutGorunum === yeniGorunum) return;
    yemMevcutGorunum = yeniGorunum;
    localStorage.setItem('yemGorunum', yemMevcutGorunum);
    gorunumuAyarla(); // Global değişkeni okuyacak
    yemUrunleriniYukle(mevcutYemSayfasi); // Yeniden yükle
}

// Yem ürünleri için arayüzü ayarlar
function gorunumuAyarla() {
    document.querySelectorAll('#yem-urunleri-tablosu, #yem-urunleri-kart-listesi').forEach(el => {
        const parentContainer = el.closest('.gorunum-konteyneri');
        if(parentContainer) parentContainer.style.display = 'none';
    });
    // yemMevcutGorunum kullanılıyor
    const activeContainer = document.getElementById(`${yemMevcutGorunum}-gorunumu`);
     if(activeContainer) activeContainer.style.display = 'block';

    // yemMevcutGorunum kullanılıyor
    document.getElementById('btn-view-table').classList.toggle('active', yemMevcutGorunum === 'tablo');
    // yemMevcutGorunum kullanılıyor
    document.getElementById('btn-view-card').classList.toggle('active', yemMevcutGorunum === 'kart');
}

// Yem işlemleri için Liste/Kart görünümünü değiştir
function gorunumuDegistirIslemler(yeniGorunum) {
    // yemIslemMevcutGorunum kullanılıyor
    if (yemIslemMevcutGorunum === yeniGorunum) return;
    yemIslemMevcutGorunum = yeniGorunum;
    localStorage.setItem('yemIslemGorunum', yemIslemMevcutGorunum);
    gorunumuAyarlaIslemler(); // Global değişkeni okuyacak
    yemIslemleriniYukle(mevcutIslemSayfasi); // Yeniden yükle
}

// Yem işlemleri için arayüzü ayarlar
function gorunumuAyarlaIslemler() {
    document.querySelectorAll('.gorunum-konteyneri-islemler').forEach(el => el.style.display = 'none');
    // yemIslemMevcutGorunum kullanılıyor
    document.getElementById(`islemler-${yemIslemMevcutGorunum}-gorunumu`).style.display = 'block';
    // yemIslemMevcutGorunum kullanılıyor
    document.getElementById('btn-islemler-liste').classList.toggle('active', yemIslemMevcutGorunum === 'tablo');
    // yemIslemMevcutGorunum kullanılıyor
    document.getElementById('btn-islemler-kart').classList.toggle('active', yemIslemMevcutGorunum === 'kart');
}

// Yem ürünlerini yükler
async function yemUrunleriniYukle(sayfa = 1) {
    mevcutYemSayfasi = sayfa;
    await genelVeriYukleyici({ // data-loader.js'den
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
        // yemMevcutGorunum kullanılıyor
        mevcutGorunum: yemMevcutGorunum
    });
}

// Yem ürünleri için fiyat formatlama
function formatFiyat(urun) {
    const cuvalFiyati = parseFloat(urun.cuval_fiyati);
    const cuvalAgirligi = parseFloat(urun.cuval_agirligi_kg);
    if (cuvalFiyati > 0 && cuvalAgirligi > 0) {
        return `${cuvalFiyati.toFixed(2)} TL / Çuval (${cuvalAgirligi.toFixed(1)} KG)`;
    }
    return `${parseFloat(urun.birim_fiyat).toFixed(2)} TL / KG`;
}

// Yem ürününü tablo satırı olarak render et
function renderYemUrunuAsTable(container, urunler) {
    urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        const uyariIconu = isKritik ? `<i class="bi bi-exclamation-triangle-fill text-danger me-2" title="Stok kritik seviyede!"></i>` : '';
        const fiyatGosterim = formatFiyat(urun);
        container.innerHTML += `<tr id="yem-urun-${urun.id}" class="${isKritik ? 'table-warning' : ''}"><td>${uyariIconu}<strong>${utils.sanitizeHTML(urun.yem_adi)}</strong></td><td class="text-end">${stokMiktari.toFixed(2)} KG</td><td class="text-end">${fiyatGosterim}</td><td class="text-center"><button class="btn btn-sm btn-outline-primary" onclick='yemDuzenleAc(${JSON.stringify(urun)})'><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemSilmeOnayiAc(${urun.id}, '${utils.sanitizeHTML(urun.yem_adi.replace(/'/g, "\\'"))}')"><i class="bi bi-trash"></i></button></td></tr>`;
    });
}

// Yem ürününü kart olarak render et
function renderYemUrunuAsCards(container, urunler) {
    urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        const fiyatGosterim = formatFiyat(urun);
        container.innerHTML += `<div class="col-md-6 col-12" id="yem-urun-${urun.id}"><div class="yem-card ${isKritik ? 'stok-kritik' : ''}"><div class="yem-card-header"><h5>${utils.sanitizeHTML(urun.yem_adi)}</h5></div><div class="yem-card-body"><p class="mb-1 text-secondary">Mevcut Stok</p><p class="stok-bilgisi ${isKritik ? 'text-danger' : ''}">${stokMiktari.toFixed(2)} KG</p></div><div class="yem-card-footer"><span class="fiyat-bilgisi">${fiyatGosterim}</span><div class="btn-group"><button class="btn btn-sm btn-outline-primary" onclick='yemDuzenleAc(${JSON.stringify(urun)})'><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemSilmeOnayiAc(${urun.id}, '${utils.sanitizeHTML(urun.yem_adi.replace(/'/g, "\\'"))}')"><i class="bi bi-trash"></i></button></div></div></div></div>`;
    });
}

// Yem işlemlerini yükler
async function yemIslemleriniYukle(sayfa = 1) {
    mevcutIslemSayfasi = sayfa;
    await genelVeriYukleyici({ // data-loader.js'den
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
        // yemIslemMevcutGorunum kullanılıyor
        mevcutGorunum: yemIslemMevcutGorunum
    });
}

// Yem işlemini tablo satırı olarak render et
function renderYemIslemiAsTable(container, islemler) {
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        const tedarikciAdi = islem.tedarikciler ? utils.sanitizeHTML(islem.tedarikciler.isim) : 'Bilinmiyor';
        const yemAdi = islem.yem_urunleri ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Bilinmiyor';
        container.innerHTML += `<tr id="yem-islem-${islem.id}"><td>${tarih}</td><td>${tedarikciAdi}</td><td>${yemAdi}</td><td class="text-end">${miktar} KG</td><td class="text-center"><button class="btn btn-sm btn-outline-primary" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button></td></tr>`;
    });
}

// Yem işlemini kart olarak render et
function renderYemIslemiAsCards(container, islemler) {
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        const tedarikciAdi = islem.tedarikciler ? utils.sanitizeHTML(islem.tedarikciler.isim) : 'Bilinmiyor';
        const yemAdi = islem.yem_urunleri ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Bilinmiyor';
        container.innerHTML += `<div class="col-lg-6 col-12" id="yem-islem-${islem.id}"><div class="card p-2 h-100"><div class="card-body p-2 d-flex flex-column"><div><h6 class="card-title mb-0">${tedarikciAdi}</h6><small class="text-secondary">${yemAdi}</small></div><div class="my-2 flex-grow-1"><span class="fs-4 fw-bold text-primary">${miktar} KG</span></div><div class="d-flex justify-content-between align-items-center"><small class="text-secondary">${tarih}</small><div class="btn-group btn-group-sm"><button class="btn btn-sm btn-outline-primary" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button></div></div></div></div></div>`;
    });
}

// Tedarikçi seçicisini doldur
async function tedarikcileriDoldur() {
    try {
        const tedarikciler = await store.getTedarikciler(); // store.js'den
        tedarikciSecici.clearOptions();
        tedarikciSecici.addOptions(tedarikciler.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.isim) })));
    } catch (error) {
        gosterMesaj('Tedarikçi menüsü yüklenemedi.', 'warning'); // ui.js'den
    }
}

// Yem ürünü seçicisini doldur
async function yemSeciciyiDoldur() {
    try {
        const urunler = await store.getYemUrunleri(); // store.js'den
        yemUrunSecici.clearOptions();
        yemUrunSecici.addOptions(urunler.map(u => ({ value: u.id, text: `${utils.sanitizeHTML(u.yem_adi)} (Stok: ${parseFloat(u.stok_miktari_kg).toFixed(2)} kg)` })));
    } catch (error) {
        gosterMesaj('Yem ürünleri menüsü yüklenemedi.', 'danger'); // ui.js'den
    }
}

// Tedarikçiye yem çıkışı yapma
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

    // Çevrimdışı kaydetme
    if (!navigator.onLine) {
        try {
            const basarili = await kaydetYemIslemiCevrimdisi(veri); // offline.js'den
            if(basarili) {
                // Formu temizle ve arayüzü güncelle (offline.js halledecek)
                document.getElementById('miktar-kg-input').value = '';
                document.getElementById('miktar-cuval-input').value = '';
                document.getElementById('aciklama-input').value = '';
                tedarikciSecici.clear();
                yemUrunSecici.clear();
                document.getElementById('cuval-cikis-alani').style.display = 'none';
                await yemIslemleriniYukle(1); // Listeyi güncelle (yeni offline kayıtla)
            }
        } finally {
            kaydetButton.disabled = false;
            kaydetButton.innerHTML = originalButtonText;
        }
        return;
    }

    // Online kaydetme
    try {
        const result = await api.postYemIslemi(veri); // api.js'den
        gosterMesaj(result.message, 'success');
        document.getElementById('miktar-kg-input').value = '';
        document.getElementById('miktar-cuval-input').value = '';
        document.getElementById('aciklama-input').value = '';
        tedarikciSecici.clear();
        yemUrunSecici.clear();
        document.getElementById('cuval-cikis-alani').style.display = 'none';
        // Stoklar ve listeler değişti, her şeyi yenile
        await Promise.all([yemUrunleriniYukle(mevcutYemSayfasi), yemSeciciyiDoldur(), yemIslemleriniYukle(1)]);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

// Yeni yem ürünü kaydetme veya güncelleme
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
        veri.stok_adedi = stokDegeri; // Stok adedi olarak al
    } else {
        veri.birim_fiyat = document.getElementById('yem-fiyat-input').value;
        veri.stok_miktari_kg = stokDegeri; // Stok KG olarak al
    }

    if (!veri.yem_adi || !stokDegeri) {
        gosterMesaj('Lütfen yem adı ve stok miktarını doldurun.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    // Çevrimdışı kaydetme (Sadece YENİ ürün için)
    if (!id && !navigator.onLine) {
       try {
           const basarili = await kaydetYeniYemUrunuCevrimdisi(veri); // offline.js'den
           if(basarili) {
               yemUrunuModal.hide();
               await yemUrunleriniYukle(1); // Listeyi güncelle
               await yemSeciciyiDoldur(); // Seçiciyi güncelle
           }
       } finally {
           kaydetButton.disabled = false;
           kaydetButton.innerHTML = originalButtonText;
       }
       return;
    }
    // Düzenleme veya online yeni kayıt
    try {
        let result;
        if (id) {
             if(!navigator.onLine) { throw new Error("Ürünleri düzenlemek için internet bağlantısı gereklidir."); }
             result = await api.updateYemUrunu(id, veri); // api.js'den
             store.updateYemUrun(result.urun); // store.js'den
        } else {
             result = await api.postYemUrunu(veri); // api.js'den
             store.addYemUrun(result.urun); // store.js'den
        }

        gosterMesaj(result.message, 'success');
        yemUrunuModal.hide();
        await yemUrunleriniYukle(mevcutYemSayfasi); // Güncel sayfayı yenile
        await yemSeciciyiDoldur(); // Seçiciyi güncelle
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

// Yem işlemi (çıkışı) güncelleme
async function yemIslemiGuncelle() {
    if (!navigator.onLine) {
        gosterMesaj("İşlemleri düzenlemek için internet bağlantısı gereklidir.", "warning");
        return;
    }
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
        const result = await api.updateYemIslemi(id, veri); // api.js'den
        gosterMesaj(result.message, 'success');
        yemIslemDuzenleModal.hide();
        // Stoklar ve listeler değişti, her şeyi yenile
        await Promise.all([yemIslemleriniYukle(mevcutIslemSayfasi), yemUrunleriniYukle(mevcutYemSayfasi), yemSeciciyiDoldur()]);
    } catch (error) {
        gosterMesaj(error.message, "danger");
    }
}

// --- MODAL AÇMA FONKSİYONLARI ---

// Yeni yem ürünü modalını aç
function yeniYemModaliniAc() {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yeni Yem Ürünü Ekle';
    document.getElementById('yem-urun-form').reset();
    document.getElementById('edit-yem-id').value = '';
    document.getElementById('fiyatlandirma-tipi-sec').value = 'kg'; // Varsayılan KG
    fiyatlandirmaAlanlariniYonet(); // Alanları ayarla
    yemUrunuModal.show();
}

// Yem ürünü düzenleme modalını aç
function yemDuzenleAc(urun) {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yem Ürününü Düzenle';
    document.getElementById('edit-yem-id').value = urun.id;
    document.getElementById('yem-adi-input').value = urun.yem_adi;
    const stokInput = document.getElementById('yem-stok-input');

    const cuvalFiyati = parseFloat(urun.cuval_fiyati);
    const cuvalAgirligi = parseFloat(urun.cuval_agirligi_kg);

    // Çuval bilgisi varsa çuval modunu seç ve doldur
    if (cuvalFiyati > 0 && cuvalAgirligi > 0) {
        document.getElementById('fiyatlandirma-tipi-sec').value = 'cuval';
        document.getElementById('cuval-agirlik-input').value = cuvalAgirligi;
        document.getElementById('cuval-fiyat-input').value = cuvalFiyati;
        // Stok adedini hesapla
        const cuvalAdedi = parseFloat(urun.stok_miktari_kg) / cuvalAgirligi;
        // Tam sayıysa ondalık gösterme
        stokInput.value = Number.isInteger(cuvalAdedi) ? cuvalAdedi : cuvalAdedi.toFixed(2);
    } else { // Yoksa KG modunu seç ve doldur
        document.getElementById('fiyatlandirma-tipi-sec').value = 'kg';
        document.getElementById('yem-fiyat-input').value = parseFloat(urun.birim_fiyat);
        stokInput.value = parseFloat(urun.stok_miktari_kg);
    }
    fiyatlandirmaAlanlariniYonet(); // Alanları göster/gizle
    yemUrunuModal.show();
}

// Yem ürünü silme onay modalını aç
function yemSilmeOnayiAc(id, isim) {
    document.getElementById('silinecek-yem-id').value = id;
    document.getElementById('silinecek-yem-adi').innerText = isim;
    yemSilmeOnayModal.show();
}

// Yem işlemi silme (iptal) onay modalını aç
function yemIslemiSilmeOnayiAc(id) {
    document.getElementById('silinecek-islem-id').value = id;
    yemIslemSilmeOnayModal.show();
}

// Yem işlemi düzenleme modalını aç
function yemIslemiDuzenleAc(id, miktar, aciklama) {
    document.getElementById('edit-islem-id').value = id;
    document.getElementById('edit-miktar-input').value = miktar;
    document.getElementById('edit-aciklama-input').value = aciklama;
    yemIslemDuzenleModal.show();
}

// Yem ürünü silme işlemini yap
async function yemUrunuSil() {
    const id = document.getElementById('silinecek-yem-id').value;
    yemSilmeOnayModal.hide();

    // Çevrimdışı durumu yönet
    if (!navigator.onLine) {
        gosterMesaj('İnternet yok. Silme işlemi kaydedildi, bağlantı kurulunca uygulanacak.', 'info');
        await kaydetSilmeIslemiCevrimdisi('yem_urunu', parseInt(id)); // offline.js'den, ID'yi integer'a çevir
        store.removeYemUrun(parseInt(id)); // store.js'den, ID'yi integer'a çevir
        yemUrunleriniYukle(mevcutYemSayfasi); // Listeyi güncelle
        yemSeciciyiDoldur(); // Menüyü de güncelle
        return;
    }

    // --- İyimser UI Mantığı ---
    // yemMevcutGorunum kullanılıyor
    const silinecekElementId = `yem-urun-${id}`;
    const silinecekElement = document.getElementById(silinecekElementId);
    if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    const originalHTML = silinecekElement.outerHTML;

    silinecekElement.style.transition = 'opacity 0.4s';
    silinecekElement.style.opacity = '0';
    setTimeout(() => {
        if(silinecekElement.parentNode) silinecekElement.remove(); // Hata kontrolü eklendi
         // Eğer silindikten sonra hiç ürün kalmadıysa "veri yok" mesajını göster
        if (parent && parent.children.length === 0 && (yemMevcutGorunum === 'kart' || document.getElementById('yem-urunleri-tablosu').children.length === 0)) {
           document.getElementById('veri-yok-mesaji').style.display = 'block';
        }
    }, 400);

    try {
        const result = await api.deleteYemUrunu(id); // api.js'den
        gosterMesaj(result.message, 'success'); // ui.js'den
        store.removeYemUrun(parseInt(id)); // store.js'den, ID'yi integer'a çevir
        // Sayfalama için listeyi baştan yükle
        await Promise.all([yemUrunleriniYukle(1), yemSeciciyiDoldur()]);
    } catch (error) {
        gosterMesaj(error.message, 'danger'); // ui.js'den
        // Hata durumunda öğeyi geri yükle
        if (originalHTML && parent) {
             // yemMevcutGorunum kullanılıyor
             const tempDiv = document.createElement(yemMevcutGorunum === 'kart' ? 'div' : 'tbody');
             tempDiv.innerHTML = originalHTML;
             const restoredElement = tempDiv.firstChild;
             restoredElement.style.opacity = '1';
             parent.insertBefore(restoredElement, nextSibling);
             // "Veri yok" mesajı varsa gizle
              const veriYokMesaji = document.getElementById('veri-yok-mesaji');
              if(veriYokMesaji) veriYokMesaji.style.display = 'none';
        }
    }
}

// Yem işlemi (çıkışı) silme (iptal) işlemini yap
async function yemIslemiSil() {
    const id = document.getElementById('silinecek-islem-id').value;
    yemIslemSilmeOnayModal.hide();

    if (!navigator.onLine) {
        gosterMesaj("Bu işlemi iptal etmek için internet bağlantısı gereklidir.", "warning");
        return;
    }

    // --- İyimser UI Mantığı ---
    // yemIslemMevcutGorunum kullanılıyor
    const silinecekElementId = `yem-islem-${id}`;
    const silinecekElement = document.getElementById(silinecekElementId);
     if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    const originalHTML = silinecekElement.outerHTML;

    silinecekElement.style.transition = 'opacity 0.4s';
    silinecekElement.style.opacity = '0';
    setTimeout(() => {
         if(silinecekElement.parentNode) silinecekElement.remove(); // Hata kontrolü eklendi
          // Eğer silindikten sonra hiç işlem kalmadıysa "veri yok" mesajını göster
          if (parent && parent.children.length === 0 && (yemIslemMevcutGorunum === 'kart' || document.getElementById('yem-islemleri-listesi').children.length === 0)) {
             document.getElementById('yem-islemleri-veri-yok').style.display = 'block';
          }
    }, 400);

    try {
        const result = await api.deleteYemIslemi(id); // api.js'den
        gosterMesaj(result.message, 'success'); // ui.js'den
        // Stoklar ve listeler değiştiği için her şeyi yenile
        await Promise.all([yemUrunleriniYukle(1), yemSeciciyiDoldur(), yemIslemleriniYukle(1)]);
    } catch (error) {
        gosterMesaj(error.message, 'danger'); // ui.js'den
        // Hata durumunda öğeyi geri yükle
        if (originalHTML && parent) {
             // yemIslemMevcutGorunum kullanılıyor
             const tempDiv = document.createElement(yemIslemMevcutGorunum === 'kart' ? 'div' : 'tbody');
             tempDiv.innerHTML = originalHTML;
             const restoredElement = tempDiv.firstChild;
             restoredElement.style.opacity = '1';
             parent.insertBefore(restoredElement, nextSibling);
              // "Veri yok" mesajı varsa gizle
              const veriYokMesaji = document.getElementById('yem-islemleri-veri-yok');
              if(veriYokMesaji) veriYokMesaji.style.display = 'none';
        }
    }
}
