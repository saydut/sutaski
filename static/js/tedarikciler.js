// static/js/tedarikciler.js (ÇEVRİMDIŞI MOD İÇİN YENİDEN YAPILANDIRILDI)

let tedarikciModal, silmeOnayModal;
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15;

// Sıralama ve arama durumunu tutacak değişkenler
let mevcutSiralamaSutunu = 'isim';
let mevcutSiralamaYonu = 'asc';
let mevcutAramaTerimi = '';
let mevcutGorunum = 'tablo';

// Tüm veriyi bellekte tutacağımız dizi
let tumTedarikciler = [];

window.onload = async () => {
    tedarikciModal = new bootstrap.Modal(document.getElementById('tedarikciModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    mevcutGorunum = localStorage.getItem('tedarikciGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);

    // Olay dinleyicilerini ayarla
    document.getElementById('arama-input').addEventListener('input', (event) => {
        mevcutAramaTerimi = event.target.value.toLowerCase();
        // Arama yapıldığında her zaman ilk sayfaya git ve verileri yeniden işle
        verileriIsleVeGoster(1);
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
            // Sıralama değiştiğinde ilk sayfaya git ve verileri yeniden işle
            verileriIsleVeGoster(1);
        });
    });

    // Sayfa ilk yüklendiğinde verileri çek ve göster
    await verileriYukle();
};

// Veriyi YALNIZCA store üzerinden (online/offline fark etmeksizin) çeken fonksiyon
async function verileriYukle() {
    const tbody = document.getElementById('tedarikciler-tablosu');
    const kartListesi = document.getElementById('tedarikciler-kart-listesi');
    const toplamLitreBaslik = document.querySelector('[data-sort="toplam_litre"]');
    const toplamLitreKolon = document.querySelector('thead th:nth-child(3)');

    // Yükleniyor animasyonlarını başlat
    tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    kartListesi.innerHTML = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;

    try {
        // store.getTedarikciler fonksiyonu zaten online/offline durumunu kendisi yönetiyor.
        // Bize sadece onu çağırmak kalıyor.
        tumTedarikciler = await store.getTedarikciler();

        // Eğer gelen veride 'toplam_litre' bilgisi varsa ilgili kolonu göster, yoksa gizle.
        // Bu, çevrimdışıyken bile önbellekte bu bilgi varsa gösterilmesini sağlar.
        const toplamLitreMevcut = tumTedarikciler.length > 0 && tumTedarikciler[0].hasOwnProperty('toplam_litre');
        if (toplamLitreBaslik) toplamLitreBaslik.style.display = toplamLitreMevcut ? '' : 'none';
        if (toplamLitreKolon) toplamLitreKolon.style.display = toplamLitreMevcut ? '' : 'none';
        
        // Sıralama seçeneklerinden "Toplam Süt"ü de bu duruma göre ayarla
        mevcutSiralamaSutunu = toplamLitreMevcut ? (mevcutSiralamaSutunu || 'isim') : 'isim';


        verileriIsleVeGoster(1); // Gelen tam listeyi işle ve ilk sayfayı göster

    } catch (error) {
        console.error("Hata:", error);
        // Hata mesajını daha anlaşılır hale getiriyoruz.
        const hataMesaji = navigator.onLine ? "Tedarikçi verileri yüklenemedi." : "Çevrimdışı modda gösterilecek tedarikçi verisi bulunamadı. Lütfen internete bağlanarak verileri güncelleyin.";
        gosterMesaj(hataMesaji, "danger");
        tbody.innerHTML = ''; // Hata durumunda yükleniyor animasyonunu temizle
        kartListesi.innerHTML = '';
    }
}

// Gelen tam listeyi arama, sıralama ve sayfalama yaparak işleyen fonksiyon
function verileriIsleVeGoster(sayfa = 1) {
    mevcutSayfa = sayfa;
    let islenmisVeri = [...tumTedarikciler];

    // 1. Arama Filtresi Uygula
    if (mevcutAramaTerimi) {
        islenmisVeri = islenmisVeri.filter(supplier =>
            supplier.isim.toLowerCase().includes(mevcutAramaTerimi) ||
            (supplier.telefon_no && supplier.telefon_no.includes(mevcutAramaTerimi))
        );
    }

// 2. Sıralama Uygula
islenmisVeri.sort((a, b) => {
    let valA, valB;

    // Hangi sütuna göre sıralama yapılacağını kontrol et
    if (mevcutSiralamaSutunu === 'toplam_litre') {
        valA = parseFloat(a.toplam_litre || 0);
        valB = parseFloat(b.toplam_litre || 0);
    } else { // Varsayılan olarak isme göre sırala
        valA = a.isim.toLocaleLowerCase('tr');
        valB = b.isim.toLocaleLowerCase('tr');
    }

    // Değerleri karşılaştır
    if (valA < valB) {
        return mevcutSiralamaYonu === 'asc' ? -1 : 1;
    }
    if (valA > valB) {
        return mevcutSiralamaYonu === 'asc' ? 1 : -1;
    }
    return 0;
});

    // 3. Sayfalama Uygula
    const toplamKayit = islenmisVeri.length;
    const baslangic = (sayfa - 1) * KAYIT_SAYISI;
    const bitis = baslangic + KAYIT_SAYISI;
    const sayfaVerisi = islenmisVeri.slice(baslangic, bitis);

    // 4. Ekrana Bas
    verileriGoster(sayfaVerisi);

    // 5. Sayfalama Navigasyonunu Oluştur
    ui.sayfalamaNavOlustur(
        'tedarikci-sayfalama',
        toplamKayit,
        sayfa,
        KAYIT_SAYISI,
        (yeniSayfa) => verileriIsleVeGoster(yeniSayfa) // Sayfa değiştirme callback'i
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
    const toplamLitreMevcut = suppliers.length > 0 && suppliers[0].hasOwnProperty('toplam_litre');
    tbody.innerHTML = '';
    suppliers.forEach(supplier => {
        // *** DEĞİŞİKLİK BURADA ***
        // toplam_litre verisi varsa göster, yoksa gizle
        const toplamLitreHtml = toplamLitreMevcut ? `<td class="text-end">${parseFloat(supplier.toplam_litre || 0).toFixed(2)} L</td>` : '<td style="display: none;"></td>';

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
}

function renderCards(suppliers) {
    const container = document.getElementById('tedarikciler-kart-listesi');
    container.innerHTML = '';
    suppliers.forEach(supplier => {
        container.innerHTML += `
            <div class="col-lg-4 col-md-6 col-12">
                <div class="supplier-card">
                    <div class="supplier-card-header"><h5>${supplier.isim}</h5></div>
                    <div class="supplier-card-body">
                        <p class="mb-2"><i class="bi bi-telephone-fill me-2"></i>${supplier.telefon_no || 'Belirtilmemiş'}</p>
                    </div>
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
    
    // Çevrimdışı kayıt desteklenmediği için kontrol ekle
    if (!navigator.onLine) {
        gosterMesaj("Yeni tedarikçi eklemek için internet bağlantısı gereklidir.", "danger");
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

// Diğer yardımcı fonksiyonlar aynı kalabilir...
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
        const sutun = header.dataset.sort;
        header.classList.remove('asc', 'desc');
        if (sutun === mevcutSiralamaSutunu) {
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

async function tedarikciDuzenleAc(id) {
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