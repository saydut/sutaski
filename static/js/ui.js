// ====================================================================================
// ARAYÜZ YÖNETİMİ (ui.js) - GÜNCELLENMİŞ VERSİYON
// Modal Yönetimi modal-handler.js'e taşındı.
// HTML OLUŞTURMA İŞİ render-utils.js'e TAŞINDI.
// Sadece temel UI yardımcıları ve durum yönetimi kaldı.
// ====================================================================================

// renderUtils objesinin render-utils.js'den geldiğini varsayıyoruz
if (typeof renderUtils === 'undefined') {
    console.error("ui.js: renderUtils objesi bulunamadı. render-utils.js yüklendi mi?");
}
// utils objesinin utils.js'den geldiğini varsayıyoruz
if (typeof utils === 'undefined') {
    console.error("ui.js: utils objesi bulunamadı. utils.js yüklendi mi?");
}


/**
 * Kullanıcıya dinamik olarak bir mesaj gösterir.
 * @param {string} mesaj - Gösterilecek mesaj (HTML içerebilir).
 * @param {string} tip - Alert tipi ('success', 'info', 'warning', 'danger').
 * @param {number} sure - Mesajın ekranda kalma süresi (milisaniye).
 * @param {boolean} allowHTML - Mesajın HTML olarak yorumlanıp yorumlanmayacağı.
 */
function gosterMesaj(mesaj, tip = 'info', sure = 5000, allowHTML = false) { // YENİ: allowHTML eklendi
    const container = document.getElementById('alert-container');
    if (!container) {
        console.error("'alert-container' ID'li element sayfada bulunamadı.");
        return;
    }
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tip} alert-dismissible fade show m-0`;
    alertDiv.role = 'alert';
    const messageSpan = document.createElement('span');
    
    // YENİ: Güvenlik kontrolü
    if (allowHTML) {
        messageSpan.innerHTML = mesaj; // Dikkat: Sadece güvenli HTML için kullanılmalı
    } else {
        messageSpan.textContent = mesaj; // Varsayılan: Güvenli
    }
    
    alertDiv.appendChild(messageSpan);
    alertDiv.insertAdjacentHTML('beforeend', '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>');
    container.appendChild(alertDiv);
    const bsAlert = new bootstrap.Alert(alertDiv);
    const timeoutId = setTimeout(() => {
        if (alertDiv.parentNode === container) bsAlert.close();
    }, sure);
    alertDiv.addEventListener('closed.bs.alert', () => {
        clearTimeout(timeoutId);
        if (alertDiv.parentNode === container) container.removeChild(alertDiv);
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
    // Bu fonksiyon aynı kalıyor.
    if (!element) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        let currentValue = easedProgress * finalValue;
        if (Math.abs(currentValue) < 1e-6) currentValue = 0;
        element.textContent = currentValue.toFixed(decimalPlaces).replace('.', ',') + suffix;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = finalValue.toFixed(decimalPlaces).replace('.', ',') + suffix;
        }
    };
    window.requestAnimationFrame(step);
}


const ui = {
    // Modal instance'ları kaldırıldı (modal-handler.js'e taşındı)

    // Diğer UI elemanları (ilgili JS dosyalarında atanacak)
    tarihFiltreleyici: null,
    tedarikciSecici: null,
    tumTedarikciler: [],

    /**
     * Sayfa yüklendiğinde çağrılır (artık modal başlatmıyor).
     */
    init() {
        console.log("ui.init() çağrıldı (Sadece temel kontroller).");
        // Modal başlatma kodları kaldırıldı.
        // Gerekirse diğer genel UI başlatmaları buraya eklenebilir.
    },

    /**
     * Lisans bitiş tarihini kontrol eder ve gerekirse bir uyarı mesajı gösterir.
     */
    lisansUyarisiKontrolEt() {
        // Bu fonksiyon aynı kalıyor.
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
                gosterMesaj(`<strong>Dikkat:</strong> Şirketinizin lisans süresi ${Math.abs(gunFarki)} gün önce dolmuştur! Lütfen yöneticinizle iletişime geçin.`, 'danger', 10000, true); // YENİ: allowHTML: true
            } else if (gunFarki <= 30) {
                gosterMesaj(`<strong>Bilgi:</strong> Şirketinizin lisans süresinin dolmasına ${gunFarki} gün kaldı.`, 'warning', 10000, true); // YENİ: allowHTML: true
            }
        } catch (e) {
             console.error("Lisans tarihi kontrol hatası:", e);
        }
    },


    /**
     * Özet panellerindeki (toplam litre/girdi) yükleniyor animasyonunu açar/kapatır.
     */
    toggleOzetPanelsLoading(isLoading) {
        // Bu fonksiyon aynı kalıyor.
        const toplamLitrePanel = document.getElementById('toplam-litre-panel');
        const girdiSayisiPanel = document.getElementById('bugunku-girdi-sayisi');
        if (isLoading) {
            if(toplamLitrePanel) toplamLitrePanel.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
            if(girdiSayisiPanel) girdiSayisiPanel.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
        }
    },

    /**
     * Özet panellerini gelen veriyle günceller ve sayıları animasyonlu gösterir.
     */
    updateOzetPanels(data, effectiveDate, isError = false) {
        // Bu fonksiyon aynı kalıyor.
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
        } else if (toplamLitrePanel && girdiSayisiPanel){
             animateCounter(toplamLitrePanel, 0, 500, ' L', 2);
             animateCounter(girdiSayisiPanel, 0, 500, '', 0);
        }
    },

    /**
     * Girdiler listesi için mevcut görünüme uygun bir yükleniyor iskeleti gösterir.
     */
    showGirdilerLoadingSkeleton(gorunum) {
        // Bu fonksiyon aynı kalıyor.
        const listeContainer = document.getElementById('girdiler-listesi');
        const kartContainer = document.getElementById('girdiler-kart-listesi');
        const veriYokMesaji = document.getElementById('veri-yok-mesaji');
        const girdilerSayfaBasi = 6;

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
        } else {
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
     */
    mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, tarih) {
        // Bu fonksiyon aynı kalıyor.
        let tumGirdiler = sunucuVerisi.girdiler || [];
        let toplamGirdi = sunucuVerisi.toplam_girdi_sayisi || 0;

        if (bekleyenGirdiler && bekleyenGirdiler.length > 0 && typeof utils !== 'undefined' && tarih === utils.getLocalDateString(new Date())) {
            const islenmisBekleyenler = bekleyenGirdiler.map(girdi => {
                const tedarikci = this.tumTedarikciler.find(t => t.id === girdi.tedarikci_id);
                return {
                    id: `offline-${girdi.id}`, litre: girdi.litre, fiyat: girdi.fiyat,
                    taplanma_tarihi: girdi.eklendigi_zaman, duzenlendi_mi: false,
                    isOffline: true, kullanicilar: { kullanici_adi: 'Siz (Beklemede)' },
                    tedarikciler: { isim: tedarikci ? utils.sanitizeHTML(tedarikci.isim) : `Bilinmeyen (ID: ${girdi.tedarikci_id})` }
                };
            });
            tumGirdiler = [...islenmisBekleyenler.reverse(), ...tumGirdiler];
            toplamGirdi += islenmisBekleyenler.length;
        }
        return { tumGirdiler, toplamGirdi };
    },

    /**
     * Girdileri seçilen görünüme göre yönlendiren ana render fonksiyonu.
     * Artık render-utils.js'i kullanıyor.
     */
    renderGirdiler(girdiler, gorunum) {
        // Bu fonksiyon aynı kalıyor (render-utils.js'i kullanıyor).
        const veriYokMesaji = document.getElementById('veri-yok-mesaji');
        const listeListesi = document.getElementById('girdiler-listesi');
        const kartListesi = document.getElementById('girdiler-kart-listesi');

        if (typeof renderUtils === 'undefined') {
            console.error("renderUtils objesi 'renderGirdiler' içinde bulunamadı.");
            if (veriYokMesaji) { veriYokMesaji.textContent = 'Arayüz oluşturulamadı.'; veriYokMesaji.style.display = 'block'; }
            if(listeListesi) listeListesi.innerHTML = ''; if(kartListesi) kartListesi.innerHTML = ''; return;
        }
        if(listeListesi) listeListesi.innerHTML = ''; if(kartListesi) kartListesi.innerHTML = '';
        if (!girdiler || girdiler.length === 0) {
            if(veriYokMesaji) { veriYokMesaji.textContent = 'Bu tarih için girdi bulunamadı.'; veriYokMesaji.style.display = 'block'; } return;
        }
       if(veriYokMesaji) veriYokMesaji.style.display = 'none';

        if (gorunum === 'liste') {
            if (listeListesi && typeof renderUtils.renderSutGirdileriAsList === 'function') {
                listeListesi.innerHTML = renderUtils.renderSutGirdileriAsList(girdiler);
            } else if(listeListesi) { listeListesi.innerHTML = '<p class="text-danger">Liste oluşturma fonksiyonu bulunamadı.</p>'; }
        } else {
            if (kartListesi && typeof renderUtils.renderSutGirdileriAsCards === 'function') {
                kartListesi.innerHTML = renderUtils.renderSutGirdileriAsCards(girdiler);
            } else if(kartListesi) { kartListesi.innerHTML = '<p class="text-danger">Kart oluşturma fonksiyonu bulunamadı.</p>'; }
        }
    },

    // renderGirdilerAsList fonksiyonu kaldırıldı.
    // renderGirdilerAsCards fonksiyonu kaldırıldı.

    /**
     * Sayfalama navigasyonunu oluşturur.
     */
    sayfalamaNavOlustur(containerId, toplamOge, aktifSayfa, sayfaBasiOge, sayfaDegistirCallback) {
        // Bu fonksiyon aynı kalıyor.
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        const toplamSayfa = Math.ceil(toplamOge / sayfaBasiOge);
        if (toplamSayfa <= 1) return;
        const ul = document.createElement('ul');
        ul.className = 'pagination pagination-sm justify-content-center';
        const createPageItem = (page, text, isDisabled = false, isActive = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            const a = document.createElement('a'); a.className = 'page-link'; a.href = '#'; a.innerHTML = text;
            if (!isDisabled && page > 0 && typeof sayfaDegistirCallback === 'function') {
                a.onclick = (e) => { e.preventDefault(); sayfaDegistirCallback(page); };
            } li.appendChild(a); return li;
        };
        ul.appendChild(createPageItem(aktifSayfa - 1, '&laquo;', aktifSayfa === 1));
        const pagesToShow = new Set(); const sayfaAraligi = 1;
        pagesToShow.add(1); pagesToShow.add(toplamSayfa);
        for (let i = -sayfaAraligi; i <= sayfaAraligi; i++) {
            const page = aktifSayfa + i; if (page > 0 && page <= toplamSayfa) pagesToShow.add(page);
        }
        let sonEklenenSayfa = 0; const siraliSayfalar = Array.from(pagesToShow).sort((a, b) => a - b);
        for (const page of siraliSayfalar) {
            if (sonEklenenSayfa > 0 && page - sonEklenenSayfa > 1) ul.appendChild(createPageItem(0, '...', true));
            ul.appendChild(createPageItem(page, page, false, page === aktifSayfa)); sonEklenenSayfa = page;
        }
        ul.appendChild(createPageItem(aktifSayfa + 1, '&raquo;', aktifSayfa === toplamSayfa));
        container.appendChild(ul);
    },

    /**
     * Tedarikçi seçim kutusunu (TomSelect) gelen veriyle doldurur.
     */
    doldurTedarikciSecici(tedarikciler) {
        // Bu fonksiyon aynı kalıyor.
        if (!this.tedarikciSecici) return;
        this.tedarikciSecici.clear();
        this.tedarikciSecici.clearOptions();
        const options = tedarikciler.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.isim) }));
        this.tedarikciSecici.addOptions(options);
    },

    /**
     * Girdiler listesinin başlığını seçilen tarihe göre günceller.
     */
    updateGirdilerBaslik(formatliTarih) {
        // Bu fonksiyon aynı kalıyor.
        const baslik = document.getElementById('girdiler-baslik');
        if (!baslik) return;
        if (typeof utils !== 'undefined' && formatliTarih === utils.getLocalDateString()) {
            baslik.textContent = 'Bugünkü Girdiler';
        } else {
             try {
                 const [yil, ay, gun] = formatliTarih.split('-');
                 baslik.textContent = `${gun}.${ay}.${yil} Tarihli Girdiler`;
             } catch(e) { baslik.textContent = 'Girdiler'; }
        }
    },

    // --- FORM ve MODAL YÖNETİMİ ---

    /**
     * Yeni süt girdisi formundaki değerleri alır.
     */
    getGirdiFormVerisi: () => ({
        // Bu fonksiyon aynı kalıyor.
        tedarikciId: ui.tedarikciSecici ? ui.tedarikciSecici.getValue() : null,
        litre: document.getElementById('litre-input')?.value || '',
        fiyat: document.getElementById('fiyat-input')?.value || '',
    }),

    /**
     * Yeni süt girdisi formunu temizler.
     */
    resetGirdiFormu: () => {
        // Bu fonksiyon aynı kalıyor.
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
        // Bu fonksiyon aynı kalıyor.
        const kaydetButton = document.getElementById('kaydet-girdi-btn');
        if(!kaydetButton) return;
        kaydetButton.disabled = isLoading;
        kaydetButton.innerHTML = isLoading ? `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...` : `Kaydet`;
    },

    /**
     * Düzenleme modalındaki formdan verileri alır.
     */
    getDuzenlemeFormVerisi: () => ({
        // Bu fonksiyon aynı kalıyor.
        girdiId: document.getElementById('edit-girdi-id')?.value || null,
        yeniLitre: document.getElementById('edit-litre-input')?.value || '',
        yeniFiyat: document.getElementById('edit-fiyat-input')?.value || '',
        duzenlemeSebebi: document.getElementById('edit-sebep-input')?.value.trim() || '',
    }),

    /**
     * Silme onay modalındaki gizli inputtan silinecek girdi ID'sini alır.
     */
    getSilinecekGirdiId: () => document.getElementById('silinecek-girdi-id')?.value || null,

    // renderGecmisModalContent fonksiyonu kaldırıldı (modal-handler.js'e taşındı).
    // sifreDegistirmeAc fonksiyonu kaldırıldı (modal-handler.js'e taşındı).
    // getSifreDegistirmeFormVerisi fonksiyonu kaldırıldı (modal-handler.js'e taşındı).

    /**
     * Çevrimdışı kayıt yapmadan önce kullanıcının lisansının geçerli olup olmadığını kontrol eder.
     */
    async checkOfflineUserLicense() {
        // Bu fonksiyon aynı kalıyor.
        const offlineUserString = localStorage.getItem('offlineUser');
        if (offlineUserString) {
            try {
                const user = JSON.parse(offlineUserString);
                const lisansBitisStr = user.lisans_bitis_tarihi;
                if (lisansBitisStr && lisansBitisStr !== 'None') {
                     const lisansBitisTarihi = new Date(lisansBitisStr);
                     if (isNaN(lisansBitisTarihi.getTime())) {
                          gosterMesaj('Lisans tarihiniz geçersiz, çevrimdışı kayıt yapılamaz.', 'danger'); return false;
                     }
                    if (new Date() > lisansBitisTarihi) {
                        gosterMesaj('Lisansınızın süresi dolduğu için çevrimdışı kayıt yapamazsınız.', 'danger'); return false;
                    }
                } else {
                    gosterMesaj('Geçerli bir lisans bulunamadığı için çevrimdışı kayıt yapamazsınız.', 'danger'); return false;
                }
            } catch (e) {
                 console.error("Çevrimdışı kullanıcı verisi okunurken hata:", e);
                 gosterMesaj('Çevrimdışı kullanıcı verisi okunamadı, kayıt yapılamaz.', 'danger'); return false;
            }
        } else {
            gosterMesaj('Çevrimdışı kayıt için kullanıcı bilgisi bulunamadı. Lütfen önce online giriş yapın.', 'danger'); return false;
        }
        return true;
    }
};

// Global scope'daki gecmisiGoster fonksiyonu kaldırıldı (modal-handler.js'e taşındı).