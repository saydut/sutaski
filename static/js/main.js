// ====================================================================================
// ANA UYGULAMA MANTIĞI (main.js) - SADELEŞTİRİLMİŞ ve GİRİŞ KONTROLLÜ (EN GÜVENLİ)
// Ana panelin genel işleyişini, veri akışını ve ana olayları yönetir.
// UI güncellemeleri için ui.js'i, modal işlemleri için modal-handler.js'i,
// veri getirme/gönderme için api.js'i ve HTML oluşturma için render-utils.js'i kullanır.
// Login/Register/Landing sayfalarında panel kodunu KESİNLİKLE çalıştırmaz.
// ====================================================================================

// --- Global Değişkenler ---
window.anaPanelMevcutGorunum = localStorage.getItem('anaPanelGorunum') || 'liste';
window.anaPanelMevcutSayfa = 1;
const girdilerSayfaBasi = 6;
let mevcutTedarikciIstatistikleri = null;
let kullaniciRolu = null; // initOfflineState içinde ayarlanır

/**
 * Uygulama kabuğu yüklendiğinde çalışır.
 * Tarayıcıda kayıtlı kullanıcı varsa bilgileri ekrana basar.
 * Yoksa ve internet de yoksa, giriş sayfasına yönlendirir.
 * Ayrıca global kullanıcı rolünü ayarlar.
 */
function initOfflineState() {
    // Bu fonksiyon global `kullaniciRolu` değişkenini set eder.
    kullaniciRolu = document.body.dataset.userRole || null; // Önce HTML'den (backend session) almayı dene
    const offlineUserString = localStorage.getItem('offlineUser');

    // Eğer HTML'den rol gelmediyse ve localStorage'da veri varsa oradan almayı dene
    if (!kullaniciRolu && offlineUserString) {
        try {
            const user = JSON.parse(offlineUserString);
            kullaniciRolu = user.rol; // Global değişkeni güncelle
            document.body.dataset.userRole = user.rol; // HTML'e de ekleyelim (belki başka kodlar kullanır)
            document.body.dataset.lisansBitis = user.lisans_bitis_tarihi;
            // Kullanıcı adı ve şirket adını UI'da güncelle (ui.js'e taşınabilir)
            const userNameEl = document.getElementById('user-name-placeholder');
            const companyNameEl = document.getElementById('company-name-placeholder');
            if (userNameEl) userNameEl.textContent = user.kullanici_adi;
            if (companyNameEl) companyNameEl.textContent = user.sirket_adi;
            console.log("initOfflineState: Rol localStorage'dan alındı:", kullaniciRolu);
        } catch (e) {
            console.error("Offline kullanıcı verisi okunamadı:", e);
            localStorage.removeItem('offlineUser');
            kullaniciRolu = null; // Hata varsa rolü null yap
        }
    } else if (kullaniciRolu) {
        console.log("initOfflineState: Rol HTML dataset'ten alındı:", kullaniciRolu);
    } else {
        console.log("initOfflineState: Rol bilgisi bulunamadı.");
         // localStorage'ı da temizleyelim (güvenlik için)
         localStorage.removeItem('offlineUser');
    }

    // Rol hala yoksa VE çevrimdışıysak login'e yönlendir (online ise sayfa devam edebilir, belki login sayfasıdır)
    if (!kullaniciRolu && !navigator.onLine) {
         console.warn("Kullanıcı rolü belirlenemedi ve çevrimdışı. Giriş sayfasına yönlendiriliyor.");
         window.location.href = '/login'; return;
    }
    // Veri giriş panelini role göre gizle/göster
    const veriGirisPaneli = document.getElementById('veri-giris-paneli');
    if (veriGirisPaneli) veriGirisPaneli.style.display = (kullaniciRolu === 'muhasebeci') ? 'none' : 'block';
}

/**
 * Uygulama başlangıç noktası.
 */
window.onload = async function() {
    const currentPath = window.location.pathname;
    console.log(`main.js onload: Sayfa yükleniyor - ${currentPath}`);

    // --- EN BAŞTA KESİN KONTROL: Login/Register/Landing sayfasında mıyız? ---
    if (['/login', '/register', '/'].includes(currentPath)) {
        console.log(`main.js: Giriş/Kayıt/Landing sayfası (${currentPath}). Panel başlatma/veri yükleme atlandı.`);
        // Sadece SW'yi başlat (gerekirse)
        if (typeof initializeSW === 'function') initializeSW();
        return; // BU SAYFALARDA KESİNLİKLE DEVAM ETME!
    }
    // --- KONTROL SONU ---

    // --- ROL KONTROLÜ (Giriş gerektiren sayfalar için) ---
    initOfflineState(); // Global `kullaniciRolu` değişkenini set eder.

    if (!kullaniciRolu) {
        // Rol yoksa ve korumalı bir sayfadaysak (api.js zaten login'e yönlendirmeli)
        console.warn(`main.js: Rol bilgisi olmadan korumalı sayfaya (${currentPath}) erişildi? Veri yükleme atlandı.`);
        if (typeof initializeSW === 'function') initializeSW();
        return;
    }
    // --- ROL KONTROL SONU ---

    // === Buradan sonrası sadece KULLANICI ROLÜ VARSA ve GİRİŞ GEREKTİREN SAYFADAYSA çalışacak ===
    console.log(`main.js: Kullanıcı rolü (${kullaniciRolu}) bulundu. Panel başlatılıyor...`);

    // Çiftçi ise çiftçi panelini başlat ve çık
    if (kullaniciRolu === 'ciftci') {
        console.log("main.js: Çiftçi paneli başlatılıyor...");
        if (typeof initCiftciPanel === 'function') await initCiftciPanel();
        else console.error("initCiftciPanel fonksiyonu bulunamadı.");
        if (typeof initializeSW === 'function') initializeSW();
        return;
    }

    // --- Normal Panel Başlatma ---
    console.log(`main.js: ${currentPath} sayfası için normal panel başlatılıyor...`);
    try {
        if(typeof ui !== 'undefined' && typeof ui.init === 'function') ui.init();
        else console.error("ui objesi veya ui.init() fonksiyonu bulunamadı.");

        // Bileşenleri BAŞLATMA (Sadece ana panelde gerekli olanlar var içinde)
        setupDateFilter();
        setupSupplierSelector();

        if(typeof ui !== 'undefined' && typeof ui.lisansUyarisiKontrolEt === 'function') ui.lisansUyarisiKontrolEt();

        window.anaPanelMevcutGorunum = localStorage.getItem('anaPanelGorunum') || 'liste';
        gorunumuAyarla(window.anaPanelMevcutGorunum);

        // Verileri YÜKLEME
        await baslangicVerileriniYukle();

        // Olay Dinleyicileri EKLEME
        const kaydetBtn = document.getElementById('kaydet-girdi-btn');
        if(kaydetBtn && kullaniciRolu !== 'muhasebeci') {
            kaydetBtn.addEventListener('click', sutGirdisiEkle);
        } else if (kaydetBtn) {
            // Muhasebeci ise butonu tamamen gizle veya pasif yap
            kaydetBtn.closest('.card').style.display = 'none';
        }

    } catch (error) {
        console.error("Normal panel başlatılırken hata oluştu:", error);
        gosterMesaj("Panel başlatılırken bir sorun oluştu. Lütfen sayfayı yenileyin.", "danger");
    }

    // Service Worker her zaman başlatılabilir (giriş yapılmışsa da)
    if (typeof initializeSW === 'function') initializeSW();
};

// --- Geri kalan fonksiyonlar (setupDateFilter, setupSupplierSelector, baslangicVerileriniYukle, ozetVerileriniYukle, girdileriGoster, tedarikcileriYukle, girdileriFiltrele, filtreyiTemizle, sutGirdisiEkle, degeriDogrulaVeKaydet, gercekKaydetmeIsleminiYap, verileriDisaAktar, gorunumuDegistir, gorunumuAyarla, initializeSW) aynı kalıyor. ---
// Önceki kod bloklarındaki gibi...

/**
 * Tarih filtresi (Flatpickr) bileşenini başlatır.
 */
function setupDateFilter() {
    const tarihFiltreEl = document.getElementById('tarih-filtre');
    if(tarihFiltreEl && typeof flatpickr !== 'undefined' && typeof ui !== 'undefined'){
         ui.tarihFiltreleyici = flatpickr(tarihFiltreEl, {
            dateFormat: "d.m.Y", altInput: true, altFormat: "d.m.Y", locale: "tr", defaultDate: "today",
            onChange: function(selectedDates, dateStr, instance) {
                girdileriFiltrele();
            }
        });
    } else { /* Ana panelde değilse hata vermemesi normal */ }
}

/**
 * Tedarikçi seçici (TomSelect) bileşenini başlatır.
 */
function setupSupplierSelector() {
    const veriGirisPaneli = document.getElementById('veri-giris-paneli');
    const tedarikciSecEl = document.getElementById('tedarikci-sec');
    if (kullaniciRolu !== 'muhasebeci' && veriGirisPaneli && tedarikciSecEl && typeof TomSelect !== 'undefined' && typeof ui !== 'undefined') {
        ui.tedarikciSecici = new TomSelect(tedarikciSecEl, {
            create: false, sortField: { field: "text", direction: "asc" },
            onChange: (value) => {
                 mevcutTedarikciIstatistikleri = null;
                 if (value && navigator.onLine && typeof api !== 'undefined') {
                    api.fetchTedarikciIstatistikleri(value)
                        .then(data => { mevcutTedarikciIstatistikleri = data[0] || null; })
                        .catch(err => console.warn("İstatistikler alınamadı:", err));
                    api.fetchSonFiyat(value).then(data => {
                       if(data && data.son_fiyat) {
                           if (typeof ui.updateFiyatInput === 'function') { ui.updateFiyatInput(data.son_fiyat); }
                           else { const fiyatInput = document.getElementById('fiyat-input'); if(fiyatInput) { fiyatInput.value = parseFloat(data.son_fiyat).toFixed(2); fiyatInput.classList.add('fiyat-guncellendi'); setTimeout(() => fiyatInput.classList.remove('fiyat-guncellendi'), 500); } }
                       }
                    }).catch(err => console.warn("Son fiyat getirilemedi:", err));
                }
            }
        });
    } else { /* Ana panelde değilse veya rol uygun değilse hata vermemesi normal */ }
}

/**
 * Uygulamanın ihtiyaç duyduğu tüm başlangıç verilerini paralel olarak yükler.
 */
async function baslangicVerileriniYukle() {
    console.log("DEBUG: baslangicVerileriniYukle START");
    console.log("Başlangıç verileri yükleniyor...");
    if(typeof ui !== 'undefined' && typeof ui.updateGirdilerBaslik === 'function' && typeof utils !== 'undefined') {
        ui.updateGirdilerBaslik(utils.getLocalDateString());
    }
    const promises = [ozetVerileriniYukle()];
    if (kullaniciRolu !== 'muhasebeci') promises.push(tedarikcileriYukle());
    try {
        await Promise.all(promises);
        console.log("Özet ve Tedarikçiler (gerekiyorsa) yüklendi.");
        await girdileriGoster(1);
    } catch (error) {
        console.error("Başlangıç verileri yüklenirken bir hata oluştu:", error);
        gosterMesaj("Başlangıç verileri yüklenemedi. Lütfen sayfayı yenileyin.", "danger");
        if(typeof ui !== 'undefined' && typeof ui.renderGirdiler === 'function') { ui.renderGirdiler([], window.anaPanelMevcutGorunum); }
    }
    console.log("DEBUG: baslangicVerileriniYukle END");
}


/**
 * Seçilen tarihe göre özet verilerini yükler ve ui.js aracılığıyla arayüzü günceller.
 */
async function ozetVerileriniYukle(tarih = null) {
    console.log(`DEBUG: ozetVerileriniYukle START for date: ${tarih}`);
    if(typeof ui === 'undefined' || typeof utils === 'undefined' || typeof api === 'undefined') { console.error("Gerekli objeler bulunamadı (ozetVerileriniYukle)."); return; }
    ui.toggleOzetPanelsLoading(true);
    const effectiveDate = tarih || utils.getLocalDateString(new Date());
    const cacheKey = `ozet_${effectiveDate}`;
    if (!navigator.onLine) { const cachedData = localStorage.getItem(cacheKey); if (cachedData) try { ui.updateOzetPanels(JSON.parse(cachedData), effectiveDate); } catch (e) { ui.updateOzetPanels(null, effectiveDate, true); } else ui.updateOzetPanels(null, effectiveDate, true); ui.toggleOzetPanelsLoading(false); return; }
    try { const data = await api.fetchGunlukOzet(effectiveDate); ui.updateOzetPanels(data, effectiveDate); localStorage.setItem(cacheKey, JSON.stringify(data)); }
    catch (error) { if (error.message !== 'Yetkisiz Erişim (401)') { console.error("Özet yüklenirken hata:", error); ui.updateOzetPanels(null, effectiveDate, true); } }
    finally { ui.toggleOzetPanelsLoading(false); }
    console.log(`DEBUG: ozetVerileriniYukle END for date: ${tarih}`);
}


/**
 * Süt girdilerini sunucudan/yerelden alır ve ui.js aracılığıyla arayüzde gösterir.
 */
async function girdileriGoster(sayfa = 1, tarih = null) {
    console.log(`DEBUG: girdileriGoster START for page: ${sayfa}, date: ${tarih}`);
    window.anaPanelMevcutSayfa = sayfa;
    const effectiveDate = tarih || (ui.tarihFiltreleyici?.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString());
    const cacheKey = `girdiler_${effectiveDate}_sayfa_${window.anaPanelMevcutSayfa}`;
    if(typeof ui === 'undefined' || typeof api === 'undefined' || typeof utils === 'undefined' || typeof bekleyenGirdileriGetir === 'undefined') { console.error("Gerekli objeler/fonksiyonlar bulunamadı (girdileriGoster)."); return; }
    ui.showGirdilerLoadingSkeleton(window.anaPanelMevcutGorunum);
    try {
        let sunucuVerisi = { girdiler: [], toplam_girdi_sayisi: 0 };
        if (navigator.onLine) { sunucuVerisi = await api.fetchSutGirdileri(effectiveDate, window.anaPanelMevcutSayfa); localStorage.setItem(cacheKey, JSON.stringify(sunucuVerisi)); }
        else { const cachedData = localStorage.getItem(cacheKey); if (cachedData) try { sunucuVerisi = JSON.parse(cachedData); } catch(e) { console.error("Önbellek verisi (girdiler) okunamadı:", e); } }
        const bekleyenGirdiler = await bekleyenGirdileriGetir();
        const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, effectiveDate);
        ui.renderGirdiler(tumGirdiler, window.anaPanelMevcutGorunum);
        ui.sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, window.anaPanelMevcutSayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, effectiveDate));
    } catch (error) { if (error.message !== 'Yetkisiz Erişim (401)') { console.error("Girdileri gösterirken hata:", error); gosterMesaj("Girdiler yüklenirken bir hata oluştu.", "danger"); ui.renderGirdiler([], window.anaPanelMevcutGorunum); } }
    console.log(`DEBUG: girdileriGoster END for page: ${sayfa}, date: ${tarih}`);
}


/**
 * Tedarikçi listesini yükler ve ui.js aracılığıyla seçim kutusunu doldurur.
 */
async function tedarikcileriYukle() {
    if (typeof ui === 'undefined' || !ui.tedarikciSecici || typeof store === 'undefined') { console.log("Tedarikçi seçici (TomSelect) bu rol için aktif değil veya gerekli objeler bulunamadı."); return; }
    console.log("Tedarikçiler yükleniyor...");
    try { const tedarikciler = await store.getTedarikciler(); ui.tumTedarikciler = tedarikciler; ui.doldurTedarikciSecici(tedarikciler); console.log("Tedarikçi seçici dolduruldu."); }
    catch (error) { console.error("Tedarikçiler yüklenirken hata:", error); gosterMesaj("Tedarikçiler yüklenemedi.", "danger"); }
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
    const formatliTarih = secilenTarih ? utils.getLocalDateString(secilenTarih) : utils.getLocalDateString();
    if(typeof ui.updateGirdilerBaslik === 'function') ui.updateGirdilerBaslik(formatliTarih);
    girdileriGoster(1, formatliTarih);
    ozetVerileriniYukle(formatliTarih);
}

/**
 * Tarih filtresini temizler ve bugünün verilerini gösterir.
 */
function filtreyiTemizle() {
    if (typeof ui !== 'undefined' && ui.tarihFiltreleyici) { ui.tarihFiltreleyici.setDate(new Date(), true); }
}

/**
 * Yeni süt girdisi ekleme butonuna tıklandığında çağrılır.
 */
async function sutGirdisiEkle() {
    if(typeof ui === 'undefined') { console.error("ui objesi bulunamadı (sutGirdisiEkle)."); return; }
    const { tedarikciId, litre, fiyat } = ui.getGirdiFormVerisi();
    if (!tedarikciId || !litre || parseFloat(litre) <= 0) { gosterMesaj("Lütfen tedarikçi seçin ve geçerli bir litre girin (0'dan büyük).", "warning"); return; }
    const yeniGirdi = { tedarikci_id: parseInt(tedarikciId), litre: parseFloat(litre), fiyat: parseFloat(fiyat || 0) };
    await degeriDogrulaVeKaydet(yeniGirdi);
}

/**
 * Girilen litre değerini tedarikçinin ortalamasıyla karşılaştırır,
 * gerekirse onay ister, sonra kaydetme işlemini başlatır.
 */
async function degeriDogrulaVeKaydet(girdi) {
    if (typeof modalHandler === 'undefined') { console.error("modalHandler objesi bulunamadı (degeriDogrulaVeKaydet)."); await gercekKaydetmeIsleminiYap(girdi); return; }
    const veriOnayModalInstance = modalHandler.veriOnayModal;
    if (!navigator.onLine || !mevcutTedarikciIstatistikleri) { await gercekKaydetmeIsleminiYap(girdi); return; }
    const { ortalama_litre, standart_sapma } = mevcutTedarikciIstatistikleri;
    const girilenLitre = girdi.litre;
    if (ortalama_litre > 0) {
        let altSinir, ustSinir;
        if (standart_sapma && standart_sapma > 0) { altSinir = ortalama_litre - (standart_sapma * 2); ustSinir = ortalama_litre + (standart_sapma * 2); }
        else { const tolerans = Math.max(ortalama_litre * 0.5, 5); altSinir = ortalama_litre - tolerans; ustSinir = ortalama_litre + tolerans; }
        altSinir = Math.max(0, altSinir);
        if (girilenLitre < altSinir || girilenLitre > ustSinir) {
            const mesaj = `Girdiğiniz <strong>${girilenLitre} Litre</strong> değeri, bu tedarikçinin ortalama (${ortalama_litre.toFixed(1)} L) girdisinden farklı görünüyor. Emin misiniz?`;
            modalHandler.showVeriOnayModal(mesaj, async () => { await gercekKaydetmeIsleminiYap(girdi); }); return;
        }
    }
    await gercekKaydetmeIsleminiYap(girdi);
}


/**
 * Yeni süt girdisini çevrimdışı veya çevrimiçi olarak kaydeder ve arayüzü günceller.
 */
async function gercekKaydetmeIsleminiYap(yeniGirdi) {
    if(typeof ui === 'undefined' || typeof api === 'undefined' || typeof utils === 'undefined' || typeof kaydetCevrimdisi === 'undefined') { console.error("Gerekli objeler/fonksiyonlar bulunamadı (gercekKaydetmeIsleminiYap)."); return; }
    ui.toggleGirdiKaydetButton(true);
    if (!navigator.onLine) { try { const isValid = await ui.checkOfflineUserLicense(); if (!isValid) return; const success = await kaydetCevrimdisi(yeniGirdi); if (success) { ui.resetGirdiFormu(); const today = utils.getLocalDateString(); await girdileriGoster(window.anaPanelMevcutSayfa, today); await ozetVerileriniYukle(today); } } catch(err) { gosterMesaj(err.message || 'Çevrimdışı kayıt yapılamadı.', 'danger'); } finally { ui.toggleGirdiKaydetButton(false); } return; }
    try { const result = await api.postSutGirdisi(yeniGirdi); gosterMesaj("Süt girdisi başarıyla kaydedildi.", "success"); ui.resetGirdiFormu(); const today = utils.getLocalDateString(); ui.updateOzetPanels(result.yeni_ozet, today); await girdileriGoster(1, today); }
    catch (error) { if (error.message !== 'Yetkisiz Erişim (401)') { console.error("Girdi kaydetme hatası:", error); gosterMesaj("Kayıt başarısız: " + (error.message || 'Bilinmeyen bir hata oluştu.'), "danger"); } }
    finally { ui.toggleGirdiKaydetButton(false); }
}


/**
 * Seçili tarihe veya tüm zamanlara ait girdileri CSV olarak dışa aktarır.
 */
async function verileriDisaAktar() {
    let secilenTarih = null; if (typeof ui !== 'undefined' && ui.tarihFiltreleyici?.selectedDates[0] && typeof utils !== 'undefined') { secilenTarih = utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]); }
    const exportButton = event.target.closest('button'); let originalButtonHtml = ''; if (exportButton) { originalButtonHtml = exportButton.innerHTML; exportButton.disabled = true; exportButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Aktarılıyor...`; }
    try { if (typeof api === 'undefined' || typeof api.fetchCsvExport !== 'function') throw new Error("API fonksiyonları yüklenemedi."); const { filename, blob } = await api.fetchCsvExport(secilenTarih); const objectUrl = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.style.display = 'none'; a.href = objectUrl; a.download = filename; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(objectUrl); a.remove(); gosterMesaj("Veriler başarıyla CSV olarak indirildi.", "success"); }
    catch (error) { if (error.message !== 'Yetkisiz Erişim (401)') { gosterMesaj(error.message || "CSV dışa aktarılırken hata oluştu.", "danger"); } }
    finally { if (exportButton) { exportButton.disabled = false; exportButton.innerHTML = originalButtonHtml || '<i class="bi bi-file-earmark-excel"></i> Aktar'; } }
}

/**
 * Ana paneldeki girdilerin görünümünü (liste/kart) değiştirir.
 */
function gorunumuDegistir(yeniGorunum) {
    if (window.anaPanelMevcutGorunum === yeniGorunum) return; window.anaPanelMevcutGorunum = yeniGorunum; localStorage.setItem('anaPanelGorunum', window.anaPanelMevcutGorunum); gorunumuAyarla(window.anaPanelMevcutGorunum);
    const formatliTarih = ui.tarihFiltreleyici?.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString(); girdileriGoster(window.anaPanelMevcutSayfa, formatliTarih);
}

/**
 * Liste ve kart görünümleri arasındaki geçişi yönetir.
 */
function gorunumuAyarla(aktifGorunum) {
    const listeDiv = document.getElementById('liste-gorunumu'); const kartDiv = document.getElementById('kart-gorunumu'); const listeBtn = document.getElementById('btn-view-list'); const kartBtn = document.getElementById('btn-view-card');
    if (aktifGorunum === 'liste') { if(listeDiv) listeDiv.style.display = 'block'; if(kartDiv) kartDiv.style.display = 'none'; if(listeBtn) listeBtn.classList.add('active'); if(kartBtn) kartBtn.classList.remove('active'); }
    else { if(listeDiv) listeDiv.style.display = 'none'; if(kartDiv) kartDiv.style.display = 'block'; if(listeBtn) listeBtn.classList.remove('active'); if(kartBtn) kartBtn.classList.add('active'); }
}

/**
 * Service Worker'ı başlatır ve güncelleme olaylarını dinler.
 */
async function initializeSW() {
    if ('serviceWorker' in navigator) { try { const registration = await navigator.serviceWorker.register('/service-worker.js'); console.log('Service Worker kaydedildi:', registration); let refreshing = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing) return; console.log('Yeni Service Worker aktifleşti. Sayfa yenileniyor...'); gosterMesaj('Uygulama güncellendi, sayfa yenileniyor...', 'info', 3000); refreshing = true; window.location.reload(true); }); if (registration.active) { console.log('Mevcut Service Worker için güncelleme kontrol ediliyor...'); registration.update(); } } catch (error) { console.error('Service Worker başlatılırken veya güncellenirken hata:', error); } } else { console.warn('Service Worker bu tarayıcıda desteklenmiyor.'); }
}

// Global scope'da olması gereken fonksiyonlar (onclick ile çağrılanlar)
// gecmisiGoster fonksiyonu modal-handler.js içinde tanımlandı.

