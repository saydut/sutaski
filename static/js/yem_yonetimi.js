// static/js/yem_yonetimi.js

// === 1. GLOBAL DEĞİŞKENLER ===
let tedarikciSecici, yemUrunSecici, yemGirisSecici;
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

// === 2. FONKSİYON TANIMLARI (ÖNCE BUNLAR YÜKLENMELİ) ===

// --- Yem Giriş (Alış) Mantığı ---
async function handleYemGirisSecimi(value) {
    const cuvalGirisAlani = document.getElementById('cuval-giris-alani');
    const kgInput = document.getElementById('giris-miktar-kg-input');
    const cuvalInput = document.getElementById('giris-miktar-cuval-input');
    const alisFiyatInput = document.getElementById('giris-alis-fiyati-input');
    const fiyatUyari = document.getElementById('giris-fiyat-uyari');

    if(kgInput) kgInput.value = ''; 
    if(cuvalInput) cuvalInput.value = ''; 
    if(alisFiyatInput) alisFiyatInput.value = ''; 
    if(fiyatUyari) fiyatUyari.textContent = '';
    seciliYemGirisUrunu = null;

    if (!value) { 
        if(cuvalGirisAlani) cuvalGirisAlani.classList.add('hidden'); 
        return; 
    }

    try {
        const urunler = await store.getYemUrunleri();
        seciliYemGirisUrunu = urunler.find(u => u.id == value);
        if (seciliYemGirisUrunu) {
            const varsayilanAlisFiyati = parseFloat(seciliYemGirisUrunu.birim_fiyat).toFixed(2);
            if(alisFiyatInput) alisFiyatInput.value = varsayilanAlisFiyati;
            
            if (seciliYemGirisUrunu.cuval_agirligi_kg > 0) {
                if(cuvalGirisAlani) cuvalGirisAlani.classList.remove('hidden');
                if(fiyatUyari) fiyatUyari.textContent = `Varsayılan çuval alış: ${parseFloat(seciliYemGirisUrunu.cuval_fiyati).toFixed(2)} TL`;
            } else {
                if(cuvalGirisAlani) cuvalGirisAlani.classList.add('hidden');
                if(fiyatUyari) fiyatUyari.textContent = `Varsayılan KG alış: ${varsayilanAlisFiyati} TL`;
            }
        }
    } catch (e) { 
        console.error(e);
        if(cuvalGirisAlani) cuvalGirisAlani.classList.add('hidden'); 
        seciliYemGirisUrunu = null; 
    }
}

function girisKgGuncelle() {
    if (isGirisInputUpdating || !seciliYemGirisUrunu || !seciliYemGirisUrunu.cuval_agirligi_kg) return;
    isGirisInputUpdating = true;
    const cuval = parseFloat(document.getElementById('giris-miktar-cuval-input').value);
    if (!isNaN(cuval)) document.getElementById('giris-miktar-kg-input').value = (cuval * parseFloat(seciliYemGirisUrunu.cuval_agirligi_kg)).toFixed(2);
    setTimeout(() => { isGirisInputUpdating = false; }, 50);
}

function girisCuvalGuncelle() {
    if (isGirisInputUpdating || !seciliYemGirisUrunu || !seciliYemGirisUrunu.cuval_agirligi_kg) return;
    isGirisInputUpdating = true;
    const kg = parseFloat(document.getElementById('giris-miktar-kg-input').value);
    const agirlik = parseFloat(seciliYemGirisUrunu.cuval_agirligi_kg);
    if (!isNaN(kg) && agirlik > 0) {
        const adet = kg / agirlik;
        document.getElementById('giris-miktar-cuval-input').value = (adet % 1 === 0) ? adet : adet.toFixed(2);
    }
    setTimeout(() => { isGirisInputUpdating = false; }, 50);
}

async function yemGirisiYap(event) {
    event.preventDefault();
    const btn = document.getElementById('yem-giris-btn');
    const originalText = btn.innerHTML;
    const veri = {
        yem_urun_id: yemGirisSecici.getValue(),
        miktar_kg: document.getElementById('giris-miktar-kg-input').value,
        birim_alis_fiyati: document.getElementById('giris-alis-fiyati-input').value,
        aciklama: document.getElementById('giris-aciklama-input').value.trim()
    };

    if (!veri.yem_urun_id || !veri.miktar_kg || !veri.birim_alis_fiyati || parseFloat(veri.miktar_kg) <= 0) {
        gosterMesaj('Lütfen tüm alanları doğru doldurun.', 'warning'); return;
    }

    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Kaydediliyor...';

    try {
        const res = await api.request('/yem/api/giris/ekle', { method: 'POST', body: JSON.stringify(veri), headers: { 'Content-Type': 'application/json' } });
        gosterMesaj(res.message, 'success');
        document.getElementById('yem-giris-formu').reset();
        yemGirisSecici.clear();
        document.getElementById('cuval-giris-alani').classList.add('hidden');
        document.getElementById('giris-fiyat-uyari').textContent = '';
        await Promise.all([yemUrunleriniYukle(mevcutYemSayfasi), yemSecicileriDoldur()]);
    } catch (e) { gosterMesaj(e.message, 'danger'); }
    finally { btn.disabled = false; btn.innerHTML = originalText; }
}

// --- Yem Çıkış (Satış) Mantığı ---
async function handleYemCikisSecimi(value) {
    const cuvalArea = document.getElementById('cuval-cikis-alani');
    const miktarKg = document.getElementById('miktar-kg-input');
    const miktarCuval = document.getElementById('miktar-cuval-input');
    
    if(miktarKg) miktarKg.value = '';
    if(miktarCuval) miktarCuval.value = '';
    seciliYemCikisUrunu = null;
    
    if(!value) { 
        if(cuvalArea) cuvalArea.classList.add('hidden'); 
        await fiyatAlaniniYonet(); 
        return; 
    }

    try {
        const urunler = await store.getYemUrunleri();
        seciliYemCikisUrunu = urunler.find(u => u.id == value);
        if(seciliYemCikisUrunu && parseFloat(seciliYemCikisUrunu.cuval_agirligi_kg) > 0) {
            if(cuvalArea) cuvalArea.classList.remove('hidden');
        } else {
            if(cuvalArea) cuvalArea.classList.add('hidden');
        }
        await fiyatAlaniniYonet();
    } catch(e) { 
        if(cuvalArea) cuvalArea.classList.add('hidden'); 
        seciliYemCikisUrunu = null; 
        await fiyatAlaniniYonet(); 
    }
}

function vadeliCuvalFiyatiniHesapla() {
    const cuvalFiyat = parseFloat(document.getElementById(VADELI_CUVAL_INPUT_ID).value);
    const kgInput = document.getElementById(BIRIM_FIYAT_INPUT_ID);
    if (seciliYemCikisUrunu && seciliYemCikisUrunu.cuval_agirligi_kg && !isNaN(cuvalFiyat)) {
        kgInput.value = (cuvalFiyat / parseFloat(seciliYemCikisUrunu.cuval_agirligi_kg)).toFixed(2);
    } else { kgInput.value = ''; }
}

async function fiyatAlaniniYonet() {
    const tipElement = document.querySelector('input[name="fiyatTipiRadio"]:checked');
    if(!tipElement) return;
    const tip = tipElement.value;
    
    const pesinDiv = document.getElementById('pesin-fiyat-alani');
    const vadeliDiv = document.getElementById('vadeli-fiyat-alani');
    const vadeliKgDiv = document.getElementById('vadeli-kg-fiyat-grup');
    const vadeliCuvalDiv = document.getElementById('vadeli-cuval-fiyat-grup');
    const pesinInput = document.getElementById(PESIN_FIYAT_INPUT_ID);
    
    if(pesinDiv) pesinDiv.classList.add('hidden'); 
    if(vadeliDiv) vadeliDiv.classList.add('hidden'); 
    if(vadeliKgDiv) vadeliKgDiv.classList.add('hidden'); 
    if(vadeliCuvalDiv) vadeliCuvalDiv.classList.add('hidden');
    
    if(!yemUrunSecici) return;
    const id = yemUrunSecici.getValue();
    
    if(!seciliYemCikisUrunu && id) {
        const urunler = await store.getYemUrunleri();
        seciliYemCikisUrunu = urunler.find(u => u.id == id);
    }
    const isCuval = seciliYemCikisUrunu && parseFloat(seciliYemCikisUrunu.cuval_agirligi_kg) > 0;

    if (tip === 'pesin') {
        if(pesinDiv) pesinDiv.classList.remove('hidden');
        if(seciliYemCikisUrunu && pesinInput) pesinInput.value = parseFloat(seciliYemCikisUrunu.satis_fiyati).toFixed(2);
    } else {
        if(vadeliDiv) vadeliDiv.classList.remove('hidden');
        if(isCuval) { if(vadeliCuvalDiv) vadeliCuvalDiv.classList.remove('hidden'); }
        else { if(vadeliKgDiv) vadeliKgDiv.classList.remove('hidden'); }
    }
}

function cikisKgGuncelle() {
    if (isCikisInputUpdating || !seciliYemCikisUrunu || !seciliYemCikisUrunu.cuval_agirligi_kg) return;
    isCikisInputUpdating = true;
    const cuval = parseFloat(document.getElementById('miktar-cuval-input').value);
    if (!isNaN(cuval)) document.getElementById('miktar-kg-input').value = (cuval * parseFloat(seciliYemCikisUrunu.cuval_agirligi_kg)).toFixed(2);
    setTimeout(() => { isCikisInputUpdating = false; }, 50);
}

function cikisCuvalGuncelle() {
    if (isCikisInputUpdating || !seciliYemCikisUrunu || !seciliYemCikisUrunu.cuval_agirligi_kg) return;
    isCikisInputUpdating = true;
    const kg = parseFloat(document.getElementById('miktar-kg-input').value);
    const agirlik = parseFloat(seciliYemCikisUrunu.cuval_agirligi_kg);
    if (!isNaN(kg) && agirlik > 0) {
        const adet = kg / agirlik;
        document.getElementById('miktar-cuval-input').value = (adet % 1 === 0) ? adet : adet.toFixed(2);
    }
    setTimeout(() => { isCikisInputUpdating = false; }, 50);
}

async function yemCikisiYap() {
    const btn = document.getElementById('yem-cikis-btn');
    const originalText = btn.innerHTML;
    const tipElement = document.querySelector('input[name="fiyatTipiRadio"]:checked');
    const tip = tipElement ? tipElement.value : 'pesin';
    
    const pInput = document.getElementById(PESIN_FIYAT_INPUT_ID);
    const vInput = document.getElementById(BIRIM_FIYAT_INPUT_ID);
    const fiyat = tip === 'pesin' ? (pInput ? pInput.value : '') : (vInput ? vInput.value : '');

    const veri = {
        tedarikci_id: tedarikciSecici ? tedarikciSecici.getValue() : null,
        yem_urun_id: yemUrunSecici ? yemUrunSecici.getValue() : null,
        miktar_kg: document.getElementById('miktar-kg-input').value,
        aciklama: document.getElementById('aciklama-input').value.trim(),
        fiyat_tipi: tip,
        birim_fiyat: fiyat
    };

    if (!veri.tedarikci_id || !veri.yem_urun_id || !veri.miktar_kg || parseFloat(veri.miktar_kg) <= 0 || !veri.birim_fiyat) {
        gosterMesaj('Lütfen tüm alanları doldurun.', 'warning'); return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Kaydediliyor...';

    if (!navigator.onLine) {
        try {
            gosterMesaj('Çevrimdışı kaydedildi.', 'info');
            const ok = await kaydetYemIslemiCevrimdisi(veri);
            if(ok) { formuTemizleCikis(); await yemIslemleriniYukle(1); }
        } finally { btn.disabled = false; btn.innerHTML = originalText; }
        return;
    }

    try {
        const res = await api.postYemIslemi(veri);
        gosterMesaj(res.message, 'success');
        formuTemizleCikis();
        await Promise.all([yemUrunleriniYukle(mevcutYemSayfasi), yemSecicileriDoldur(), yemIslemleriniYukle(1)]);
    } catch (e) { gosterMesaj(e.message, 'danger'); }
    finally { btn.disabled = false; btn.innerHTML = originalText; }
}

function formuTemizleCikis() {
    document.getElementById('miktar-kg-input').value = '';
    document.getElementById('miktar-cuval-input').value = '';
    document.getElementById('aciklama-input').value = '';
    if(tedarikciSecici) tedarikciSecici.clear();
    if(yemUrunSecici) yemUrunSecici.clear();
    const radio = document.getElementById('fiyatTipiPesin');
    if(radio) radio.checked = true;
    
    const cuvalArea = document.getElementById('cuval-cikis-alani');
    if(cuvalArea) cuvalArea.classList.add('hidden');
    fiyatAlaniniYonet();
}

// --- MODAL VE YENİ ÜRÜN ---
function yeniYemModaliniAc() {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yeni Yem Ürünü';
    document.getElementById('yem-urun-form').reset();
    document.getElementById('edit-yem-id').value = '';
    document.getElementById('fiyatlandirma-tipi-sec').value = 'kg';
    fiyatlandirmaAlanlariniYonet();
    toggleModal('yemUrunuModal', true);
}

function yemDuzenleAc(urun) {
    document.getElementById('yemUrunuModalLabel').innerText = 'Ürünü Düzenle';
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
    toggleModal('yemUrunuModal', true);
}

function fiyatlandirmaAlanlariniYonet() {
    const tip = document.getElementById('fiyatlandirma-tipi-sec').value;
    if (tip === 'cuval') {
        document.getElementById('kg-fiyat-alani').classList.add('hidden');
        document.getElementById('cuval-fiyat-alani').classList.remove('hidden');
        document.getElementById('yem-stok-label').innerHTML = 'Başlangıç Stok (Çuval) <span class="text-red-500">*</span>';
    } else {
        document.getElementById('kg-fiyat-alani').classList.remove('hidden');
        document.getElementById('cuval-fiyat-alani').classList.add('hidden');
        document.getElementById('yem-stok-label').innerHTML = 'Başlangıç Stok (KG) <span class="text-red-500">*</span>';
    }
}

async function yemUrunuKaydet() {
    const btn = document.getElementById('kaydet-yem-urun-btn'); 
    const original = btn.innerHTML;
    const id = document.getElementById('edit-yem-id').value;
    const veri = { yem_adi: document.getElementById('yem-adi-input').value.trim(), fiyatlandirma_tipi: document.getElementById('fiyatlandirma-tipi-sec').value };
    const stok = document.getElementById('yem-stok-input').value;

    if (veri.fiyatlandirma_tipi === 'cuval') {
        veri.cuval_agirligi_kg = document.getElementById('cuval-agirlik-input').value;
        veri.cuval_fiyati = document.getElementById('cuval-fiyat-input').value;
        veri.satis_cuval_fiyati = document.getElementById('yem-satis-cuval-fiyat-input').value;
        veri.stok_adedi = stok;
    } else {
        veri.birim_fiyat = document.getElementById('yem-fiyat-input').value;
        veri.satis_fiyati = document.getElementById('yem-satis-fiyat-input').value;
        veri.stok_miktari_kg = stok;
    }

    if (!veri.yem_adi || !stok) { gosterMesaj('Alanları doldurun.', 'warning'); return; }

    btn.disabled = true; btn.innerHTML = 'Kaydediliyor...';
    
    if (!id && !navigator.onLine) {
        try {
             const ok = await kaydetYeniYemUrunuCevrimdisi(veri);
             if(ok) { toggleModal('yemUrunuModal', false); await yemUrunleriniYukle(1); await yemSecicileriDoldur(); }
        } catch(e) { gosterMesaj("Çevrimdışı kayıt hatası: " + e.message, 'danger'); }
        finally { btn.disabled = false; btn.innerHTML = original; }
        return;
    }

    try {
        let res;
        if (id) { 
            res = await api.updateYemUrunu(id, veri); 
            if(typeof store.updateYemUrun === 'function') store.updateYemUrun(res.urun); 
        }
        else { 
            res = await api.postYemUrunu(veri); 
            if(typeof store.addYemUrun === 'function') store.addYemUrun(res.urun); 
        }
        gosterMesaj(res.message, 'success');
        toggleModal('yemUrunuModal', false);
        await yemUrunleriniYukle(mevcutYemSayfasi);
        await yemSecicileriDoldur();
    } catch(e) { gosterMesaj(e.message, 'danger'); }
    finally { btn.disabled = false; btn.innerHTML = original; }
}

async function yemIslemiGuncelle() {
    const id = document.getElementById('edit-islem-id').value;
    const veri = { yeni_miktar_kg: document.getElementById('edit-miktar-input').value, aciklama: document.getElementById('edit-aciklama-input').value.trim() };
    try {
        const res = await api.updateYemIslemi(id, veri);
        gosterMesaj(res.message, 'success');
        toggleModal('yemIslemDuzenleModal', false);
        await Promise.all([yemIslemleriniYukle(mevcutIslemSayfasi), yemUrunleriniYukle(mevcutYemSayfasi), yemSecicileriDoldur()]);
    } catch(e) { gosterMesaj(e.message, 'danger'); }
}

function yemSilmeOnayiAc(id, isim) {
    document.getElementById('silinecek-yem-id').value = id;
    document.getElementById('silinecek-yem-adi').innerText = isim;
    toggleModal('yemSilmeOnayModal', true);
}

async function yemUrunuSil() {
    const id = document.getElementById('silinecek-yem-id').value;
    toggleModal('yemSilmeOnayModal', false);
    try {
        const res = await api.deleteYemUrunu(id);
        gosterMesaj(res.message, 'success');
        if(typeof store.removeYemUrun === 'function') store.removeYemUrun(parseInt(id));
        await Promise.all([yemUrunleriniYukle(1), yemSecicileriDoldur()]);
    } catch(e) { gosterMesaj(e.message, 'danger'); }
}

function yemIslemiDuzenleAc(id, miktar, aciklama) {
    document.getElementById('edit-islem-id').value = id;
    document.getElementById('edit-miktar-input').value = miktar;
    document.getElementById('edit-aciklama-input').value = aciklama;
    toggleModal('yemIslemDuzenleModal', true);
}

function yemIslemiSilmeOnayiAc(id) {
    document.getElementById('silinecek-islem-id').value = id;
    toggleModal('yemIslemSilmeOnayModal', true);
}

async function yemIslemiSil() {
    const id = document.getElementById('silinecek-islem-id').value;
    toggleModal('yemIslemSilmeOnayModal', false);
    try {
        const res = await api.deleteYemIslemi(id);
        gosterMesaj(res.message, 'success');
        await Promise.all([yemUrunleriniYukle(1), yemSecicileriDoldur(), yemIslemleriniYukle(1)]);
    } catch(e) { gosterMesaj(e.message, 'danger'); }
}

// --- RENDER FONKSİYONLARI ---
function renderYemUrunuAsTable(container, urunler) {
    container.innerHTML = '';
    urunler.forEach(urun => {
        const stok = parseFloat(urun.stok_miktari_kg);
        const isKritik = stok <= KRITIK_STOK_SEVIYESI;
        const stokHtml = isKritik ? `<span class="text-red-600 font-bold flex items-center justify-end"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${formatStokGosterimi(urun)}</span>` : formatStokGosterimi(urun);

        container.innerHTML += `
            <tr id="yem-urun-${urun.id}" class="hover:bg-gray-50 transition-colors border-b border-gray-100 ${isKritik ? 'bg-red-50/30' : ''}">
                <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">${utils.sanitizeHTML(urun.yem_adi)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-700">${stokHtml}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-gray-500 text-sm">${formatAlisFiyat(urun)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-green-600 font-semibold text-sm">${formatSatisFiyat(urun)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick='yemDuzenleAc(${JSON.stringify(urun)})' class="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="yemSilmeOnayiAc(${urun.id}, '${utils.sanitizeHTML(urun.yem_adi.replace(/'/g, "\\'"))}')" class="p-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
    });
}

function renderYemUrunuAsCards(container, urunler) {
    container.innerHTML = '';
    urunler.forEach(urun => {
        const stok = parseFloat(urun.stok_miktari_kg);
        const isKritik = stok <= KRITIK_STOK_SEVIYESI;

        container.innerHTML += `
            <div class="col-span-1" id="yem-urun-${urun.id}">
                <div class="bg-white rounded-xl border ${isKritik ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'} p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-start mb-3">
                        <h4 class="font-bold text-gray-900 truncate">${utils.sanitizeHTML(urun.yem_adi)}</h4>
                        <div class="flex gap-1">
                            <button onclick='yemDuzenleAc(${JSON.stringify(urun)})' class="text-blue-600 bg-blue-50 p-1.5 rounded hover:bg-blue-100"><i class="fa-solid fa-pen text-xs"></i></button> 
                            <button onclick="yemSilmeOnayiAc(${urun.id}, '${utils.sanitizeHTML(urun.yem_adi.replace(/'/g, "\\'"))}')" class="text-red-600 bg-red-50 p-1.5 rounded hover:bg-red-100"><i class="fa-solid fa-trash text-xs"></i></button>
                        </div>
                    </div>
                    <div class="mb-4">
                        <p class="text-xs text-gray-500 uppercase tracking-wide mb-1">Mevcut Stok</p>
                        <div class="text-xl font-bold ${isKritik ? 'text-red-600' : 'text-gray-800'}">${formatStokGosterimi(urun)}</div>
                    </div>
                    <div class="border-t border-gray-100 pt-3 flex justify-between items-center text-xs">
                        <div class="text-gray-500">Alış: ${formatAlisFiyat(urun)}</div>
                        <div class="text-green-600 font-bold">Satış: ${formatSatisFiyat(urun)}</div>
                    </div>
                </div>
            </div>`;
    });
}

function renderYemIslemiAsTable(container, islemler) {
    container.innerHTML = '';
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        
        container.innerHTML += `
            <tr id="yem-islem-${islem.id}" class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${tarih}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${utils.sanitizeHTML(islem.tedarikciler?.isim || '-')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${utils.sanitizeHTML(islem.yem_urunleri?.yem_adi || '-')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-red-600 font-bold">-${miktar} KG</td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    <button onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')" class="text-blue-600 hover:text-blue-800 mr-2"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="yemIslemiSilmeOnayiAc(${islem.id})" class="text-red-600 hover:text-red-800"><i class="fa-solid fa-xmark"></i></button>
                </td>
            </tr>`;
    });
}

function renderYemIslemiAsCards(container, islemler) {
    container.innerHTML = '';
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);

        container.innerHTML += `
        <div class="col-span-1" id="yem-islem-${islem.id}">
            <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-gray-900">${utils.sanitizeHTML(islem.tedarikciler?.isim || '-')}</h4>
                    <span class="text-xs text-gray-400">${tarih}</span>
                </div>
                <p class="text-sm text-gray-600 mb-2">${utils.sanitizeHTML(islem.yem_urunleri?.yem_adi || '-')}</p>
                <div class="flex justify-between items-center pt-2 border-t border-gray-50 mt-2">
                    <span class="text-lg font-bold text-red-600 font-mono">-${miktar} KG</span>
                    <div class="flex gap-2">
                        <button onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')" class="p-1.5 bg-gray-100 rounded text-gray-600 hover:bg-blue-50 hover:text-blue-600"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button onclick="yemIslemiSilmeOnayiAc(${islem.id})" class="p-1.5 bg-red-50 rounded text-red-600 hover:bg-red-100"><i class="fa-solid fa-xmark text-xs"></i></button>
                    </div>
                </div>
            </div>
        </div>`;
    });
}

// --- YARDIMCILAR ---

async function tedarikcileriDoldur() {
    try {
        const t = await store.getTedarikciler();
        tedarikciSecici.clearOptions();
        tedarikciSecici.addOptions(t.map(x => ({ value: x.id, text: utils.sanitizeHTML(x.isim) })));
    } catch(e) { console.error(e); }
}

async function yemSecicileriDoldur() {
    try {
        const u = await store.getYemUrunleri();
        const opts = u.map(x => ({ value: x.id, text: `${utils.sanitizeHTML(x.yem_adi)} (Stok: ${parseFloat(x.stok_miktari_kg).toFixed(2)} kg)` }));
        yemUrunSecici.clearOptions(); yemUrunSecici.addOptions(opts);
        yemGirisSecici.clearOptions(); yemGirisSecici.addOptions(opts);
    } catch(e) { console.error(e); }
}

function formatAlisFiyat(u) {
    const cf = parseFloat(u.cuval_fiyati); const ca = parseFloat(u.cuval_agirligi_kg);
    if(cf>0 && ca>0) return `${cf.toFixed(2)} TL / Çuval`;
    return `${parseFloat(u.birim_fiyat).toFixed(2)} TL / KG`;
}
function formatSatisFiyat(u) {
    const cf = parseFloat(u.satis_cuval_fiyati); const ca = parseFloat(u.cuval_agirligi_kg);
    if(cf>0 && ca>0) return `${cf.toFixed(2)} TL / Çuval`;
    return `${parseFloat(u.satis_fiyati).toFixed(2)} TL / KG`;
}
function formatStokGosterimi(u) {
    const stok = parseFloat(u.stok_miktari_kg); const ca = parseFloat(u.cuval_agirligi_kg);
    if(ca>0 && stok>0) {
        const adet = stok/ca;
        return `${stok.toFixed(2)} KG <span class="text-gray-400 text-xs">(${Number.isInteger(adet)?adet:adet.toFixed(1)} Çuval)</span>`;
    }
    return `${stok.toFixed(2)} KG`;
}

function gorunumuDegistir(v) { yemMevcutGorunum = v; localStorage.setItem('yemGorunum', v); gorunumuAyarla(); yemUrunleriniYukle(mevcutYemSayfasi); }
function gorunumuDegistirIslemler(v) { yemIslemMevcutGorunum = v; localStorage.setItem('yemIslemGorunum', v); gorunumuAyarlaIslemler(); yemIslemleriniYukle(mevcutIslemSayfasi); }

function gorunumuAyarla() {
    document.getElementById('tablo-gorunumu').classList.add('hidden');
    document.getElementById('kart-gorunumu').classList.add('hidden');
    document.getElementById(`${yemMevcutGorunum}-gorunumu`).classList.remove('hidden');
    const btnT = document.getElementById('btn-view-table');
    const btnC = document.getElementById('btn-view-card');
    const act = "p-1.5 rounded text-brand-600 bg-white shadow-sm";
    const inact = "p-1.5 rounded text-gray-500 hover:text-brand-600";
    if(yemMevcutGorunum === 'tablo') { btnT.className = act; btnC.className = inact; } else { btnC.className = act; btnT.className = inact; }
}

function gorunumuAyarlaIslemler() {
    document.getElementById('islemler-tablo-gorunumu').classList.add('hidden');
    document.getElementById('islemler-kart-gorunumu').classList.add('hidden');
    document.getElementById(`islemler-${yemIslemMevcutGorunum}-gorunumu`).classList.remove('hidden');
    const btnT = document.getElementById('btn-islemler-liste');
    const btnC = document.getElementById('btn-islemler-kart');
    const act = "p-1.5 rounded text-brand-600 bg-white shadow-sm";
    const inact = "p-1.5 rounded text-gray-500 hover:text-brand-600";
    if(yemIslemMevcutGorunum === 'tablo') { btnT.className = act; btnC.className = inact; } else { btnC.className = act; btnT.className = inact; }
}

async function yemUrunleriniYukle(sayfa=1) {
    mevcutYemSayfasi = sayfa;
    await store.getYemUrunleri(true);
    await genelVeriYukleyici({
        apiURL: `/yem/api/urunler?sayfa=${sayfa}&_t=${new Date().getTime()}`,
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

async function yemIslemleriniYukle(sayfa=1) {
    mevcutIslemSayfasi = sayfa;
    await genelVeriYukleyici({
        apiURL: `/yem/api/islemler/liste?sayfa=${sayfa}&_t=${new Date().getTime()}`,
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

// === 3. DOMContentLoaded (EN SONA) ===
document.addEventListener('DOMContentLoaded', function() {
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    yemUrunSecici = new TomSelect("#yem-urun-sec", { create: false, sortField: { field: "text", direction: "asc" }, onChange: handleYemCikisSecimi });
    yemGirisSecici = new TomSelect("#yem-urun-giris-sec", { create: false, sortField: { field: "text", direction: "asc" }, onChange: handleYemGirisSecimi });
    
    const yemGirisForm = document.getElementById('yem-giris-formu');
    if (yemGirisForm) yemGirisForm.addEventListener('submit', yemGirisiYap);

    document.getElementById('giris-miktar-kg-input').addEventListener('input', girisCuvalGuncelle);
    document.getElementById('giris-miktar-cuval-input').addEventListener('input', girisKgGuncelle);
    
    document.querySelectorAll('input[name="fiyatTipiRadio"]').forEach(radio => {
        radio.addEventListener('change', fiyatAlaniniYonet);
    });
    const vadeliCuvalInput = document.getElementById(VADELI_CUVAL_INPUT_ID);
    if (vadeliCuvalInput) vadeliCuvalInput.addEventListener('input', vadeliCuvalFiyatiniHesapla);
    
    document.getElementById('miktar-kg-input').addEventListener('input', cikisCuvalGuncelle);
    document.getElementById('miktar-cuval-input').addEventListener('input', cikisKgGuncelle);
    
    const fiyatlandirmaTipiSelect = document.getElementById('fiyatlandirma-tipi-sec');
    if (fiyatlandirmaTipiSelect) fiyatlandirmaTipiSelect.addEventListener('change', fiyatlandirmaAlanlariniYonet); 

    yemMevcutGorunum = localStorage.getItem('yemGorunum') || 'tablo';
    yemIslemMevcutGorunum = localStorage.getItem('yemIslemGorunum') || 'tablo';
    
    gorunumuAyarla(); 
    gorunumuAyarlaIslemler(); 
    
    tedarikcileriDoldur();
    yemSecicileriDoldur(); 
    yemUrunleriniYukle(1);
    yemIslemleriniYukle(1); 
    fiyatAlaniniYonet();
});