// static/js/tedarikciler.js (İyimser Arayüz ve ID'ler eklendi)

let tedarikciModal, silmeOnayModal;
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15;
let mevcutSiralamaSutunu = 'isim';
let mevcutSiralamaYonu = 'asc';
let mevcutAramaTerimi = '';
let mevcutGorunum = 'tablo';

function debounce(func, delay = 400) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

window.onload = async () => {
    tedarikciModal = new bootstrap.Modal(document.getElementById('tedarikciModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    mevcutGorunum = localStorage.getItem('tedarikciGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);

    const aramaInput = document.getElementById('arama-input');
    aramaInput.addEventListener('input', debounce((event) => {
        mevcutAramaTerimi = event.target.value;
        verileriYukle(1);
    }));

    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sutun = header.dataset.sort;
            if (mevcutSiralamaSutunu === sutun) {
                mevcutSiralamaYonu = mevcutSiralamaYonu === 'asc' ? 'desc' : 'asc';
            } else {
                mevcutSiralamaSutunu = sutun;
                mevcutSiralamaYonu = 'asc';
            }
            basliklariGuncelle();
            verileriYukle(1);
        });
    });

    basliklariGuncelle();
    await verileriYukle();
};

async function verileriYukle(sayfa = 1) {
    mevcutSayfa = sayfa;
    const url = `/api/tedarikciler_liste?sayfa=${sayfa}&arama=${mevcutAramaTerimi}&sirala=${mevcutSiralamaSutunu}&yon=${mevcutSiralamaYonu}`;

    await genelVeriYukleyici({
        apiURL: url,
        veriAnahtari: 'tedarikciler',
        tabloBodyId: 'tedarikciler-tablosu',
        kartContainerId: 'tedarikciler-kart-listesi',
        veriYokId: 'veri-yok-mesaji',
        sayfalamaId: 'tedarikci-sayfalama',
        tabloRenderFn: renderTable,
        kartRenderFn: renderCards,
        yukleFn: verileriYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: mevcutGorunum
    });
}

// GÜNCELLEME: Satıra benzersiz ID ekliyoruz.
function renderTable(container, suppliers) {
    suppliers.forEach(supplier => {
        container.innerHTML += `
            <tr id="tedarikci-${supplier.id}">
                <td><strong>${supplier.isim}</strong></td>
                <td>${supplier.telefon_no || '-'}</td>
                <td class="text-end">${parseFloat(supplier.toplam_litre || 0).toFixed(2)} L</td>
                <td class="text-center">
                    <a href="/tedarikci/${supplier.id}" class="btn btn-sm btn-outline-info" title="Detayları Gör"><i class="bi bi-eye"></i></a>
                    <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="tedarikciDuzenleAc(${supplier.id}, this)"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="silmeOnayiAc(${supplier.id}, '${supplier.isim.replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

// GÜNCELLEME: Karta benzersiz ID ekliyoruz.
function renderCards(container, suppliers) {
    suppliers.forEach(supplier => {
        container.innerHTML += `
            <div class="col-lg-4 col-md-6 col-12" id="tedarikci-${supplier.id}">
                <div class="supplier-card">
                    <div class="supplier-card-header"><h5>${supplier.isim}</h5></div>
                    <div class="supplier-card-body"><p class="mb-2"><i class="bi bi-telephone-fill me-2"></i>${supplier.telefon_no || 'Belirtilmemiş'}</p></div>
                    <div class="supplier-card-footer">
                        <a href="/tedarikci/${supplier.id}" class="btn btn-sm btn-outline-info" title="Detayları Gör"><i class="bi bi-eye"></i></a>
                        <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="tedarikciDuzenleAc(${supplier.id}, this)"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="silmeOnayiAc(${supplier.id}, '${supplier.isim.replace(/'/g, "\\'")}')"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

function basliklariGuncelle() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('asc', 'desc');
        if (header.dataset.sort === mevcutSiralamaSutunu) {
            header.classList.add(mevcutSiralamaYonu);
        }
    });
}

async function tedarikciKaydet() {
    const kaydetButton = document.querySelector('#kaydet-tedarikci-btn');
    const originalButtonText = kaydetButton.innerHTML;
    const id = document.getElementById('edit-tedarikci-id').value;
    const veri = {
        isim: document.getElementById('tedarikci-isim-input').value.trim(),
        tc_no: document.getElementById('tedarikci-tc-input').value.trim(),
        telefon_no: document.getElementById('tedarikci-tel-input').value.trim(),
        adres: document.getElementById('tedarikci-adres-input').value.trim()
    };
    if (!veri.isim) { gosterMesaj("Tedarikçi ismi zorunludur.", "warning"); return; }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    try {
        const result = id ? await api.updateTedarikci(id, veri) : await api.postTedarikci(veri);
        gosterMesaj(result.message, "success");
        tedarikciModal.hide();
        await verileriYukle(id ? mevcutSayfa : 1); // Yeni ekleme ise ilk sayfaya git, düzenleme ise mevcut sayfada kal
    } catch (error) {
        gosterMesaj(error.message || "Bir hata oluştu.", "danger");
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

// GÜNCELLEME: İyimser arayüz mantığı eklendi
async function tedarikciSil() {
    const id = document.getElementById('silinecek-tedarikci-id').value;
    silmeOnayModal.hide();

    const silinecekElement = document.getElementById(`tedarikci-${id}`);
    if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    const originalHTML = silinecekElement.outerHTML;

    silinecekElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    silinecekElement.style.opacity = '0';
    silinecekElement.style.transform = 'translateX(-50px)';
    setTimeout(() => {
        if(silinecekElement.parentNode) silinecekElement.parentNode.removeChild(silinecekElement)
    }, 400);

    try {
        const result = await api.deleteTedarikci(id);
        gosterMesaj(result.message, 'success');
        // Sayfalama durumunu düzeltmek için listeyi baştan yükle
        await verileriYukle(1);
    } catch (error) {
        gosterMesaj(error.message || 'Silme işlemi başarısız, tedarikçi geri yüklendi.', 'danger');
        // Hata durumunda öğeyi geri ekle
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = originalHTML;
        const restoredElement = tempDiv.firstChild;
        restoredElement.style.opacity = '1';
        restoredElement.style.transform = 'translateX(0)';
        parent.insertBefore(restoredElement, nextSibling);
    }
}

async function tedarikciDuzenleAc(id, button) {
    button.disabled = true;
    try {
        const supplier = await api.request(`/api/tedarikci/${id}`);
        
        document.getElementById('tedarikciModalLabel').innerText = 'Tedarikçi Bilgilerini Düzenle';
        document.getElementById('edit-tedarikci-id').value = supplier.id;
        document.getElementById('tedarikci-isim-input').value = supplier.isim;
        document.getElementById('tedarikci-tc-input').value = supplier.tc_no || '';
        document.getElementById('tedarikci-tel-input').value = supplier.telefon_no || '';
        document.getElementById('tedarikci-adres-input').value = supplier.adres || '';
        tedarikciModal.show();
    } catch (error) {
        gosterMesaj(error.message || "Tedarikçi detayı bulunamadı.", "danger");
    } finally {
        button.disabled = false;
    }
}

function yeniTedarikciAc() {
    document.getElementById('tedarikciModalLabel').innerText = 'Yeni Tedarikçi Ekle';
    document.getElementById('edit-tedarikci-id').value = '';
    document.getElementById('tedarikci-form').reset();
    tedarikciModal.show();
}

function silmeOnayiAc(id, isim) {
    document.getElementById('silinecek-tedarikci-id').value = id;
    document.getElementById('silinecek-tedarikci-adi').innerText = isim;
    silmeOnayModal.show();
}

function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('tedarikciGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);
    verileriYukle(mevcutSayfa);
}

function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    document.getElementById(`${aktifGorunum}-gorunumu`).style.display = 'block';
    document.getElementById('btn-view-table').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}
