// ====================================================================================
// ANA UYGULA[...] (OTOMATİK GÜNCELLEME İÇİN DEĞİŞTİRİLDİ)
// ====================================================================================

// --- Global Değişkenler ---
let anaPanelMevcutGorunum = 'liste';
let anaPanelMevcutSayfa = 1;
const girdilerSayfaBasi = 6;
let mevcutTedarikciIstatistikleri = null;
let kullaniciRolu = null;
// YENİ: Güncelleme bildirimi için değişkenler kaldırıldı.

/**
 * Uygulama kabuğu yüklendiğinde çalışır.
 * Tarayıcıda kayıtlı kullanıcı varsa bilgileri ekrana basar.
 * Yoksa ve internet de yoksa, giriş sayfasına yönlendirir.
 * Ayrıca global kullanıcı rolünü ayarlar.
 */
function initOfflineState() {
    kullaniciRolu = document.body.dataset.userRole || null;
    const offlineUserString = localStorage.getItem('offlineUser');

    if (!kullaniciRolu && offlineUserString) {
        try {
            const user = JSON.parse(offlineUserString);
            kullaniciRolu = user.rol;
            document.body.dataset.userRole = user.rol;
            document.body.dataset.lisansBitis = user.lisans_bitis_tarihi;

            const userNameEl = document.getElementById('user-name-placeholder');
            const companyNameEl = document.getElementById('company-name-placeholder');
            if (userNameEl) userNameEl.textContent = user.kullanici_adi;
            if (companyNameEl) companyNameEl.textContent = user.sirket_adi;

        } catch (e) {
            console.error("Offline kullanıcı verisi okunamadı:", e);
            localStorage.removeItem('offlineUser');
        }
    }

    if (!kullaniciRolu && !navigator.onLine) {
         console.warn("Kullanıcı rolü belirlenemedi ve çevrimdışı. Giriş sayfasına yönlendiriliyor.");
         window.location.href = '/login';
         return; // Yönlendirme sonrası devam etme
    }

    const veriGirisPaneli = document.getElementById('veri-giris-paneli');
     if (veriGirisPaneli) {
        veriGirisPaneli.style.display = (kullaniciRolu === 'muhasebeci') ? 'none' : 'block';
    }
}

// Uygulama başlangıç noktası
window.onload = async function() {
    initOfflineState(); // Global `kullaniciRolu` değişkenini ayarlar

    // --- Rol Kontrolü ---
    if (kullaniciRolu === 'ciftci') {
        if (typeof initCiftciPanel === 'function') {
            await initCiftciPanel();
        } else {
            console.error("initCiftciPanel fonksiyonu bulunamadı. ciftci_panel.js yüklendi mi?");
        }
        initializeSW(); // YENİ: Service Worker başlatma ve güncelleme dinleyicisi
        return; // Çiftçi ise buradan çık
    }

    // --- Normal Panel Başlatma ---
    if(typeof ui !== 'undefined' && typeof ui.init === 'function') {
        ui.init(); // Genel UI ve Modalları Başlatır (ui.js içinde)
    } else {
        console.error("ui objesi veya ui.init() fonksiyonu bulunamadı.");
        gosterMesaj("Arayüz başlatılırken bir sorun oluştu. Lütfen sayfayı yenileyin.", "danger");
        return;
    }

    // Ana panele özel Flatpickr başlatması
    const tarihFiltreEl = document.getElementById('tarih-filtre');
    if(tarihFiltreEl && typeof flatpickr !== 'undefined' && typeof ui !== 'undefined'){
         ui.tarihFiltreleyici = flatpickr(tarihFiltreEl, {
            dateFormat: "d.m.Y",
            altInput: true,
            altFormat: "d.m.Y",
            locale: "tr",
            defaultDate: "today",
            onChange: function(selectedDates, dateStr, instance) {
                if (typeof girdileriFiltrele === 'function') {
                    girdileriFiltrele();
                }
            }
        });
    }

    // Lisans uyarısını kontrol et
    if(typeof ui !== 'undefined' && typeof ui.lisansUyarisiKontrolEt === 'function') {
       ui.lisansUyarisiKontrolEt();
    }

    // TomSelect (Tedarikçi Seçici) BAŞLATMA KODU
    const veriGirisPaneli = document.getElementById('veri-giris-paneli');
    const tedarikciSecEl = document.getElementById('tedarikci-sec');
    if (kullaniciRolu !== 'muhasebeci' && veriGirisPaneli && tedarikciSecEl && typeof TomSelect !== 'undefined' && typeof ui !== 'undefined') {
        ui.tedarikciSecici = new TomSelect(tedarikciSecEl, { // Elementi doğrudan ver
            create: false,
            sortField: { field: "text", direction: "asc" },
            onChange: (value) => {
                 if (value && navigator.onLine && typeof api !== 'undefined') { // api kontrolü eklendi
                    api.fetchTedarikciIstatistikleri(value)
                        .then(data => { mevcutTedarikciIstatistikleri = data[0] || null; })
                        .catch(err => {
                            console.warn("İstatistikler alınamadı:", err);
                            mevcutTedarikciIstatistikleri = null;
                        });
                    api.fetchSonFiyat(value).then(data => {
                       if(data && data.son_fiyat) {
                           const fiyatInput = document.getElementById('fiyat-input');
                           if(fiyatInput) { // Fiyat input kontrolü
                               fiyatInput.value = parseFloat(data.son_fiyat).toFixed(2);
                               fiyatInput.classList.add('fiyat-guncellendi');
                               setTimeout(() => fiyatInput.classList.remove('fiyat-guncellendi'), 500);
                           }
                       }
                    }).catch(err => console.warn("Son fiyat getirilemedi:", err));
                } else {
                    mevcutTedarikciIstatistikleri = null;
                }
            }
        });
    } else {
        console.log("TomSelect başlatılamadı (rol muhasebeci, element eksik veya kütüphane yüklenmemiş).");
    }

    // Görünümü ayarla
    anaPanelMevcutGorunum = localStorage.getItem('anaPanelGorunum') || 'liste';
    gorunumuAyarla(anaPanelMevcutGorunum);

    // Başlangıç verilerini yükle
    await baslangicVerileriniYukle();

    // Kaydet butonu olay dinleyicisi
    const kaydetBtn = document.getElementById('kaydet-girdi-btn');
    if(kaydetBtn && kullaniciRolu !== 'muhasebeci') {
        kaydetBtn.addEventListener('click', sutGirdisiEkle);
    }

    initializeSW(); // YENİ: Service Worker başlatma ve güncelleme dinleyicisi
};


/**
 * Uygulamanın ihtiyaç duyduğu tüm başlangıç verilerini paralel olarak yükler.
 */
async function baslangicVerileriniYukle() {
    console.log("Başlangıç verileri yükleniyor...");
    const girdilerBaslik = document.getElementById('girdiler-baslik');
    if(girdilerBaslik) girdilerBaslik.textContent = 'Bugünkü Girdiler'; // Başlığı sıfırla

    const promises = [];
    // Her zaman özet verilerini yükle
    promises.push(ozetVerileriniYukle());

    // Sadece muhasebeci olmayanlar için tedarikçileri yükle
    if (kullaniciRolu !== 'muhasebeci') {
        promises.push(tedarikcileriYukle());
    }

    try {
        await Promise.all(promises);
        console.log("Özet ve Tedarikçiler (gerekiyorsa) yüklendi.");
        // Girdileri yükle (kullanıcı rolüne göre backend filtreleyecek)
        await girdileriGoster(1); // Girdileri ilk sayfadan yükle
    } catch (error) {
        console.error("Başlangıç verileri yüklenirken bir hata oluştu:", error);
        gosterMesaj("Başlangıç verileri yüklenemedi. Lütfen sayfayı yenileyin.", "danger");
        if(typeof ui !== 'undefined' && typeof ui.renderGirdiler === 'function') {
            ui.renderGirdiler([], anaPanelMevcutGorunum); // Hata durumunda boş göster
        }
    }
}


/**
 * Seçilen tarihe göre özet verilerini yükler ve arayüzü günceller.
 */
async function ozetVerileriniYukle(tarih = null) {
    if(typeof ui === 'undefined' || typeof ui.toggleOzetPanelsLoading !== 'function' || typeof utils === 'undefined') {
        console.error("Gerekli UI veya Utils fonksiyonları bulunamadı (ozetVerileriniYukle).");
        return;
    }
    ui.toggleOzetPanelsLoading(true);
    const effectiveDate = tarih || utils.getLocalDateString(new Date()); // utils.js'den
    const cacheKey = `ozet_${effectiveDate}`;

    if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            try {
                ui.updateOzetPanels(JSON.parse(cachedData), effectiveDate); // ui.js'den
            } catch (e) {
                 console.error("Önbellek verisi okunamadı:", e);
                 ui.updateOzetPanels(null, effectiveDate, true); // ui.js'den
            }
        } else {
            ui.updateOzetPanels(null, effectiveDate, true); // ui.js'den
        }
        ui.toggleOzetPanelsLoading(false);
        return;
    }

    try {
        if (typeof api === 'undefined' || typeof api.fetchGunlukOzet !== 'function') {
             throw new Error("API fonksiyonları yüklenemedi.");
        }
        const data = await api.fetchGunlukOzet(effectiveDate); // api.js'den
        ui.updateOzetPanels(data, effectiveDate); // ui.js'den
        localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
        console.error("Özet yüklenirken hata:", error);
        ui.updateOzetPanels(null, effectiveDate, true); // ui.js'den
    } finally {
        ui.toggleOzetPanelsLoading(false); // ui.js'den
    }
}


/**
 * Süt girdilerini sunucudan/yerelden alır ve arayüzde gösterir.
 * @param {number} [sayfa=1] - Gösterilecek sayfa numarası.
 * @param {string|null} [tarih=null] - Filtrelenecek tarih ('YYYY-MM-DD'). Null ise seçili tarihi kullanır.
 */
async function girdileriGoster(sayfa = 1, tarih = null) {
    anaPanelMevcutSayfa = sayfa; // Global sayfayı güncelle
    const effectiveDate = tarih || (ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString(new Date()));
    const cacheKey = `girdiler_${effectiveDate}_sayfa_${anaPanelMevcutSayfa}`;

    if(typeof ui === 'undefined' || typeof ui.showGirdilerLoadingSkeleton !== 'function' || typeof ui.renderGirdiler !== 'function' || typeof ui.sayfalamaNavOlustur !== 'function' || typeof ui.mergeOnlineOfflineGirdiler !== 'function') {
         console.error("Gerekli ui fonksiyonları bulunamadı (girdileriGoster).");
         return;
    }

    ui.showGirdilerLoadingSkeleton(anaPanelMevcutGorunum);

    if (!navigator.onLine) {
        try {
            const cachedData = localStorage.getItem(cacheKey);
            let sunucuVerisi = { girdiler: [], toplam_girdi_sayisi: 0 };
            if (cachedData) {
                try { sunucuVerisi = JSON.parse(cachedData); } catch(e) { console.error("Önbellek verisi (girdiler) okunamadı:", e); }
            }
            // Bekleyen girdileri her zaman getir (sadece bugünse eklenecek)
            const bekleyenGirdiler = await bekleyenGirdileriGetir(); // offline.js'den
            const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, effectiveDate);

            ui.renderGirdiler(tumGirdiler, anaPanelMevcutGorunum);
            ui.sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, anaPanelMevcutSayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, effectiveDate));

        } catch(err) {
            console.error("Çevrimdışı girdi gösterimi hatası:", err);
            ui.renderGirdiler([], anaPanelMevcutGorunum); // Hata durumunda boş liste
        }
        return;
    }

    try {
        if (typeof api === 'undefined' || typeof api.fetchSutGirdileri !== 'function') {
             throw new Error("API fonksiyonları yüklenemedi.");
        }
        const sunucuVerisi = await api.fetchSutGirdileri(effectiveDate, anaPanelMevcutSayfa); // api.js'den
        localStorage.setItem(cacheKey, JSON.stringify(sunucuVerisi));

        const bekleyenGirdiler = await bekleyenGirdileriGetir(); // offline.js'den
        const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, effectiveDate);

        ui.renderGirdiler(tumGirdiler, anaPanelMevcutGorunum);
        ui.sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, anaPanelMevcutSayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, effectiveDate));

    } catch (error) {
        console.error("Girdileri gösterirken hata:", error);
        gosterMesaj("Girdiler yüklenirken bir hata oluştu.", "danger"); // ui.js'den
        ui.renderGirdiler([], anaPanelMevcutGorunum);
    }
}


/**
 * Tedarikçi listesini yükler ve seçim kutusunu doldurur.
 */
async function tedarikcileriYukle() {
    if (typeof ui === 'undefined' || !ui.tedarikciSecici) {
        console.log("Tedarikçi seçici (TomSelect) bu rol için aktif değil veya ui objesi bulunamadı.");
        return;
    }
    console.log("Tedarikçiler yükleniyor...");
    try {
        // store.js'deki getTedarikciler, online ise API'den çeker ve yerel DB'yi günceller
        if (typeof store === 'undefined' || typeof store.getTedarikciler !== 'function') {
            throw new Error("Store fonksiyonları yüklenemedi.");
        }
        const tedarikciler = await store.getTedarikciler();
        console.log(`Tedarikçiler ${navigator.onLine ? 'API\'den' : 'yerel DB\'den'} alındı:`, tedarikciler.length);
        ui.tumTedarikciler = tedarikciler; // ui objesindeki listeyi güncelle
        ui.doldurTedarikciSecici(tedarikciler); // ui.js'den
        console.log("Tedarikçi seçici dolduruldu.");
    } catch (error) {
        console.error("Tedarikçiler yüklenirken hata:", error);
        gosterMesaj("Tedarikçiler yüklenemedi.", "danger"); // ui.js'den
    }
}


// ====================================================================================
// OLAY YÖNETİCİLERİ (EVENT HANDLERS)
// ====================================================================================

/**
 * Tarih filtresi değiştiğinde çağrılır.
 */
function girdileriFiltrele() {
    if (typeof ui === 'undefined' || !ui.tarihFiltreleyici || typeof utils === 'undefined') return;
    const secilenTarih = ui.tarihFiltreleyici.selectedDates[0];
    if (secilenTarih) {
        const formatliTarih = utils.getLocalDateString(secilenTarih); // utils.js'den
        if(typeof ui.updateGirdilerBaslik === 'function') {
            ui.updateGirdilerBaslik(formatliTarih);
        }
        girdileriGoster(1, formatliTarih); // Her filtrelemede ilk sayfayı yükle
        ozetVerileriniYukle(formatliTarih); // Özet panellerini de güncelle
    } else {
        // Tarih seçimi kaldırılırsa (nadiren olur) bugüne dön
        filtreyiTemizle();
    }
}

/**
 * Tarih filtresini temizler ve bugünün verilerini gösterir.
 */
function filtreyiTemizle() {
    if (typeof ui !== 'undefined' && ui.tarihFiltreleyici) {
        ui.tarihFiltreleyici.setDate(new Date(), true); // 'true' ile onChange olayını tetikle
    }
}

/**
 * Yeni süt girdisi ekleme butonuna tıklandığında çağrılır.
 */
async function sutGirdisiEkle() {
    if(typeof ui === 'undefined' || typeof ui.getGirdiFormVerisi !== 'function') {
        console.error("ui.getGirdiFormVerisi fonksiyonu bulunamadı.");
        return;
    }
    const { tedarikciId, litre, fiyat } = ui.getGirdiFormVerisi();
    if (!tedarikciId || !litre || !fiyat || parseFloat(litre) <= 0) {
        gosterMesaj("Lütfen tüm alanları doğru doldurun ve litre 0'dan büyük olsun.", "warning");
        return;
    }
    const yeniGirdi = {
        tedarikci_id: parseInt(tedarikciId),
        litre: parseFloat(litre),
        fiyat: parseFloat(fiyat)
    };
    await degeriDogrulaVeKaydet(yeniGirdi);
}

/**
 * Girilen litre değerini tedarikçinin ortalamasıyla karşılaştırır,
 * gerekirse onay ister, sonra kaydetme işlemini başlatır.
 */
async function degeriDogrulaVeKaydet(girdi) {
    // Veri onay modalı instance'ını al (ui.init içinde başlatılmış olmalı)
    const veriOnayModalInstance = ui.veriOnayModal || window.veriOnayModalInstance;

    // İnternet yoksa veya istatistikler henüz yüklenmemişse doğrudan kaydet
    if (!navigator.onLine || !mevcutTedarikciIstatistikleri) {
        await gercekKaydetmeIsleminiYap(girdi);
        return;
    }

    const { ortalama_litre, standart_sapma } = mevcutTedarikciIstatistikleri;
    const girilenLitre = girdi.litre;

    // Sadece ortalama varsa (standart sapma 0 olabilir) kontrol yap
    if (ortalama_litre > 0) {
        let altSinir, ustSinir;
        // Standart sapma varsa ve 0'dan büyükse onu kullan
        if (standart_sapma && standart_sapma > 0) {
            altSinir = ortalama_litre - (standart_sapma * 2); // 2 standart sapma altı
            ustSinir = ortalama_litre + (standart_sapma * 2); // 2 standart sapma üstü
        } else {
            // Standart sapma yoksa veya 0 ise, ortalamanın %50'si kadar tolerans uygula
            // (Minimum 5 litre tolerans)
            const tolerans = Math.max(ortalama_litre * 0.5, 5);
            altSinir = ortalama_litre - tolerans;
            ustSinir = ortalama_litre + tolerans;
        }
        altSinir = Math.max(0, altSinir); // Alt sınır 0'dan küçük olamaz

        // Girilen değer aralığın dışındaysa onay iste
        if (girilenLitre < altSinir || girilenLitre > ustSinir) {
            const mesaj = `Girdiğiniz <strong>${girilenLitre} Litre</strong> değeri, bu tedarikçinin ortalama (${ortalama_litre.toFixed(1)} L) girdisinden farklı görünüyor. Emin misiniz?`;
            const onayMesajiElement = document.getElementById('onay-mesaji');
            const onaylaBtn = document.getElementById('onayla-ve-kaydet-btn');

            if(onayMesajiElement) onayMesajiElement.innerHTML = mesaj;

            if(onaylaBtn) {
                // Butonun önceki onclick olayını kaldırıp yenisini ekleyelim (güvenlik için)
                onaylaBtn.onclick = null; // Öncekini kaldır
                onaylaBtn.onclick = async () => {
                    if(veriOnayModalInstance) veriOnayModalInstance.hide();
                    await gercekKaydetmeIsleminiYap(girdi);
                };
            }

            if(veriOnayModalInstance) {
                veriOnayModalInstance.show(); // Onay modalını göster
            } else {
                 console.error("Veri Onay Modalı başlatılamamış!");
                 await gercekKaydetmeIsleminiYap(girdi); // Modal yoksa doğrudan kaydet
            }
            return; // Onay bekleniyor, kaydetme işlemini burada durdur
        }
    }
    // Değer normal aralıktaysa doğrudan kaydet
    await gercekKaydetmeIsleminiYap(girdi);
}


/**
 * Yeni süt girdisini çevrimdışı veya çevrimiçi olarak kaydeder ve arayüzü günceller.
 */
async function gercekKaydetmeIsleminiYap(yeniGirdi) {
    // Çevrimdışı Kayıt
    if (!navigator.onLine) {
        if(typeof ui !== 'undefined' && typeof ui.toggleGirdiKaydetButton === 'function') ui.toggleGirdiKaydetButton(true);
        try {
            // Lisans kontrolü (offline.js içinde de yapılabilir ama burada da yapmak iyi olur)
            const isOfflineUserValid = await ui.checkOfflineUserLicense(); // ui.js'den
            if (!isOfflineUserValid) return; // Lisans geçerli değilse dur

            // offline.js'deki kaydetCevrimdisi fonksiyonunu çağır
            if (typeof kaydetCevrimdisi !== 'function') {
                throw new Error("Çevrimdışı kayıt fonksiyonu bulunamadı.");
            }
            const basarili = await kaydetCevrimdisi(yeniGirdi);
            if (basarili) {
                if(typeof ui !== 'undefined' && typeof ui.resetGirdiFormu === 'function') ui.resetGirdiFormu();
                // Girdileri yeniden yükle (bugünün tarihi için, çevrimdışı girdiyi de gösterecek)
                await girdileriGoster(anaPanelMevcutSayfa, utils.getLocalDateString());
                await ozetVerileriniYukle(utils.getLocalDateString()); // Özet panellerini de güncelle
            }
        } catch(err) {
            console.error("Çevrimdışı kayıt işlemi sırasında hata:", err);
            gosterMesaj(err.message || 'Çevrimdışı kayıt yapılamadı.', 'danger');
        } finally {
            if(typeof ui !== 'undefined' && typeof ui.toggleGirdiKaydetButton === 'function') ui.toggleGirdiKaydetButton(false);
        }
        return;
    }

    // Çevrimiçi Kayıt (İyimser Güncelleme ile)
    const listeElementi = document.getElementById('girdiler-listesi');
    const kartListesi = document.getElementById('girdiler-kart-listesi');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    const geciciId = `gecici-${Date.now()}`;

    // Tedarikçi adını ui.tumTedarikciler listesinden bul
    let tedarikciAdi = 'Bilinmeyen Tedarikçi';
    if(ui.tumTedarikciler && yeniGirdi.tedarikci_id) {
        const tedarikci = ui.tumTedarikciler.find(t => t.id === yeniGirdi.tedarikci_id);
        if (tedarikci) tedarikciAdi = utils.sanitizeHTML(tedarikci.isim);
    }

    // Kullanıcı adını localStorage'dan al (veya varsayılan kullan)
    let kullaniciAdi = 'Siz';
    try { kullaniciAdi = JSON.parse(localStorage.getItem('offlineUser'))?.kullanici_adi || 'Siz'; } catch(e) {}

    const anlikSaat = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const tutar = yeniGirdi.litre * yeniGirdi.fiyat;
    const fiyatBilgisi = `<span class="text-success">@ ${parseFloat(yeniGirdi.fiyat).toFixed(2)} TL</span>`;
    const kaydediliyorEtiketi = `<span class="badge bg-info text-dark ms-2"><i class="bi bi-arrow-repeat"></i> Kaydediliyor...</span>`;

    // Seçili görünüme göre geçici öğeyi oluştur ve ekle
    let geciciElementHTML = '';
    if (anaPanelMevcutGorunum === 'liste' && listeElementi) {
        geciciElementHTML = `
            <div class="list-group-item" id="${geciciId}" style="opacity: 0.6;">
                <div class="d-flex w-100 justify-content-between flex-wrap">
                    <h5 class="mb-1 girdi-baslik">${tedarikciAdi} - ${yeniGirdi.litre} Litre ${fiyatBilgisi} ${kaydediliyorEtiketi}</h5>
                    <div class="btn-group"></div> {# Butonlar için boş yer #}
                </div>
                <p class="mb-1 girdi-detay">Toplayan: ${kullaniciAdi} | Saat: ${anlikSaat}</p>
            </div>`;
        listeElementi.insertAdjacentHTML('afterbegin', geciciElementHTML);
    } else if (anaPanelMevcutGorunum === 'kart' && kartListesi) {
        geciciElementHTML = `
            <div class="col-xl-6 col-12" id="${geciciId}" style="opacity: 0.6;">
                <div class="card p-2 h-100">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="card-title mb-0">${tedarikciAdi}</h6>
                                <small class="text-secondary">Toplayan: ${kullaniciAdi}</small>
                            </div>
                             <div class="d-flex gap-2">${kaydediliyorEtiketi}</div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center my-2">
                            <span class="fs-4 fw-bold text-primary">${yeniGirdi.litre} L</span>
                            <span class="fs-5 fw-bold text-success">${tutar.toFixed(2)} TL</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                             <small class="text-secondary">Saat: ${anlikSaat}</small>
                             <div class="btn-group btn-group-sm"></div> {# Butonlar için boş yer #}
                        </div>
                    </div>
                </div>
            </div>`;
        kartListesi.insertAdjacentHTML('afterbegin', geciciElementHTML);
    }

    if (veriYokMesaji) veriYokMesaji.style.display = 'none'; // Veri yok mesajını gizle
    const geciciElement = document.getElementById(geciciId);
    const orjinalFormVerisi = { ...yeniGirdi }; // Hata durumunda formu geri yüklemek için

    // Formu temizle ve butonu pasif yap
    if(typeof ui !== 'undefined' && typeof ui.resetGirdiFormu === 'function') ui.resetGirdiFormu();
    if(typeof ui !== 'undefined' && typeof ui.toggleGirdiKaydetButton === 'function') ui.toggleGirdiKaydetButton(true);

    try {
        if (typeof api === 'undefined' || typeof api.postSutGirdisi !== 'function') {
             throw new Error("API fonksiyonları yüklenemedi.");
        }
        const result = await api.postSutGirdisi(yeniGirdi); // api.js'den
        gosterMesaj("Süt girdisi başarıyla kaydedildi.", "success"); // ui.js'den
        if(geciciElement && geciciElement.parentNode) geciciElement.remove(); // Geçici öğeyi kaldır
        const bugun = utils.getLocalDateString(); // utils.js'den
        // Özet panelini ve girdileri yeniden yükle (backend'den gelen güncel veriyle)
        if(typeof ui !== 'undefined' && typeof ui.updateOzetPanels === 'function') ui.updateOzetPanels(result.yeni_ozet, bugun);
        await girdileriGoster(1, bugun); // İlk sayfayı yenile (yeni girdi en üstte görünür)
    } catch (error) {
        console.error("İyimser ekleme başarısız oldu:", error);
        gosterMesaj("Kayıt başarısız: " + (error.message || 'İnternet bağlantınızı kontrol edin.'), "danger"); // ui.js'den
        if(geciciElement && geciciElement.parentNode) geciciElement.remove(); // Hata olursa geçici öğeyi kaldır

        // Formu eski değerlerle doldur
        if(ui.tedarikciSecici) ui.tedarikciSecici.setValue(orjinalFormVerisi.tedarikci_id);
        const litreInput = document.getElementById('litre-input');
        const fiyatInput = document.getElementById('fiyat-input');
        if(litreInput) litreInput.value = orjinalFormVerisi.litre;
        if(fiyatInput) fiyatInput.value = orjinalFormVerisi.fiyat;

        // Eğer liste boşaldıysa "veri yok" mesajını tekrar göster
        if (listeElementi && kartListesi && listeElementi.children.length === 0 && kartListesi.children.length === 0 && veriYokMesaji) {
            veriYokMesaji.style.display = 'block';
        }
    } finally {
        if(typeof ui !== 'undefined' && typeof ui.toggleGirdiKaydetButton === 'function') ui.toggleGirdiKaydetButton(false); // Butonu tekrar aktif et
    }
}

/**
 * Düzenleme modalındaki "Kaydet" butonuna basıldığında çağrılır.
 */
async function sutGirdisiDuzenle() {
    if (!navigator.onLine) {
        gosterMesaj("Girdileri düzenlemek için internet bağlantısı gereklidir.", "warning");
        return;
    }
    if(typeof ui === 'undefined' || typeof ui.getDuzenlemeFormVerisi !== 'function' || !ui.duzenleModal) {
        console.error("Gerekli ui fonksiyonları veya düzenleme modalı bulunamadı.");
        gosterMesaj("Düzenleme işlemi başlatılamadı.", "danger");
        return;
    }
    const { girdiId, yeniLitre, yeniFiyat, duzenlemeSebebi } = ui.getDuzenlemeFormVerisi();
    if (!girdiId || !yeniLitre || !yeniFiyat || parseFloat(yeniLitre) <= 0) {
        gosterMesaj("Lütfen yeni litre ve fiyat değerlerini girin (Litre 0'dan büyük olmalı).", "warning");
        return;
    }

    // Butonu pasif yap ve spinner göster (modal içinde)
    const kaydetButton = ui.duzenleModal._element.querySelector('.btn-primary');
    let originalButtonText = '';
    if (kaydetButton) {
        originalButtonText = kaydetButton.innerHTML;
        kaydetButton.disabled = true;
        kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    }

    try {
        if (typeof api === 'undefined' || typeof api.updateSutGirdisi !== 'function') {
             throw new Error("API fonksiyonları yüklenemedi.");
        }
        const result = await api.updateSutGirdisi(girdiId, { // api.js'den
            yeni_litre: parseFloat(yeniLitre),
            yeni_fiyat: parseFloat(yeniFiyat),
            duzenleme_sebebi: duzenlemeSebebi
        });
        gosterMesaj("Girdi başarıyla güncellendi.", "success");
        ui.duzenleModal.hide();

        // Girdinin orijinal tarihini alıp o tarihin özetini ve listesini güncelle
        const formatliTarih = ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString(); // Düzenlenen girdinin hangi tarihte olduğunu bilmemiz lazım, bu şimdilik seçili tarihi varsayıyor. İdeali backend'in döndürmesi.
        // Backend'in döndürdüğü tarihi kullanalım (sut_service.py'de eklendi)
        const guncellenenGirdiTarihi = result.girdi_tarihi_str || formatliTarih;

        // Önce özet panelini güncelle
        ui.updateOzetPanels(result.yeni_ozet, guncellenenGirdiTarihi);
        // Sonra girdilerin olduğu sayfayı yeniden yükle
        await girdileriGoster(anaPanelMevcutSayfa, guncellenenGirdiTarihi);

    } catch (error) {
        gosterMesaj(`Girdi düzenlenemedi: ${error.message || 'Bilinmeyen hata.'}`, "danger");
    } finally {
        // Butonu eski haline getir
        if (kaydetButton) {
            kaydetButton.disabled = false;
            kaydetButton.innerHTML = originalButtonText || 'Kaydet';
        }
    }
}

/**
 * Silme onay modalındaki "Evet, Sil" butonuna basıldığında çağrılır.
 */
async function sutGirdisiSil() {
    if (!navigator.onLine) {
        gosterMesaj("Girdileri silmek için internet bağlantısı gereklidir.", "warning");
        if(ui.silmeOnayModal) ui.silmeOnayModal.hide();
        return;
    }
    if(typeof ui === 'undefined' || typeof ui.getSilinecekGirdiId !== 'function' || !ui.silmeOnayModal) {
        console.error("Gerekli ui fonksiyonları veya silme modalı bulunamadı.");
        gosterMesaj("Silme işlemi başlatılamadı.", "danger");
        return;
    }
    const girdiId = ui.getSilinecekGirdiId();
    if (!girdiId) {
         gosterMesaj("Silinecek girdi ID'si bulunamadı.", "warning");
         ui.silmeOnayModal.hide();
         return;
    }
    ui.silmeOnayModal.hide();

    // İyimser UI: Öğeyi hemen kaldır
    const silinecekElement = document.getElementById(anaPanelMevcutGorunum === 'liste' ? `girdi-liste-${girdiId}` : `girdi-kart-${girdiId}`);
    if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    const originalHTML = silinecekElement.outerHTML; // Hata durumunda geri yüklemek için

    silinecekElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    silinecekElement.style.opacity = '0';
    silinecekElement.style.transform = 'translateX(-50px)';
    setTimeout(() => {
        if(silinecekElement.parentNode) { // Hala DOM'da ise kaldır
            silinecekElement.remove();
            // Liste boşaldıysa "veri yok" mesajını göster
            const listeElementi = document.getElementById('girdiler-listesi');
            const kartListesi = document.getElementById('girdiler-kart-listesi');
            const veriYokMesaji = document.getElementById('veri-yok-mesaji');
             if (listeElementi && kartListesi && listeElementi.children.length === 0 && kartListesi.children.length === 0 && veriYokMesaji) {
                veriYokMesaji.style.display = 'block';
            }
        }
    }, 400);

    try {
        if (typeof api === 'undefined' || typeof api.deleteSutGirdisi !== 'function') {
             throw new Error("API fonksiyonları yüklenemedi.");
        }
        const result = await api.deleteSutGirdisi(girdiId); // api.js'den
        gosterMesaj(result.message, 'success');

        // Girdinin orijinal tarihini alıp o tarihin özetini ve listesini güncelle
        const formatliTarih = ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
        // Backend'in döndürdüğü tarihi kullanalım (sut_service.py'de eklendi)
        const silinenGirdiTarihi = result.girdi_tarihi_str || formatliTarih;

        // Önce özet panelini güncelle
        ui.updateOzetPanels(result.yeni_ozet, silinenGirdiTarihi);
        // Sonra girdilerin OLDUĞU sayfayı yeniden yükle (ilk sayfa değil, mevcut sayfa!)
        // Eğer silinen son elemansa ve sayfa > 1 ise, bir önceki sayfayı yükle
        const listeElementi = document.getElementById('girdiler-listesi');
        const kartListesi = document.getElementById('girdiler-kart-listesi');
        let hedefSayfa = anaPanelMevcutSayfa;
        if(anaPanelMevcutSayfa > 1 && listeElementi && kartListesi && listeElementi.children.length === 0 && kartListesi.children.length === 0) {
            hedefSayfa--;
        }
        await girdileriGoster(hedefSayfa, silinenGirdiTarihi);

    } catch (error) {
        console.error("İyimser silme başarısız oldu:", error);
        gosterMesaj('Silme işlemi başarısız, girdi geri yüklendi.', 'danger');
        // Hata durumunda öğeyi geri ekle
        if (originalHTML && parent) {
             const tempDiv = document.createElement(anaPanelMevcutGorunum === 'kart' ? 'div' : 'tbody'); // Düzeltme: liste için tbody olmalı
             tempDiv.innerHTML = originalHTML;
             const restoredElement = tempDiv.firstChild;
             if (restoredElement) { // Eklenen null kontrolü
                 restoredElement.style.opacity = '1';
                 restoredElement.style.transform = 'translateX(0)';
                 parent.insertBefore(restoredElement, nextSibling);
                 const veriYokMesaji = document.getElementById('veri-yok-mesaji');
                 if(veriYokMesaji) veriYokMesaji.style.display = 'none'; // Veri yok mesajını gizle
             }
        }
    }
}


/**
 * Şifre değiştirme modalındaki "Kaydet" butonuna basıldığında çağrılır.
 */
async function sifreDegistir() {
    if(typeof ui === 'undefined' || typeof ui.getSifreDegistirmeFormVerisi !== 'function' || !ui.sifreDegistirModal) {
        console.error("Gerekli ui fonksiyonları veya şifre modalı bulunamadı.");
        gosterMesaj("Şifre değiştirme işlemi başlatılamadı.", "danger");
        return;
    }
    const { mevcutSifre, yeniSifre, yeniSifreTekrar } = ui.getSifreDegistirmeFormVerisi();
    if (!mevcutSifre || !yeniSifre || !yeniSifreTekrar) {
        gosterMesaj("Lütfen tüm şifre alanlarını doldurun.", "warning");
        return;
    }
    if (yeniSifre !== yeniSifreTekrar) {
        gosterMesaj("Yeni şifreler eşleşmiyor.", "warning");
        return;
    }

    // Butonu pasif yap ve spinner göster (modal içinde)
    const kaydetButton = ui.sifreDegistirModal._element.querySelector('.btn-primary');
    let originalButtonText = '';
    if (kaydetButton) {
        originalButtonText = kaydetButton.innerHTML;
        kaydetButton.disabled = true;
        kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    }

    try {
        if (typeof api === 'undefined' || typeof api.postChangePassword !== 'function') {
             throw new Error("API fonksiyonları yüklenemedi.");
        }
        const result = await api.postChangePassword({ mevcut_sifre: mevcutSifre, yeni_sifre: yeniSifre, yeni_sifre_tekrar: yeniSifreTekrar }); // api.js'den
        gosterMesaj(result.message, 'success');
        ui.sifreDegistirModal.hide(); // Başarılı olunca modalı kapat
    } catch (error) {
        gosterMesaj(error.message || "Bir hata oluştu.", 'danger');
    } finally {
        // Butonu eski haline getir
        if (kaydetButton) {
            kaydetButton.disabled = false;
            kaydetButton.innerHTML = originalButtonText || 'Kaydet';
        }
    }
}

/**
 * Seçili tarihe veya tüm zamanlara ait girdileri CSV olarak dışa aktarır.
 */
async function verileriDisaAktar() {
    let secilenTarih = null;
    if (typeof ui !== 'undefined' && ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0]) {
        secilenTarih = utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]);
    }

    // Butonu geçici olarak pasif yap (gerekirse)
    const exportButton = event.target.closest('button'); // Tıklanan butonu bul
    let originalButtonHtml = '';
    if (exportButton) {
        originalButtonHtml = exportButton.innerHTML;
        exportButton.disabled = true;
        exportButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Aktarılıyor...`;
    }

    try {
        if (typeof api === 'undefined' || typeof api.fetchCsvExport !== 'function') {
             throw new Error("API fonksiyonları yüklenemedi.");
        }
        const { filename, blob } = await api.fetchCsvExport(secilenTarih); // api.js'den

        // Blob'dan indirme linki oluştur ve tıkla
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Oluşturulan linki temizle
        window.URL.revokeObjectURL(objectUrl);
        a.remove();
        gosterMesaj("Veriler başarıyla CSV olarak indirildi.", "success");
    } catch (error) {
        gosterMesaj(error.message || "CSV dışa aktarılırken hata oluştu.", "danger");
    } finally {
        // Butonu eski haline getir
        if (exportButton) {
            exportButton.disabled = false;
            exportButton.innerHTML = originalButtonHtml || '<i class="bi bi-file-earmark-excel"></i> Aktar';
        }
    }
}

/**
 * Ana paneldeki girdilerin görünümünü (liste/kart) değiştirir.
 * @param {string} yeniGorunum - 'liste' veya 'kart'.
 */
function gorunumuDegistir(yeniGorunum) {
    if (anaPanelMevcutGorunum === yeniGorunum) return; // Zaten o görünümdeyse bir şey yapma
    anaPanelMevcutGorunum = yeniGorunum;
    localStorage.setItem('anaPanelGorunum', anaPanelMevcutGorunum); // Seçimi kaydet
    gorunumuAyarla(anaPanelMevcutGorunum); // Arayüzü güncelle

    // Mevcut sayfadaki verileri yeni görünüme göre tekrar render et
    // (API'den tekrar çekmeye gerek yok, sadece render fonksiyonunu çağır)
    const formatliTarih = ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
    girdileriGoster(anaPanelMevcutSayfa, formatliTarih);
}

/**
 * Liste ve kart görünümleri arasındaki geçişi yönetir (elementleri gösterir/gizler, butonları günceller).
 * @param {string} aktifGorunum - Şu anda aktif olan görünüm ('liste' veya 'kart').
 */
function gorunumuAyarla(aktifGorunum) {
    const listeDiv = document.getElementById('liste-gorunumu');
    const kartDiv = document.getElementById('kart-gorunumu');
    const listeBtn = document.getElementById('btn-view-list');
    const kartBtn = document.getElementById('btn-view-card');

    if (aktifGorunum === 'liste') {
        if(listeDiv) listeDiv.style.display = 'block';
        if(kartDiv) kartDiv.style.display = 'none';
        if(listeBtn) listeBtn.classList.add('active');
        if(kartBtn) kartBtn.classList.remove('active');
    } else { // 'kart' görünümü
        if(listeDiv) listeDiv.style.display = 'none';
        if(kartDiv) kartDiv.style.display = 'block'; // Kartlar için display: block uygun
        if(listeBtn) listeBtn.classList.remove('active');
        if(kartBtn) kartBtn.classList.add('active');
    }
}

// initOfflineState fonksiyonu sayfa başında çağrıldığı için burada tekrar çağırmaya gerek yok.

// --- YENİ: PWA OTOMATİK GÜNCELLEME ---
async function initializeSW() {
    if ('serviceWorker' in navigator) {
        try {
            // Service Worker'ı kaydet (veya mevcut kaydı al)
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker kaydedildi:', registration);

            // Yeni SW kurulduktan ve aktifleşmeyi beklerken (installing -> installed -> waiting)
            // Biz `skipWaiting()` kullandığımız için direkt `activating` -> `activated` olacak.
            // Bu yüzden controller değişikliğini dinlemek daha güvenilir.

            // Controller (aktif SW) değiştiğinde sayfayı yenile
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return; // Zaten yenileme işlemi başladıysa tekrar yapma
                console.log('Yeni Service Worker aktifleşti. Sayfa yenileniyor...');
                gosterMesaj('Uygulama güncellendi, sayfa yenileniyor...', 'info', 3000);
                refreshing = true;
                window.location.reload(true); // Önbelleği atlayarak yenile
            });

            // Sayfa yüklendiğinde mevcut SW'den güncelleme kontrolü isteyelim
            // Bu, özellikle sekme uzun süre açık kaldığında faydalı olabilir.
            if (registration.active) {
                console.log('Mevcut Service Worker için güncelleme kontrol ediliyor...');
                registration.update();
            }

        } catch (error) {
            console.error('Service Worker başlatılırken veya güncellenirken hata:', error);
        }
    } else {
        console.warn('Service Worker bu tarayıcıda desteklenmiyor.');
    }
}

// Eski checkForUpdates, showUpdateNotification ve activateUpdate fonksiyonları kaldırıldı.
