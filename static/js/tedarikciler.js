// static/js/tedarikciler.js (ÇEVRİMDIŞI KAYIT EKLENDİ)

let tedarikciModal, silmeOnayModal;
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15;

let mevcutSiralamaSutunu = 'isim';
let mevcutSiralamaYonu = 'asc';
let mevcutAramaTerimi = '';
let mevcutGorunum = 'tablo';

let tumTedarikciler = [];

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
    const debouncedSearch = debounce((event) => {
        mevcutAramaTerimi = event.target.value.toLowerCase();
        verileriIsleVeGoster(1);
    });
    aramaInput.addEventListener('input', debouncedSearch);

    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sutun = header.dataset.sort;
            if (mevcutSiralamaSutunu === sutun) {
                mevcutSiralamaYonu = mevcutSiralamaYonu === 'asc' ? 'desc' : 'asc';
            } else {
                mevcutSiralamaSutunu = sutun;
                mevcutSiralamaYonu = 'asc';
            }
            verileriIsleVeGoster(1);
        });
    });

    await verileriYukle();
};

async function verileriYukle() {
    const tbody = document.getElementById('tedarikciler-tablosu');
    const kartListesi = document.getElementById('tedarikciler-kart-listesi');
    const toplamLitreBaslik = document.querySelector('[data-sort="toplam_litre"]');

    tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    kartListesi.innerHTML = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;

    try {
        tumTedarikciler = await store.getTedarikciler();
        const toplamLitreMevcut = navigator.onLine && tumTedarikciler.length > 0 && tumTedarikciler[0].hasOwnProperty('toplam_litre');
        if (toplamLitreBaslik) toplamLitreBaslik.style.display = toplamLitreMevcut ? '' : 'none';
        
        mevcutSiralamaSutunu = toplamLitreMevcut ? (mevcutSiralamaSutunu || 'isim') : 'isim';
        
        verileriIsleVeGoster(1);

    } catch (error) {
        console.error("Hata:", error);
        const hataMesaji = navigator.onLine ? "Tedarikçi verileri yüklenemedi." : "Çevrimdışı modda gösterilecek önbelleğe alınmış veri bulunamadı.";
        gosterMesaj(hataMesaji, "danger");
        tbody.innerHTML = '';
        kartListesi.innerHTML = '';
    }
}

function verileriIsleVeGoster(sayfa = 1) {
    mevcutSayfa = sayfa;
    let islenmisVeri = [...tumTedarikciler];

    if (mevcutAramaTerimi) {
        islenmisVeri = islenmisVeri.filter(supplier =>
            supplier.isim.toLowerCase().includes(mevcutAramaTerimi) ||
            (supplier.telefon_no && supplier.telefon_no.includes(mevcutAramaTerimi))
        );
    }

    islenmisVeri.sort((a, b) => {
        let valA = a.isim.toLocaleLowerCase('tr');
        let valB = b.isim.toLocaleLowerCase('tr');
        if (mevcutSiralamaSutunu === 'toplam_litre') {
            valA = parseFloat(a.toplam_litre || 0);
            valB = parseFloat(b.toplam_litre || 0);
        }
        if (valA < valB) return mevcutSiralamaYonu === 'asc' ? -1 : 1;
        if (valA > valB) return mevcutSiralamaYonu === 'asc' ? 1 : -1;
        return 0;
    });

    const toplamKayit = islenmisVeri.length;
    const baslangic = (sayfa - 1) * KAYIT_SAYISI;
    const bitis = baslangic + KAYIT_SAYISI;
    const sayfaVerisi = islenmisVeri.slice(baslangic, bitis);

    verileriGoster(sayfaVerisi);

    ui.sayfalamaNavOlustur(
        'tedarikci-sayfalama', toplamKayit, sayfa, KAYIT_SAYISI, 
        (yeniSayfa) => verileriIsleVeGoster(yeniSayfa)
    );
    basliklariGuncelle();
}

function verileriGoster(suppliers) {
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    veriYokMesaji.style.display = suppliers.length === 0 ? 'block' : 'none';
    if (mevcutGorunum === 'tablo') renderTable(suppliers);
    else renderCards(suppliers);
}

function renderTable(suppliers) {
    const tbody = document.getElementById('tedarikciler-tablosu');
    const toplamLitreMevcut = navigator.onLine;
    tbody.innerHTML = '';
    suppliers.forEach(supplier => {
        const toplamLitreHtml = toplamLitreMevcut ? `<td class="text-end">${parseFloat(supplier.toplam_litre || 0).toFixed(2)} L</td>` : '';
        tbody.innerHTML += `
            <tr>
                <td><strong>${supplier.isim}</strong></td>
                <td>${supplier.telefon_no || '-'}</td>
                ${toplamLitreHtml} 
                <td class="text-center">
                    <a href="/tedarikci/${supplier.id}" class="btn btn-sm btn-outline-info" title="Detayları Gör"><i class="bi bi-eye"></i></a>
                    <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="tedarikciDuzenleAc(${supplier.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="silmeOnayiAc(${supplier.id}, '${supplier.isim}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
     // Başlık kolonunu da gizle/göster
    document.querySelector('[data-sort="toplam_litre"]').style.display = toplamLitreMevcut ? '' : 'none';
}

function renderCards(suppliers) {
    const container = document.getElementById('tedarikciler-kart-listesi');
    container.innerHTML = '';
    suppliers.forEach(supplier => {
        container.innerHTML += `
            <div class="col-lg-4 col-md-6 col-12">
                <div class="supplier-card">
                    <div class="supplier-card-header"><h5>${supplier.isim}</h5></div>
                    <div class="supplier-card-body"><p class="mb-2"><i class="bi bi-telephone-fill me-2"></i>${supplier.telefon_no || 'Belirtilmemiş'}</p></div>
                    <div class="supplier-card-footer">
                        <a href="/tedarikci/${supplier.id}" class="btn btn-sm btn-outline-info" title="Detayları Gör"><i class="bi bi-eye"></i></a>
                        <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="tedarikciDuzenleAc(${supplier.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="silmeOnayiAc(${supplier.id}, '${supplier.isim}')"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
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
    
    // --- YENİ ÇEVRİMDIŞI MANTIĞI ---
    if (!navigator.onLine) {
        // Düzenleme çevrimdışı desteklenmiyor
        if (id) {
            gosterMesaj("Tedarikçi düzenlemek için internet bağlantısı gereklidir.", "warning");
            return;
        }
        // Yeni kayıt ise çevrimdışı kaydet
        const basarili = await kaydetTedarikciCevrimdisi(veri);
        if (basarili) {
            tedarikciModal.hide();
        }
        return;
    }

    // --- Mevcut Çevrimiçi Mantığı ---
    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    const url = id ? `/api/tedarikci_duzenle/${id}` : '/api/tedarikci_ekle';
    const method = id ? 'PUT' : 'POST';
    try {
        const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, "success");
            tedarikciModal.hide();
            await verileriYukle();
        } else {
            gosterMesaj(result.error || "Bir hata oluştu.", "danger");
        }
    } catch (error) {
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

async function tedarikciSil() {
    const id = document.getElementById('silinecek-tedarikci-id').value;
    if (!navigator.onLine) {
        gosterMesaj("Tedarikçi silmek için internet bağlantısı gereklidir.", "danger");
        return;
    }
    try {
        const response = await fetch(`/api/tedarikci_sil/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            silmeOnayModal.hide();
            await verileriYukle(); 
        } else {
            gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}

// Diğer yardımcı fonksiyonlar (değişiklik yok)
function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('tedarikciGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);
    verileriIsleVeGoster(mevcutSayfa);
}
function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    document.getElementById(`${aktifGorunum}-gorunumu`).style.display = 'block';
    document.getElementById('btn-view-table').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}
function basliklariGuncelle() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('asc', 'desc');
        if (header.dataset.sort === mevcutSiralamaSutunu) {
            header.classList.add(mevcutSiralamaYonu);
        }
    });
}
function yeniTedarikciAc() {
    document.getElementById('tedarikciModalLabel').innerText = 'Yeni Tedarikçi Ekle';
    document.getElementById('edit-tedarikci-id').value = '';
    document.getElementById('tedarikci-form').reset();
    tedarikciModal.show();
}
function tedarikciDuzenleAc(id) {
    const supplier = tumTedarikciler.find(t => t.id === id);
    if(supplier){
        document.getElementById('tedarikciModalLabel').innerText = 'Tedarikçi Bilgilerini Düzenle';
        document.getElementById('edit-tedarikci-id').value = supplier.id;
        document.getElementById('tedarikci-isim-input').value = supplier.isim;
        document.getElementById('tedarikci-tc-input').value = supplier.tc_no || '';
        document.getElementById('tedarikci-tel-input').value = supplier.telefon_no || '';
        document.getElementById('tedarikci-adres-input').value = supplier.adres || '';
        tedarikciModal.show();
    } else {
        gosterMesaj("Tedarikçi detayı bulunamadı.", "danger");
    }
}
function silmeOnayiAc(id, isim) {
    document.getElementById('silinecek-tedarikci-id').value = id;
    document.getElementById('silinecek-tedarikci-adi').innerText = isim;
    silmeOnayModal.show();
}

