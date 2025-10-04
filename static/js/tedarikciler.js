// static/js/tedarikciler.js - SUNUCU TARAFLI SAYFALAMA KULLANAN YENİ VERSİYON

let tedarikciModal, silmeOnayModal;

// Sayfa durumunu tutacak değişkenler
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15; // Backend'deki limit ile aynı olmalı
let mevcutSiralamaSutunu = 'isim';
let mevcutSiralamaYonu = 'asc';
let mevcutAramaTerimi = '';
let mevcutGorunum = 'tablo';

window.onload = async () => {
    tedarikciModal = new bootstrap.Modal(document.getElementById('tedarikciModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    mevcutGorunum = localStorage.getItem('tedarikciGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);

    // Olay dinleyicilerini ayarla
    document.getElementById('arama-input').addEventListener('input', (event) => {
        mevcutAramaTerimi = event.target.value;
        verileriYukle(1); // Arama yapıldığında her zaman ilk sayfaya git
    });

    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sutun = header.dataset.sort;
            if (mevcutSiralamaSutunu === sutun) {
                mevcutSiralamaYonu = mevcutSiralamaYonu === 'asc' ? 'desc' : 'asc';
            } else {
                mevcutSiralamaSutunu = sutun;
                mevcutSiralamaYonu = 'asc';
            }
            verileriYukle(1); // Sıralama değiştiğinde ilk sayfaya git
        });
    });

    // Sayfa ilk yüklendiğinde verileri sunucudan çek
    await verileriYukle(1);
};


// Sunucudan verileri çeken ana fonksiyon
async function verileriYukle(sayfa = 1) {
    mevcutSayfa = sayfa;
    const tbody = document.getElementById('tedarikciler-tablosu');
    const kartListesi = document.getElementById('tedarikciler-kart-listesi');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    const sayfalamaNav = document.getElementById('tedarikci-sayfalama');

    // Yükleniyor animasyonlarını göster
    veriYokMesaji.style.display = 'none';
    if (mevcutGorunum === 'tablo') {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    } else {
        kartListesi.innerHTML = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;
    }

    // Çevrimdışı kontrolü
    if (!navigator.onLine) {
        gosterMesaj("Tedarikçileri listelemek, aramak ve sıralamak için internet bağlantısı gereklidir.", "warning");
        if (mevcutGorunum === 'tablo') {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-warning">Çevrimdışı modda listeleme yapılamıyor.</td></tr>`;
        } else {
            kartListesi.innerHTML = `<div class="col-12 text-center p-4 text-warning">Çevrimdışı modda listeleme yapılamıyor.</div>`;
        }
        sayfalamaNav.innerHTML = '';
        return;
    }
    
    try {
        // Backend'e tüm parametrelerle birlikte istek at
        const url = `/api/tedarikciler_liste?sayfa=${sayfa}&arama=${mevcutAramaTerimi}&siralamaSutun=${mevcutSiralamaSutunu}&siralamaYon=${mevcutSiralamaYonu}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        // Gelen veriyi ekrana bas
        verileriGoster(data.tedarikciler);

        // Sayfalama navigasyonunu oluştur
        ui.sayfalamaNavOlustur(
            'tedarikci-sayfalama',
            data.toplam_kayit,
            sayfa,
            KAYIT_SAYISI,
            verileriYukle // Sayfa değiştirme callback'i
        );

        // Sıralama oklarını güncelle
        basliklariGuncelle();

    } catch (error) {
        console.error("Hata:", error);
        gosterMesaj(error.message || "Tedarikçi verileri yüklenemedi.", "danger");
    }
}

// Gelen veriyi mevcut görünüme göre ekrana basan fonksiyon
function verileriGoster(tedarikciler) {
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    veriYokMesaji.style.display = tedarikciler.length === 0 ? 'block' : 'none';
    
    if (mevcutGorunum === 'tablo') {
        renderTable(tedarikciler);
    } else {
        renderCards(tedarikciler);
    }
}

function renderTable(tedarikciler) {
    const tbody = document.getElementById('tedarikciler-tablosu');
    tbody.innerHTML = '';
    tedarikciler.forEach(tedarikci => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${tedarikci.isim}</strong></td>
                <td>${tedarikci.telefon_no || '-'}</td>
                <td class="text-end">${parseFloat(tedarikci.toplam_litre || 0).toFixed(2)} L</td>
                <td class="text-center">
                    <a href="/tedarikci/${tedarikci.id}" class="btn btn-sm btn-outline-info" title="Detayları Gör"><i class="bi bi-eye"></i></a>
                    <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="tedarikciDuzenleAc(${tedarikci.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="silmeOnayiAc(${tedarikci.id}, '${tedarikci.isim}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

function renderCards(tedarikciler) {
    const container = document.getElementById('tedarikciler-kart-listesi');
    container.innerHTML = '';
    tedarikciler.forEach(tedarikci => {
        container.innerHTML += `
            <div class="col-lg-4 col-md-6 col-12">
                <div class="supplier-card">
                    <div class="supplier-card-header">
                        <h5>${tedarikci.isim}</h5>
                        <small class="text-secondary">${tedarikci.telefon_no || 'Telefon yok'}</small>
                    </div>
                    <div class="supplier-card-body">
                        <p class="mb-1">Toplam Süt</p>
                        <h4 class="fw-bold text-primary">${parseFloat(tedarikci.toplam_litre || 0).toFixed(2)} L</h4>
                    </div>
                    <div class="supplier-card-footer">
                        <a href="/tedarikci/${tedarikci.id}" class="btn btn-sm btn-outline-info" title="Detayları Gör"><i class="bi bi-eye"></i></a>
                        <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="tedarikciDuzenleAc(${tedarikci.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="silmeOnayiAc(${tedarikci.id}, '${tedarikci.isim}')"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

// Görünüm değiştirme fonksiyonları
function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('tedarikciGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);
    verileriYukle(mevcutSayfa); // Mevcut sayfayı yeni görünümle tekrar yükle
}

function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    document.getElementById(`${aktifGorunum}-gorunumu`).style.display = 'block';
    document.getElementById('btn-view-table').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}

// Sıralama başlıklarındaki okları günceller
function basliklariGuncelle() {
    document.querySelectorAll('.sortable').forEach(header => {
        const sutun = header.dataset.sort;
        header.classList.remove('asc', 'desc');
        if (sutun === mevcutSiralamaSutunu) {
            header.classList.add(mevcutSiralamaYonu);
        }
    });
}

// --- MODAL İŞLEMLERİ (Bu fonksiyonlar büyük ölçüde aynı kaldı) ---

function yeniTedarikciAc() {
    document.getElementById('tedarikciModalLabel').innerText = 'Yeni Tedarikçi Ekle';
    document.getElementById('edit-tedarikci-id').value = '';
    document.getElementById('tedarikci-form').reset();
    tedarikciModal.show();
}

async function tedarikciDuzenleAc(id) {
    // Düzenleme için tek bir tedarikçinin tam verisini sunucudan çekiyoruz
    try {
        const response = await fetch(`/api/tedarikci/${id}`);
        const tedarikci = await response.json();
        if (!response.ok) throw new Error(tedarikci.error);

        document.getElementById('tedarikciModalLabel').innerText = 'Tedarikçi Bilgilerini Düzenle';
        document.getElementById('edit-tedarikci-id').value = tedarikci.id;
        document.getElementById('tedarikci-isim-input').value = tedarikci.isim;
        document.getElementById('tedarikci-tc-input').value = tedarikci.tc_no || '';
        document.getElementById('tedarikci-tel-input').value = tedarikci.telefon_no || '';
        document.getElementById('tedarikci-adres-input').value = tedarikci.adres || '';
        tedarikciModal.show();
    } catch (error) {
        gosterMesaj(error.message || "Tedarikçi detayı bulunamadı.", "danger");
    }
}

function silmeOnayiAc(id, isim) {
    document.getElementById('silinecek-tedarikci-id').value = id;
    document.getElementById('silinecek-tedarikci-adi').innerText = isim;
    silmeOnayModal.show();
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
    
    // --- EKLENEN KONTROL ---
    if (!navigator.onLine) { 
        gosterMesaj("Bu işlem için internet bağlantısı gereklidir.", "warning"); 
        return; 
    }
    // --- KONTROL SONU ---

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    
    const url = id ? `/api/tedarikci_duzenle/${id}` : '/api/tedarikci_ekle';
    const method = id ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, "success");
            tedarikciModal.hide();
            await verileriYukle(id ? mevcutSayfa : 1); // Yeni kayıt eklenince ilk sayfaya git
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
    silmeOnayModal.hide();

    // --- EKLENEN KONTROL ---
    if (!navigator.onLine) { 
        gosterMesaj("Silme işlemi için internet bağlantısı gereklidir.", "warning");
        return; 
    }
    // --- KONTROL SONU ---
    
    try {
        const response = await fetch(`/api/tedarikci_sil/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            await verileriYukle(mevcutSayfa); // Listeyi yenile
        } else {
            gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}