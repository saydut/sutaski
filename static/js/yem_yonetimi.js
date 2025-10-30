// static/js/yem_yonetimi.js

let yemIslemSilmeOnayModal, yemIslemDuzenleModal;
let tedarikciSecici, yemUrunSecici;
let yemUrunuModal, yemSilmeOnayModal;

let yemMevcutGorunum = 'tablo'; // Ürünler için
let yemIslemMevcutGorunum = 'tablo'; // İşlemler için
let mevcutYemSayfasi = 1;
let mevcutIslemSayfasi = 1;
let seciliYemUrunu = null; // Seçilen yem ürünü objesini tutacak
let isInputUpdating = false; // KG/Çuval dönüşümü sırasında sonsuz döngüyü engellemek için

const YEMLER_SAYFA_BASI = 10;
const ISLEMLER_SAYFA_BASI = 5;
const KRITIK_STOK_SEVIYESI = 500;

window.onload = function() {
    // Modal instance'larını başlat
    yemUrunuModal = new bootstrap.Modal(document.getElementById('yemUrunuModal'));
    yemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemSilmeOnayModal'));
    yemIslemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemIslemSilmeOnayModal'));
    yemIslemDuzenleModal = new bootstrap.Modal(document.getElementById('yemIslemDuzenleModal'));

    // Tedarikçi ve Yem Ürünü seçicilerini (TomSelect) başlat
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    yemUrunSecici = new TomSelect("#yem-urun-sec", {
        create: false,
        sortField: { field: "text", direction: "asc" },
        onChange: handleYemSecimi // Yem seçilince çalışacak fonksiyon
    });

    // --- YENİ: Fiyat Tipi radio butonlarına olay dinleyici ekle ---
    document.querySelectorAll('input[name="fiyatTipiRadio"]').forEach(radio => {
        radio.addEventListener('change', fiyatAlaniniYonet); // Fiyat tipi değişince fiyat inputunu yönet
    });
    // --- /YENİ ---

    // Diğer olay dinleyicileri
    document.getElementById('fiyatlandirma-tipi-sec').addEventListener('change', fiyatlandirmaAlanlariniYonet); // Yem ürünü modalı için
    document.getElementById('miktar-kg-input').addEventListener('input', cuvalGuncelle);
    document.getElementById('miktar-cuval-input').addEventListener('input', kgGuncelle);

    // Görünüm tercihlerini localStorage'dan yükle
    yemMevcutGorunum = localStorage.getItem('yemGorunum') || 'tablo';
    yemIslemMevcutGorunum = localStorage.getItem('yemIslemGorunum') || 'tablo';
    gorunumuAyarla(); // Ürünler için görünümü ayarla
    gorunumuAyarlaIslemler(); // İşlemler için görünümü ayarla

    // Başlangıç verilerini yükle
    tedarikcileriDoldur();
    yemSeciciyiDoldur();
    yemUrunleriniYukle(1);
    yemIslemleriniYukle(1);

    // --- YENİ: Sayfa yüklendiğinde fiyat alanını ilk kez ayarla ---
    fiyatAlaniniYonet();
    // --- /YENİ ---
};

// --- YENİ FONKSİYON: Fiyat Tipi Seçimine Göre Birim Fiyat Alanını Yönetir ---
async function fiyatAlaniniYonet() {
    const fiyatTipi = document.querySelector('input[name="fiyatTipiRadio"]:checked').value;
    const birimFiyatInput = document.getElementById('birim-fiyat-input');
    const yemUrunId = yemUrunSecici.getValue(); // Seçili yemin ID'sini al

    // Önce seçili yem ürününün detaylarını almamız lazım (fiyatı bilmek için)
    // Eğer `seciliYemUrunu` global değişkeni güncel değilse tekrar çekebiliriz
    // Veya `handleYemSecimi` içinde zaten ayarlandığını varsayabiliriz.
    // Şimdilik `seciliYemUrunu`'nun güncel olduğunu varsayalım.
    if (!seciliYemUrunu && yemUrunId) {
        // Eğer `seciliYemUrunu` boşsa ama bir yem seçilmişse, veriyi store'dan tekrar almayı dene
         try {
             const urunler = await store.getYemUrunleri(); // store.js'den
             seciliYemUrunu = urunler.find(u => u.id == yemUrunId);
         } catch(e){
             console.error("Fiyat yönetimi için yem ürünü bilgisi alınamadı:", e);
             seciliYemUrunu = null;
         }
    }


    if (fiyatTipi === 'pesin') {
        let pesinFiyat = '';
        if (seciliYemUrunu) {
            // Çuval fiyatı varsa KG fiyatına çevir, yoksa direkt birim fiyatı al
            const cuvalFiyati = parseFloat(seciliYemUrunu.cuval_fiyati);
            const cuvalAgirligi = parseFloat(seciliYemUrunu.cuval_agirligi_kg);
            if (cuvalFiyati > 0 && cuvalAgirligi > 0) {
                pesinFiyat = (cuvalFiyati / cuvalAgirligi).toFixed(2);
            } else {
                pesinFiyat = parseFloat(seciliYemUrunu.birim_fiyat).toFixed(2);
            }
        }
        birimFiyatInput.value = pesinFiyat;
        birimFiyatInput.disabled = true; // Peşin fiyatı değiştiremez
        birimFiyatInput.placeholder = "Peşin fiyat otomatik geldi";
    } else { // Vadeli seçiliyse
        birimFiyatInput.value = ''; // Alanı temizle
        birimFiyatInput.disabled = false; // Düzenlenebilir yap
        birimFiyatInput.placeholder = "Vadeli fiyatı girin (TL/KG)";
        birimFiyatInput.focus(); // Kullanıcının direkt yazabilmesi için focus yap
    }
}
// --- /YENİ FONKSİYON ---


// Fiyatlandırma tipi değiştikçe ilgili alanları göster/gizle (Yem Ürünü Modalı İçin - Değişiklik Yok)
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

// Yem ürünü seçildiğinde çuval bilgilerini kontrol et ve FİYAT ALANINI GÜNCELLE
async function handleYemSecimi(value) {
    const cuvalCikisAlani = document.getElementById('cuval-cikis-alani');
    const kgInput = document.getElementById('miktar-kg-input');
    const cuvalInput = document.getElementById('miktar-cuval-input');

    kgInput.value = '';
    cuvalInput.value = '';
    seciliYemUrunu = null; // Seçimi sıfırla

    if (!value) {
        cuvalCikisAlani.style.display = 'none';
        await fiyatAlaniniYonet(); // Yem seçimi kalkınca fiyat alanını da sıfırla/pasif yap
        return;
    }

    try {
        const urunler = await store.getYemUrunleri(); // store.js'den
        seciliYemUrunu = urunler.find(u => u.id == value); // Seçilen ürünü global değişkene ata

        if (seciliYemUrunu && seciliYemUrunu.cuval_agirligi_kg > 0) {
            cuvalCikisAlani.style.display = 'block';
        } else {
            cuvalCikisAlani.style.display = 'none';
        }

        // --- YENİ: Yem seçilince fiyat alanını güncelle ---
        await fiyatAlaniniYonet();
        // --- /YENİ ---

    } catch (error) {
        console.error("Seçili yem ürünü bilgisi alınamadı:", error);
        cuvalCikisAlani.style.display = 'none';
        seciliYemUrunu = null; // Hata olursa sıfırla
        await fiyatAlaniniYonet(); // Hata durumunda da fiyat alanını yönet
    }
}

// KG girildiğinde çuvalı otomatik hesapla (Değişiklik Yok)
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
    setTimeout(() => { isInputUpdating = false; }, 50);
}

// Çuval girildiğinde KG'yi otomatik hesapla (Değişiklik Yok)
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
    setTimeout(() => { isInputUpdating = false; }, 50);
}

// Yem ürünleri için Liste/Kart görünümünü değiştir (Değişiklik Yok)
function gorunumuDegistir(yeniGorunum) {
    if (yemMevcutGorunum === yeniGorunum) return;
    yemMevcutGorunum = yeniGorunum;
    localStorage.setItem('yemGorunum', yemMevcutGorunum);
    gorunumuAyarla();
    yemUrunleriniYukle(mevcutYemSayfasi);
}

// Yem ürünleri için arayüzü ayarlar (Değişiklik Yok)
function gorunumuAyarla() {
    document.querySelectorAll('#tablo-gorunumu, #kart-gorunumu').forEach(el => {
        const parentContainer = el.closest('.gorunum-konteyneri');
        if(parentContainer) parentContainer.style.display = 'none';
    });
    const activeContainer = document.getElementById(`${yemMevcutGorunum}-gorunumu`);
     if(activeContainer) activeContainer.style.display = 'block';

    document.getElementById('btn-view-table').classList.toggle('active', yemMevcutGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', yemMevcutGorunum === 'kart');
}

// Yem işlemleri için Liste/Kart görünümünü değiştir (Değişiklik Yok)
function gorunumuDegistirIslemler(yeniGorunum) {
    if (yemIslemMevcutGorunum === yeniGorunum) return;
    yemIslemMevcutGorunum = yeniGorunum;
    localStorage.setItem('yemIslemGorunum', yemIslemMevcutGorunum);
    gorunumuAyarlaIslemler();
    yemIslemleriniYukle(mevcutIslemSayfasi);
}

// Yem işlemleri için arayüzü ayarlar (Değişiklik Yok)
function gorunumuAyarlaIslemler() {
    document.querySelectorAll('.gorunum-konteyneri-islemler').forEach(el => el.style.display = 'none');
    document.getElementById(`islemler-${yemIslemMevcutGorunum}-gorunumu`).style.display = 'block';
    document.getElementById('btn-islemler-liste').classList.toggle('active', yemIslemMevcutGorunum === 'tablo');
    document.getElementById('btn-islemler-kart').classList.toggle('active', yemIslemMevcutGorunum === 'kart');
}

// Yem ürünlerini yükler (Değişiklik Yok)
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
        mevcutGorunum: yemMevcutGorunum
    });
}

// Yem ürünleri için fiyat formatlama (Değişiklik Yok)
function formatFiyat(urun) {
    const cuvalFiyati = parseFloat(urun.cuval_fiyati);
    const cuvalAgirligi = parseFloat(urun.cuval_agirligi_kg);
    if (cuvalFiyati > 0 && cuvalAgirligi > 0) {
        return `${cuvalFiyati.toFixed(2)} TL / Çuval (${cuvalAgirligi.toFixed(1)} KG)`;
    }
    return `${parseFloat(urun.birim_fiyat).toFixed(2)} TL / KG`;
}

// YENİ FONKSİYON: Stok gösterimini formatlar (KG ve Çuval)
function formatStokGosterimi(urun) {
    const stokMiktari = parseFloat(urun.stok_miktari_kg);
    const cuvalAgirligi = parseFloat(urun.cuval_agirligi_kg);

    if (cuvalAgirligi > 0 && stokMiktari > 0) {
        // Bu bir çuval ürünü, adedi de hesapla
        const cuvalAdedi = (stokMiktari / cuvalAgirligi);
        // .toFixed(1) ondalık bırakır, Number() sondaki .0'ı siler
        const cuvalAdediStr = Number.isInteger(cuvalAdedi) ? cuvalAdedi : cuvalAdedi.toFixed(1); 
        // HTML olarak döndürüyoruz ki text-secondary çalışsın
        return `${stokMiktari.toFixed(2)} KG <span class="text-secondary">(${cuvalAdediStr} Çuval)</span>`;
    } else {
        // Bu bir KG ürünü veya stok 0
        return `${stokMiktari.toFixed(2)} KG`;
    }
}


// Yem ürününü tablo satırı olarak render et (GÜNCELLENDİ)
function renderYemUrunuAsTable(container, urunler) {
    urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        const uyariIconu = isKritik ? `<i class="bi bi-exclamation-triangle-fill text-danger me-2" title="Stok kritik seviyede!"></i>` : '';
        const fiyatGosterim = formatFiyat(urun);
        // YENİ İSTEK: Stok gösterimini formatStokGosterimi fonksiyonu ile yap
        const stokGosterim = formatStokGosterimi(urun);
        
        container.innerHTML += `
            <tr id="yem-urun-${urun.id}" class="${isKritik ? 'table-warning' : ''}">
                <td>${uyariIconu}<strong>${utils.sanitizeHTML(urun.yem_adi)}</strong></td>
                <td class="text-end">${stokGosterim}</td> <!-- Değişiklik burada -->
                <td class="text-end">${fiyatGosterim}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick='yemDuzenleAc(${JSON.stringify(urun)})'><i class="bi bi-pencil"></i></button> 
                    <button class="btn btn-sm btn-outline-danger" onclick="yemSilmeOnayiAc(${urun.id}, '${utils.sanitizeHTML(urun.yem_adi.replace(/'/g, "\\'"))}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

// Yem ürününü kart olarak render et (GÜNCELLENDİ)
function renderYemUrunuAsCards(container, urunler) {
    urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        const fiyatGosterim = formatFiyat(urun);
        // YENİ İSTEK: Stok gösterimini formatStokGosterimi fonksiyonu ile yap
        const stokGosterim = formatStokGosterimi(urun);

        container.innerHTML += `
            <div class="col-md-6 col-12" id="yem-urun-${urun.id}">
                <div class="yem-card ${isKritik ? 'stok-kritik' : ''}">
                    <div class="yem-card-header"><h5>${utils.sanitizeHTML(urun.yem_adi)}</h5></div>
                    <div class="yem-card-body">
                        <p class="mb-1 text-secondary">Mevcut Stok</p>
                        <p class="stok-bilgisi ${isKritik ? 'text-danger' : ''}">${stokGosterim}</p> <!-- Değişiklik burada -->
                    </div>
                    <div class="yem-card-footer">
                        <span class="fiyat-bilgisi">${fiyatGosterim}</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" onclick='yemDuzenleAc(${JSON.stringify(urun)})'><i class="bi bi-pencil"></i></button> 
                            <button class="btn btn-sm btn-outline-danger" onclick="yemSilmeOnayiAc(${urun.id}, '${utils.sanitizeHTML(urun.yem_adi.replace(/'/g, "\\'"))}')"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}


// Yem işlemlerini yükler (Değişiklik Yok)
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
        mevcutGorunum: yemIslemMevcutGorunum
    });
}

// Yem işlemini tablo satırı olarak render et (Değişiklik Yok)
function renderYemIslemiAsTable(container, islemler) {
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        const tedarikciAdi = islem.tedarikciler ? utils.sanitizeHTML(islem.tedarikciler.isim) : 'Bilinmiyor';
        const yemAdi = islem.yem_urunleri ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Bilinmiyor';
        container.innerHTML += `<tr id="yem-islem-${islem.id}"><td>${tarih}</td><td>${tedarikciAdi}</td><td>${yemAdi}</td><td class="text-end">${miktar} KG</td><td class="text-center"><button class="btn btn-sm btn-outline-primary" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button></td></tr>`;
    });
}

// Yem işlemini kart olarak render et (Değişiklik Yok)
function renderYemIslemiAsCards(container, islemler) {
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        const tedarikciAdi = islem.tedarikciler ? utils.sanitizeHTML(islem.tedarikciler.isim) : 'Bilinmiyor';
        const yemAdi = islem.yem_urunleri ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Bilinmiyor';
        container.innerHTML += `<div class="col-lg-6 col-12" id="yem-islem-${islem.id}"><div class="card p-2 h-100"><div class="card-body p-2 d-flex flex-column"><div><h6 class="card-title mb-0">${tedarikciAdi}</h6><small class="text-secondary">${yemAdi}</small></div><div class="my-2 flex-grow-1"><span class="fs-4 fw-bold text-primary">${miktar} KG</span></div><div class="d-flex justify-content-between align-items-center"><small class="text-secondary">${tarih}</small><div class="btn-group btn-group-sm"><button class="btn btn-sm btn-outline-primary" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button></div></div></div></div></div>`;
    });
}

// Tedarikçi seçicisini doldur (Değişiklik Yok)
async function tedarikcileriDoldur() {
    try {
        const tedarikciler = await store.getTedarikciler();
        tedarikciSecici.clearOptions();
        tedarikciSecici.addOptions(tedarikciler.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.isim) })));
    } catch (error) {
        gosterMesaj('Tedarikçi menüsü yüklenemedi.', 'warning');
    }
}

// Yem ürünü seçicisini doldur (Değişiklik Yok)
async function yemSeciciyiDoldur() {
    try {
        const urunler = await store.getYemUrunleri();
        yemUrunSecici.clearOptions();
        yemUrunSecici.addOptions(urunler.map(u => ({ value: u.id, text: `${utils.sanitizeHTML(u.yem_adi)} (Stok: ${parseFloat(u.stok_miktari_kg).toFixed(2)} kg)` })));
    } catch (error) {
        gosterMesaj('Yem ürünleri menüsü yüklenemedi.', 'danger');
    }
}

// Tedarikçiye yem çıkışı yapma - GÜNCELLENDİ
async function yemCikisiYap() {
    const kaydetButton = document.getElementById('yem-cikis-btn');
    const originalButtonText = kaydetButton.innerHTML;
    const veri = {
        tedarikci_id: tedarikciSecici.getValue(),
        yem_urun_id: yemUrunSecici.getValue(),
        miktar_kg: document.getElementById('miktar-kg-input').value,
        aciklama: document.getElementById('aciklama-input').value.trim(),
        // --- YENİ: Fiyat tipi ve birim fiyatı ekle ---
        fiyat_tipi: document.querySelector('input[name="fiyatTipiRadio"]:checked').value,
        birim_fiyat: document.getElementById('birim-fiyat-input').value
        // --- /YENİ ---
    };

    // Doğrulama: Miktar ve fiyatın geçerli olup olmadığını kontrol et
    if (!veri.tedarikci_id || !veri.yem_urun_id || !veri.miktar_kg || parseFloat(veri.miktar_kg) <= 0 || !veri.birim_fiyat || parseFloat(veri.birim_fiyat) < 0) { // Fiyat 0 olabilir ama negatif olamaz
        gosterMesaj('Lütfen tedarikçi, yem, miktar (0\'dan büyük) ve geçerli bir birim fiyat girin.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    // Çevrimdışı kaydetme (Şimdilik fiyat tipi mantığı olmadan eski haliyle)
    // TODO: Çevrimdışı kaydetmeyi de fiyat tipi ve manuel fiyat girişiyle güncelle
    if (!navigator.onLine) {
        try {
            // Geçici olarak eski veriyi gönderiyoruz, çünkü offline.js henüz güncellenmedi
            const offlineVeri = {
                tedarikci_id: veri.tedarikci_id,
                yem_urun_id: veri.yem_urun_id,
                miktar_kg: veri.miktar_kg,
                aciklama: veri.aciklama
            };
             gosterMesaj('İnternet yok. Vadeli fiyat özelliği çevrimdışı modda henüz aktif değil, peşin fiyatla kaydedilecek.', 'warning');
            const basarili = await kaydetYemIslemiCevrimdisi(offlineVeri); // offline.js'den
            if(basarili) {
                formuTemizle(); // Yeni fonksiyonu çağır
                await yemIslemleriniYukle(1);
            }
        } finally {
            kaydetButton.disabled = false;
            kaydetButton.innerHTML = originalButtonText;
        }
        return;
    }

    // Online kaydetme (Yeni veri yapısıyla)
    try {
        const result = await api.postYemIslemi(veri); // api.js'den (artık fiyat_tipi ve birim_fiyat içeriyor)
        gosterMesaj(result.message, 'success');
        formuTemizle(); // Yeni fonksiyonu çağır
        // Stoklar ve listeler değişti, her şeyi yenile
        await Promise.all([yemUrunleriniYukle(mevcutYemSayfasi), yemSeciciyiDoldur(), yemIslemleriniYukle(1)]);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

// --- YENİ: Yem çıkışı formunu temizleme fonksiyonu ---
function formuTemizle() {
    document.getElementById('miktar-kg-input').value = '';
    document.getElementById('miktar-cuval-input').value = '';
    document.getElementById('aciklama-input').value = '';
    tedarikciSecici.clear();
    yemUrunSecici.clear(); // Bu seciliYemUrunu'nu null yapar ve handleYemSecimi'ni tetikler
    document.getElementById('fiyatTipiPesin').checked = true; // Varsayılan olarak Peşin'i seç
    // handleYemSecimi tetiklendiği için fiyatAlaniniYonet() otomatik çağrılacaktır
    document.getElementById('cuval-cikis-alani').style.display = 'none';
}
// --- /YENİ ---


// Yeni yem ürünü kaydetme veya güncelleme (Değişiklik Yok - Vadeli fiyat inputu yok)
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

// Yem işlemi (çıkışı) güncelleme (Değişiklik Yok)
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

// --- MODAL AÇMA FONKSİYONLARI (Değişiklik Yok) ---
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
// --- /MODAL AÇMA FONKSİYONLARI ---


// Yem ürünü silme işlemini yap (Değişiklik Yok)
async function yemUrunuSil() {
    const id = document.getElementById('silinecek-yem-id').value;
    yemSilmeOnayModal.hide();
    if (!navigator.onLine) {
        gosterMesaj('İnternet yok. Silme işlemi kaydedildi, bağlantı kurulunca uygulanacak.', 'info');
        await kaydetSilmeIslemiCevrimdisi('yem_urunu', parseInt(id));
        store.removeYemUrun(parseInt(id));
        yemUrunleriniYukle(mevcutYemSayfasi);
        yemSeciciyiDoldur();
        return;
    }
    const silinecekElementId = `yem-urun-${id}`;
    const silinecekElement = document.getElementById(silinecekElementId);
    if (!silinecekElement) return;
    const parent = silinecekElement.parentNode; const nextSibling = silinecekElement.nextSibling; const originalHTML = silinecekElement.outerHTML;
    silinecekElement.style.transition = 'opacity 0.4s'; silinecekElement.style.opacity = '0';
    setTimeout(() => { if(silinecekElement.parentNode) silinecekElement.remove(); if (parent && parent.children.length === 0 && (yemMevcutGorunum === 'kart' || document.getElementById('yem-urunleri-tablosu').children.length === 0)) { document.getElementById('veri-yok-mesaji').style.display = 'block'; } }, 400);
    try {
        const result = await api.deleteYemUrunu(id); gosterMesaj(result.message, 'success'); store.removeYemUrun(parseInt(id));
        await Promise.all([yemUrunleriniYukle(1), yemSeciciyiDoldur()]);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
        if (originalHTML && parent) { const tempDiv = document.createElement(yemMevcutGorunum === 'kart' ? 'div' : 'tbody'); tempDiv.innerHTML = originalHTML; const restoredElement = tempDiv.firstChild; restoredElement.style.opacity = '1'; parent.insertBefore(restoredElement, nextSibling); const veriYokMesaji = document.getElementById('veri-yok-mesaji'); if(veriYokMesaji) veriYokMesaji.style.display = 'none'; }
    }
}

// Yem işlemi (çıkışı) silme (iptal) işlemini yap (Değişiklik Yok)
async function yemIslemiSil() {
    const id = document.getElementById('silinecek-islem-id').value;
    yemIslemSilmeOnayModal.hide();
    if (!navigator.onLine) { gosterMesaj("Bu işlemi iptal etmek için internet bağlantısı gereklidir.", "warning"); return; }
    const silinecekElementId = `yem-islem-${id}`; const silinecekElement = document.getElementById(silinecekElementId); if (!silinecekElement) return;
    const parent = silinecekElement.parentNode; const nextSibling = silinecekElement.nextSibling; const originalHTML = silinecekElement.outerHTML;
    silinecekElement.style.transition = 'opacity 0.4s'; silinecekElement.style.opacity = '0';
    setTimeout(() => { if(silinecekElement.parentNode) silinecekElement.remove(); if (parent && parent.children.length === 0 && (yemIslemMevcutGorunum === 'kart' || document.getElementById('yem-islemleri-listesi').children.length === 0)) { document.getElementById('yem-islemleri-veri-yok').style.display = 'block'; } }, 400);
    try {
        const result = await api.deleteYemIslemi(id); gosterMesaj(result.message, 'success');
        await Promise.all([yemUrunleriniYukle(1), yemSeciciyiDoldur(), yemIslemleriniYukle(1)]);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
        if (originalHTML && parent) { const tempDiv = document.createElement(yemIslemMevcutGorunum === 'kart' ? 'div' : 'tbody'); tempDiv.innerHTML = originalHTML; const restoredElement = tempDiv.firstChild; restoredElement.style.opacity = '1'; parent.insertBefore(restoredElement, nextSibling); const veriYokMesaji = document.getElementById('yem-islemleri-veri-yok'); if(veriYokMesaji) veriYokMesaji.style.display = 'none'; }
    }
}
