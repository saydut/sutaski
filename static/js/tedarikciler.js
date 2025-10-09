// static/js/tedarikciler.js (SUNUCU TARAFLI ARAMA VE SIRALAMA İÇİN SON HALİ)

// --- Global Değişkenler ---
// Bu değişkenler, sayfanın mevcut durumunu (hangi sayfa, hangi sıralama vb.) saklar.
let tedarikciModal, silmeOnayModal;
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15;
let mevcutSiralamaSutunu = 'isim';
let mevcutSiralamaYonu = 'asc';
let mevcutAramaTerimi = '';
let mevcutGorunum = 'tablo';

// --- Yardımcı Fonksiyon: Debounce ---
// Kullanıcı arama kutusuna hızlıca yazı yazarken her harfte sunucuya gitmek yerine,
// yazmayı bıraktıktan kısa bir süre sonra tek bir istek gönderir. Bu, sistemi yormaz.
function debounce(func, delay = 400) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// --- Sayfa Yüklendiğinde Çalışan Ana Fonksiyon ---
// Gerekli modal'ları hazırlar, olay dinleyicilerini (arama ve sıralama için) kurar
// ve sunucudan ilk sayfa verisini ister.
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
            verileriYukle(1); // Sıralama değiştiğinde ilk sayfadan başla
        });
    });

    await verileriYukle();
};

// --- Ana Veri Yükleme Fonksiyonu ---
// Sunucuya o anki sayfa, arama ve sıralama bilgilerini göndererek
// sadece ihtiyaç duyulan veriyi (örn: 15 kayıt) ister.
async function verileriYukle(sayfa = 1) {
    mevcutSayfa = sayfa;
    const tbody = document.getElementById('tedarikciler-tablosu');
    const kartListesi = document.getElementById('tedarikciler-kart-listesi');

    tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    kartListesi.innerHTML = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;
    document.getElementById('veri-yok-mesaji').style.display = 'none';

    try {
        const url = `/api/tedarikciler_liste?sayfa=${sayfa}&arama=${mevcutAramaTerimi}&sirala=${mevcutSiralamaSutunu}&yon=${mevcutSiralamaYonu}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);
        
        verileriGoster(data.tedarikciler);
        ui.sayfalamaNavOlustur('tedarikci-sayfalama', data.toplam_kayit, sayfa, KAYIT_SAYISI, verileriYukle);
        basliklariGuncelle();

    } catch (error) {
        console.error("Hata:", error);
        gosterMesaj(error.message || "Tedarikçi verileri yüklenemedi.", "danger");
        tbody.innerHTML = '';
        kartListesi.innerHTML = '';
    }
}

// --- Arayüz Çizim Fonksiyonları ---

// Gelen veriyi tabloya mı yoksa kartlara mı çizeceğine karar verir.
function verileriGoster(tedarikciler) {
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    veriYokMesaji.style.display = tedarikciler.length === 0 ? 'block' : 'none';
    if (mevcutGorunum === 'tablo') {
        renderTable(tedarikciler);
    } else {
        renderCards(tedarikciler);
    }
}

// Gelen veriyi tablo satırları olarak HTML'e dönüştürür.
function renderTable(suppliers) {
    const tbody = document.getElementById('tedarikciler-tablosu');
    tbody.innerHTML = '';
    suppliers.forEach(supplier => {
        tbody.innerHTML += `
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

// --- Veri Manipülasyon Fonksiyonları ---

// Yeni tedarikçi ekler veya mevcut tedarikçiyi günceller.
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

// Bir tedarikçiyi siler.
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


// --- Modal ve Arayüz Yardımcı Fonksiyonları ---

// "Düzenle" butonuna tıklandığında, sunucudan o tedarikçinin en güncel verisini
// çekerek modal'ı doldurur.
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

// "Yeni Tedarikçi Ekle" butonuna basıldığında boş modal'ı açar.
function yeniTedarikciAc() {
    document.getElementById('tedarikciModalLabel').innerText = 'Yeni Tedarikçi Ekle';
    document.getElementById('edit-tedarikci-id').value = '';
    document.getElementById('tedarikci-form').reset();
    tedarikciModal.show();
}

// "Sil" butonuna basıldığında onay modal'ını açar.
function silmeOnayiAc(id, isim) {
    document.getElementById('silinecek-tedarikci-id').value = id;
    document.getElementById('silinecek-tedarikci-adi').innerText = isim;
    silmeOnayModal.show();
}

// Görünüm (Liste/Kart) değiştirme butonlarına tıklandığında çalışır.
function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('tedarikciGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);
    verileriYukle(mevcutSayfa);
}

// Arayüzdeki Liste/Kart görünümünü ayarlar.
function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    document.getElementById(`${aktifGorunum}-gorunumu`).style.display = 'block';
    document.getElementById('btn-view-table').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}

