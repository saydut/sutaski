// static/js/yem_yonetimi.js
// HATA DÜZELTMESİ: Fonksiyonlar global kapsama taşındı, listener'lar DOMContentLoaded içinde kaldı.

// === GLOBAL DEĞİŞKENLER ===
let yemIslemSilmeOnayModal, yemIslemDuzenleModal;
let tedarikciSecici, yemUrunSecici;
let yemUrunuModal, yemSilmeOnayModal;
let yemGirisSecici;
let seciliYemGirisUrunu = null; 
let isGirisInputUpdating = false; 
let yemMevcutGorunum = 'tablo'; 
let yemIslemMevcutGorunum = 'tablo';
let mevcutYemSayfasi = 1;
let mevcutIslemSayfasi = 1; 
let seciliYemCikisUrunu = null; 
let isCikisInputUpdating = false; 

const BIRIM_FIYAT_INPUT_ID = 'birim-fiyat-input';
const PESIN_FIYAT_INPUT_ID = 'birim-fiyat-input-pesin';
const VADELI_CUVAL_INPUT_ID = 'vadeli-cuval-fiyat-input';

const YEMLER_SAYFA_BASI = 10;
const ISLEMLER_SAYFA_BASI = 5; 
const KRITIK_STOK_SEVIYESI = 500;

// === SAYFA YÜKLENİNCE ÇALIŞAN KOD ===
document.addEventListener('DOMContentLoaded', function() {
    
    // Modal instance'larını başlat
    // Not: Bu değişkenler zaten global, burada sadece atama yapıyoruz
    yemUrunuModal = new bootstrap.Modal(document.getElementById('yemUrunuModal'));
    yemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemSilmeOnayModal'));
    yemIslemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemIslemSilmeOnayModal'));
    yemIslemDuzenleModal = new bootstrap.Modal(document.getElementById('yemIslemDuzenleModal'));

    // TomSelect'leri başlat
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    yemUrunSecici = new TomSelect("#yem-urun-sec", {
        create: false,
        sortField: { field: "text", direction: "asc" },
        onChange: handleYemCikisSecimi 
    });
    yemGirisSecici = new TomSelect("#yem-urun-giris-sec", {
        create: false,
        sortField: { field: "text", direction: "asc" },
        onChange: handleYemGirisSecimi
    });
    
    // Form Dinleyicileri
    const yemGirisForm = document.getElementById('yem-giris-formu');
    if (yemGirisForm) {
        yemGirisForm.addEventListener('submit', yemGirisiYap);
    }
    // GİRİŞ FORMU
    document.getElementById('giris-miktar-kg-input').addEventListener('input', girisCuvalGuncelle);
    document.getElementById('giris-miktar-cuval-input').addEventListener('input', girisKgGuncelle);
    
    // ÇIKIŞ FORMU
    document.querySelectorAll('input[name="fiyatTipiRadio"]').forEach(radio => {
        radio.addEventListener('change', fiyatAlaniniYonet);
    });
    const vadeliCuvalInput = document.getElementById(VADELI_CUVAL_INPUT_ID);
    if (vadeliCuvalInput) {
        vadeliCuvalInput.addEventListener('input', vadeliCuvalFiyatiniHesapla);
    }
    document.getElementById('miktar-kg-input').addEventListener('input', cikisCuvalGuncelle);
    document.getElementById('miktar-cuval-input').addEventListener('input', cikisKgGuncelle);
    
    // YENİ ÜRÜN TANIMLA MODALI
    const fiyatlandirmaTipiSelect = document.getElementById('fiyatlandirma-tipi-sec');
    if (fiyatlandirmaTipiSelect) {
        fiyatlandirmaTipiSelect.addEventListener('change', fiyatlandirmaAlanlariniYonet); 
    }

    // Görünüm tercihlerini yükle
    yemMevcutGorunum = localStorage.getItem('yemGorunum') || 'tablo';
    yemIslemMevcutGorunum = localStorage.getItem('yemIslemGorunum') || 'tablo';
    
    gorunumuAyarla(); 
    gorunumuAyarlaIslemler(); 
    
    // Başlangıç verilerini yükle
    tedarikcileriDoldur();
    yemSecicileriDoldur(); 
    yemUrunleriniYukle(1);
    yemIslemleriniYukle(1); 

    fiyatAlaniniYonet();
});


// ==========================================================
// YEM GİRİŞ (ALIŞ) FONKSİYONLARI
// ==========================================================

async function handleYemGirisSecimi(value) {
    const cuvalGirisAlani = document.getElementById('cuval-giris-alani');
    const kgInput = document.getElementById('giris-miktar-kg-input');
    const cuvalInput = document.getElementById('giris-miktar-cuval-input');
    const alisFiyatInput = document.getElementById('giris-alis-fiyati-input');
    const fiyatUyari = document.getElementById('giris-fiyat-uyari');

    kgInput.value = '';
    cuvalInput.value = '';
    alisFiyatInput.value = '';
    fiyatUyari.textContent = '';
    seciliYemGirisUrunu = null;

    if (!value) {
        cuvalGirisAlani.style.display = 'none';
        return;
    }

    try {
        const urunler = await store.getYemUrunleri();
        seciliYemGirisUrunu = urunler.find(u => u.id == value);

        if (seciliYemGirisUrunu) {
            const varsayilanAlisFiyati = parseFloat(seciliYemGirisUrunu.birim_fiyat).toFixed(2);
            alisFiyatInput.value = varsayilanAlisFiyati;
            
            if (seciliYemGirisUrunu.cuval_agirligi_kg > 0) {
                cuvalGirisAlani.style.display = 'block';
                const cuvalAlisFiyati = parseFloat(seciliYemGirisUrunu.cuval_fiyati).toFixed(2);
                fiyatUyari.textContent = `Varsayılan çuval alış fiyatı: ${cuvalAlisFiyati} TL`;
            } else {
                cuvalGirisAlani.style.display = 'none';
                fiyatUyari.textContent = `Varsayılan KG alış fiyatı: ${varsayilanAlisFiyati} TL`;
            }
        }
    } catch (error) {
        console.error("Seçili yem girişi ürünü bilgisi alınamadı:", error);
        cuvalGirisAlani.style.display = 'none';
        seciliYemGirisUrunu = null;
    }
}

function girisKgGuncelle() {
    if (isGirisInputUpdating || !seciliYemGirisUrunu || !seciliYemGirisUrunu.cuval_agirligi_kg) return;
    isGirisInputUpdating = true;
    const cuvalInput = document.getElementById('giris-miktar-cuval-input');
    const kgInput = document.getElementById('giris-miktar-kg-input');
    const cuvalAdedi = parseFloat(cuvalInput.value);
    const cuvalAgirligi = parseFloat(seciliYemGirisUrunu.cuval_agirligi_kg);
    if (!isNaN(cuvalAdedi)) {
        kgInput.value = (cuvalAdedi * cuvalAgirligi).toFixed(2);
    }
    setTimeout(() => { isGirisInputUpdating = false; }, 50);
}

function girisCuvalGuncelle() {
    if (isGirisInputUpdating || !seciliYemGirisUrunu || !seciliYemGirisUrunu.cuval_agirligi_kg) return;
    isGirisInputUpdating = true;
    const kgInput = document.getElementById('giris-miktar-kg-input');
    const cuvalInput = document.getElementById('giris-miktar-cuval-input');
    const kgMiktari = parseFloat(kgInput.value);
    const cuvalAgirligi = parseFloat(seciliYemGirisUrunu.cuval_agirligi_kg);
    if (!isNaN(kgMiktari) && cuvalAgirligi > 0) {
        const cuvalAdedi = kgMiktari / cuvalAgirligi;
        cuvalInput.value = cuvalAdedi % 1 === 0 && cuvalAdedi.toString().indexOf('.') === -1 ? cuvalAdedi : cuvalAdedi.toFixed(2);
    }
    setTimeout(() => { isGirisInputUpdating = false; }, 50);
}

async function yemGirisiYap(event) {
    event.preventDefault(); 
    const kaydetButton = document.getElementById('yem-giris-btn');
    const originalButtonText = kaydetButton.innerHTML;

    const veri = {
        yem_urun_id: yemGirisSecici.getValue(),
        miktar_kg: document.getElementById('giris-miktar-kg-input').value,
        birim_alis_fiyati: document.getElementById('giris-alis-fiyati-input').value,
        aciklama: document.getElementById('giris-aciklama-input').value.trim()
    };

    if (!veri.yem_urun_id || !veri.miktar_kg || !veri.birim_alis_fiyati || parseFloat(veri.miktar_kg) <= 0 || parseFloat(veri.birim_alis_fiyati) <= 0) {
        gosterMesaj('Lütfen yem, miktar (0\'dan büyük) ve geçerli bir alış fiyatı girin.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    try {
        const result = await api.request('/yem/api/giris/ekle', {
            method: 'POST',
            body: JSON.stringify(veri),
            headers: { 'Content-Type': 'application/json' }
        });
        
        gosterMesaj(result.message, 'success');
        document.getElementById('yem-giris-formu').reset();
        yemGirisSecici.clear();
        document.getElementById('cuval-giris-alani').style.display = 'none';
        document.getElementById('giris-fiyat-uyari').textContent = '';

        await Promise.all([yemUrunleriniYukle(mevcutYemSayfasi), yemSecicileriDoldur()]);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}


// ==========================================================
// YEM ÇIKIŞ (SATIŞ) FONKSİYONLARI
// ==========================================================

function vadeliCuvalFiyatiniHesapla() {
    const vadeliCuvalInput = document.getElementById(VADELI_CUVAL_INPUT_ID);
    const birimFiyatInput = document.getElementById(BIRIM_FIYAT_INPUT_ID); 

    if (!seciliYemCikisUrunu || !seciliYemCikisUrunu.cuval_agirligi_kg) {
        birimFiyatInput.value = '';
        return;
    }
    const cuvalFiyati = parseFloat(vadeliCuvalInput.value);
    const cuvalAgirligi = parseFloat(seciliYemCikisUrunu.cuval_agirligi_kg);
    if (!isNaN(cuvalFiyati) && cuvalAgirligi > 0) {
        birimFiyatInput.value = (cuvalFiyati / cuvalAgirligi).toFixed(2);
    } else {
        birimFiyatInput.value = '';
    }
}

async function fiyatAlaniniYonet() {
    const fiyatTipiRadio = document.querySelector('input[name="fiyatTipiRadio"]:checked');
    if (!fiyatTipiRadio) return; 
    
    const fiyatTipi = fiyatTipiRadio.value;
    const pesinFiyatAlani = document.getElementById('pesin-fiyat-alani');
    const vadeliFiyatAlani = document.getElementById('vadeli-fiyat-alani');
    const vadeliKGGrup = document.getElementById('vadeli-kg-fiyat-grup');
    const vadeliCuvalGrup = document.getElementById('vadeli-cuval-fiyat-grup');
    const pesinFiyatInput = document.getElementById(PESIN_FIYAT_INPUT_ID);
    const vadeliKGInput = document.getElementById(BIRIM_FIYAT_INPUT_ID);
    const vadeliCuvalInput = document.getElementById(VADELI_CUVAL_INPUT_ID);
    
    if (!yemUrunSecici) return; 
    const yemUrunId = yemUrunSecici.getValue();

    if (!seciliYemCikisUrunu && yemUrunId) {
         try {
             const urunler = await store.getYemUrunleri();
             seciliYemCikisUrunu = urunler.find(u => u.id == yemUrunId);
         } catch(e){
             console.error("Fiyat yönetimi için yem ürünü bilgisi alınamadı:", e);
             seciliYemCikisUrunu = null;
         }
    }
    
    const isCuvalUrunu = seciliYemCikisUrunu && parseFloat(seciliYemCikisUrunu.cuval_agirligi_kg) > 0;

    pesinFiyatAlani.style.display = 'none';
    vadeliFiyatAlani.style.display = 'none';
    vadeliKGGrup.style.display = 'none';
    vadeliCuvalGrup.style.display = 'none';
    pesinFiyatInput.value = '';
    vadeliKGInput.value = '';
    vadeliCuvalInput.value = '';

    if (fiyatTipi === 'pesin') {
        pesinFiyatAlani.style.display = 'block';
        if (seciliYemCikisUrunu) {
            pesinFiyatInput.value = parseFloat(seciliYemCikisUrunu.satis_fiyati).toFixed(2);
        }
    } else {
        vadeliFiyatAlani.style.display = 'block';
        if (isCuvalUrunu) {
            vadeliCuvalGrup.style.display = 'block';
            vadeliKGGrup.style.display = 'none';
            vadeliCuvalInput.focus();
        } else {
            vadeliKGGrup.style.display = 'block';
            vadeliCuvalGrup.style.display = 'none';
            vadeliKGInput.focus();
        }
    }
}

async function handleYemCikisSecimi(value) {
    const cuvalCikisAlani = document.getElementById('cuval-cikis-alani');
    const kgInput = document.getElementById('miktar-kg-input');
    const cuvalInput = document.getElementById('miktar-cuval-input');

    kgInput.value = '';
    cuvalInput.value = '';
    seciliYemCikisUrunu = null; 

    if (!value) {
        cuvalCikisAlani.style.display = 'none';
        await fiyatAlaniniYonet(); 
        return;
    }

    try {
        const urunler = await store.getYemUrunleri();
        seciliYemCikisUrunu = urunler.find(u => u.id == value); 

        if (seciliYemCikisUrunu && seciliYemCikisUrunu.cuval_agirligi_kg > 0) {
            cuvalCikisAlani.style.display = 'block';
        } else {
            cuvalCikisAlani.style.display = 'none';
        }
        await fiyatAlaniniYonet();

    } catch (error) {
        console.error("Seçili yem çıkışı ürünü bilgisi alınamadı:", error);
        cuvalCikisAlani.style.display = 'none';
        seciliYemCikisUrunu = null;
        await fiyatAlaniniYonet();
    }
}

function cikisKgGuncelle() {
    if (isCikisInputUpdating || !seciliYemCikisUrunu || !seciliYemCikisUrunu.cuval_agirligi_kg) return;
    isCikisInputUpdating = true;
    const cuvalInput = document.getElementById('miktar-cuval-input');
    const kgInput = document.getElementById('miktar-kg-input');
    const cuvalAdedi = parseFloat(cuvalInput.value);
    const cuvalAgirligi = parseFloat(seciliYemCikisUrunu.cuval_agirligi_kg);
    if (!isNaN(cuvalAdedi)) {
        kgInput.value = (cuvalAdedi * cuvalAgirligi).toFixed(2);
    }
    setTimeout(() => { isCikisInputUpdating = false; }, 50);
}

function cikisCuvalGuncelle() {
    if (isCikisInputUpdating || !seciliYemCikisUrunu || !seciliYemCikisUrunu.cuval_agirligi_kg) return;
    isCikisInputUpdating = true;
    const kgInput = document.getElementById('miktar-kg-input');
    const cuvalInput = document.getElementById('miktar-cuval-input');
    const kgMiktari = parseFloat(kgInput.value);
    const cuvalAgirligi = parseFloat(seciliYemCikisUrunu.cuval_agirligi_kg);
    if (!isNaN(kgMiktari) && cuvalAgirligi > 0) {
        const cuvalAdedi = kgMiktari / cuvalAgirligi;
        cuvalInput.value = cuvalAdedi % 1 === 0 && cuvalAdedi.toString().indexOf('.') === -1 ? cuvalAdedi : cuvalAdedi.toFixed(2);
    }
    setTimeout(() => { isCikisInputUpdating = false; }, 50);
}

// onclick="yemCikisiYap()"
async function yemCikisiYap() {
    const kaydetButton = document.getElementById('yem-cikis-btn');
    const originalButtonText = kaydetButton.innerHTML;
    const fiyatTipi = document.querySelector('input[name="fiyatTipiRadio"]:checked').value;

    let birimFiyat = '';
    if (fiyatTipi === 'pesin') {
        birimFiyat = document.getElementById(PESIN_FIYAT_INPUT_ID).value;
    } else {
        birimFiyat = document.getElementById(BIRIM_FIYAT_INPUT_ID).value;
    }

    const veri = {
        tedarikci_id: tedarikciSecici.getValue(),
        yem_urun_id: yemUrunSecici.getValue(),
        miktar_kg: document.getElementById('miktar-kg-input').value,
        aciklama: document.getElementById('aciklama-input').value.trim(),
        fiyat_tipi: fiyatTipi,
        birim_fiyat: birimFiyat 
    };
    
    if (!veri.tedarikci_id || !veri.yem_urun_id || !veri.miktar_kg || parseFloat(veri.miktar_kg) <= 0 || !veri.birim_fiyat || parseFloat(veri.birim_fiyat) < 0) {
        gosterMesaj('Lütfen tedarikçi, yem, miktar (0\'dan büyük) ve geçerli bir birim fiyat girin.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    if (!navigator.onLine) {
        try {
             gosterMesaj('İnternet yok. Yem çıkışı çevrimdışı olarak kaydedildi.', 'info');
            const basarili = await kaydetYemIslemiCevrimdisi(veri);
            if(basarili) {
                formuTemizleCikis(); 
                await yemIslemleriniYukle(1);
            }
        } finally {
            kaydetButton.disabled = false;
            kaydetButton.innerHTML = originalButtonText;
        }
        return;
    }

    try {
        const result = await api.postYemIslemi(veri);
        gosterMesaj(result.message, 'success');
        formuTemizleCikis(); 
        await Promise.all([yemUrunleriniYukle(mevcutYemSayfasi), yemSecicileriDoldur(), yemIslemleriniYukle(1)]);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

function formuTemizleCikis() {
    document.getElementById('miktar-kg-input').value = '';
    document.getElementById('miktar-cuval-input').value = '';
    document.getElementById('aciklama-input').value = '';
    if (tedarikciSecici) tedarikciSecici.clear();
    if (yemUrunSecici) yemUrunSecici.clear();
    document.getElementById('fiyatTipiPesin').checked = true;
    document.getElementById('cuval-cikis-alani').style.display = 'none';
}


// ==========================================================
// ORTAK FONKSİYONLAR (Listeleme, Tanımlama, Silme vb.)
// ==========================================================

// onclick="gorunumuDegistir('tablo')"
function gorunumuDegistir(yeniGorunum) {
    if (yemMevcutGorunum === yeniGorunum) return;
    yemMevcutGorunum = yeniGorunum;
    localStorage.setItem('yemGorunum', yemMevcutGorunum);
    gorunumuAyarla();
    yemUrunleriniYukle(mevcutYemSayfasi);
}

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

// onclick="gorunumuDegistirIslemler('tablo')"
function gorunumuDegistirIslemler(yeniGorunum) {
    if (yemIslemMevcutGorunum === yeniGorunum) return;
    yemIslemMevcutGorunum = yeniGorunum;
    localStorage.setItem('yemIslemGorunum', yemIslemMevcutGorunum);
    gorunumuAyarlaIslemler();
    yemIslemleriniYukle(mevcutIslemSayfasi);
}

function gorunumuAyarlaIslemler() {
    document.querySelectorAll('.gorunum-konteyneri-islemler').forEach(el => el.style.display = 'none');
    
    const activeContainer = document.getElementById(`islemler-${yemIslemMevcutGorunum}-gorunumu`);
    if (activeContainer) {
        activeContainer.style.display = 'block';
    }
    
    const btnListe = document.getElementById('btn-islemler-liste');
    const btnKart = document.getElementById('btn-islemler-kart');
    if (btnListe) {
        btnListe.classList.toggle('active', yemIslemMevcutGorunum === 'tablo');
    }
    if (btnKart) {
        btnKart.classList.toggle('active', yemIslemMevcutGorunum === 'kart');
    }
}

async function yemUrunleriniYukle(sayfa = 1) {
    mevcutYemSayfasi = sayfa;
    await store.getYemUrunleri(true); 

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

function formatAlisFiyat(urun) {
    const cuvalFiyati = parseFloat(urun.cuval_fiyati);
    const cuvalAgirligi = parseFloat(urun.cuval_agirligi_kg);
    if (cuvalFiyati > 0 && cuvalAgirligi > 0) {
        return `${cuvalFiyati.toFixed(2)} TL / Çuval (${cuvalAgirligi.toFixed(1)} KG)`;
    }
    return `${parseFloat(urun.birim_fiyat).toFixed(2)} TL / KG`;
}

function formatSatisFiyat(urun) {
    const satisCuvalFiyati = parseFloat(urun.satis_cuval_fiyati);
    const cuvalAgirligi = parseFloat(urun.cuval_agirligi_kg);
    if (satisCuvalFiyati > 0 && cuvalAgirligi > 0) {
        return `${satisCuvalFiyati.toFixed(2)} TL / Çuval`;
    }
    return `${parseFloat(urun.satis_fiyati).toFixed(2)} TL / KG`;
}

function formatStokGosterimi(urun) {
    const stokMiktari = parseFloat(urun.stok_miktari_kg);
    const cuvalAgirligi = parseFloat(urun.cuval_agirligi_kg);
    if (cuvalAgirligi > 0 && stokMiktari > 0) {
        const cuvalAdedi = (stokMiktari / cuvalAgirligi);
        const cuvalAdediStr = Number.isInteger(cuvalAdedi) ? cuvalAdedi : cuvalAdedi.toFixed(1); 
        return `${stokMiktari.toFixed(2)} KG <span class="text-secondary">(${cuvalAdediStr} Çuval)</span>`;
    } else {
        return `${stokMiktari.toFixed(2)} KG`;
    }
}

function renderYemUrunuAsTable(container, urunler) {
    container.innerHTML = ''; // Temizle
    urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        const uyariIconu = isKritik ? `<i class="bi bi-exclamation-triangle-fill text-danger me-2" title="Stok kritik seviyede!"></i>` : '';
        const alisFiyatGosterim = formatAlisFiyat(urun);
        const satisFiyatGosterim = formatSatisFiyat(urun);
        const stokGosterim = formatStokGosterimi(urun);
        container.innerHTML += `
            <tr id="yem-urun-${urun.id}" class="${isKritik ? 'table-warning' : ''}">
                <td>${uyariIconu}<strong>${utils.sanitizeHTML(urun.yem_adi)}</strong></td>
                <td class="text-end">${stokGosterim}</td>
                <td class="text-end">${alisFiyatGosterim}</td>
                <td class="text-end text-success fw-bold">${satisFiyatGosterim}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick='yemDuzenleAc(${JSON.stringify(urun)})'><i class="bi bi-pencil"></i></button> 
                    <button class="btn btn-sm btn-outline-danger" onclick="yemSilmeOnayiAc(${urun.id}, '${utils.sanitizeHTML(urun.yem_adi.replace(/'/g, "\\'"))}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

function renderYemUrunuAsCards(container, urunler) {
    container.innerHTML = ''; // Temizle
    urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        const alisFiyatGosterim = formatAlisFiyat(urun);
        const satisFiyatGosterim = formatSatisFiyat(urun);
        const stokGosterim = formatStokGosterimi(urun);
        container.innerHTML += `
            <div class="col-md-6 col-12" id="yem-urun-${urun.id}">
                <div class="yem-card ${isKritik ? 'stok-kritik' : ''}">
                    <div class="yem-card-header"><h5>${utils.sanitizeHTML(urun.yem_adi)}</h5></div>
                    <div class="yem-card-body">
                        <p class="mb-1 text-secondary">Mevcut Stok</p>
                        <p class="stok-bilgisi ${isKritik ? 'text-danger' : ''}">${stokGosterim}</p>
                    </div>
                    <div class="yem-card-footer">
                        <div>
                            <span class="fiyat-bilgisi d-block text-secondary">Alış: ${alisFiyatGosterim}</span>
                            <span class="fiyat-bilgisi d-block text-success fw-bold">Satış: ${satisFiyatGosterim}</span>
                        </div>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" onclick='yemDuzenleAc(${JSON.stringify(urun)})'><i class="bi bi-pencil"></i></button> 
                            <button class="btn btn-sm btn-outline-danger" onclick="yemSilmeOnayiAc(${urun.id}, '${utils.sanitizeHTML(urun.yem_adi.replace(/'/g, "\\'"))}')"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
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
        mevcutGorunum: yemIslemMevcutGorunum
    });
}

function renderYemIslemiAsTable(container, islemler) {
    container.innerHTML = ''; // Temizle
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        const tedarikciAdi = islem.tedarikciler ? utils.sanitizeHTML(islem.tedarikciler.isim) : 'Bilinmiyor';
        const yemAdi = islem.yem_urunleri ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Bilinmiyor';
        container.innerHTML += `<tr id="yem-islem-${islem.id}"><td>${tarih}</td><td>${tedarikciAdi}</td><td>${yemAdi}</td><td class="text-end">${miktar} KG</td><td class="text-center"><button class="btn btn-sm btn-outline-primary" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button></td></tr>`;
    });
}

function renderYemIslemiAsCards(container, islemler) {
    container.innerHTML = ''; // Temizle
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        const tedarikciAdi = islem.tedarikciler ? utils.sanitizeHTML(islem.tedarikciler.isim) : 'Bilinmiyor';
        const yemAdi = islem.yem_urunleri ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Bilinmiyor';
        container.innerHTML += `<div class="col-lg-6 col-12" id="yem-islem-${islem.id}"><div class="card p-2 h-100"><div class="card-body p-2 d-flex flex-column"><div><h6 class="card-title mb-0">${tedarikciAdi}</h6><small class="text-secondary">${yemAdi}</small></div><div class="my-2 flex-grow-1"><span class="fs-4 fw-bold text-primary">${miktar} KG</span></div><div class="d-flex justify-content-between align-items-center"><small class="text-secondary">${tarih}</small><div class="btn-group btn-group-sm"><button class="btn btn-sm btn-outline-primary" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')"><i class="bi bi-pencil"></i></button> <button class="btn btn-sm btn-outline-danger" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button></div></div></div></div></div>`;
    });
}

async function tedarikcileriDoldur() {
    try {
        const tedarikciler = await store.getTedarikciler();
        tedarikciSecici.clearOptions();
        tedarikciSecici.addOptions(tedarikciler.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.isim) })));
    } catch (error) {
        gosterMesaj('Tedarikçi menüsü yüklenemedi.', 'warning');
    }
}

async function yemSecicileriDoldur() {
    try {
        const urunler = await store.getYemUrunleri();
        const options = urunler.map(u => ({ 
            value: u.id, 
            text: `${utils.sanitizeHTML(u.yem_adi)} (Stok: ${parseFloat(u.stok_miktari_kg).toFixed(2)} kg)` 
        }));
        
        yemUrunSecici.clearOptions();
        yemUrunSecici.addOptions(options);
        
        yemGirisSecici.clearOptions();
        yemGirisSecici.addOptions(options);

    } catch (error) {
        gosterMesaj('Yem ürünleri menüsü yüklenemedi.', 'danger');
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
        veri.satis_cuval_fiyati = document.getElementById('yem-satis-cuval-fiyat-input').value; 
        veri.stok_adedi = stokDegeri;
    } else {
        veri.birim_fiyat = document.getElementById('yem-fiyat-input').value; 
        veri.satis_fiyati = document.getElementById('yem-satis-fiyat-input').value; 
        veri.stok_miktari_kg = stokDegeri;
    }

    if (!veri.yem_adi || !stokDegeri) {
        gosterMesaj('Lütfen yem adı ve stok miktarını doldurun.', 'warning');
        return;
    }
    if (veri.fiyatlandirma_tipi === 'cuval' && (!veri.cuval_fiyati || !veri.satis_cuval_fiyati || !veri.cuval_agirligi_kg)) {
         gosterMesaj('Lütfen çuval için ağırlık, alış ve satış fiyatlarını girin.', 'warning');
         return;
    }
     if (veri.fiyatlandirma_tipi === 'kg' && (!veri.birim_fiyat || !veri.satis_fiyati)) {
         gosterMesaj('Lütfen KG için alış ve satış fiyatlarını girin.', 'warning');
         return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    if (!id && !navigator.onLine) {
       try {
           gosterMesaj('İnternet yok. Yeni ürün çevrimdışı kaydedildi.', 'info');
           const basarili = await kaydetYeniYemUrunuCevrimdisi(veri);
           if(basarili) {
               yemUrunuModal.hide();
               await yemUrunleriniYukle(1);
               await yemSecicileriDoldur();
           }
       } finally {
           kaydetButton.disabled = false;
           kaydetButton.innerHTML = originalButtonText;
       }
       return;
    }
    
    try {
        let result;
        if (id) {
             if(!navigator.onLine) { throw new Error("Ürünleri düzenlemek için internet bağlantısı gereklidir."); }
             result = await api.updateYemUrunu(id, veri); 
             store.updateYemUrun(result.urun);
        } else {
             result = await api.postYemUrunu(veri);
             store.addYemUrun(result.urun);
        }

        gosterMesaj(result.message, 'success');
        yemUrunuModal.hide();
        await yemUrunleriniYukle(mevcutYemSayfasi);
        await yemSecicileriDoldur();
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

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
        const result = await api.updateYemIslemi(id, veri);
        gosterMesaj(result.message, 'success');
        yemIslemDuzenleModal.hide();
        await Promise.all([yemIslemleriniYukle(mevcutIslemSayfasi), yemUrunleriniYukle(mevcutYemSayfasi), yemSecicileriDoldur()]);
    } catch (error) {
        gosterMesaj(error.message, "danger");
    }
}

// --- MODAL AÇMA FONKSİYONLARI ---
function yeniYemModaliniAc() {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yeni Yem Ürünü Tanımla';
    document.getElementById('yem-urun-form').reset();
    document.getElementById('edit-yem-id').value = '';
    document.getElementById('fiyatlandirma-tipi-sec').value = 'kg';
    fiyatlandirmaAlanlariniYonet(); // Hata buradaydı, artık fonksiyon global
    yemUrunuModal.show();
}

function yemDuzenleAc(urun) {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yem Ürününü Düzenle';
    document.getElementById('edit-yem-id').value = urun.id;
    document.getElementById('yem-adi-input').value = urun.yem_adi;
    
    const stokInput = document.getElementById('yem-stok-input');
    const cuvalAgirligi = parseFloat(urun.cuval_agirligi_kg);

    if (cuvalAgirligi > 0) {
        document.getElementById('fiyatlandirma-tipi-sec').value = 'cuval';
        document.getElementById('cuval-agirlik-input').value = cuvalAgirligi;
        document.getElementById('cuval-fiyat-input').value = parseFloat(urun.cuval_fiyati).toFixed(2);
        document.getElementById('yem-satis-cuval-fiyat-input').value = parseFloat(urun.satis_cuval_fiyati).toFixed(2);
        const cuvalAdedi = parseFloat(urun.stok_miktari_kg) / cuvalAgirligi;
        stokInput.value = Number.isInteger(cuvalAdedi) ? cuvalAdedi : cuvalAdedi.toFixed(2);
    } else {
        document.getElementById('fiyatlandirma-tipi-sec').value = 'kg';
        document.getElementById('yem-fiyat-input').value = parseFloat(urun.birim_fiyat).toFixed(2);
        document.getElementById('yem-satis-fiyat-input').value = parseFloat(urun.satis_fiyati).toFixed(2);
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

// Bu fonksiyon 'fiyatlandirmaAlanlariniYonet' HTML'deki 'onchange' tarafından çağrılır
function fiyatlandirmaAlanlariniYonet() {
    const tip = document.getElementById('fiyatlandirma-tipi-sec').value;
    const kgAlani = document.getElementById('kg-fiyat-alani');
    const cuvalAlani = document.getElementById('cuval-fiyat-alani');
    const stokLabel = document.getElementById('yem-stok-label');
    const stokInput = document.getElementById('yem-stok-input');

    if (tip === 'cuval') {
        kgAlani.style.display = 'none';
        cuvalAlani.style.display = 'block';
        stokLabel.innerHTML = 'Başlangıç Stok (Çuval Adedi) <span class="text-danger">*</span>';
        stokInput.placeholder = "Örn: 100";
        stokInput.step = "1";
    } else {
        kgAlani.style.display = 'block';
        cuvalAlani.style.display = 'none';
        stokLabel.innerHTML = 'Başlangıç Stok (KG) <span class="text-danger">*</span>';
        stokInput.placeholder = "Örn: 5000";
        stokInput.step = "1";
    }
}


async function yemUrunuSil() {
    const id = document.getElementById('silinecek-yem-id').value;
    yemSilmeOnayModal.hide();
    if (!navigator.onLine) {
        gosterMesaj('İnternet yok. Silme işlemi kaydedildi, bağlantı kurulunca uygulanacak.', 'info');
        await kaydetSilmeIslemiCevrimdisi('yem_urunu', parseInt(id));
        store.removeYemUrun(parseInt(id));
        yemUrunleriniYukle(mevcutYemSayfasi);
        yemSecicileriDoldur();
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
        await Promise.all([yemUrunleriniYukle(1), yemSecicileriDoldur()]);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
        if (originalHTML && parent) { const tempDiv = document.createElement(yemMevcutGorunum === 'kart' ? 'div' : 'tbody'); tempDiv.innerHTML = originalHTML; const restoredElement = tempDiv.firstChild; restoredElement.style.opacity = '1'; parent.insertBefore(restoredElement, nextSibling); const veriYokMesaji = document.getElementById('veri-yok-mesaji'); if(veriYokMesaji) veriYokMesaji.style.display = 'none'; }
    }
}

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
        await Promise.all([yemUrunleriniYukle(1), yemSecicileriDoldur(), yemIslemleriniYukle(1)]);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
        if (originalHTML && parent) { const tempDiv = document.createElement(yemIslemMevcutGorunum === 'kart' ? 'div' : 'tbody'); tempDiv.innerHTML = originalHTML; const restoredElement = tempDiv.firstChild; restoredElement.style.opacity = '1'; parent.insertBefore(restoredElement, nextSibling); const veriYokMesaji = document.getElementById('yem-islemleri-veri-yok'); if(veriYokMesaji) veriYokMesaji.style.display = 'none'; }
    }
}