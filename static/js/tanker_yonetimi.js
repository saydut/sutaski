// static/js/tanker_yonetimi.js

// === GLOBAL DEĞİŞKENLER ===
let yeniTankerModal;
let tankerAtamaSecici; // TomSelect için
let tumTankerler = []; // Tanker listesini cache'lemek için
let tumToplayicilar = []; // Toplayıcı listesini cache'lemek için
let seciliToplayiciId = null; // Atama için seçilen kullanıcı

// === SAYFA YÜKLENİNCE ÇALIŞAN KOD ===
document.addEventListener('DOMContentLoaded', function() {
    
    // Modalları başlat
    yeniTankerModal = new bootstrap.Modal(document.getElementById('yeniTankerModal'));

    // Form gönderimini yakala (Enter tuşuna basılırsa)
    const yeniTankerForm = document.getElementById('yeni-tanker-form');
    if (yeniTankerForm) {
        yeniTankerForm.addEventListener('submit', (event) => {
            event.preventDefault(); 
            tankerEkle();
        });
    }
    
    // --- Atama Sekmesi Öğeleri ---
    tankerAtamaSecici = new TomSelect("#tanker-atama-secici", {
        create: false,
        sortField: { field: "text", direction: "asc" },
        placeholder: "Tanker seçin..."
    });
    
    // Arama çubuğunu dinle
    const aramaInput = document.getElementById('toplayici-arama-input');
    if (aramaInput) {
        aramaInput.addEventListener('input', (e) => {
            renderToplayiciListesi(tumToplayicilar, e.target.value);
        });
    }

    // Sekme değiştiğinde veriyi yükle
    const atamaSekmesi = document.getElementById('atama-tab');
    if (atamaSekmesi) {
        atamaSekmesi.addEventListener('shown.bs.tab', (event) => {
            // Sadece ilk açılışta veya ihtiyaç duyuldukça yükle
            if (tumToplayicilar.length === 0) {
                loadAtamaSekmesi();
            }
        });
    }
    // --- Atama Sekmesi Sonu ---

    // Sekme 1: Tanker listesini yükle (Sayfa açılır açılmaz)
    tankerleriYukle();
});

/**
 * API'den tanker listesini çeker ve ekrana render eder (Sekme 1).
 */
async function tankerleriYukle() {
    const container = document.getElementById('tanker-listesi-container');
    const veriYokMesaji = document.getElementById('tanker-veri-yok');
    
    if (!container || !veriYokMesaji) return;

    container.innerHTML = '<div class="col-12 text-center"><div class="spinner-border spinner-border-sm"></div> Yükleniyor...</div>';
    veriYokMesaji.style.display = 'none';

    try {
        // Global listeyi doldur (Aynı anda store'u da güncelleyelim)
        tumTankerler = await store.getTankers(true); 

        if (!tumTankerler || tumTankerler.length === 0) {
            container.innerHTML = '';
            veriYokMesaji.style.display = 'block';
            return;
        }

        renderTankerListesi(tumTankerler);

    } catch (error) {
        container.innerHTML = '';
        gosterMesaj(error.message, 'danger');
    }
}

/**
 * Gelen tanker verisine göre HTML kartlarını oluşturur (Sekme 1).
 */
function renderTankerListesi(tankerler) {
    const container = document.getElementById('tanker-listesi-container');
    container.innerHTML = ''; 

    tankerler.forEach(tanker => {
        const kapasite = parseFloat(tanker.kapasite_litre);
        const doluluk = parseFloat(tanker.mevcut_doluluk);
        const yuzde = parseInt(tanker.doluluk_yuzdesi, 10);

        let progressBarClass = 'bg-success';
        if (yuzde > 75) progressBarClass = 'bg-warning';
        if (yuzde > 95) progressBarClass = 'bg-danger';

        const cardHtml = `
            <div class="col-lg-6 col-md-12" id="tanker-kart-${tanker.id}">
                <div class="card shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h5 class="card-title mb-0">${utils.sanitizeHTML(tanker.tanker_adi)}</h5>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-success" disabled>
                                    <i class="bi bi-box-arrow-in-down me-1"></i> Sat/Boşalt
                                </button>
                                <button class="btn btn-outline-danger" disabled>
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="mb-1">
                            <small class="text-secondary">Doluluk Oranı: ${doluluk.toFixed(0)} L / ${kapasite.toFixed(0)} L</small>
                        </div>
                        <div class="progress" role="progressbar" aria-label="Tanker doluluk" aria-valuenow="${yuzde}" aria-valuemin="0" aria-valuemax="100" style="height: 20px;">
                            <div class="progress-bar ${progressBarClass} progress-bar-striped progress-bar-animated" style="width: ${yuzde}%">
                                <strong>${yuzde}%</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

/**
 * "Yeni Tanker Ekle" modalını açar (HTML onclick'ten çağrılır)
 */
function yeniTankerModaliniAc() {
    if (yeniTankerModal) {
        document.getElementById('yeni-tanker-form').reset();
        yeniTankerModal.show();
    }
}

/**
 * "Yeni Tanker Ekle" modalındaki formu API'ye gönderir.
 */
async function tankerEkle() {
    const kaydetButton = document.getElementById('kaydet-tanker-btn');
    const originalButtonText = 'Kaydet';

    const veri = {
        tanker_adi: document.getElementById('tanker-adi-input').value.trim(),
        kapasite: document.getElementById('tanker-kapasite-input').value
    };

    if (!veri.tanker_adi || !veri.kapasite) {
        gosterMesaj('Tanker adı ve kapasitesi zorunludur.', 'warning');
        return;
    }
    if (parseFloat(veri.kapasite) <= 0) {
        gosterMesaj('Kapasite 0\'dan büyük olmalıdır.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    try {
        const result = await api.request('/tanker/api/ekle', {
            method: 'POST',
            body: JSON.stringify(veri),
            headers: { 'Content-Type': 'application/json' }
        });
        
        gosterMesaj(result.message, 'success');
        yeniTankerModal.hide();
        await tankerleriYukle(); // Listeyi yenile

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

// ==========================================================
// YENİ FONKSİYONLAR: Toplayıcı Atama Sekmesi (Sekme 2)
// ==========================================================

/**
 * Atama sekmesi için gerekli verileri (toplayıcılar ve tankerler) yükler.
 */
async function loadAtamaSekmesi() {
    const listeContainer = document.getElementById('toplayici-atama-listesi');
    const veriYokMesaji = document.getElementById('toplayici-veri-yok');
    
    listeContainer.innerHTML = '<div class="list-group-item text-center"><div class="spinner-border spinner-border-sm"></div> Yükleniyor...</div>';
    veriYokMesaji.style.display = 'none';

    try {
        // İki API isteğini aynı anda yap
        const [toplayicilar, tankerler] = await Promise.all([
            api.request('/tanker/api/toplayici-listesi'), // Az önce Python'da yazdığımız API
            store.getTankers(true) // Tankerleri store'dan taze olarak çek
        ]);

        tumToplayicilar = toplayicilar || []; // Global listeyi doldur
        tumTankerler = tankerler || []; // Global tanker listesini doldur
        
        if (tumToplayicilar.length === 0) {
            listeContainer.innerHTML = '';
            veriYokMesaji.style.display = 'block';
        } else {
            veriYokMesaji.style.display = 'none';
            renderToplayiciListesi(tumToplayicilar);
        }
        
        // Sağdaki tanker seçme menüsünü doldur
        renderTankerSecici(tumTankerler);

    } catch (error) {
        listeContainer.innerHTML = '';
        gosterMesaj(`Atama sekmesi yüklenirken hata: ${error.message}`, 'danger');
    }
}

/**
 * Toplayıcıları atama listesine (sol sütun) render eder.
 */
function renderToplayiciListesi(toplayicilar, filtre = '') {
    const listeContainer = document.getElementById('toplayici-atama-listesi');
    listeContainer.innerHTML = '';
    
    const aramaMetni = filtre.toLowerCase().trim();
    let gosterilenSayisi = 0;

    toplayicilar.forEach(toplayici => {
        const adSoyad = toplayici.ad_soyad || '';
        const kullaniciAdi = toplayici.kullanici_adi || '';
        
        // Arama filtresi
        if (aramaMetni && 
            !adSoyad.toLowerCase().includes(aramaMetni) && 
            !kullaniciAdi.toLowerCase().includes(aramaMetni)) {
            return; // Eşleşmezse bu toplayıcıyı atla
        }

        gosterilenSayisi++;
        const atananTanker = toplayici.atanan_tanker;
        const tankerAdi = atananTanker ? utils.sanitizeHTML(atananTanker.tanker_adi) : 'Atanmamış';
        const tankerId = atananTanker ? atananTanker.id : 0;
        
        const badgeClass = atananTanker ? 'text-bg-success' : 'text-bg-secondary';
        const safeAdSoyad = utils.sanitizeHTML(adSoyad) || 'İsimsiz';
        
        // onclick içine ID'yi, Adı ve mevcut atanan tanker ID'sini gönderiyoruz
        const itemHtml = `
            <a href="#" class="list-group-item list-group-item-action" 
               id="toplayici-item-${toplayici.id}"
               onclick="atamaIcinToplayiciSec(${toplayici.id}, '${safeAdSoyad.replace(/'/g, "\\'")}', ${tankerId})">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${safeAdSoyad}</h6>
                    <span class="badge ${badgeClass} rounded-pill">${tankerAdi}</span>
                </div>
                <small class="text-secondary">${utils.sanitizeHTML(kullaniciAdi)}</small>
            </a>
        `;
        listeContainer.innerHTML += itemHtml;
    });
    
    if (gosterilenSayisi === 0 && filtre) {
         listeContainer.innerHTML = '<div class="list-group-item text-center text-secondary">Aramayla eşleşen toplayıcı bulunamadı.</div>';
    }
}

/**
 * Sağdaki tanker atama dropdown'ını doldurur.
 */
function renderTankerSecici(tankerler) {
    tankerAtamaSecici.clear();
    tankerAtamaSecici.clearOptions();
    
    // "Atama Yok" seçeneği
    tankerAtamaSecici.addOption({
        value: 0,
        text: "--- Tanker Atanmamış ---"
    });
    
    // Tankerleri ekle
    tankerler.forEach(tanker => {
        tankerAtamaSecici.addOption({
            value: tanker.id,
            text: `${utils.sanitizeHTML(tanker.tanker_adi)} (${parseInt(tanker.kapasite_litre, 10)} L)`
        });
    });
}

/**
 * Soldaki listeden bir toplayıcı seçildiğinde sağ paneli açar ve doldurur.
 */
function atamaIcinToplayiciSec(id, adSoyad, atananTankerId) {
    seciliToplayiciId = id; // Hangi toplayıcıya atama yapacağımızı sakla

    // Aktif olanı vurgula
    document.querySelectorAll('#toplayici-atama-listesi .list-group-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById(`toplayici-item-${id}`).classList.add('active');

    // Panelleri göster/gizle
    document.getElementById('atama-paneli-secim-bekliyor').style.display = 'none';
    document.getElementById('atama-paneli-sag').style.display = 'block';

    // Verileri doldur
    document.getElementById('atama-toplayici-adi').textContent = adSoyad;
    document.getElementById('atanacak-toplayici-id').value = id;
    tankerAtamaSecici.setValue(atananTankerId); // Mevcut atamayı seç
}

/**
 * "Kaydet" butonuna basıldığında atamayı API'ye gönderir.
 */
async function tankerAta() {
    const secilenToplayiciId = document.getElementById('atanacak-toplayici-id').value;
    
    if (!secilenToplayiciId) {
        gosterMesaj("Lütfen önce bir toplayıcı seçin.", "warning");
        return;
    }
    
    const secilenTankerId = tankerAtamaSecici.getValue();
    const kaydetButton = document.getElementById('atama-kaydet-btn');
    const originalButtonText = kaydetButton.innerHTML;

    const veri = {
        toplayici_id: secilenToplayiciId,
        tanker_id: secilenTankerId
    };

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    
    try {
        const result = await api.request('/tanker/api/ata', {
            method: 'POST',
            body: JSON.stringify(veri),
            headers: { 'Content-Type': 'application/json' }
        });
        
        gosterMesaj(result.message, 'success');
        
        // Paneli gizle ve listeyi yenile
        document.getElementById('atama-paneli-secim-bekliyor').style.display = 'block';
        document.getElementById('atama-paneli-sag').style.display = 'none';
        seciliToplayiciId = null;
        
        await loadAtamaSekmesi(); // Atama listesini yenile

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = 'Kaydet';
    }
}

/**
 * "Atamayı Kaldır" butonuna basıldığında '0' ID'si ile atama yapar.
 */
function atamaKaldir() {
    tankerAtamaSecici.setValue(0); // Dropdown'u "Atanmamış"a çek
    tankerAta(); // Kaydet fonksiyonunu çağır
}