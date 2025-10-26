// ====================================================================================
// ANA UYGULAMA MANTIĞI (main.js)
// ====================================================================================

// --- Global Değişkenler ---
let anaPanelMevcutGorunum = 'liste'; // İsim Değişti
let anaPanelMevcutSayfa = 1;      // İsim Değişti
const girdilerSayfaBasi = 6;
let mevcutTedarikciIstatistikleri = null;
let veriOnayModal = null;
let kullaniciRolu = null;

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
        return; // Çiftçi ise buradan çık
    }

    // --- Normal Panel Başlatma ---

    // YENİ: ui.init() fonksiyonunu burada çağırıyoruz!
    if(typeof ui !== 'undefined' && typeof ui.init === 'function') {
        ui.init(); // Genel UI ve Modalları Başlatır (ui.js içinde)
    } else {
        console.error("ui objesi veya ui.init() fonksiyonu bulunamadı.");
        // Gerekirse kullanıcıya bir hata mesajı gösterilebilir
        gosterMesaj("Arayüz başlatılırken bir sorun oluştu. Lütfen sayfayı yenileyin.", "danger");
        return; // ui objesi yoksa devam etmenin anlamı yok
    }

    // Ana panele özel Veri Onay Modalını ayrıca başlat (ui.init içinde çift başlatmayı önlemek için window globalini kullanmıştık)
     const veriOnayModalEl = document.getElementById('veriOnayModal');
     if (veriOnayModalEl && !window.veriOnayModal) { // Sadece ui.init başlatmadıysa başlat
        window.veriOnayModal = new bootstrap.Modal(veriOnayModalEl);
        console.log("Veri Onay Modal başlatıldı (main.js).");
    } else if (veriOnayModalEl && window.veriOnayModal){
        console.log("Veri Onay Modal zaten başlatılmış.");
    }

    // Ana panele özel Flatpickr başlatması (ui objesine atanıyor)
    const tarihFiltreEl = document.getElementById('tarih-filtre');
    if(tarihFiltreEl && typeof flatpickr !== 'undefined'){
         ui.tarihFiltreleyici = flatpickr(tarihFiltreEl, {
            dateFormat: "d.m.Y", // Kullanıcıya gösterilecek format
            altInput: true,      // Kullanıcı dostu format için ikinci bir input
            altFormat: "d.m.Y",  // Kullanıcı dostu format
            locale: "tr",        // Türkçe dil desteği
            defaultDate: "today", // Varsayılan olarak bugünü seç
            onChange: function(selectedDates, dateStr, instance) {
                // Tarih değiştiğinde filtrelemeyi tetikle
                if (typeof girdileriFiltrele === 'function') {
                    girdileriFiltrele();
                }
            }
        });
    }

    // Lisans uyarısını kontrol et
    if(typeof ui.lisansUyarisiKontrolEt === 'function') {
       ui.lisansUyarisiKontrolEt();
    }

    // TomSelect (Tedarikçi Seçici) BAŞLATMA KODU (ui objesine atanıyor)
    const veriGirisPaneli = document.getElementById('veri-giris-paneli');
    if (kullaniciRolu !== 'muhasebeci' && veriGirisPaneli && document.getElementById('tedarikci-sec')) {
        ui.tedarikciSecici = new TomSelect("#tedarikci-sec", {
            create: false,
            sortField: { field: "text", direction: "asc" },
            onChange: (value) => {
                 if (value && navigator.onLine) {
                    api.fetchTedarikciIstatistikleri(value)
                        .then(data => { mevcutTedarikciIstatistikleri = data[0] || null; })
                        .catch(err => {
                            console.warn("İstatistikler alınamadı:", err);
                            mevcutTedarikciIstatistikleri = null;
                        });
                    api.fetchSonFiyat(value).then(data => {
                       if(data && data.son_fiyat) {
                           const fiyatInput = document.getElementById('fiyat-input');
                           fiyatInput.value = parseFloat(data.son_fiyat).toFixed(2);
                           fiyatInput.classList.add('fiyat-guncellendi');
                           setTimeout(() => fiyatInput.classList.remove('fiyat-guncellendi'), 500);
                       }
                    }).catch(err => console.warn("Son fiyat getirilemedi:", err));
                } else {
                    mevcutTedarikciIstatistikleri = null;
                }
            }
        });
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
};






/**
 * Uygulamanın ihtiyaç duyduğu tüm başlangıç verilerini paralel olarak yükler.
 */
async function baslangicVerileriniYukle() {
    console.log("Başlangıç verileri yükleniyor...");
    const girdilerBaslik = document.getElementById('girdiler-baslik');
    if(girdilerBaslik) girdilerBaslik.textContent = 'Bugünkü Girdiler';

    const promises = [
        ozetVerileriniYukle()
    ];

    if (kullaniciRolu !== 'muhasebeci') {
        promises.push(tedarikcileriYukle());
    }

    try {
        await Promise.all(promises);
        console.log("Özet ve Tedarikçiler (gerekiyorsa) yüklendi.");
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
    if(typeof ui === 'undefined' || typeof ui.toggleOzetPanelsLoading !== 'function') {
        console.error("ui objesi veya toggleOzetPanelsLoading fonksiyonu bulunamadı.");
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
 */
async function girdileriGoster(sayfa = 1, tarih = null) {
    anaPanelMevcutSayfa = sayfa; // Global sayfayı güncelle
    const effectiveDate = tarih || (ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString(new Date()));
    const cacheKey = `girdiler_${effectiveDate}_sayfa_${anaPanelMevcutSayfa}`;

    if(typeof ui === 'undefined' || typeof ui.showGirdilerLoadingSkeleton !== 'function' || typeof ui.renderGirdiler !== 'function' || typeof ui.sayfalamaNavOlustur !== 'function' || typeof ui.mergeOnlineOfflineGirdiler !== 'function') {
         console.error("Gerekli ui fonksiyonları bulunamadı.");
         return;
    }

    ui.showGirdilerLoadingSkeleton(anaPanelMevcutGorunum);

    if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            try {
                const { girdiler, toplam_girdi_sayisi } = JSON.parse(cachedData);
                const bekleyenGirdiler = await bekleyenGirdileriGetir(); // offline.js'den
                const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler({ girdiler: girdiler, toplam_girdi_sayisi: toplam_girdi_sayisi }, bekleyenGirdiler, effectiveDate);

                ui.renderGirdiler(tumGirdiler, anaPanelMevcutGorunum);
                ui.sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, anaPanelMevcutSayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, effectiveDate));

            } catch(e) {
                 console.error("Önbellek verisi (girdiler) okunamadı:", e);
                 ui.renderGirdiler([], anaPanelMevcutGorunum);
            }
        } else {
            ui.renderGirdiler([], anaPanelMevcutGorunum);
        }
        return;
    }

    try {
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
    if (!ui.tedarikciSecici) {
        console.log("Tedarikçi seçici (TomSelect) bu rol için aktif değil veya ui objesi bulunamadı.");
        return;
    }
    console.log("Tedarikçiler yükleniyor...");
    try {
        const tedarikciler = await store.getTedarikciler(); // store.js'den
        console.log("Tedarikçiler store'dan alındı:", tedarikciler);
        ui.tumTedarikciler = tedarikciler; // ui objesine atama
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

function girdileriFiltrele() {
    const secilenTarih = ui.tarihFiltreleyici ? ui.tarihFiltreleyici.selectedDates[0] : null;
    if (secilenTarih) {
        const formatliTarih = utils.getLocalDateString(secilenTarih); // utils.js'den
        if(typeof ui !== 'undefined' && typeof ui.updateGirdilerBaslik === 'function') {
            ui.updateGirdilerBaslik(formatliTarih);
        }
        girdileriGoster(1, formatliTarih); // İlk sayfayı yükle
        ozetVerileriniYukle(formatliTarih);
    }
}

function filtreyiTemizle() {
    if (ui.tarihFiltreleyici) {
        ui.tarihFiltreleyici.setDate(new Date(), true);
    }
}

async function sutGirdisiEkle() {
    // ui objesi kontrolü eklendi
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

async function degeriDogrulaVeKaydet(girdi) {
    if (!navigator.onLine || !mevcutTedarikciIstatistikleri) {
        await gercekKaydetmeIsleminiYap(girdi);
        return;
    }
    const { ortalama_litre, standart_sapma } = mevcutTedarikciIstatistikleri;
    const girilenLitre = girdi.litre;
    if (ortalama_litre > 0) {
        let altSinir, ustSinir;
        if (standart_sapma > 0) {
            altSinir = ortalama_litre - (standart_sapma * 2);
            ustSinir = ortalama_litre + (standart_sapma * 2);
        } else {
            const tolerans = Math.max(ortalama_litre * 0.5, 5);
            altSinir = ortalama_litre - tolerans;
            ustSinir = ortalama_litre + tolerans;
        }
        altSinir = Math.max(0, altSinir);
        if (girilenLitre < altSinir || girilenLitre > ustSinir) {
            const mesaj = `Girdiğiniz <strong>${girilenLitre} Litre</strong> değeri, bu tedarikçinin ortalama (${ortalama_litre.toFixed(1)} L) girdisinden farklı görünüyor. Emin misiniz?`;
            const onayMesajiElement = document.getElementById('onay-mesaji');
            const onaylaBtn = document.getElementById('onayla-ve-kaydet-btn');

            if(onayMesajiElement) onayMesajiElement.innerHTML = mesaj;
            if(onaylaBtn) {
                onaylaBtn.onclick = async () => {
                    if(veriOnayModal) veriOnayModal.hide();
                    await gercekKaydetmeIsleminiYap(girdi);
                };
            }
            if(veriOnayModal) veriOnayModal.show();
            return;
        }
    }
    await gercekKaydetmeIsleminiYap(girdi);
}


async function gercekKaydetmeIsleminiYap(yeniGirdi) {
    if (!navigator.onLine) {
        if(typeof ui !== 'undefined' && typeof ui.toggleGirdiKaydetButton === 'function') ui.toggleGirdiKaydetButton(true);
        try {
            const isOfflineUserValid = await ui.checkOfflineUserLicense(); // ui.js'den
            if (!isOfflineUserValid) return;
            const basarili = await kaydetCevrimdisi(yeniGirdi); // offline.js'den
            if (basarili) {
                if(typeof ui !== 'undefined' && typeof ui.resetGirdiFormu === 'function') ui.resetGirdiFormu();
                await girdileriGoster(anaPanelMevcutSayfa); // Mevcut sayfayı yenile
            }
        } finally {
            if(typeof ui !== 'undefined' && typeof ui.toggleGirdiKaydetButton === 'function') ui.toggleGirdiKaydetButton(false);
        }
        return;
    }

    const listeElementi = document.getElementById('girdiler-listesi');
    const kartListesi = document.getElementById('girdiler-kart-listesi');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    const geciciId = `gecici-${Date.now()}`;
    const tedarikciAdi = ui.tedarikciSecici && ui.tedarikciSecici.options[yeniGirdi.tedarikci_id] ? ui.tedarikciSecici.options[yeniGirdi.tedarikci_id].text : 'Bilinmeyen Tedarikçi';
    const kullaniciAdi = JSON.parse(localStorage.getItem('offlineUser'))?.kullanici_adi || 'Siz';
    const anlikSaat = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const tutar = yeniGirdi.litre * yeniGirdi.fiyat;

    let geciciElementHTML = '';
    if (anaPanelMevcutGorunum === 'liste') {
        geciciElementHTML = `
            <div class="list-group-item" id="${geciciId}" style="opacity: 0.6;">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1 girdi-baslik">${tedarikciAdi} - ${yeniGirdi.litre} Litre <span class="badge bg-info text-dark ms-2"><i class="bi bi-arrow-repeat"></i> Kaydediliyor...</span></h5>
                </div>
                <p class="mb-1 girdi-detay">Toplayan: ${kullaniciAdi} | Saat: ${anlikSaat}</p>
            </div>`;
        if(listeElementi) listeElementi.insertAdjacentHTML('afterbegin', geciciElementHTML);
    } else {
        geciciElementHTML = `
            <div class="col-xl-6 col-12" id="${geciciId}" style="opacity: 0.6;">
                <div class="card p-2 h-100"> <div class="card-body p-2"> ... Kaydediliyor Kart ... </div> </div>
            </div>`; // İçerik benzer, kısaltıldı
         if(kartListesi) kartListesi.insertAdjacentHTML('afterbegin', geciciElementHTML);
    }

    if (veriYokMesaji) veriYokMesaji.style.display = 'none';
    const geciciElement = document.getElementById(geciciId);
    const orjinalFormVerisi = { ...yeniGirdi };

    if(typeof ui !== 'undefined' && typeof ui.resetGirdiFormu === 'function') ui.resetGirdiFormu();
    if(typeof ui !== 'undefined' && typeof ui.toggleGirdiKaydetButton === 'function') ui.toggleGirdiKaydetButton(true);

    try {
        const result = await api.postSutGirdisi(yeniGirdi); // api.js'den
        gosterMesaj("Süt girdisi başarıyla kaydedildi.", "success"); // ui.js'den
        if(geciciElement) geciciElement.remove();
        const bugun = utils.getLocalDateString(); // utils.js'den
        if(typeof ui !== 'undefined' && typeof ui.updateOzetPanels === 'function') ui.updateOzetPanels(result.yeni_ozet, bugun);
        await girdileriGoster(1, bugun); // İlk sayfayı yenile
    } catch (error) {
        console.error("İyimser ekleme başarısız oldu:", error);
        gosterMesaj("Kayıt başarısız: " + (error.message || 'İnternet bağlantınızı kontrol edin.'), "danger"); // ui.js'den
        if(geciciElement) geciciElement.remove();
        if(ui.tedarikciSecici) ui.tedarikciSecici.setValue(orjinalFormVerisi.tedarikci_id);
        const litreInput = document.getElementById('litre-input');
        const fiyatInput = document.getElementById('fiyat-input');
        if(litreInput) litreInput.value = orjinalFormVerisi.litre;
        if(fiyatInput) fiyatInput.value = orjinalFormVerisi.fiyat;
        if (listeElementi && kartListesi && listeElementi.children.length === 0 && kartListesi.children.length === 0 && veriYokMesaji) {
            veriYokMesaji.style.display = 'block';
        }
    } finally {
        if(typeof ui !== 'undefined' && typeof ui.toggleGirdiKaydetButton === 'function') ui.toggleGirdiKaydetButton(false);
    }
}

async function sutGirdisiDuzenle() {
    if (!navigator.onLine) {
        gosterMesaj("Girdileri düzenlemek için internet bağlantısı gereklidir.", "warning");
        return;
    }
     // ui objesi kontrolü eklendi
    if(typeof ui === 'undefined' || typeof ui.getDuzenlemeFormVerisi !== 'function' || typeof ui.duzenleModal === 'undefined') {
        console.error("Gerekli ui fonksiyonları veya modal bulunamadı.");
        return;
    }
    const { girdiId, yeniLitre, yeniFiyat, duzenlemeSebebi } = ui.getDuzenlemeFormVerisi();
    if (!yeniLitre || !yeniFiyat || parseFloat(yeniLitre) <= 0) {
        gosterMesaj("Lütfen yeni litre ve fiyat değerlerini girin (Litre 0'dan büyük olmalı).", "warning");
        return;
    }

    try {
        const result = await api.updateSutGirdisi(girdiId, { // api.js'den
            yeni_litre: parseFloat(yeniLitre),
            yeni_fiyat: parseFloat(yeniFiyat),
            duzenleme_sebebi: duzenlemeSebebi
        });
        gosterMesaj("Girdi başarıyla güncellendi.", "success");
        if(ui.duzenleModal) ui.duzenleModal.hide();

        const formatliTarih = ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
        ui.updateOzetPanels(result.yeni_ozet, formatliTarih);
        await girdileriGoster(anaPanelMevcutSayfa, formatliTarih); // Mevcut sayfayı yenile
    } catch (error) {
        gosterMesaj(`Girdi düzenlenemedi: ${error.message || 'Bilinmeyen hata.'}`, "danger");
    }
}

async function sutGirdisiSil() {
    if (!navigator.onLine) {
        gosterMesaj("Girdileri silmek için internet bağlantısı gereklidir.", "warning");
        if(ui.silmeOnayModal) ui.silmeOnayModal.hide();
        return;
    }
     // ui objesi kontrolü eklendi
    if(typeof ui === 'undefined' || typeof ui.getSilinecekGirdiId !== 'function' || typeof ui.silmeOnayModal === 'undefined') {
        console.error("Gerekli ui fonksiyonları veya modal bulunamadı.");
        return;
    }
    const girdiId = ui.getSilinecekGirdiId();
    if(ui.silmeOnayModal) ui.silmeOnayModal.hide();

    const silinecekElement = document.getElementById(anaPanelMevcutGorunum === 'liste' ? `girdi-liste-${girdiId}` : `girdi-kart-${girdiId}`);
    if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    const originalHTML = silinecekElement.outerHTML;

    silinecekElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    silinecekElement.style.opacity = '0';
    silinecekElement.style.transform = 'translateX(-50px)';
    setTimeout(() => { if(silinecekElement.parentNode) silinecekElement.remove() }, 400);

    try {
        const result = await api.deleteSutGirdisi(girdiId); // api.js'den
        gosterMesaj(result.message, 'success');
        const formatliTarih = ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
        ui.updateOzetPanels(result.yeni_ozet, formatliTarih);
        await girdileriGoster(1, formatliTarih); // İlk sayfayı yenile
    } catch (error) {
        console.error("İyimser silme başarısız oldu:", error);
        gosterMesaj('Silme işlemi başarısız, girdi geri yüklendi.', 'danger');
        if (originalHTML && parent) {
             const tempDiv = document.createElement(anaPanelMevcutGorunum === 'kart' ? 'div' : 'tbody');
             tempDiv.innerHTML = originalHTML;
             const restoredElement = tempDiv.firstChild;
             restoredElement.style.opacity = '1';
             restoredElement.style.transform = 'translateX(0)';
             parent.insertBefore(restoredElement, nextSibling);
             const veriYokMesaji = document.getElementById('veri-yok-mesaji');
             if(veriYokMesaji) veriYokMesaji.style.display = 'none';
        }
    }
}

async function gecmisiGoster(girdiId) {
     // ui objesi kontrolü eklendi
    if(typeof ui === 'undefined' || typeof ui.gecmisModal === 'undefined' || typeof ui.renderGecmisModalContent !== 'function') {
        console.error("Gerekli ui fonksiyonları veya modal bulunamadı.");
        return;
    }
    ui.gecmisModal.show();
    ui.renderGecmisModalContent(null, true);
    try {
        const gecmisKayitlari = await api.fetchGirdiGecmisi(girdiId); // api.js'den
        ui.renderGecmisModalContent(gecmisKayitlari);
    } catch (error) {
        ui.renderGecmisModalContent(null, false, error.message);
    }
}

async function sifreDegistir() {
     // ui objesi kontrolü eklendi
    if(typeof ui === 'undefined' || typeof ui.getSifreDegistirmeFormVerisi !== 'function' || typeof ui.sifreDegistirModal === 'undefined') {
        console.error("Gerekli ui fonksiyonları veya modal bulunamadı.");
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
    try {
        const result = await api.postChangePassword({ mevcut_sifre: mevcutSifre, yeni_sifre: yeniSifre, yeni_sifre_tekrar: yeniSifreTekrar }); // api.js'den
        gosterMesaj(result.message, 'success');
        if(ui.sifreDegistirModal) ui.sifreDegistirModal.hide();
    } catch (error) {
        gosterMesaj(error.message || "Bir hata oluştu.", 'danger');
    }
}

async function verileriDisaAktar() {
    const secilenTarih = ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : null;
    try {
        const { filename, blob } = await api.fetchCsvExport(secilenTarih); // api.js'den
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(objectUrl);
        a.remove();
        gosterMesaj("Veriler başarıyla CSV olarak indirildi.", "success");
    } catch (error) {
        gosterMesaj(error.message, "danger");
    }
}

function gorunumuDegistir(yeniGorunum) {
    if (anaPanelMevcutGorunum === yeniGorunum) return;
    anaPanelMevcutGorunum = yeniGorunum;
    localStorage.setItem('anaPanelGorunum', anaPanelMevcutGorunum);
    gorunumuAyarla(anaPanelMevcutGorunum);
    const formatliTarih = ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
    girdileriGoster(anaPanelMevcutSayfa, formatliTarih); // Mevcut sayfayı yeniden render et
}

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
    } else {
        if(listeDiv) listeDiv.style.display = 'none';
        if(kartDiv) kartDiv.style.display = 'block';
        if(listeBtn) listeBtn.classList.remove('active');
        if(kartBtn) kartBtn.classList.add('active');
    }
}

// --- Diğer Yardımcı Fonksiyonlar ---
// initOfflineState() artık dosyanın başında çağrılıyor.

