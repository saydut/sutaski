// static/js/tedarikciler.js (MERKEZİ YÜKLEYİCİYİ KULLANACAK ŞEKİLDE REFAKTÖR EDİLDİ)

// --- Global Değişkenler ---
let tedarikciModal, silmeOnayModal;
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15;
let mevcutSiralamaSutunu = 'isim';
let mevcutSiralamaYonu = 'asc';
let mevcutAramaTerimi = '';
let mevcutGorunum = 'tablo';

// --- Yardımcı Fonksiyon: Debounce ---
function debounce(func, delay = 400) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// --- Sayfa Yüklendiğinde Çalışan Ana Fonksiyon ---
window.onload = async () => {
    tedarikciModal = new bootstrap.Modal(document.getElementById('tedarikciModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    mevcutGorunum = localStorage.getItem('tedarikciGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);

    const aramaInput = document.getElementById('arama-input');
    aramaInput.addEventListener('input', debounce((event) => {
        mevcutAramaTerimi = event.target.value;
        verileriYukle(1); // Arama yapıldığında her zaman ilk sayfadan başla
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
            verileriYukle(1); // Sıralama değiştiğinde ilk sayfadan başla
        });
    });

    basliklariGuncelle();
    await verileriYukle();
};

// --- Ana Veri Yükleme Fonksiyonu (REFAKTÖR EDİLDİ) ---
async function verileriYukle(sayfa = 1) {
    mevcutSayfa = sayfa;
    const url = `/api/tedarikciler_liste?sayfa=${sayfa}&arama=${mevcutAramaTerimi}&sirala=${mevcutSiralamaSutunu}&yon=${mevcutSiralamaYonu}`;

    // data-loader.js'deki merkezi fonksiyonu çağırıyoruz
    await genelVeriYukleyici({
        apiURL: url,
        veriAnahtari: 'tedarikciler',
        tabloBodyId: 'tedarikciler-tablosu',
        kartContainerId: 'tedarikciler-kart-listesi',
        veriYokId: 'veri-yok-mesaji',
        sayfalamaId: 'tedarikci-sayfalama',
        tabloRenderFn: renderTable,    // Bu sayfaya özel render fonksiyonu
        kartRenderFn: renderCards,     // Bu sayfaya özel render fonksiyonu
        yukleFn: verileriYukle,        // Sayfalama için callback
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: mevcutGorunum
    });
}


// --- Arayüz Çizim Fonksiyonları (YENİ, AYRI FONKSİYONLAR) ---

// Gelen veriyi tablo satırları olarak HTML'e dönüştürür.
function renderTable(container, suppliers) {
    suppliers.forEach(supplier => {
        container.innerHTML += `
            <tr>
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

// Gelen veriyi kartlar olarak HTML'e dönüştürür.
function renderCards(container, suppliers) {
    suppliers.forEach(supplier => {
        container.innerHTML += `
            <div class="col-lg-4 col-md-6 col-12">
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

// Sıralama yapıldıktan sonra tablo başlıklarındaki ok ikonlarını (▲/▼) günceller.
function basliklariGuncelle() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('asc', 'desc');
        if (header.dataset.sort === mevcutSiralamaSutunu) {
            header.classList.add(mevcutSiralamaYonu);
        }
    });
}

// --- Veri Manipülasyon Fonksiyonları (DEĞİŞİKLİK YOK) ---

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
        await verileriYukle(mevcutSayfa); // İşlem sonrası listeyi yenile
    } catch (error) {
        gosterMesaj(error.message || "Bir hata oluştu.", "danger");
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

async function tedarikciSil() {
    const id = document.getElementById('silinecek-tedarikci-id').value;
    silmeOnayModal.hide();

    try {
        const result = await api.deleteTedarikci(id);
        gosterMesaj(result.message, 'success');
        await verileriYukle(1); // Silme sonrası ilk sayfaya dön
    } catch (error) {
        gosterMesaj(error.message || 'Silme işlemi başarısız.', 'danger');
    }
}


// --- Modal ve Arayüz Yardımcı Fonksiyonları (DEĞİŞİKLİK YOK) ---

async function tedarikciDuzenleAc(id, button) {
    button.disabled = true;
    try {
        const response = await fetch(`/api/tedarikci/${id}`);
        const supplier = await response.json();
        if(!response.ok) throw new Error(supplier.error);

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
