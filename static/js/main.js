// ====================================================================================
// ANA UYGULAMA MANTIĞI (main.js) - FİNAL (LOGIN ENGELİ EKLENDİ)
// Ana panelin genel işleyişini, veri akışını ve ana olayları yönetir.
// Login/Register/Landing sayfalarında veri çekme işlemlerini KESİNLİKLE yapmaz.
// ====================================================================================

// --- Global Değişkenler ---
window.anaPanelMevcutGorunum = localStorage.getItem('anaPanelGorunum') || 'liste';
window.anaPanelMevcutSayfa = 1;
const girdilerSayfaBasi = 6;
let mevcutTedarikciIstatistikleri = null;
let kullaniciRolu = null; // initOfflineState içinde ayarlanır

/**
 * Uygulama kabuğu yüklendiğinde çalışır.
 * Rolü belirler ve çevrimdışı durumu yönetir.
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
            kullaniciRolu = null;
        }
    } else if (!kullaniciRolu) {
         localStorage.removeItem('offlineUser');
    }

    // Rol yoksa ve offline isek (ve login sayfasında değilsek - bu kontrol aşağıda yapılıyor)
    if (!kullaniciRolu && !navigator.onLine) {
         // Burası çalışmayacak çünkü window.onload başında login kontrolü var
         // Ama güvenlik için kalsın
    }
    
    const veriGirisPaneli = document.getElementById('veri-giris-paneli');
    if (veriGirisPaneli) veriGirisPaneli.style.display = (kullaniciRolu === 'muhasebeci') ? 'none' : 'block';
}

/**
 * Uygulama başlangıç noktası.
 */
window.onload = async function() {
    const currentPath = window.location.pathname;

    // 1. KRİTİK KONTROL: Login, Register veya Landing sayfasındaysak ÇALIŞMA!
    // Veri çekme, cacheleme, initOfflineState vb. yapma. Sadece SW başlat ve çık.
    // 'includes' kullanarak /login?next=... gibi durumları da yakalarız.
    if (currentPath === '/' || currentPath.includes('/login') || currentPath.includes('/register')) {
        console.log(`Giriş/Kayıt/Landing sayfası algılandı (${currentPath}). Veri yükleme iptal edildi.`);
        
        // Sadece Service Worker'ı başlat (PWA güncellemeleri ve cache için gerekli)
        if (typeof initializeSW === 'function') initializeSW();
        
        // BURADA DURUYORUZ. Aşağıdaki kodlar çalışmayacak.
        return; 
    }

    // --- Buraya geldiysen demek ki içeridesin (Panel, Profil vb.) ---

    initOfflineState();

    if (!kullaniciRolu) {
        // Rol yok ama içerideki sayfaya girmeye çalışmış (yetkisiz), yine de veri çekme.
        console.warn("Rol bilgisi yok, işlem durduruldu.");
        if (typeof initializeSW === 'function') initializeSW();
        return;
    }

    // Çiftçi Paneli Kontrolü
    if (kullaniciRolu === 'ciftci') {
        if (typeof initCiftciPanel === 'function') await initCiftciPanel();
        if (typeof initializeSW === 'function') initializeSW();
        return;
    }

    // Normal Panel Başlatma (Firma Yetkilisi, Toplayıcı, Admin)
    try {
        if(typeof ui !== 'undefined' && typeof ui.init === 'function') ui.init();

        setupDateFilter();
        setupSupplierSelector();

        if(typeof ui !== 'undefined' && typeof ui.lisansUyarisiKontrolEt === 'function') ui.lisansUyarisiKontrolEt();

        window.anaPanelMevcutGorunum = localStorage.getItem('anaPanelGorunum') || 'liste';
        gorunumuAyarla(window.anaPanelMevcutGorunum);

        // Verileri YÜKLEME (Tüm veriler burada çekilecek)
        await baslangicVerileriniYukle();

        const kaydetBtn = document.getElementById('kaydet-girdi-btn');
        if(kaydetBtn && kullaniciRolu !== 'muhasebeci') {
            kaydetBtn.addEventListener('click', sutGirdisiEkle);
        } else if (kaydetBtn) {
            kaydetBtn.closest('.card').style.display = 'none';
        }

    } catch (error) {
        console.error("Panel başlatılırken hata:", error);
    }

    if (typeof initializeSW === 'function') initializeSW();
};

function setupDateFilter() {
    const tarihFiltreEl = document.getElementById('tarih-filtre');
    if(tarihFiltreEl && typeof flatpickr !== 'undefined' && typeof ui !== 'undefined'){
         ui.tarihFiltreleyici = flatpickr(tarihFiltreEl, {
            dateFormat: "d.m.Y", altInput: true, altFormat: "d.m.Y", locale: "tr", defaultDate: "today",
            onChange: function(selectedDates, dateStr, instance) {
                girdileriFiltrele();
            }
        });
    }
}

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
                }
            }
        });
    }
}

/**
 * Uygulamanın ihtiyaç duyduğu TÜM verileri paralel olarak yükler ve önbellekler.
 * Çevrimdışı mod için kritiktir.
 */
async function baslangicVerileriniYukle() {
    console.log("🚀 Başlangıç verileri yükleniyor (Full Önbellekleme)...");
    
    if(typeof ui !== 'undefined' && typeof ui.updateGirdilerBaslik === 'function' && typeof utils !== 'undefined') {
        ui.updateGirdilerBaslik(utils.getLocalDateString());
    }
    
    const bugununTarihi = utils.getLocalDateString(new Date());
    
    // 1. Ana Ekranda Görünenler (Öncelikli)
    const promises = [
        ozetVerileriniYukle(), 
        guncelFiyatiGetir(bugununTarihi)
    ];
    
    // 2. Arka Planda Önbelleklenecekler (Offline Mod İçin)
    if (kullaniciRolu !== 'muhasebeci') {
        // Tedarikçiler (Selectbox için şart)
        promises.push(tedarikcileriYukle());

        // Yem Ürünleri (store.js üzerinden hem RAM'e hem DB'ye yazar)
        if (typeof store !== 'undefined' && typeof store.getYemUrunleri === 'function') {
            promises.push(store.getYemUrunleri().then(() => console.log("✅ Yem ürünleri önbelleklendi.")));
        }

        // Tankerler (Sadece yetkili roller için)
        if (['admin', 'firma_yetkilisi', 'toplayici'].includes(kullaniciRolu)) {
            if (typeof store !== 'undefined' && typeof store.getTankers === 'function') {
                // forceRefresh = true yaparak güncel veriyi çekmesini sağlıyoruz
                promises.push(store.getTankers(true).then(() => console.log("✅ Tankerler önbelleklendi.")));
            }
        }
    }
    
    try {
        // Hepsini paralel başlat
        await Promise.all(promises);
        console.log("✅ Tüm başlangıç verileri başarıyla yüklendi.");
        
        // En son listeyi göster
        await girdileriGoster(1);
    } catch (error) {
        console.error("❌ Başlangıç verileri yüklenirken hata:", error);
        gosterMesaj("Bazı veriler yüklenemedi, internet bağlantınızı kontrol edin.", "warning");
        // Hata olsa bile en azından girdileri göstermeye çalış
        if(typeof ui !== 'undefined') ui.renderGirdiler([], window.anaPanelMevcutGorunum);
    }
}

async function ozetVerileriniYukle(tarih = null) {
    if(typeof ui === 'undefined' || typeof utils === 'undefined' || typeof api === 'undefined') return;
    ui.toggleOzetPanelsLoading(true);
    const effectiveDate = tarih || utils.getLocalDateString(new Date());
    const cacheKey = `ozet_${effectiveDate}`;
    
    if (!navigator.onLine) { 
        const cachedData = localStorage.getItem(cacheKey); 
        if (cachedData) try { ui.updateOzetPanels(JSON.parse(cachedData), effectiveDate); } catch (e) { ui.updateOzetPanels(null, effectiveDate, true); } 
        else ui.updateOzetPanels(null, effectiveDate, true); 
        ui.toggleOzetPanelsLoading(false); 
        return; 
    }

    try { 
        const data = await api.fetchGunlukOzet(effectiveDate); 
        ui.updateOzetPanels(data, effectiveDate); 
        localStorage.setItem(cacheKey, JSON.stringify(data)); 
    } catch (error) { 
        if (error.message !== 'Yetkisiz Erişim (401)') { console.error("Özet yüklenirken hata:", error); ui.updateOzetPanels(null, effectiveDate, true); } 
    } finally { 
        ui.toggleOzetPanelsLoading(false); 
    }
}

async function girdileriGoster(sayfa = 1, tarih = null) {
    window.anaPanelMevcutSayfa = sayfa;
    const effectiveDate = tarih || (ui.tarihFiltreleyici?.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString());
    const cacheKey = `girdiler_${effectiveDate}_sayfa_${window.anaPanelMevcutSayfa}`;
    
    if(typeof ui === 'undefined') return;
    ui.showGirdilerLoadingSkeleton(window.anaPanelMevcutGorunum);
    
    try {
        let sunucuVerisi = { girdiler: [], toplam_girdi_sayisi: 0 };
        if (navigator.onLine) { 
            sunucuVerisi = await api.fetchSutGirdileri(effectiveDate, window.anaPanelMevcutSayfa); 
            localStorage.setItem(cacheKey, JSON.stringify(sunucuVerisi)); 
        } else { 
            const cachedData = localStorage.getItem(cacheKey); 
            if (cachedData) try { sunucuVerisi = JSON.parse(cachedData); } catch(e) {} 
        }
        
        const bekleyenGirdiler = await bekleyenGirdileriGetir();
        const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, effectiveDate);
        
        ui.renderGirdiler(tumGirdiler, window.anaPanelMevcutGorunum);
        ui.sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, window.anaPanelMevcutSayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, effectiveDate));
    } catch (error) { 
        if (error.message !== 'Yetkisiz Erişim (401)') { 
            console.error("Girdiler hatası:", error); 
            ui.renderGirdiler([], window.anaPanelMevcutGorunum); 
        } 
    }
}

async function tedarikcileriYukle() {
    if (typeof ui === 'undefined' || !ui.tedarikciSecici || typeof store === 'undefined') return;
    try { 
        const tedarikciler = await store.getTedarikciler(); 
        ui.tumTedarikciler = tedarikciler; 
        ui.doldurTedarikciSecici(tedarikciler); 
    } catch (error) { 
        console.error("Tedarikçiler yüklenemedi:", error); 
    }
}

async function guncelFiyatiGetir(tarih) {
    const fiyatInput = document.getElementById('fiyat-input');
    if (!fiyatInput || kullaniciRolu === 'muhasebeci') return;

    fiyatInput.disabled = false;
    fiyatInput.placeholder = "Fiyat yükleniyor...";
    
    if (!navigator.onLine) {
        fiyatInput.placeholder = "Çevrimdışı, fiyatı manuel girin";
        return;
    }

    try {
        const data = await api.fetchTarifeFiyat(tarih);
        if (data && data.fiyat) {
            const tarifeFiyati = parseFloat(data.fiyat).toFixed(2);
            fiyatInput.value = tarifeFiyati;
            fiyatInput.placeholder = `Tarife: ${tarifeFiyati} TL`;
            fiyatInput.classList.add('fiyat-guncellendi');
            setTimeout(() => fiyatInput.classList.remove('fiyat-guncellendi'), 500);
        } else {
            fiyatInput.value = '';
            fiyatInput.placeholder = "Tarife yok, manuel girin";
        }
    } catch(error) {
        fiyatInput.value = '';
        fiyatInput.placeholder = "Fiyatı manuel girin";
    }
}

// --- OLAY YÖNETİCİLERİ ---

function girdileriFiltrele() {
    if (typeof ui === 'undefined' || !ui.tarihFiltreleyici || typeof utils === 'undefined') return;
    const secilenTarih = ui.tarihFiltreleyici.selectedDates[0];
    const formatliTarih = secilenTarih ? utils.getLocalDateString(secilenTarih) : utils.getLocalDateString();
    
    if(typeof ui.updateGirdilerBaslik === 'function') ui.updateGirdilerBaslik(formatliTarih);
    girdileriGoster(1, formatliTarih);
    ozetVerileriniYukle(formatliTarih);
    guncelFiyatiGetir(formatliTarih);
}

function filtreyiTemizle() {
    if (typeof ui !== 'undefined' && ui.tarihFiltreleyici) { ui.tarihFiltreleyici.setDate(new Date(), true); }
}

async function sutGirdisiEkle() {
    if(typeof ui === 'undefined') return;
    
    const { tedarikciId, litre, fiyat } = ui.getGirdiFormVerisi();
    const parsedLitre = parseFloat(litre);
    const parsedFiyat = parseFloat(fiyat || 0);
    
    if (!tedarikciId || !litre || parsedLitre <= 0) { 
        gosterMesaj("Lütfen tedarikçi seçin ve geçerli bir litre girin.", "warning"); return; 
    }
    if (parsedFiyat < 0) {
        gosterMesaj("Fiyat negatif olamaz.", "warning"); return;
    }

    const yeniGirdi = { tedarikci_id: parseInt(tedarikciId), litre: parsedLitre, fiyat: parsedFiyat };
    await degeriDogrulaVeKaydet(yeniGirdi);
}

async function degeriDogrulaVeKaydet(girdi) {
    if (typeof modalHandler === 'undefined' || !navigator.onLine || !mevcutTedarikciIstatistikleri) { 
        await gercekKaydetmeIsleminiYap(girdi); return; 
    }
    
    const { ortalama_litre, standart_sapma } = mevcutTedarikciIstatistikleri;
    const girilenLitre = girdi.litre;
    
    if (ortalama_litre > 0) {
        let altSinir, ustSinir;
        if (standart_sapma && standart_sapma > 0) { 
            altSinir = ortalama_litre - (standart_sapma * 2); 
            ustSinir = ortalama_litre + (standart_sapma * 2); 
        } else { 
            const tolerans = Math.max(ortalama_litre * 0.5, 5); 
            altSinir = ortalama_litre - tolerans; 
            ustSinir = ortalama_litre + tolerans; 
        }
        
        altSinir = Math.max(0, altSinir);
        if (girilenLitre < altSinir || girilenLitre > ustSinir) {
            const mesaj = `Girdiğiniz <strong>${girilenLitre} Litre</strong>, ortalamadan (${ortalama_litre.toFixed(1)} L) farklı. Emin misiniz?`;
            if(typeof modalHandler.showVeriOnayModal === 'function') {
                modalHandler.showVeriOnayModal(mesaj, async () => { await gercekKaydetmeIsleminiYap(girdi); }); 
                return;
            }
        }
    }
    await gercekKaydetmeIsleminiYap(girdi);
}

async function gercekKaydetmeIsleminiYap(yeniGirdi) {
    ui.toggleGirdiKaydetButton(true);
    const seciliTarih = ui.tarihFiltreleyici?.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
    
    if (!navigator.onLine) { 
        try { 
            const isValid = await ui.checkOfflineUserLicense(); 
            if (!isValid) return; 
            const success = await kaydetCevrimdisi(yeniGirdi); 
            if (success) { 
                ui.resetGirdiFormu(); 
                await girdileriGoster(window.anaPanelMevcutSayfa, seciliTarih); 
                await ozetVerileriniYukle(seciliTarih); 
            } 
        } catch(err) { 
            gosterMesaj(err.message || 'Çevrimdışı kayıt yapılamadı.', 'danger'); 
        } finally { 
            ui.toggleGirdiKaydetButton(false); 
        } 
        return; 
    }

    try { 
        const result = await api.postSutGirdisi(yeniGirdi); 
        gosterMesaj("Süt girdisi başarıyla kaydedildi.", "success"); 
        ui.resetGirdiFormu(); 
        ui.updateOzetPanels(result.yeni_ozet, seciliTarih); 
        await girdileriGoster(1, seciliTarih); 
    } catch (error) { 
        if (error.message !== 'Yetkisiz Erişim (401)') { 
            console.error("Kayıt hatası:", error); 
            gosterMesaj("Kayıt başarısız: " + (error.message || 'Hata'), "danger"); 
        } 
    } finally { 
        ui.toggleGirdiKaydetButton(false); 
    }
}

async function verileriDisaAktar() {
    let secilenTarih = null; 
    if (typeof ui !== 'undefined' && ui.tarihFiltreleyici?.selectedDates[0]) { 
        secilenTarih = utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]); 
    }
    const exportButton = event.target.closest('button'); 
    let originalButtonHtml = ''; 
    if (exportButton) { 
        originalButtonHtml = exportButton.innerHTML; 
        exportButton.disabled = true; 
        exportButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Aktarılıyor...`; 
    }
    try { 
        const { filename, blob } = await api.fetchCsvExport(secilenTarih); 
        const objectUrl = window.URL.createObjectURL(blob); 
        const a = document.createElement('a'); 
        a.style.display = 'none'; a.href = objectUrl; a.download = filename; 
        document.body.appendChild(a); a.click(); 
        window.URL.revokeObjectURL(objectUrl); a.remove(); 
        gosterMesaj("CSV indirildi.", "success"); 
    } catch (error) { 
        if (error.message !== 'Yetkisiz Erişim (401)') gosterMesaj("Dışa aktarma hatası.", "danger"); 
    } finally { 
        if (exportButton) { exportButton.disabled = false; exportButton.innerHTML = originalButtonHtml || '<i class="bi bi-file-earmark-excel"></i> Aktar'; } 
    }
}

function gorunumuDegistir(yeniGorunum) {
    if (window.anaPanelMevcutGorunum === yeniGorunum) return; 
    window.anaPanelMevcutGorunum = yeniGorunum; 
    localStorage.setItem('anaPanelGorunum', window.anaPanelMevcutGorunum); 
    gorunumuAyarla(window.anaPanelMevcutGorunum);
    
    const formatliTarih = ui.tarihFiltreleyici?.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString(); 
    girdileriGoster(window.anaPanelMevcutSayfa, formatliTarih);
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

async function initializeSW() {
    if ('serviceWorker' in navigator) { 
        try { 
            const registration = await navigator.serviceWorker.register('/service-worker.js'); 
            let refreshing = false; 
            navigator.serviceWorker.addEventListener('controllerchange', () => { 
                if (refreshing) return; 
                gosterMesaj('Uygulama güncellendi.', 'info', 3000); 
                refreshing = true; 
                window.location.reload(true); 
            }); 
            if (registration.active) registration.update(); 
        } catch (error) { 
            console.error('SW Hatası:', error); 
        } 
    }
}