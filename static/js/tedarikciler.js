// static/js/tedarikciler.js DOSYASININ SON VE TAM HALİ

let tedarikciModal, silmeOnayModal;

// Sayfa durumunu tutacak değişkenler
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15;
let mevcutSiralamaSutunu = 'isim';
let mevcutSiralamaYonu = 'asc';
let mevcutAramaTerimi = '';
let mevcutGorunum = 'tablo';
let debounceTimer; // Arama için zamanlayıcı
let tumCevrimdisiTedarikciler = []; // Çevrimdışı listeyi tutmak için

window.onload = async () => {
    tedarikciModal = new bootstrap.Modal(document.getElementById('tedarikciModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    mevcutGorunum = localStorage.getItem('tedarikciGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);

    // Olay dinleyicilerini ayarla
    document.getElementById('arama-input').addEventListener('input', (event) => {
        // Arama mantığı artık online/offline durumuna göre değişiyor
        if (navigator.onLine) {
            // ÇEVRİMİÇİ ARAMA (DEBOUNCE İLE)
            mevcutAramaTerimi = event.target.value;
            clearTimeout(debounceTimer); // Önceki zamanlayıcıyı temizle
            // Yeni bir zamanlayıcı ayarla
            debounceTimer = setTimeout(() => {
                verileriYukle(1); // Sunucu tabanlı arama yap
            }, 300); // Kullanıcı yazmayı bıraktıktan 300ms sonra ara
        } else {
            // ÇEVRİMDIŞI ARAMA (ANINDA FİLTRELEME)
            const aramaTerimi = event.target.value.toLowerCase();
            const filtrelenmisListe = tumCevrimdisiTedarikciler.filter(t => 
                (t.isim && t.isim.toLowerCase().includes(aramaTerimi)) ||
                (t.telefon_no && t.telefon_no.includes(aramaTerimi))
            );
            verileriGoster(filtrelenmisListe);
        }
    });

    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            // Sıralama sadece online iken çalışır
            if (!navigator.onLine) return; 
            
            const sutun = header.dataset.sort;
            if (mevcutSiralamaSutunu === sutun) {
                mevcutSiralamaYonu = mevcutSiralamaYonu === 'asc' ? 'desc' : 'asc';
            } else {
                mevcutSiralamaSutunu = sutun;
                mevcutSiralamaYonu = 'asc';
            }
            verileriYukle(1);
        });
    });

    // Sayfa ilk yüklendiğinde verileri yükle
    await verileriYukle(1);
};


// Ana veri yükleme fonksiyonu artık hibrit çalışıyor
async function verileriYukle(sayfa = 1) {
    const offlineUyari = document.getElementById('offline-uyari-mesaji');
    const sayfalamaNav = document.getElementById('tedarikci-sayfalama');
    const siralamaBasliklari = document.querySelectorAll('.sortable');

    // --- ÇEVRİMDIŞI BLOK ---
    if (!navigator.onLine) {
        offlineUyari.classList.remove('d-none'); // Uyarıyı göster
        sayfalamaNav.innerHTML = ''; // Sayfalamayı gizle
        siralamaBasliklari.forEach(h => h.style.cursor = 'not-allowed'); // Sıralama imlecini değiştir

        try {
            // Yerel veritabanından önbelleklenmiş listeyi çek
            tumCevrimdisiTedarikciler = await getOfflineTedarikciler();
            verileriGoster(tumCevrimdisiTedarikciler);
        } catch (e) {
            gosterMesaj("Önbellekteki tedarikçiler yüklenemedi.", "danger");
            verileriGoster([]);
        }
        return; // Fonksiyonu burada bitir, online koda geçme
    }
    // --- ÇEVRİMDIŞI BLOK SONU ---

    // --- ÇEVRİMİÇİ BLOK ---
    offlineUyari.classList.add('d-none'); // Uyarıyı gizle
    siralamaBasliklari.forEach(h => h.style.cursor = 'pointer'); // Sıralama imlecini düzelt
    
    mevcutSayfa = sayfa;
    const tbody = document.getElementById('tedarikciler-tablosu');
    const kartListesi = document.getElementById('tedarikciler-kart-listesi');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    
    veriYokMesaji.style.display = 'none';
    if (mevcutGorunum === 'tablo') {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    } else {
        kartListesi.innerHTML = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;
    }

    try {
        const url = `/api/tedarikciler_liste?sayfa=${sayfa}&arama=${mevcutAramaTerimi}&siralamaSutun=${mevcutSiralamaSutunu}&siralamaYon=${mevcutSiralamaYonu}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);
        
        verileriGoster(data.tedarikciler);
        
        ui.sayfalamaNavOlustur('tedarikci-sayfalama', data.toplam_kayit, sayfa, KAYIT_SAYISI, verileriYukle);
        basliklariGuncelle();

    } catch (error) {
        console.error("Hata:", error);
        gosterMesaj(error.message || "Tedarikçi verileri yüklenemedi.", "danger");
    }
}

// Bu fonksiyonlar artık eksik veriyle de (çevrimdışı) çalışabiliyor
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

// Veri gösterme ve görünüm değiştirme fonksiyonları
function verileriGoster(tedarikciler) {
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    veriYokMesaji.style.display = tedarikciler.length === 0 ? 'block' : 'none';
    
    if (mevcutGorunum === 'tablo') {
        renderTable(tedarikciler);
    } else {
        renderCards(tedarikciler);
    }
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

function basliklariGuncelle() {
    document.querySelectorAll('.sortable').forEach(header => {
        const sutun = header.dataset.sort;
        header.classList.remove('asc', 'desc');
        if (sutun === mevcutSiralamaSutunu) {
            header.classList.add(mevcutSiralamaYonu);
        }
    });
}

// Modal işlemleri
function yeniTedarikciAc() {
    document.getElementById('tedarikciModalLabel').innerText = 'Yeni Tedarikçi Ekle';
    document.getElementById('edit-tedarikci-id').value = '';
    document.getElementById('tedarikci-form').reset();
    tedarikciModal.show();
}

async function tedarikciDuzenleAc(id) {
    if (!navigator.onLine) {
        gosterMesaj("Düzenleme işlemi için internet bağlantısı gereklidir.", "warning");
        return;
    }
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
    
    if (!id && !navigator.onLine) { 
        const basarili = await kaydetCevrimdisiYeniTedarikci(veri);
        if (basarili) {
            tedarikciModal.hide();
            document.getElementById('tedarikci-form').reset();
        }
        return; 
    }
    
    if (id && !navigator.onLine) {
        gosterMesaj("Tedarikçi düzenleme işlemi için internet bağlantısı gereklidir.", "warning");
        return;
    }

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
            await verileriYukle(id ? mevcutSayfa : 1);
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

    if (!navigator.onLine) { 
        gosterMesaj("Silme işlemi için internet bağlantısı gereklidir.", "warning");
        return; 
    }
    
    try {
        const response = await fetch(`/api/tedarikci_sil/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            await verileriYukle(mevcutSayfa);
        } else {
            gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}