// static/js/tanker_yonetimi.js
// HATA DÜZELTMESİ: 'gosterOnayMesaji is not defined' hatasını çözmek için
// standart 'confirm()' fonksiyonu kullanıldı.
// HATA DÜZELTMESİ 1: "Doluluk Oranı"nın güncellenmemesi sorunu için 'durum-tab' sekmesine listener eklendi.
// HATA DÜZELTMESİ 2: "Atama" bug'ı için lokal state güncellemesi eklendi.
// YENİ ÖZELLİK: Tanker silme fonksiyonları eklendi.

// === GLOBAL DEĞİŞKENLER ===
let yeniTankerModal;
let tankerAtamaSecici; // TomSelect için
let tumTankerler = []; // Tanker listesini cache'lemek için
let tumToplayicilar = []; // Toplayıcı listesini cache'lemek için
let tankerMap = new Map(); // Hızlı erişim için Tanker ID -> Tanker Objesi
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

    // --- SEKME DINLEYICILERI ---
    
    // HATA DÜZELTMESİ 1: 'Tanker Durumu' sekmesi her gösterildiğinde veriyi yenile.
    const durumSekmesi = document.getElementById('durum-tab');
    if (durumSekmesi) {
        durumSekmesi.addEventListener('shown.bs.tab', (event) => {
            tankerleriYukle(); // Her gösterildiğinde listeyi yenile
        });
    }

    // 'Atama' sekmesi değiştiğinde veriyi yükle
    const atamaSekmesi = document.getElementById('atama-tab');
    if (atamaSekmesi) {
        atamaSekmesi.addEventListener('shown.bs.tab', (event) => {
            if (tumToplayicilar.length === 0) {
                loadAtamaSekmesi();
            }
        });
    }
    // --- Sekme Dinleyicileri Sonu ---

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
        const safeTankerAdi = utils.sanitizeHTML(tanker.tanker_adi);

        let progressBarClass = 'bg-success';
        if (yuzde > 75) progressBarClass = 'bg-warning';
        if (yuzde > 95) progressBarClass = 'bg-danger';

        // XSS'e karşı ' (tek tırnak) karakterini güvenli hale getiriyoruz
        const safeTankerAdiOnclick = safeTankerAdi.replace(/'/g, "\\'");

        const cardHtml = `
            <div class="col-lg-6 col-md-12" id="tanker-kart-${tanker.id}">
                <div class="card shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h5 class="card-title mb-0">${safeTankerAdi}</h5>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-success" disabled>
                                    <i class="bi bi-box-arrow-in-down me-1"></i> Sat/Boşalt
                                </button>
                                
                                <button class="btn btn-outline-danger" 
                                        onclick="tankerSilmeyiOnayla(${tanker.id}, '${safeTankerAdiOnclick}')">
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
        
        await store.getTankers(true); 
        await tankerleriYukle(); 
        
        tumToplayicilar = []; // Sekme 2'yi bir sonraki açılışta yenilenmeye zorla

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}


// ==========================================================
// SEÇENEK 2: Toplayıcı Atama Sekmesi
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
        const [toplayicilar, tankerler] = await Promise.all([
            api.request('/tanker/api/toplayici-listesi'), 
            store.getTankers(true) // Tankerleri taze çek
        ]);

        tumToplayicilar = toplayicilar || []; 
        tumTankerler = tankerler || []; 
        
        // === CLIENT-SIDE JOIN ===
        tankerMap.clear(); 
        tumTankerler.forEach(t => tankerMap.set(t.id, t));

        tumToplayicilar.forEach(toplayici => {
            const tankerId = toplayici.atanan_tanker_id; 
            if (tankerId && tankerMap.has(tankerId)) {
                toplayici.atanan_tanker = tankerMap.get(tankerId);
            } else {
                toplayici.atanan_tanker = null;
            }
        });
        // === JOIN SONU ===

        if (tumToplayicilar.length === 0) {
            listeContainer.innerHTML = '';
            veriYokMesaji.style.display = 'block';
        } else {
            veriYokMesaji.style.display = 'none';
            renderToplayiciListesi(tumToplayicilar);
        }
        
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
        const kullaniciAdi = toplayici.kullanici_adi || '';
        
        if (aramaMetni && 
            !kullaniciAdi.toLowerCase().includes(aramaMetni)) {
            return;
        }

        gosterilenSayisi++;
        const atananTanker = toplayici.atanan_tanker; 
        const tankerAdi = atananTanker ? utils.sanitizeHTML(atananTanker.tanker_adi) : 'Atanmamış';
        const tankerId = atananTanker ? atananTanker.id : 0;
        
        const badgeClass = atananTanker ? 'text-bg-success' : 'text-bg-secondary';
        const safeKullaniciAdi = utils.sanitizeHTML(kullaniciAdi) || 'İsimsiz';
        
        const itemHtml = `
            <a href="#" class="list-group-item list-group-item-action" 
               id="toplayici-item-${toplayici.id}"
               data-toplayici-id="${toplayici.id}"
               data-ad-soyad="${safeKullaniciAdi}" 
               data-tanker-id="${tankerId}"
               onclick="atamaIcinToplayiciSec(this)">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${safeKullaniciAdi}</h6>
                    <span class="badge ${badgeClass} rounded-pill">${tankerAdi}</span>
                </div>
                <small class="text-secondary">Toplayıcı Kullanıcı</small>
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
    
    tankerAtamaSecici.addOption({
        value: 0,
        text: "--- Tanker Atanmamış ---"
    });
    
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
function atamaIcinToplayiciSec(element) {
    const id = element.dataset.toplayiciId;
    const adSoyad = element.dataset.adSoyad; 
    const atananTankerId = parseInt(element.dataset.tankerId, 10);

    seciliToplayiciId = id; 

    document.querySelectorAll('#toplayici-atama-listesi .list-group-item').forEach(item => {
        item.classList.remove('active');
    });
    element.classList.add('active'); 

    document.getElementById('atama-paneli-secim-bekliyor').style.display = 'none';
    document.getElementById('atama-paneli-sag').style.display = 'block';

    document.getElementById('atama-toplayici-adi').textContent = adSoyad;
    document.getElementById('atanacak-toplayici-id').value = id;
    tankerAtamaSecici.setValue(atananTankerId); 
}

/**
 * "Kaydet" butonuna basıldığında atamayı API'ye gönderir.
 */
async function tankerAta() {
    const toplayiciId = parseInt(document.getElementById('atanacak-toplayici-id').value, 10);
    
    if (!toplayiciId) {
        gosterMesaj("Lütfen önce bir toplayıcı seçin.", "warning");
        return;
    }
    
    const tankerId = parseInt(tankerAtamaSecici.getValue(), 10);
    const kaydetButton = document.getElementById('atama-kaydet-btn');
    const originalButtonText = kaydetButton.innerHTML;

    const veri = {
        toplayici_id: toplayiciId,
        tanker_id: tankerId
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
        
        document.getElementById('atama-paneli-secim-bekliyor').style.display = 'block';
        document.getElementById('atama-paneli-sag').style.display = 'none';
        seciliToplayiciId = null;
        
        // === LOKAL LİSTEYİ GÜNCELLE ===
        const toplayiciIndex = tumToplayicilar.findIndex(t => t.id === toplayiciId);
        if (toplayiciIndex !== -1) {
            if (tankerId === 0) {
                tumToplayicilar[toplayiciIndex].atanan_tanker_id = 0;
                tumToplayicilar[toplayiciIndex].atanan_tanker = null;
            } else {
                tumToplayicilar[toplayiciIndex].atanan_tanker_id = tankerId;
                tumToplayicilar[toplayiciIndex].atanan_tanker = tankerMap.get(tankerId) || null;
            }
        }
        renderToplayiciListesi(tumToplayicilar);
        // === GÜNCELLEME SONU ===

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
    tankerAtamaSecici.setValue(0);
    tankerAta(); 
}


// --- YENİ ÖZELLİK: TANKER SİLME FONKSİYONLARI ---

/**
 * Kullanıcıya silme onayı gösterir.
 * HATA DÜZELTMESİ: 'gosterOnayMesaji' yerine standart 'confirm' kullanıldı.
 */
function tankerSilmeyiOnayla(id, tankerAdi) {
    const mesaj = `'${tankerAdi}' adlı tankeri silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz. Tanker sadece boşsa ve bir toplayıcıya atanmamışsa silinebilir.`;
    
    if (confirm(mesaj)) {
        tankerSil(id);
    }
}

/**
 * Silme API isteğini yapar ve arayüzü günceller.
 */
async function tankerSil(id) {
    const kartElementi = document.getElementById(`tanker-kart-${id}`);
    const silmeButonu = kartElementi ? kartElementi.querySelector('.btn-outline-danger') : null;

    if (silmeButonu) {
        silmeButonu.disabled = true;
        silmeButonu.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    }

    try {
        const result = await api.request(`/tanker/api/sil/${id}`, {
            method: 'DELETE'
        });

        gosterMesaj(result.message, 'success');
        
        // Kartı arayüzden kaldır
        if (kartElementi) {
            kartElementi.remove();
        }
        
        // Store'daki cache'i temizle
        await store.getTankers(true); 
        
        // Atama sekmesindeki listeyi yenilemeye zorla
        tumToplayicilar = [];
        
        // Veri yok mesajını kontrol et
        if (document.getElementById('tanker-listesi-container').children.length === 0) {
             document.getElementById('tanker-veri-yok').style.display = 'block';
        }

    } catch (error) {
        gosterMesaj(error.message, 'danger');
        if (silmeButonu) {
            silmeButonu.disabled = false;
            silmeButonu.innerHTML = `<i class="bi bi-trash"></i>`;
        }
    }
}