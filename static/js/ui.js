// ====================================================================================
// ARAYÜZ YÖNETİMİ (ui.js) - GÜNCELLENMİŞ VERSİYON
// Modalların açılması için data-* attribute'ları ve event listener'lar kullanıldı.
// Buton görünürlüğü için yetki kontrolü düzeltildi.
// ====================================================================================

/**
 * Kullanıcıya dinamik olarak bir mesaj gösterir.
 * @param {string} mesaj - Gösterilecek mesaj (HTML içerebilir).
 * @param {string} tip - Alert tipi ('success', 'info', 'warning', 'danger').
 * @param {number} sure - Mesajın ekranda kalma süresi (milisaniye).
 */
function gosterMesaj(mesaj, tip = 'info', sure = 5000) {
    const container = document.getElementById('alert-container');
    if (!container) {
        console.error("'alert-container' ID'li element sayfada bulunamadı.");
        return;
    }
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tip} alert-dismissible fade show m-0`; // margin kaldırıldı
    alertDiv.role = 'alert';
    // Mesaj içeriğini güvenli hale getirerek ekle
    const messageSpan = document.createElement('span');
    messageSpan.innerHTML = mesaj; // innerHTML kullanıyoruz çünkü mesajda HTML olabilir (örn: çiftçi şifresi)
    alertDiv.appendChild(messageSpan);
    alertDiv.insertAdjacentHTML('beforeend', '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>');

    container.appendChild(alertDiv);

    // Bootstrap alert instance'ını al ve kapanma olayını bekle
    const bsAlert = new bootstrap.Alert(alertDiv);
    const timeoutId = setTimeout(() => {
        // Element hala DOM'da ise kapat
        if (alertDiv.parentNode === container) {
            bsAlert.close();
        }
    }, sure);

    // Kapatma butonu tıklandığında veya süre dolduğunda DOM'dan tamamen kaldır
    alertDiv.addEventListener('closed.bs.alert', () => {
        clearTimeout(timeoutId); // Zamanlayıcıyı temizle (önemli!)
        if (alertDiv.parentNode === container) {
            container.removeChild(alertDiv);
        }
    });
}


/**
 * Bir sayıyı 0'dan hedef değere doğru animasyonla artırır.
 * @param {HTMLElement} element - Sayının gösterileceği HTML elementi.
 * @param {number} finalValue - Hedeflenen son değer.
 * @param {number} duration - Animasyon süresi (milisaniye).
 * @param {string} suffix - Sayının sonuna eklenecek metin (örn: ' L').
 * @param {number} decimalPlaces - Ondalık basamak sayısı.
 */
function animateCounter(element, finalValue, duration = 1200, suffix = '', decimalPlaces = 0) {
    if (!element) return; // Element yoksa çık
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // Yumuşak geçiş efekti (ease-out cubic)
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        let currentValue = easedProgress * finalValue;

        // Çok küçük negatif sayıları sıfıra yuvarla (animasyon sırasında oluşabilir)
        if (Math.abs(currentValue) < 1e-6) currentValue = 0;

        element.textContent = currentValue.toFixed(decimalPlaces).replace('.', ',') + suffix;

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            // Animasyon bittiğinde tam değeri gösterdiğinden emin ol
            element.textContent = finalValue.toFixed(decimalPlaces).replace('.', ',') + suffix;
        }
    };
    window.requestAnimationFrame(step);
}


const ui = {
    // Modal instance'ları (init içinde oluşturulacak)
    duzenleModal: null,
    gecmisModal: null,
    silmeOnayModal: null,
    veriOnayModal: null, // Ana panel için veri onay modalı (main.js de başlatabilir)
    sifreDegistirModal: null, // base.html'deki genel şifre modalı

    // Diğer UI elemanları (ilgili JS dosyalarında atanacak)
    tarihFiltreleyici: null, // Ana panel tarih filtresi (main.js)
    tedarikciSecici: null, // Ana panel tedarikçi seçici (main.js)
    tumTedarikciler: [], // Tedarikçi listesi (store.js/main.js tarafından doldurulur)

    /**
     * Sayfa yüklendiğinde gerekli tüm UI bileşenlerini (özellikle modalları) başlatır.
     * Bu fonksiyon ilgili sayfanın .js dosyasındaki onload içinde çağrılır.
     * Sadece o sayfada var olan elementleri başlatır.
     */
    init() {
        console.log("ui.init() çağrıldı.");
        const duzenleModalEl = document.getElementById('duzenleModal');
        const gecmisModalEl = document.getElementById('gecmisModal');
        const silmeOnayModalEl = document.getElementById('silmeOnayModal');
        const veriOnayModalEl = document.getElementById('veriOnayModal');
        const sifreDegistirModalEl = document.getElementById('sifreDegistirModal');

        // Düzenleme Modalı Başlatma ve Olay Dinleyicileri
        if (duzenleModalEl) {
            this.duzenleModal = new bootstrap.Modal(duzenleModalEl);
            console.log("Duzenle Modal başlatıldı.");
            // --- Modal AÇILDIKTAN SONRA inputları doldurma ---
            duzenleModalEl.addEventListener('shown.bs.modal', (event) => {
                const button = event.relatedTarget; // Modalı tetikleyen buton
                if (button && button.dataset.girdiId) {
                    const girdiId = button.dataset.girdiId;
                    const mevcutLitre = button.dataset.litre;
                    const mevcutFiyat = button.dataset.fiyat;

                    const idInput = document.getElementById('edit-girdi-id');
                    const litreInput = document.getElementById('edit-litre-input');
                    const fiyatInput = document.getElementById('edit-fiyat-input');
                    const sebepInput = document.getElementById('edit-sebep-input');

                    // Elementlerin varlığını tekrar kontrol et (güvenlik için)
                    if (idInput && litreInput && fiyatInput && sebepInput) {
                        idInput.value = girdiId;
                        litreInput.value = mevcutLitre;
                        fiyatInput.value = mevcutFiyat;
                        sebepInput.value = ''; // Sebebi her açılışta temizle
                        litreInput.focus(); // Litre alanına odaklan
                    } else {
                        console.error('Düzenleme modalı açıldı ancak iç elementler bulunamadı!');
                        gosterMesaj('Düzenleme penceresi elemanları bulunamadı.', 'danger');
                        this.duzenleModal.hide(); // Hata varsa modalı kapat
                    }
                } else {
                    // Eğer butondan data gelmediyse (belki başka bir yolla açıldı?) formu temizle
                    console.warn("Düzenleme modalı 'relatedTarget' veya gerekli data attribute'ları olmadan açıldı.");
                    const idInput = document.getElementById('edit-girdi-id');
                    const litreInput = document.getElementById('edit-litre-input');
                    const fiyatInput = document.getElementById('edit-fiyat-input');
                    const sebepInput = document.getElementById('edit-sebep-input');
                    if(idInput) idInput.value = '';
                    if(litreInput) litreInput.value = '';
                    if(fiyatInput) fiyatInput.value = '';
                    if(sebepInput) sebepInput.value = '';
                }
            });
            // Modal kapandığında formu temizle
            duzenleModalEl.addEventListener('hidden.bs.modal', () => {
                const idInput = document.getElementById('edit-girdi-id');
                const litreInput = document.getElementById('edit-litre-input');
                const fiyatInput = document.getElementById('edit-fiyat-input');
                const sebepInput = document.getElementById('edit-sebep-input');
                if(idInput) idInput.value = '';
                if(litreInput) litreInput.value = '';
                if(fiyatInput) fiyatInput.value = '';
                if(sebepInput) sebepInput.value = '';
            });
        }

        // Geçmiş Modalı Başlatma
        if (gecmisModalEl) {
            this.gecmisModal = new bootstrap.Modal(gecmisModalEl);
            console.log("Gecmis Modal başlatıldı.");
             // Geçmiş modalı kapandığında içeriğini temizleyelim (bir sonraki açılışta spinner görünsün)
             gecmisModalEl.addEventListener('hidden.bs.modal', () => {
                 const modalBody = document.getElementById('gecmis-modal-body');
                 if (modalBody) {
                    modalBody.innerHTML = '<div class="text-center p-4"><div class="spinner-border"></div></div>';
                 }
             });
        }

        // Silme Onay Modalı Başlatma ve Olay Dinleyicileri
        if (silmeOnayModalEl) {
            this.silmeOnayModal = new bootstrap.Modal(silmeOnayModalEl);
             console.log("Silme Onay Modal başlatıldı.");
             // --- Modal AÇILDIKTAN SONRA inputu doldurma ---
             silmeOnayModalEl.addEventListener('shown.bs.modal', (event) => {
                const button = event.relatedTarget; // Modalı tetikleyen buton
                if (button && button.dataset.girdiId) {
                    const girdiId = button.dataset.girdiId;
                    const idInput = document.getElementById('silinecek-girdi-id');
                    if (idInput) {
                        idInput.value = girdiId;
                    } else {
                         console.error('Silme modalı açıldı ancak "silinecek-girdi-id" inputu bulunamadı!');
                         gosterMesaj('Silme penceresi elemanı bulunamadı.', 'danger');
                         this.silmeOnayModal.hide(); // Hata varsa kapat
                    }
                } else {
                     console.warn("Silme modalı 'relatedTarget' veya data-girdi-id attribute'u olmadan açıldı.");
                     const idInput = document.getElementById('silinecek-girdi-id');
                     if(idInput) idInput.value = ''; // ID inputunu temizle
                }
             });
             // Modal kapandığında ID inputunu temizle
              silmeOnayModalEl.addEventListener('hidden.bs.modal', () => {
                 const idInput = document.getElementById('silinecek-girdi-id');
                 if(idInput) idInput.value = '';
             });
        }

        // Veri Onay Modalı Başlatma (main.js de başlatabilir, çift kontrol)
         if (veriOnayModalEl) {
            // Bu modal main.js içinde ayrıca başlatılıyor olabilir, çift başlatmayı önle
            if (!window.veriOnayModalInstance) { // Global scope'da bir instance kontrolü
                 window.veriOnayModalInstance = new bootstrap.Modal(veriOnayModalEl);
                 this.veriOnayModal = window.veriOnayModalInstance; // ui objesine de referans ekle
                 console.log("Veri Onay Modal başlatıldı (ui.init).");
            } else {
                this.veriOnayModal = window.veriOnayModalInstance; // Mevcut instance'ı kullan
                 console.log("Veri Onay Modal zaten başlatılmıştı.");
            }
            // 'shown' veya 'hidden' event listenerları buraya eklenebilir (gerekirse)
        }

        // Şifre Değiştirme Modalı Başlatma
        if (sifreDegistirModalEl) {
            this.sifreDegistirModal = new bootstrap.Modal(sifreDegistirModalEl);
             console.log("Şifre Değiştir Modal başlatıldı.");
             // 'hidden' event'i ile kapanınca inputları temizleyelim
             sifreDegistirModalEl.addEventListener('hidden.bs.modal', () => {
                 const mevcutSifreInput = document.getElementById('mevcut-sifre-input');
                 const yeniSifreInput = document.getElementById('kullanici-yeni-sifre-input');
                 const yeniSifreTekrarInput = document.getElementById('kullanici-yeni-sifre-tekrar-input');
                 if(mevcutSifreInput) mevcutSifreInput.value = '';
                 if(yeniSifreInput) yeniSifreInput.value = '';
                 if(yeniSifreTekrarInput) yeniSifreTekrarInput.value = '';
             });
        }

        // Ana panele özel Flatpickr ve TomSelect başlatmaları main.js içinde yapılır.
        // Diğer sayfalara özel başlatmalar kendi .js dosyalarında yapılmalı.
    },

    /**
     * Lisans bitiş tarihini kontrol eder ve gerekirse bir uyarı mesajı gösterir.
     */
    lisansUyarisiKontrolEt() {
        const lisansBitisStr = document.body.dataset.lisansBitis;
        if (!lisansBitisStr || lisansBitisStr === 'None' || lisansBitisStr === '') return;

        try {
            const lisansBitisTarihi = new Date(lisansBitisStr);
             if (isNaN(lisansBitisTarihi.getTime())) {
                 console.warn("Geçersiz lisans bitiş tarihi formatı:", lisansBitisStr);
                 return;
             }
            const bugun = new Date();
            lisansBitisTarihi.setHours(0, 0, 0, 0);
            bugun.setHours(0, 0, 0, 0);

            const gunFarki = Math.ceil((lisansBitisTarihi.getTime() - bugun.getTime()) / (1000 * 3600 * 24));

            if (gunFarki < 0) {
                gosterMesaj(`<strong>Dikkat:</strong> Şirketinizin lisans süresi ${Math.abs(gunFarki)} gün önce dolmuştur! Lütfen yöneticinizle iletişime geçin.`, 'danger', 10000);
            } else if (gunFarki <= 30) {
                gosterMesaj(`<strong>Bilgi:</strong> Şirketinizin lisans süresinin dolmasına ${gunFarki} gün kaldı.`, 'warning', 10000);
            }
        } catch (e) {
             console.error("Lisans tarihi kontrol hatası:", e);
        }
    },


    /**
     * Özet panellerindeki (toplam litre/girdi) yükleniyor animasyonunu açar/kapatır.
     */
    toggleOzetPanelsLoading(isLoading) {
        const toplamLitrePanel = document.getElementById('toplam-litre-panel');
        const girdiSayisiPanel = document.getElementById('bugunku-girdi-sayisi');
        if (isLoading) {
            if(toplamLitrePanel) toplamLitrePanel.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
            if(girdiSayisiPanel) girdiSayisiPanel.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
        }
        // Kapatma (spinner'ı kaldırma) işlemi updateOzetPanels içinde yapılıyor
    },

    /**
     * Özet panellerini gelen veriyle günceller ve sayıları animasyonlu gösterir.
     */
    updateOzetPanels(data, effectiveDate, isError = false) {
        const toplamLitrePanel = document.getElementById('toplam-litre-panel');
        const girdiSayisiPanel = document.getElementById('bugunku-girdi-sayisi');
        const ozetBaslik = document.getElementById('ozet-panel-baslik');
        const girdiSayisiBaslik = document.getElementById('girdi-sayisi-baslik');

        if(ozetBaslik && girdiSayisiBaslik && typeof utils !== 'undefined'){
            const bugun = utils.getLocalDateString(); // utils.js'den
            if (effectiveDate && effectiveDate !== bugun) {
                try {
                    const [yil, ay, gun] = effectiveDate.split('-');
                    ozetBaslik.textContent = `${gun}.${ay}.${yil} TOPLAMI`;
                    girdiSayisiBaslik.textContent = `${gun}.${ay}.${yil} TOPLAM GİRDİ`;
                } catch(e) { /* Hata olursa varsayılan kalır */ }
            } else {
                ozetBaslik.textContent = 'BUGÜNKÜ TOPLAM SÜT';
                girdiSayisiBaslik.textContent = 'BUGÜNKÜ TOPLAM GİRDİ';
            }
        }

        if (isError) {
            if(toplamLitrePanel) toplamLitrePanel.textContent = 'Hata';
            if(girdiSayisiPanel) girdiSayisiPanel.textContent = 'Hata';
        } else if (data && toplamLitrePanel && girdiSayisiPanel) {
            const toplamLitre = parseFloat(data.toplam_litre) || 0;
            const girdiSayisi = parseInt(data.girdi_sayisi, 10) || 0;
            animateCounter(toplamLitrePanel, toplamLitre, 1000, ' L', 2);
            animateCounter(girdiSayisiPanel, girdiSayisi, 800, '', 0);
        } else if (toplamLitrePanel && girdiSayisiPanel){ // Veri null veya undefined ise 0 göster
             animateCounter(toplamLitrePanel, 0, 500, ' L', 2);
             animateCounter(girdiSayisiPanel, 0, 500, '', 0);
        }
    },

    /**
     * Girdiler listesi için mevcut görünüme uygun bir yükleniyor iskeleti gösterir.
     */
    showGirdilerLoadingSkeleton(gorunum) {
        const listeContainer = document.getElementById('girdiler-listesi');
        const kartContainer = document.getElementById('girdiler-kart-listesi');
        const veriYokMesaji = document.getElementById('veri-yok-mesaji');
        const girdilerSayfaBasi = 6; // Bu değer main.js'deki ile aynı olmalı

        if(listeContainer) listeContainer.innerHTML = '';
        if(kartContainer) kartContainer.innerHTML = '';
        if(veriYokMesaji) veriYokMesaji.style.display = 'none';

        const skeletonItemCount = girdilerSayfaBasi;

        if (gorunum === 'liste') {
            if (!listeContainer) return;
            for (let i = 0; i < skeletonItemCount; i++) {
                listeContainer.innerHTML += `
                    <div class="list-group-item">
                        <div class="skeleton skeleton-text" style="width: ${Math.random()*30 + 50}%;"></div>
                        <div class="skeleton skeleton-text mt-1" style="width: ${Math.random()*20 + 30}%; height: 0.8rem;"></div>
                    </div>
                `;
            }
        } else { // kart görünümü
             if (!kartContainer) return;
            for (let i = 0; i < skeletonItemCount; i++) {
                kartContainer.innerHTML += `
                    <div class="col-xl-6 col-12">
                        <div class="card p-2 skeleton-card" style="height: 120px;">
                             <div class="skeleton skeleton-text" style="width: ${Math.random()*30 + 60}%;"></div>
                            <div class="skeleton skeleton-text mt-1" style="width: ${Math.random()*20 + 40}%; height: 0.8rem;"></div>
                            <div class="skeleton skeleton-text" style="width: ${Math.random()*40 + 50}%; margin-top: 1.2rem;"></div>
                        </div>
                    </div>
                `;
            }
        }
    },


    /**
     * Sunucudan gelen ve çevrimdışı kaydedilen girdileri birleştirir.
     * @param {object} sunucuVerisi - API'den gelen { girdiler: [], toplam_girdi_sayisi: number } yapısı.
     * @param {Array} bekleyenGirdiler - IndexedDB'den gelen çevrimdışı girdiler.
     * @param {string} tarih - Görüntülenen tarih ('YYYY-MM-DD').
     * @returns {object} - { tumGirdiler: Array, toplamGirdi: number }
     */
    mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, tarih) {
        let tumGirdiler = sunucuVerisi.girdiler || [];
        let toplamGirdi = sunucuVerisi.toplam_girdi_sayisi || 0;

        // Sadece bugünün tarihi için çevrimdışı girdileri ekle
        if (bekleyenGirdiler && bekleyenGirdiler.length > 0 && typeof utils !== 'undefined' && tarih === utils.getLocalDateString(new Date())) {
            const islenmisBekleyenler = bekleyenGirdiler.map(girdi => {
                // this.tumTedarikciler listesi main.js'de yüklenmiş olmalı
                const tedarikci = this.tumTedarikciler.find(t => t.id === girdi.tedarikci_id);
                return {
                    id: `offline-${girdi.id}`, // Benzersiz ID
                    litre: girdi.litre,
                    fiyat: girdi.fiyat,
                    taplanma_tarihi: girdi.eklendigi_zaman, // Eklendiği zaman
                    duzenlendi_mi: false,
                    isOffline: true, // Çevrimdışı olduğunu belirt
                    kullanicilar: { kullanici_adi: 'Siz (Beklemede)' }, // Kullanıcı adı placeholder
                    // kullanici_id çevrimdışı girdide yok, backend eklerken atayacak
                    tedarikciler: { isim: tedarikci ? utils.sanitizeHTML(tedarikci.isim) : `Bilinmeyen (ID: ${girdi.tedarikci_id})` }
                };
            });
            // Bekleyenleri başa ekle (en yeni önce)
            tumGirdiler = [...islenmisBekleyenler.reverse(), ...tumGirdiler];
            toplamGirdi += islenmisBekleyenler.length;
        }
        return { tumGirdiler, toplamGirdi };
    },

    /**
     * Girdileri seçilen görünüme göre yönlendiren ana render fonksiyonu.
     * @param {Array} girdiler - Gösterilecek girdi objeleri dizisi.
     * @param {string} gorunum - 'liste' veya 'kart'.
     */
    renderGirdiler(girdiler, gorunum) {
        const veriYokMesaji = document.getElementById('veri-yok-mesaji');
        const listeListesi = document.getElementById('girdiler-listesi');
        const kartListesi = document.getElementById('girdiler-kart-listesi');

        if(listeListesi) listeListesi.innerHTML = '';
        if(kartListesi) kartListesi.innerHTML = '';

        if (!girdiler || girdiler.length === 0) {
            if(veriYokMesaji) veriYokMesaji.style.display = 'block';
            return;
        }

       if(veriYokMesaji) veriYokMesaji.style.display = 'none';

        if (gorunum === 'liste') {
            this.renderGirdilerAsList(girdiler);
        } else {
            this.renderGirdilerAsCards(girdiler);
        }
    },

    /**
     * Girdileri liste formatında (list-group) render eder.
     */
    renderGirdilerAsList(girdiler) {
        const listeElementi = document.getElementById('girdiler-listesi');
        if(!listeElementi) return;
        listeElementi.innerHTML = ''; // Önce temizle

        girdiler.forEach(girdi => {
            let formatliTarih = 'Geçersiz Saat';
            try {
                 const tarihObj = new Date(girdi.taplanma_tarihi);
                 if (!isNaN(tarihObj.getTime())) {
                     formatliTarih = `${String(tarihObj.getHours()).padStart(2, '0')}:${String(tarihObj.getMinutes()).padStart(2, '0')}`;
                 }
            } catch(e) { console.error("Tarih formatlama hatası:", girdi.taplanma_tarihi, e); }

            const duzenlendiEtiketi = girdi.duzenlendi_mi ? `<span class="badge bg-warning text-dark ms-2">Düzenlendi</span>` : '';
            const cevrimdisiEtiketi = girdi.isOffline ? `<span class="badge bg-info text-dark ms-2" title="İnternet geldiğinde gönderilecek"><i class="bi bi-cloud-upload"></i> Beklemede</span>` : '';

            const currentUserRole = document.body.dataset.userRole;
            let currentUserId = null;
            try { currentUserId = JSON.parse(localStorage.getItem('offlineUser'))?.id; } catch(e) { console.error("Kullanıcı ID alınamadı:", e); }

            // --- GÜNCELLEME: girdiSahibiId'yi doğrudan al ---
            const girdiSahibiId = girdi.kullanici_id; // Backend'den bu ID'nin geldiğini varsayıyoruz
            // --- GÜNCELLEME SONU ---

            // --- HATA AYIKLAMA ---
            // console.log(`Girdi ID: ${girdi.id}, Sahip ID: ${girdiSahibiId}, Mevcut Kullanıcı ID: ${currentUserId}, Rol: ${currentUserRole}, Offline: ${girdi.isOffline}`);
            // --- HATA AYIKLAMA SONU ---

            const canModify = !girdi.isOffline && typeof currentUserId === 'number' && typeof girdiSahibiId === 'number' &&
                              (currentUserRole === 'firma_yetkilisi' || (currentUserRole === 'toplayici' && girdiSahibiId === currentUserId));

            // --- HATA AYIKLAMA ---
            // console.log(`canModify (${girdi.id}): ${canModify}`);
            // --- HATA AYIKLAMA SONU ---

            let actionButtons = canModify ? `
                <button class="btn btn-sm btn-outline-info border-0" title="Düzenle"
                        data-bs-toggle="modal" data-bs-target="#duzenleModal"
                        data-girdi-id="${girdi.id}" data-litre="${girdi.litre}" data-fiyat="${girdi.fiyat}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger border-0" title="Sil"
                        data-bs-toggle="modal" data-bs-target="#silmeOnayModal"
                        data-girdi-id="${girdi.id}">
                    <i class="bi bi-trash"></i>
                </button>` : '';

            // Geçmiş butonu: Sadece online ve ID'si 'offline-' ile başlamayan girdiler için
            const gecmisButonu = !girdi.isOffline && girdi.id && !String(girdi.id).startsWith('offline-')
                ? `<button class="btn btn-sm btn-outline-secondary border-0" title="Geçmişi Gör" onclick="gecmisiGoster(${girdi.id})"><i class="bi bi-clock-history"></i></button>`
                : '';

            const fiyatBilgisi = girdi.fiyat ? `<span class="text-success">@ ${parseFloat(girdi.fiyat).toFixed(2)} TL</span>` : '';
            const kullaniciAdi = girdi.kullanicilar?.kullanici_adi ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : (girdi.isOffline ? 'Siz (Beklemede)' : 'Bilinmiyor'); // Offline için düzeltme
            const tedarikciAdi = girdi.tedarikciler ? utils.sanitizeHTML(girdi.tedarikciler.isim) : 'Bilinmeyen Tedarikçi';


            const girdiElementi = `
                <div class="list-group-item" id="girdi-liste-${girdi.id}">
                    <div class="d-flex w-100 justify-content-between flex-wrap">
                        <h5 class="mb-1 girdi-baslik">${tedarikciAdi} - ${girdi.litre} Litre ${fiyatBilgisi} ${duzenlendiEtiketi} ${cevrimdisiEtiketi}</h5>
                        <div class="btn-group">${actionButtons} ${gecmisButonu}</div>
                    </div>
                    <p class="mb-1 girdi-detay">Toplayan: ${kullaniciAdi} | Saat: ${formatliTarih}</p>
                </div>`;
            listeElementi.innerHTML += girdiElementi;
        });
    },

    /**
     * Girdileri kart formatında (grid) render eder.
     */
    renderGirdilerAsCards(girdiler) {
        const kartListesi = document.getElementById('girdiler-kart-listesi');
         if(!kartListesi) return;
         kartListesi.innerHTML = ''; // Önce temizle

        girdiler.forEach(girdi => {
            let formatliTarih = 'Geçersiz Saat';
             try {
                  const tarihObj = new Date(girdi.taplanma_tarihi);
                  if (!isNaN(tarihObj.getTime())) {
                      formatliTarih = `${String(tarihObj.getHours()).padStart(2, '0')}:${String(tarihObj.getMinutes()).padStart(2, '0')}`;
                  }
             } catch(e) { console.error("Tarih formatlama hatası:", girdi.taplanma_tarihi, e); }

            const duzenlendiEtiketi = girdi.duzenlendi_mi ? `<span class="badge bg-warning text-dark">Düzenlendi</span>` : '';
            const cevrimdisiEtiketi = girdi.isOffline ? `<span class="badge bg-info text-dark" title="Beklemede"><i class="bi bi-cloud-upload"></i></span>` : '';

            const currentUserRole = document.body.dataset.userRole;
            let currentUserId = null;
            try { currentUserId = JSON.parse(localStorage.getItem('offlineUser'))?.id; } catch(e) { console.error("Kullanıcı ID alınamadı:", e); }

            // --- GÜNCELLEME: girdiSahibiId'yi doğrudan al ---
            const girdiSahibiId = girdi.kullanici_id;
            // --- GÜNCELLEME SONU ---

            // --- HATA AYIKLAMA ---
            // console.log(`Girdi ID: ${girdi.id}, Sahip ID: ${girdiSahibiId}, Mevcut Kullanıcı ID: ${currentUserId}, Rol: ${currentUserRole}, Offline: ${girdi.isOffline}`);
            // --- HATA AYIKLAMA SONU ---

            const canModify = !girdi.isOffline && typeof currentUserId === 'number' && typeof girdiSahibiId === 'number' &&
                               (currentUserRole === 'firma_yetkilisi' || (currentUserRole === 'toplayici' && girdiSahibiId === currentUserId));

            // --- HATA AYIKLAMA ---
            // console.log(`canModify (${girdi.id}): ${canModify}`);
            // --- HATA AYIKLAMA SONU ---

            let actionButtons = canModify ? `
                <button class="btn btn-sm btn-outline-primary" title="Düzenle"
                        data-bs-toggle="modal" data-bs-target="#duzenleModal"
                        data-girdi-id="${girdi.id}" data-litre="${girdi.litre}" data-fiyat="${girdi.fiyat}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" title="Sil"
                        data-bs-toggle="modal" data-bs-target="#silmeOnayModal"
                        data-girdi-id="${girdi.id}">
                    <i class="bi bi-trash"></i>
                </button>` : '';

            const gecmisButonu = !girdi.isOffline && girdi.id && !String(girdi.id).startsWith('offline-')
                ? `<button class="btn btn-sm btn-outline-secondary" title="Geçmişi Gör" onclick="gecmisiGoster(${girdi.id})"><i class="bi bi-clock-history"></i></button>`
                : '';

            const tutar = parseFloat(girdi.litre || 0) * parseFloat(girdi.fiyat || 0);
            const kullaniciAdi = girdi.kullanicilar?.kullanici_adi ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : (girdi.isOffline ? 'Siz (Beklemede)' : 'Bilinmiyor'); // Offline için düzeltme
            const tedarikciAdi = girdi.tedarikciler ? utils.sanitizeHTML(girdi.tedarikciler.isim) : 'Bilinmeyen Tedarikçi';

            const kartElementi = `
            <div class="col-xl-6 col-12" id="girdi-kart-${girdi.id}">
                <div class="card p-2 h-100">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="card-title mb-0">${tedarikciAdi}</h6>
                                <small class="text-secondary">Toplayan: ${kullaniciAdi}</small>
                            </div>
                            <div class="d-flex gap-2">${cevrimdisiEtiketi} ${duzenlendiEtiketi}</div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center my-2">
                            <span class="fs-4 fw-bold text-primary">${girdi.litre} L</span>
                            <span class="fs-5 fw-bold text-success">${tutar.toFixed(2)} TL</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                             <small class="text-secondary">Saat: ${formatliTarih}</small>
                             <div class="btn-group btn-group-sm">${actionButtons} ${gecmisButonu}</div>
                        </div>
                    </div>
                </div>
            </div>`;
            kartListesi.innerHTML += kartElementi;
        });
    },

    /**
     * Sayfalama navigasyonunu oluşturur.
     */
    sayfalamaNavOlustur(containerId, toplamOge, aktifSayfa, sayfaBasiOge, sayfaDegistirCallback) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = ''; // Önceki sayfalamayı temizle
        const toplamSayfa = Math.ceil(toplamOge / sayfaBasiOge);
        if (toplamSayfa <= 1) return; // Tek sayfa varsa sayfalama gösterme

        const ul = document.createElement('ul');
        ul.className = 'pagination pagination-sm justify-content-center';

        // Sayfa öğesi oluşturma yardımcı fonksiyonu
        const createPageItem = (page, text, isDisabled = false, isActive = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.innerHTML = text; // HTML içeriği olabileceği için innerHTML
            if (!isDisabled && page > 0 && typeof sayfaDegistirCallback === 'function') {
                a.onclick = (e) => {
                    e.preventDefault();
                    sayfaDegistirCallback(page);
                };
            }
            li.appendChild(a);
            return li;
        };

        // Geri butonu
        ul.appendChild(createPageItem(aktifSayfa - 1, '&laquo;', aktifSayfa === 1));

        // Gösterilecek sayfa numaraları mantığı (mobil uyumlu, az buton)
        const pagesToShow = new Set();
        const sayfaAraligi = 1; // Aktif sayfanın sağında ve solunda kaç buton olacak

        pagesToShow.add(1); // İlk sayfa her zaman görünür
        pagesToShow.add(toplamSayfa); // Son sayfa her zaman görünür

        // Aktif sayfa ve etrafındakiler
        for (let i = -sayfaAraligi; i <= sayfaAraligi; i++) {
            const page = aktifSayfa + i;
            if (page > 0 && page <= toplamSayfa) {
                pagesToShow.add(page);
            }
        }

        let sonEklenenSayfa = 0;
        const siraliSayfalar = Array.from(pagesToShow).sort((a, b) => a - b);

        // Sayfa numaralarını ve aradaki '...'ları ekle
        for (const page of siraliSayfalar) {
            if (sonEklenenSayfa > 0 && page - sonEklenenSayfa > 1) {
                // Arada atlanan sayfalar varsa '...' ekle
                ul.appendChild(createPageItem(0, '...', true));
            }
            ul.appendChild(createPageItem(page, page, false, page === aktifSayfa));
            sonEklenenSayfa = page;
        }

        // İleri butonu
        ul.appendChild(createPageItem(aktifSayfa + 1, '&raquo;', aktifSayfa === toplamSayfa));

        container.appendChild(ul);
    },

    /**
     * Tedarikçi seçim kutusunu (TomSelect) gelen veriyle doldurur.
     */
    doldurTedarikciSecici(tedarikciler) {
        if (!this.tedarikciSecici) return; // Tedarikçi seçici başlatılmamışsa çık
        this.tedarikciSecici.clear();
        this.tedarikciSecici.clearOptions();
        const options = tedarikciler.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.isim) }));
        this.tedarikciSecici.addOptions(options);
    },

    /**
     * Girdiler listesinin başlığını seçilen tarihe göre günceller.
     */
    updateGirdilerBaslik(formatliTarih) {
        const baslik = document.getElementById('girdiler-baslik');
        if (!baslik) return;
        if (typeof utils !== 'undefined' && formatliTarih === utils.getLocalDateString()) {
            baslik.textContent = 'Bugünkü Girdiler';
        } else {
             try {
                 // Tarihi 'GG.AA.YYYY' formatına çevir
                 const [yil, ay, gun] = formatliTarih.split('-');
                 baslik.textContent = `${gun}.${ay}.${yil} Tarihli Girdiler`;
             } catch(e) {
                  baslik.textContent = 'Girdiler'; // Hata olursa varsayılan
             }
        }
    },

    // --- FORM ve MODAL YÖNETİMİ ---

    /**
     * Yeni süt girdisi formundaki değerleri alır.
     */
    getGirdiFormVerisi: () => ({
        tedarikciId: ui.tedarikciSecici ? ui.tedarikciSecici.getValue() : null,
        litre: document.getElementById('litre-input')?.value || '',
        fiyat: document.getElementById('fiyat-input')?.value || '',
    }),

    /**
     * Yeni süt girdisi formunu temizler.
     */
    resetGirdiFormu: () => {
        const litreInput = document.getElementById('litre-input');
        const fiyatInput = document.getElementById('fiyat-input');
        if(litreInput) litreInput.value = '';
        if(fiyatInput) fiyatInput.value = '';
        if(ui.tedarikciSecici) ui.tedarikciSecici.clear();
    },

    /**
     * Yeni girdi kaydetme butonunun durumunu ayarlar.
     */
    toggleGirdiKaydetButton: (isLoading) => {
        const kaydetButton = document.getElementById('kaydet-girdi-btn');
        if(!kaydetButton) return;
        kaydetButton.disabled = isLoading;
        kaydetButton.innerHTML = isLoading ? `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...` : `Kaydet`;
    },

    /**
     * Düzenleme modalındaki formdan verileri alır.
     */
    getDuzenlemeFormVerisi: () => ({
        girdiId: document.getElementById('edit-girdi-id')?.value || null,
        yeniLitre: document.getElementById('edit-litre-input')?.value || '',
        yeniFiyat: document.getElementById('edit-fiyat-input')?.value || '',
        duzenlemeSebebi: document.getElementById('edit-sebep-input')?.value.trim() || '',
    }),

    /**
     * Silme onay modalındaki gizli inputtan silinecek girdi ID'sini alır.
     */
    getSilinecekGirdiId: () => document.getElementById('silinecek-girdi-id')?.value || null,

    /**
     * Girdi geçmişi modalının içeriğini render eder.
     */
    renderGecmisModalContent(gecmisKayitlari, isLoading = false, error = null) {
        const modalBody = document.getElementById('gecmis-modal-body');
        if (!modalBody) return;

        if (isLoading) {
            modalBody.innerHTML = '<div class="text-center p-4"><div class="spinner-border"></div></div>';
            return;
        }
        if (error) {
            modalBody.innerHTML = `<p class="text-danger p-3">Geçmiş yüklenemedi: ${utils.sanitizeHTML(error)}</p>`;
            return;
        }
        if (!gecmisKayitlari || gecmisKayitlari.length === 0) {
            modalBody.innerHTML = '<p class="p-3 text-secondary">Bu girdi için düzenleme geçmişi bulunamadı.</p>';
            return;
        }

        let content = '<ul class="list-group list-group-flush">';
        gecmisKayitlari.forEach(kayit => {
            let tarihStr = "Geçersiz Tarih";
            try {
                 tarihStr = new Date(kayit.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short'});
            } catch(e) {/* Hata olursa varsayılan kalır */}

            const eskiFiyatBilgisi = kayit.eski_fiyat_degeri ? ` | <span class="text-warning">Eski Fiyat:</span> ${parseFloat(kayit.eski_fiyat_degeri).toFixed(2)} TL` : '';
            const duzenleyen = kayit.duzenleyen_kullanici_id?.kullanici_adi ? utils.sanitizeHTML(kayit.duzenleyen_kullanici_id.kullanici_adi) : 'Bilinmiyor';
            const sebep = kayit.duzenleme_sebebi ? utils.sanitizeHTML(kayit.duzenleme_sebebi) : '-';

            content += `<li class="list-group-item">
                            <p class="mb-1 small text-secondary">${tarihStr} - ${duzenleyen}</p>
                            <p class="mb-1"><span class="text-warning">Eski Litre:</span> ${kayit.eski_litre_degeri} Litre ${eskiFiyatBilgisi}</p>
                            <p class="mb-0"><span class="text-info">Sebep:</span> ${sebep}</p>
                        </li>`;
        });
        modalBody.innerHTML = content + '</ul>';
    },

    /**
     * Şifre değiştirme modalını açar.
     */
    sifreDegistirmeAc() {
        if (!this.sifreDegistirModal) {
             console.error("Şifre Değiştirme Modalı (sifreDegistirModal) başlatılmamış!");
             gosterMesaj("Şifre değiştirme penceresi başlatılamadı.", "danger");
             return;
        }
        this.sifreDegistirModal.show();
    },

    /**
     * Şifre değiştirme modalındaki form verilerini alır.
     */
    getSifreDegistirmeFormVerisi: () => ({
        mevcutSifre: document.getElementById('mevcut-sifre-input')?.value || '',
        yeniSifre: document.getElementById('kullanici-yeni-sifre-input')?.value || '',
        yeniSifreTekrar: document.getElementById('kullanici-yeni-sifre-tekrar-input')?.value || ''
    }),

    /**
     * Çevrimdışı kayıt yapmadan önce kullanıcının lisansının geçerli olup olmadığını kontrol eder.
     */
    async checkOfflineUserLicense() {
        const offlineUserString = localStorage.getItem('offlineUser');
        if (offlineUserString) {
            try {
                const user = JSON.parse(offlineUserString);
                const lisansBitisStr = user.lisans_bitis_tarihi;
                if (lisansBitisStr && lisansBitisStr !== 'None') {
                     const lisansBitisTarihi = new Date(lisansBitisStr);
                     if (isNaN(lisansBitisTarihi.getTime())) {
                          gosterMesaj('Lisans tarihiniz geçersiz, çevrimdışı kayıt yapılamaz.', 'danger');
                          return false;
                     }
                    if (new Date() > lisansBitisTarihi) {
                        gosterMesaj('Lisansınızın süresi dolduğu için çevrimdışı kayıt yapamazsınız.', 'danger');
                        return false;
                    }
                } else {
                    gosterMesaj('Geçerli bir lisans bulunamadığı için çevrimdışı kayıt yapamazsınız.', 'danger');
                    return false;
                }
            } catch (e) {
                 console.error("Çevrimdışı kullanıcı verisi okunurken hata:", e);
                 gosterMesaj('Çevrimdışı kullanıcı verisi okunamadı, kayıt yapılamaz.', 'danger');
                 return false;
            }
        } else {
            gosterMesaj('Çevrimdışı kayıt için kullanıcı bilgisi bulunamadı. Lütfen önce online giriş yapın.', 'danger');
            return false;
        }
        return true;
    }
};

// Global scope'da olması gereken fonksiyonlar (onclick ile çağrılanlar)
/**
 * Girdi geçmişi modalını açar ve içeriğini yükler.
 * @param {number} girdiId - Geçmişi gösterilecek girdinin ID'si.
 */
async function gecmisiGoster(girdiId) {
    // ui objesinin ve modalın varlığını kontrol et
    if(typeof ui === 'undefined' || !ui.gecmisModal) {
        console.error("Geçmiş modalı başlatılmamış veya ui objesi bulunamadı!");
        gosterMesaj("Geçmiş penceresi açılamadı.", "danger");
        return;
    }
    ui.renderGecmisModalContent(null, true); // Spinner göster
    ui.gecmisModal.show();
    try {
        // api objesinin varlığını kontrol et (api.js'den gelmeli)
        if (typeof api === 'undefined' || typeof api.fetchGirdiGecmisi !== 'function') {
            throw new Error("API fonksiyonları yüklenemedi.");
        }
        const gecmisKayitlari = await api.fetchGirdiGecmisi(girdiId);
        ui.renderGecmisModalContent(gecmisKayitlari); // Veri gelince içeriği doldur
    } catch (error) {
        ui.renderGecmisModalContent(null, false, error.message); // Hata göster
    }
}

// Not: sutGirdisiDuzenle, sutGirdisiSil fonksiyonları main.js içinde tanımlıdır
// ve bu dosyadaki ui objesini kullanırlar.

