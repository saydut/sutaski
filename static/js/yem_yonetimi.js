// static/js/yem_yonetimi.js (TÜM FONKSİYONLARI İÇEREN TAM VE GÜNCEL VERSİYON)

let tedarikciSecici, yemUrunSecici;
let yemUrunuModal, yemSilmeOnayModal;
let mevcutYemSiralamaSutunu = 'yem_adi';
let mevcutYemSiralamaYonu = 'asc';
let mevcutGorunum = 'tablo';
const KRITIK_STOK_SEVIYESI = 500;

window.onload = function() {
    yemUrunuModal = new bootstrap.Modal(document.getElementById('yemUrunuModal'));
    yemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemSilmeOnayModal'));
    
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    yemUrunSecici = new TomSelect("#yem-urun-sec", { create: false, sortField: { field: "text", direction: "asc" } });

    mevcutGorunum = localStorage.getItem('yemGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);
    
    verileriYukle();

    document.querySelectorAll('.sortable-yem').forEach(header => {
        header.addEventListener('click', () => {
            const sutun = header.dataset.sort;
            if (mevcutYemSiralamaSutunu === sutun) {
                mevcutYemSiralamaYonu = mevcutYemSiralamaYonu === 'asc' ? 'desc' : 'asc';
            } else {
                mevcutYemSiralamaSutunu = sutun;
                mevcutYemSiralamaYonu = 'asc';
            }
            yemleriSiralaVeGoster();
        });
    });
};

function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('yemGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);
    yemleriSiralaVeGoster();
}

function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    const gorunumElementi = document.getElementById(`${aktifGorunum}-gorunumu`);
    if(gorunumElementi) {
        gorunumElementi.style.display = gorunumElementi.id.includes('kart') ? 'flex' : 'block'; // Kartlar için row'u aktif et
        if (gorunumElementi.id.includes('kart')) {
            gorunumElementi.querySelector('.row').style.display = 'flex';
        }
    }
    document.getElementById('btn-view-table').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}

async function verileriYukle() {
    await Promise.all([
        tedarikcileriDoldur(),
        yemUrunleriniDoldur()
    ]);
}

async function tedarikcileriDoldur() {
    try {
        const tedarikciler = await store.getTedarikciler();
        tedarikciSecici.clearOptions();
        const options = tedarikciler.map(t => ({ value: t.id, text: t.isim }));
        tedarikciSecici.addOptions(options);
    } catch (error) {
        gosterMesaj('Tedarikçiler yüklenirken bir hata oluştu.', 'danger');
    }
}

async function yemUrunleriniDoldur() {
    try {
        await store.getYemUrunleri();
        yemleriSiralaVeGoster();

        yemUrunSecici.clearOptions();
        const options = store.yemUrunleri.map(u => ({ 
            value: u.id, 
            text: `${u.yem_adi} (Stok: ${parseFloat(u.stok_miktari_kg).toFixed(2)} kg)` 
        }));
        yemUrunSecici.addOptions(options);
    } catch (error) {
        gosterMesaj(error.message, "danger");
        document.getElementById('veri-yok-mesaji').style.display = 'block';
    }
}

function yemleriSiralaVeGoster() {
    let siraliYemler = [...store.yemUrunleri];
    siraliYemler.sort((a, b) => {
        let valA = a[mevcutYemSiralamaSutunu] || '';
        let valB = b[mevcutYemSiralamaSutunu] || '';
        if (typeof valA === 'string') {
            return mevcutYemSiralamaYonu === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return mevcutYemSiralamaYonu === 'asc' ? parseFloat(valA) - parseFloat(valB) : parseFloat(valB) - parseFloat(valA);
    });
    
    verileriGoster(siraliYemler);
    yemBasliklariniGuncelle();
}

function verileriGoster(urunler) {
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    veriYokMesaji.style.display = urunler.length === 0 ? 'block' : 'none';

    if (mevcutGorunum === 'tablo') {
        renderTable(urunler);
    } else {
        renderCards(urunler);
    }
}

function renderTable(urunler) {
    const tbody = document.getElementById('yem-urunleri-tablosu');
    tbody.innerHTML = '';
    urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        const rowClass = isKritik ? 'table-warning' : ''; 
        const uyariIconu = isKritik 
            ? `<i class="bi bi-exclamation-triangle-fill text-danger me-2" title="Stok kritik seviyede: ${stokMiktari.toFixed(2)} KG"></i>` 
            : '';
        tbody.innerHTML += `
            <tr class="${rowClass}">
                <td>${uyariIconu}<strong>${urun.yem_adi}</strong></td>
                <td class="text-end">${stokMiktari.toFixed(2)} KG</td>
                <td class="text-end">${parseFloat(urun.birim_fiyat).toFixed(2)} TL</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="yemDuzenleAc(${urun.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="yemSilmeOnayiAc(${urun.id}, '${urun.yem_adi}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

function renderCards(urunler) {
    const container = document.getElementById('yem-urunleri-kart-listesi');
    container.innerHTML = '';
    urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        const kartSinifi = isKritik ? 'yem-card stok-kritik' : 'yem-card';
        container.innerHTML += `
            <div class="col-md-6 col-12">
                <div class="${kartSinifi}">
                    <div class="yem-card-header">
                        <h5>${urun.yem_adi}</h5>
                    </div>
                    <div class="yem-card-body">
                        <p class="mb-1 text-secondary">Mevcut Stok</p>
                        <p class="stok-bilgisi ${isKritik ? 'text-danger' : ''}">${stokMiktari.toFixed(2)} KG</p>
                    </div>
                    <div class="yem-card-footer">
                        <span class="fiyat-bilgisi">${parseFloat(urun.birim_fiyat).toFixed(2)} TL / KG</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="yemDuzenleAc(${urun.id})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="yemSilmeOnayiAc(${urun.id}, '${urun.yem_adi}')"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

function yemBasliklariniGuncelle() {
    document.querySelectorAll('.sortable-yem').forEach(header => {
        const sutun = header.dataset.sort;
        header.classList.remove('asc', 'desc');
        if (sutun === mevcutYemSiralamaSutunu) {
            header.classList.add(mevcutYemSiralamaYonu);
        }
    });
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
        gosterMesaj('Lütfen tedarikçi, yem ürünü seçin ve geçerli bir miktar girin.', 'warning');
        return;
    }
    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    try {
        const response = await fetch('/yem/api/islemler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            document.getElementById('miktar-input').value = '';
            document.getElementById('aciklama-input').value = '';
            tedarikciSecici.clear();
            store.invalidateYemUrunleri();
            await yemUrunleriniDoldur();
        } else {
            gosterMesaj(result.error || 'Bir hata oluştu.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
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

function yemDuzenleAc(id) {
    const urun = store.yemUrunleri.find(y => y.id === id);
    if (urun) {
        document.getElementById('yemUrunuModalLabel').innerText = 'Yem Ürününü Düzenle';
        document.getElementById('edit-yem-id').value = urun.id;
        document.getElementById('yem-adi-input').value = urun.yem_adi;
        document.getElementById('yem-stok-input').value = parseFloat(urun.stok_miktari_kg);
        document.getElementById('yem-fiyat-input').value = parseFloat(urun.birim_fiyat);
        yemUrunuModal.show();
    }
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
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            yemUrunuModal.hide();
            store.invalidateYemUrunleri();
            await yemUrunleriniDoldur();
        } else {
            gosterMesaj(result.error || 'İşlem sırasında bir hata oluştu.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
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
    try {
        const response = await fetch(`/yem/api/urunler/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            yemSilmeOnayModal.hide();
            store.invalidateYemUrunleri();
            await yemUrunleriniDoldur();
        } else {
            gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}