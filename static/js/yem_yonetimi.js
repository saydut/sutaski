let yemIslemSilmeOnayModal, yemIslemDuzenleModal;
let tedarikciSecici, yemUrunSecici;
let yemUrunuModal, yemSilmeOnayModal;

let mevcutGorunum = 'tablo';
let mevcutIslemGorunumu = 'tablo';
let mevcutYemSayfasi = 1;
let mevcutIslemSayfasi = 1;

const YEMLER_SAYFA_BASI = 10;
const ISLEMLER_SAYFA_BASI = 5;
const KRITIK_STOK_SEVIYESI = 500;

window.onload = function() {
    yemUrunuModal = new bootstrap.Modal(document.getElementById('yemUrunuModal'));
    yemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemSilmeOnayModal'));
    yemIslemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemIslemSilmeOnayModal'));
    yemIslemDuzenleModal = new bootstrap.Modal(document.getElementById('yemIslemDuzenleModal'));
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    yemUrunSecici = new TomSelect("#yem-urun-sec", { create: false, sortField: { field: "text", direction: "asc" } });

    mevcutGorunum = localStorage.getItem('yemGorunum') || 'tablo';
    mevcutIslemGorunumu = localStorage.getItem('yemIslemGorunum') || 'tablo';
    gorunumuAyarla();
    gorunumuAyarlaIslemler();

    tedarikcileriDoldur();
    yemSeciciyiDoldur();
    yemUrunleriniYukle(1);
    yemIslemleriniYukle(1);
};

// --- GÖRÜNÜM DEĞİŞTİRME FONKSİYONLARI ---

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

// --- VERİ YÜKLEME VE RENDER BÖLÜMÜ ---

async function yemUrunleriniYukle(sayfa = 1) {
    mevcutYemSayfasi = sayfa;
    // Yem ürünleri listesi için merkezi veri yükleme motorunu çağırıyoruz.
    await genelVeriYukleyici({
        apiURL: `/yem/api/urunler?sayfa=${sayfa}`,
        veriAnahtari: 'urunler',
        tabloBodyId: 'yem-urunleri-tablosu',
        kartContainerId: 'yem-urunleri-kart-listesi',
        veriYokId: 'veri-yok-mesaji',
        sayfalamaId: 'yem-urunleri-sayfalama',
        tabloRenderFn: renderYemUrunuAsTable, // Bu sayfaya özel çizim fonksiyonu
        kartRenderFn: renderYemUrunuAsCards,   // Bu sayfaya özel çizim fonksiyonu
        yukleFn: yemUrunleriniYukle,
        sayfa: sayfa,
        kayitSayisi: YEMLER_SAYFA_BASI,
        mevcutGorunum: mevcutGorunum
    });
}

async function yemIslemleriniYukle(sayfa = 1) {
    mevcutIslemSayfasi = sayfa;
    // Yem işlemleri listesi için merkezi veri yükleme motorunu çağırıyoruz.
    await genelVeriYukleyici({
        apiURL: `/yem/api/islemler/liste?sayfa=${sayfa}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'yem-islemleri-listesi',
        kartContainerId: 'yem-islemleri-kart-listesi',
        veriYokId: 'yem-islemleri-veri-yok',
        sayfalamaId: 'yem-islemleri-sayfalama',
        tabloRenderFn: renderYemIslemiAsTable, // Bu sayfaya özel çizim fonksiyonu
        kartRenderFn: renderYemIslemiAsCards,   // Bu sayfaya özel çizim fonksiyonu
        yukleFn: yemIslemleriniYukle,
        sayfa: sayfa,
        kayitSayisi: ISLEMLER_SAYFA_BASI,
        mevcutGorunum: mevcutIslemGorunumu // Dikkat: Bu liste kendi görünüm değişkenini kullanıyor
    });
}

function renderYemUrunuAsTable(container, urunler) {
    urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        const uyariIconu = isKritik ? `<i class="bi bi-exclamation-triangle-fill text-danger me-2" title="Stok kritik seviyede!"></i>` : '';
        container.innerHTML += `
            <tr id="yem-urun-${urun.id}" class="${isKritik ? 'table-warning' : ''}">
                <td>${uyariIconu}<strong>${urun.yem_adi}</strong></td>
                <td class="text-end">${stokMiktari.toFixed(2)} KG</td>
                <td class="text-end">${parseFloat(urun.birim_fiyat).toFixed(2)} TL</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="yemDuzenleAc(${urun.id},'${urun.yem_adi.replace(/'/g, "\\'")}',${stokMiktari},${urun.birim_fiyat})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="yemSilmeOnayiAc(${urun.id}, '${urun.yem_adi.replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

function renderYemUrunuAsCards(container, urunler) {
     urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        container.innerHTML += `
            <div class="col-md-6 col-12" id="yem-urun-${urun.id}">
                <div class="yem-card ${isKritik ? 'stok-kritik' : ''}">
                    <div class="yem-card-header"><h5>${urun.yem_adi}</h5></div>
                    <div class="yem-card-body">
                        <p class="mb-1 text-secondary">Mevcut Stok</p>
                        <p class="stok-bilgisi ${isKritik ? 'text-danger' : ''}">${stokMiktari.toFixed(2)} KG</p>
                    </div>
                    <div class="yem-card-footer">
                        <span class="fiyat-bilgisi">${parseFloat(urun.birim_fiyat).toFixed(2)} TL / KG</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" onclick="yemDuzenleAc(${urun.id},'${urun.yem_adi.replace(/'/g, "\\'")}',${stokMiktari},${urun.birim_fiyat})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="yemSilmeOnayiAc(${urun.id}, '${urun.yem_adi.replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

function renderYemIslemiAsTable(container, islemler) {
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        container.innerHTML += `
            <tr id="yem-islem-${islem.id}">
                <td>${tarih}</td>
                <td>${islem.tedarikciler.isim}</td>
                <td>${islem.yem_urunleri.yem_adi}</td>
                <td class="text-end">${miktar} KG</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${(islem.aciklama || '').replace(/'/g, "\\'")}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button>
                </td>
            </tr>`;
    });
}

function renderYemIslemiAsCards(container, islemler) {
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        container.innerHTML += `
            <div class="col-lg-6 col-12" id="yem-islem-${islem.id}">
                <div class="card p-2 h-100">
                    <div class="card-body p-2 d-flex flex-column">
                        <div>
                            <h6 class="card-title mb-0">${islem.tedarikciler.isim}</h6>
                            <small class="text-secondary">${islem.yem_urunleri.yem_adi}</small>
                        </div>
                        <div class="my-2 flex-grow-1"><span class="fs-4 fw-bold text-primary">${miktar} KG</span></div>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-secondary">${tarih}</small>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-sm btn-outline-primary" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${(islem.aciklama || '').replace(/'/g, "\\'")}')"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-danger" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

async function tedarikcileriDoldur() {
    try {
        const tedarikciler = await store.getTedarikciler();
        tedarikciSecici.clearOptions();
        tedarikciSecici.addOptions(tedarikciler.map(t => ({ value: t.id, text: t.isim })));
    } catch (error) {
        gosterMesaj('Tedarikçi menüsü yüklenemedi. İnternet bağlantınızı kontrol edin.', 'warning');
    }
}

async function yemSeciciyiDoldur() {
    try {
        const urunler = await store.getYemUrunleri();
        yemUrunSecici.clearOptions();
        const options = urunler.map(u => ({
            value: u.id,
            text: `${u.yem_adi} (Stok: ${parseFloat(u.stok_miktari_kg).toFixed(2)} kg)`
        }));
        yemUrunSecici.addOptions(options);
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
        miktar_kg: document.getElementById('miktar-input').value,
        aciklama: document.getElementById('aciklama-input').value.trim()
    };

    if (!veri.tedarikci_id || !veri.yem_urun_id || !veri.miktar_kg || parseFloat(veri.miktar_kg) <= 0) {
        gosterMesaj('Lütfen tüm alanları doğru doldurun.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    try {
        const response = await fetch('/yem/api/islemler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        gosterMesaj(result.message, 'success');
        document.getElementById('miktar-input').value = '';
        document.getElementById('aciklama-input').value = '';
        tedarikciSecici.clear();
        
        await yemUrunleriniYukle(mevcutYemSayfasi);
        await yemSeciciyiDoldur();
        await yemIslemleriniYukle(1);
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

function yeniYemModaliniAc() {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yeni Yem Ürünü Ekle';
    document.getElementById('yem-urun-form').reset();
    document.getElementById('edit-yem-id').value = '';
    yemUrunuModal.show();
}

function yemDuzenleAc(id, ad, stok, fiyat) {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yem Ürününü Düzenle';
    document.getElementById('edit-yem-id').value = id;
    document.getElementById('yem-adi-input').value = ad;
    document.getElementById('yem-stok-input').value = stok;
    document.getElementById('yem-fiyat-input').value = fiyat;
    yemUrunuModal.show();
}

async function yemUrunuKaydet() {
    const kaydetButton = document.querySelector('#yemUrunuModal .btn-primary');
    const originalButtonText = kaydetButton.innerHTML;
    const id = document.getElementById('edit-yem-id').value;
    const veri = {
        yem_adi: document.getElementById('yem-adi-input').value.trim(),
        stok_miktari_kg: document.getElementById('yem-stok-input').value,
        birim_fiyat: document.getElementById('yem-fiyat-input').value
    };

    if (!veri.yem_adi || !veri.stok_miktari_kg || !veri.birim_fiyat) {
        gosterMesaj('Lütfen tüm zorunlu alanları doldurun.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    const url = id ? `/yem/api/urunler/${id}` : '/yem/api/urunler';
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        
        gosterMesaj(result.message, 'success');
        yemUrunuModal.hide();
        await yemUrunleriniYukle(id ? mevcutYemSayfasi : 1);
        await yemSeciciyiDoldur();
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

function yemSilmeOnayiAc(id, isim) {
    document.getElementById('silinecek-yem-id').value = id;
    document.getElementById('silinecek-yem-adi').innerText = isim;
    yemSilmeOnayModal.show();
}

async function yemUrunuSil() {
    const id = document.getElementById('silinecek-yem-id').value;
    yemSilmeOnayModal.hide();

    // Çevrimdışı silme desteği
    if (!navigator.onLine) {
        gosterMesaj('İnternet yok. Silme işlemi kaydedildi, bağlantı kurulunca uygulanacak.', 'info');
        await kaydetSilmeIslemiCevrimdisi('yem_urunu', parseInt(id));
        document.getElementById(`yem-urun-${id}`)?.remove();
        return;
    }

    // İyimser Arayüz Güncellemesi
    const silinecekElement = document.getElementById(`yem-urun-${id}`);
    if (silinecekElement) {
        silinecekElement.style.opacity = '0';
        setTimeout(() => silinecekElement.remove(), 400);
    }

    try {
        const response = await fetch(`/yem/api/urunler/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        gosterMesaj(result.message, 'success');
        await yemUrunleriniYukle(1);
        await yemSeciciyiDoldur();
    } catch (error) {
        gosterMesaj(error.message, 'danger');
        // Hata durumunda listeyi yeniden yükleyerek silinmiş gibi görünen öğeyi geri getir
        await yemUrunleriniYukle(mevcutYemSayfasi);
    }
}

function yemIslemiSilmeOnayiAc(id) {
    document.getElementById('silinecek-islem-id').value = id;
    yemIslemSilmeOnayModal.show();
}

async function yemIslemiSil() {
    const id = document.getElementById('silinecek-islem-id').value;
    yemIslemSilmeOnayModal.hide();

    if (!navigator.onLine) {
        gosterMesaj("Bu işlemi iptal etmek için internet bağlantısı gereklidir.", "warning");
        return;
    }
    
    const silinecekElement = document.getElementById(`yem-islem-${id}`);
    if(silinecekElement) silinecekElement.style.opacity = '0.5';

    try {
        const response = await fetch(`/yem/api/islemler/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        gosterMesaj(result.message, 'success');
        await yemUrunleriniYukle(mevcutYemSayfasi);
        await yemSeciciyiDoldur();
        await yemIslemleriniYukle(mevcutIslemSayfasi);

    } catch (error) {
        gosterMesaj(error.message, 'danger');
        if(silinecekElement) silinecekElement.style.opacity = '1';
    }
}

function yemIslemiDuzenleAc(id, miktar, aciklama) {
    document.getElementById('edit-islem-id').value = id;
    document.getElementById('edit-miktar-input').value = miktar;
    document.getElementById('edit-aciklama-input').value = aciklama;
    yemIslemDuzenleModal.show();
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
        const response = await fetch(`/yem/api/islemler/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        gosterMesaj(result.message, 'success');
        yemIslemDuzenleModal.hide();
        
        await yemIslemleriniYukle(mevcutIslemSayfasi);
        await yemUrunleriniYukle(mevcutYemSayfasi);
        await yemSeciciyiDoldur();
    } catch (error) {
        gosterMesaj(error.message, "danger");
    }
}
