// ====================================================================================
// ARAYÜZ YÖNETİMİ (ui.js)
// ====================================================================================

/**
 * Kullanıcıya dinamik olarak bir mesaj gösterir.
 */
function gosterMesaj(mesaj, tip = 'info', sure = 5000) {
    const container = document.getElementById('alert-container');
    if (!container) {
        console.error("'alert-container' ID'li element sayfada bulunamadı.");
        return;
    }
    // Önceki mesajları temizle (isteğe bağlı, çok fazla mesaj birikmesini önler)
    // container.innerHTML = '';
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
    setTimeout(() => {
        // Element hala DOM'da ise kapat
        if (alertDiv.parentNode === container) {
            bsAlert.close();
        }
    }, sure);

    // Kapatma butonu tıklandığında veya süre dolduğunda DOM'dan tamamen kaldır
    alertDiv.addEventListener('closed.bs.alert', () => {
        if (alertDiv.parentNode === container) {
            container.removeChild(alertDiv);
        }
    });
}


/**
 * Bir sayıyı 0'dan hedef değere doğru animasyonla artırır.
 */
function animateCounter(element, finalValue, duration = 1200, suffix = '', decimalPlaces = 0) {
    if (!element) return; // Element yoksa çık
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easedProgress = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        const currentValue = easedProgress * finalValue;

        element.textContent = currentValue.toFixed(decimalPlaces).replace('.', ',') + suffix;

        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}


const ui = {
    // Modal ve kütüphane instance'ları (başlangıçta null)
    duzenleModal: null,
    gecmisModal: null,
    silmeOnayModal: null,
    veriOnayModal: null, // Ana panel için veri onay modalı
    sifreDegistirModal: null, // base.html'deki genel şifre modalı
    tarihFiltreleyici: null, // Ana panel tarih filtresi
    tedarikciSecici: null, // Ana panel tedarikçi seçici
    tumTedarikciler: [],

    /**
     * Sayfa yüklendiğinde gerekli tüm UI bileşenlerini başlatır.
     * Bu fonksiyon ilgili sayfanın .js dosyasındaki onload içinde çağrılır.
     * Sadece o sayfada var olan elementleri başlatır.
     */
    init() {
        console.log("ui.init() çağrıldı."); // Çalıştığını kontrol et
        // Sadece var olan modalları başlatmayı dene
        const duzenleModalEl = document.getElementById('duzenleModal');
        const gecmisModalEl = document.getElementById('gecmisModal');
        const silmeOnayModalEl = document.getElementById('silmeOnayModal');
        const veriOnayModalEl = document.getElementById('veriOnayModal');
        const sifreDegistirModalEl = document.getElementById('sifreDegistirModal'); // base.html'den gelen

        if (duzenleModalEl) {
            this.duzenleModal = new bootstrap.Modal(duzenleModalEl);
            console.log("Duzenle Modal başlatıldı.");
        }
        if (gecmisModalEl) {
            this.gecmisModal = new bootstrap.Modal(gecmisModalEl);
            console.log("Gecmis Modal başlatıldı.");
        }
        if (silmeOnayModalEl) {
            this.silmeOnayModal = new bootstrap.Modal(silmeOnayModalEl);
             console.log("Silme Onay Modal başlatıldı.");
        }
         if (veriOnayModalEl) {
            // Bu modal main.js içinde ayrıca başlatılıyor, çift başlatmayı önle
            if (!window.veriOnayModal) { // window global scope'unu kullanabiliriz
                 window.veriOnayModal = new bootstrap.Modal(veriOnayModalEl);
                 console.log("Veri Onay Modal başlatıldı (ui.init).");
            }
        }
        if (sifreDegistirModalEl) {
            this.sifreDegistirModal = new bootstrap.Modal(sifreDegistirModalEl);
             console.log("Şifre Değiştir Modal başlatıldı.");
        }

        // Ana panele özel Flatpickr ve TomSelect başlatmaları main.js'e taşındı.
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
            // Tarih geçerli değilse veya 'Invalid Date' ise çık
             if (isNaN(lisansBitisTarihi.getTime())) {
                 console.warn("Geçersiz lisans bitiş tarihi formatı:", lisansBitisStr);
                 return;
             }
            const bugun = new Date();
            // Saat farklarını hesaba katmadan sadece tarihleri karşılaştır
            lisansBitisTarihi.setHours(0, 0, 0, 0);
            bugun.setHours(0, 0, 0, 0);

            const gunFarki = Math.ceil((lisansBitisTarihi.getTime() - bugun.getTime()) / (1000 * 3600 * 24));

            if (gunFarki < 0) { // Artık tam olarak geçmiş mi kontrol et
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
        // Kapatma kısmı updateOzetPanels içinde yapılıyor
    },

    /**
     * Özet panellerini gelen veriyle günceller ve sayıları animasyonlu gösterir.
     */
    updateOzetPanels(data, effectiveDate, isError = false) {
        const toplamLitrePanel = document.getElementById('toplam-litre-panel');
        const girdiSayisiPanel = document.getElementById('bugunku-girdi-sayisi');
        const ozetBaslik = document.getElementById('ozet-panel-baslik');
        const girdiSayisiBaslik = document.getElementById('girdi-sayisi-baslik');

        if(ozetBaslik && girdiSayisiBaslik){
            const bugun = utils.getLocalDateString();
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
        const girdilerSayfaBasi = 6;

        if(listeContainer) listeContainer.innerHTML = '';
        if(kartContainer) kartContainer.innerHTML = '';
        if(veriYokMesaji) veriYokMesaji.style.display = 'none';

        const skeletonItemCount = girdilerSayfaBasi; // Kaç tane iskelet gösterilecek

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
     */
    mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, tarih) {
        let tumGirdiler = sunucuVerisi.girdiler || [];
        let toplamGirdi = sunucuVerisi.toplam_girdi_sayisi || 0;

        // Sadece bugünün tarihi için çevrimdışı girdileri ekle
        if (bekleyenGirdiler && bekleyenGirdiler.length > 0 && tarih === utils.getLocalDateString(new Date())) {
            const islenmisBekleyenler = bekleyenGirdiler.map(girdi => {
                // this.tumTedarikciler listesinin dolu olduğunu varsayıyoruz (main.js'de yüklenmeli)
                const tedarikci = this.tumTedarikciler.find(t => t.id === girdi.tedarikci_id);
                return {
                    id: `offline-${girdi.id}`, // Benzersiz ID
                    litre: girdi.litre,
                    fiyat: girdi.fiyat,
                    taplanma_tarihi: girdi.eklendigi_zaman, // Eklendiği zaman
                    duzenlendi_mi: false,
                    isOffline: true, // Çevrimdışı olduğunu belirt
                    kullanicilar: { kullanici_adi: 'Siz (Beklemede)' },
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
        girdiler.forEach(girdi => {
            let formatliTarih = 'Geçersiz Saat';
            let tarihObj = null;
            try {
                 tarihObj = new Date(girdi.taplanma_tarihi);
                 if (!isNaN(tarihObj.getTime())) {
                     formatliTarih = `${String(tarihObj.getHours()).padStart(2, '0')}:${String(tarihObj.getMinutes()).padStart(2, '0')}`;
                 }
            } catch(e) { /* Hata olursa varsayılan kalır */ }

            const duzenlendiEtiketi = girdi.duzenlendi_mi ? `<span class="badge bg-warning text-dark ms-2">Düzenlendi</span>` : '';
            const cevrimdisiEtiketi = girdi.isOffline ? `<span class="badge bg-info text-dark ms-2" title="İnternet geldiğinde gönderilecek"><i class="bi bi-cloud-upload"></i> Beklemede</span>` : '';
            // Butonları sadece online ve muhasebeci olmayanlar için göster
            // YENİ: Firma Yetkilisi HERKESİNKİNİ, Toplayıcı SADECE KENDİSİNİ düzenleyebilmeli/silebilmeli
            const currentUserRole = document.body.dataset.userRole;
            const currentUserId = JSON.parse(localStorage.getItem('offlineUser'))?.id; // Offline user ID'si
            const canModify = !girdi.isOffline &&
                              (currentUserRole === 'firma_yetkilisi' ||
                               (currentUserRole === 'toplayici' && girdi.kullanicilar.kullanici_id === currentUserId)); // Kullanıcı ID karşılaştırması eklendi (kullanicilar.kullanici_id DB'den gelmeli)


            let actionButtons = canModify ? `
                <button class="btn btn-sm btn-outline-info border-0" title="Düzenle" onclick="ui.duzenlemeModaliniAc(${girdi.id}, ${girdi.litre}, ${girdi.fiyat})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger border-0" title="Sil" onclick="ui.silmeOnayiAc(${girdi.id})"><i class="bi bi-trash"></i></button>` : '';

            // Geçmiş butonu sadece online girdiler için
            const gecmisButonu = !girdi.isOffline ? `<button class="btn btn-sm btn-outline-secondary border-0" title="Geçmişi Gör" onclick="gecmisiGoster(${girdi.id})"><i class="bi bi-clock-history"></i></button>` : '';
            const fiyatBilgisi = girdi.fiyat ? `<span class="text-success">@ ${parseFloat(girdi.fiyat).toFixed(2)} TL</span>` : '';
            const kullaniciAdi = girdi.kullanicilar ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : 'Bilinmiyor';
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
        girdiler.forEach(girdi => {
            let formatliTarih = 'Geçersiz Saat';
             let tarihObj = null;
             try {
                  tarihObj = new Date(girdi.taplanma_tarihi);
                  if (!isNaN(tarihObj.getTime())) {
                      formatliTarih = `${String(tarihObj.getHours()).padStart(2, '0')}:${String(tarihObj.getMinutes()).padStart(2, '0')}`;
                  }
             } catch(e) { /* Hata olursa varsayılan kalır */ }

            const duzenlendiEtiketi = girdi.duzenlendi_mi ? `<span class="badge bg-warning text-dark">Düzenlendi</span>` : '';
            const cevrimdisiEtiketi = girdi.isOffline ? `<span class="badge bg-info text-dark" title="Beklemede"><i class="bi bi-cloud-upload"></i></span>` : '';
             // Yetki kontrolü (yukarıdakiyle aynı)
             const currentUserRole = document.body.dataset.userRole;
             const currentUserId = JSON.parse(localStorage.getItem('offlineUser'))?.id;
             const canModify = !girdi.isOffline &&
                               (currentUserRole === 'firma_yetkilisi' ||
                                (currentUserRole === 'toplayici' && girdi.kullanicilar.kullanici_id === currentUserId));


            let actionButtons = canModify ? `
                <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="ui.duzenlemeModaliniAc(${girdi.id}, ${girdi.litre}, ${girdi.fiyat})"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="ui.silmeOnayiAc(${girdi.id})"><i class="bi bi-trash"></i></button>` : '';
            const gecmisButonu = !girdi.isOffline ? `<button class="btn btn-sm btn-outline-secondary" title="Geçmişi Gör" onclick="gecmisiGoster(${girdi.id})"><i class="bi bi-clock-history"></i></button>` : '';
            const tutar = parseFloat(girdi.litre || 0) * parseFloat(girdi.fiyat || 0);
            const kullaniciAdi = girdi.kullanicilar ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : 'Bilinmiyor';
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
        // ... (Bu fonksiyonun içeriği önceki mesajdaki gibi aynı kalabilir) ...
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
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.innerHTML = text;
            if (!isDisabled && page > 0 && typeof sayfaDegistirCallback === 'function') {
                a.onclick = (e) => {
                    e.preventDefault();
                    sayfaDegistirCallback(page);
                };
            }
            li.appendChild(a);
            return li;
        };

        ul.appendChild(createPageItem(aktifSayfa - 1, '&laquo;', aktifSayfa === 1));

        const pagesToShow = new Set();
        const sayfaAraligi = 1; // Mobil için daha az buton gösterelim

        pagesToShow.add(1);
        pagesToShow.add(toplamSayfa);

        for (let i = -sayfaAraligi; i <= sayfaAraligi; i++) {
            const page = aktifSayfa + i;
            if (page > 0 && page <= toplamSayfa) {
                pagesToShow.add(page);
            }
        }

        let sonEklenenSayfa = 0;
        const siraliSayfalar = Array.from(pagesToShow).sort((a, b) => a - b);

        for (const page of siraliSayfalar) {
            if (sonEklenenSayfa > 0 && page - sonEklenenSayfa > 1) {
                ul.appendChild(createPageItem(0, '...', true));
            }
            ul.appendChild(createPageItem(page, page, false, page === aktifSayfa));
            sonEklenenSayfa = page;
        }

        ul.appendChild(createPageItem(aktifSayfa + 1, '&raquo;', aktifSayfa === toplamSayfa));

        container.appendChild(ul);
    },

    /**
     * Tedarikçi seçim kutusunu (TomSelect) gelen veriyle doldurur.
     */
    doldurTedarikciSecici(tedarikciler) {
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
        const baslik = document.getElementById('girdiler-baslik');
        if (!baslik) return;
        if (formatliTarih === utils.getLocalDateString()) {
            baslik.textContent = 'Bugünkü Girdiler';
        } else {
             try {
                 const [yil, ay, gun] = formatliTarih.split('-');
                 baslik.textContent = `${gun}.${ay}.${yil} Tarihli Girdiler`;
             } catch(e) {
                  baslik.textContent = 'Girdiler';
             }
        }
    },

    // --- FORM ve MODAL YÖNETİMİ ---

    getGirdiFormVerisi: () => ({
        tedarikciId: ui.tedarikciSecici ? ui.tedarikciSecici.getValue() : null,
        litre: document.getElementById('litre-input') ? document.getElementById('litre-input').value : '',
        fiyat: document.getElementById('fiyat-input') ? document.getElementById('fiyat-input').value : '',
    }),

    resetGirdiFormu: () => {
        const litreInput = document.getElementById('litre-input');
        const fiyatInput = document.getElementById('fiyat-input');
        if(litreInput) litreInput.value = '';
        if(fiyatInput) fiyatInput.value = '';
        if(ui.tedarikciSecici) ui.tedarikciSecici.clear();
    },

    toggleGirdiKaydetButton: (isLoading) => {
        const kaydetButton = document.querySelector('#kaydet-girdi-btn'); // ID değiştirildi
        if(!kaydetButton) return;
        kaydetButton.disabled = isLoading;
        kaydetButton.innerHTML = isLoading ? `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...` : `Kaydet`;
    },

    duzenlemeModaliniAc(girdiId, mevcutLitre, mevcutFiyat) {
        console.log("duzenlemeModaliniAc çağrıldı", girdiId); // Log eklendi
        const idInput = document.getElementById('edit-girdi-id');
        const litreInput = document.getElementById('edit-litre-input');
        const fiyatInput = document.getElementById('edit-fiyat-input');
        const sebepInput = document.getElementById('edit-sebep-input');

        if (!idInput || !litreInput || !fiyatInput || !sebepInput) {
             console.error("Düzenleme modalı içindeki elementler bulunamadı!");
             gosterMesaj("Düzenleme penceresi açılamadı.", "danger");
             return;
        }
        if (!this.duzenleModal) {
             console.error("Düzenleme modalı (duzenleModal) başlatılmamış!");
             gosterMesaj("Düzenleme penceresi başlatılamadı.", "danger");
             return;
        }

        idInput.value = girdiId;
        litreInput.value = mevcutLitre;
        fiyatInput.value = mevcutFiyat;
        sebepInput.value = ''; // Sebebi her zaman temizle
        this.duzenleModal.show();
    },


    getDuzenlemeFormVerisi: () => ({
        girdiId: document.getElementById('edit-girdi-id') ? document.getElementById('edit-girdi-id').value : null,
        yeniLitre: document.getElementById('edit-litre-input') ? document.getElementById('edit-litre-input').value : '',
        yeniFiyat: document.getElementById('edit-fiyat-input') ? document.getElementById('edit-fiyat-input').value : '',
        duzenlemeSebebi: document.getElementById('edit-sebep-input') ? document.getElementById('edit-sebep-input').value.trim() : '',
    }),

    silmeOnayiAc(girdiId) {
        console.log("silmeOnayiAc çağrıldı", girdiId); // Log eklendi
        const idInput = document.getElementById('silinecek-girdi-id');
        if (!idInput) {
             console.error("Silme modalı içindeki 'silinecek-girdi-id' inputu bulunamadı!");
             gosterMesaj("Silme penceresi açılamadı.", "danger");
             return;
        }
         if (!this.silmeOnayModal) {
             console.error("Silme modalı (silmeOnayModal) başlatılmamış!");
             gosterMesaj("Silme penceresi başlatılamadı.", "danger");
             return;
        }
        idInput.value = girdiId;
        this.silmeOnayModal.show();
    },

    getSilinecekGirdiId: () => document.getElementById('silinecek-girdi-id') ? document.getElementById('silinecek-girdi-id').value : null,

    renderGecmisModalContent(gecmisKayitlari, isLoading = false, error = null) {
        const modalBody = document.getElementById('gecmis-modal-body');
        if (!modalBody) return;
        // ... (içerik aynı kalabilir) ...
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

        let content = '<ul class="list-group list-group-flush">'; // flush class eklendi
        gecmisKayitlari.forEach(kayit => {
            let tarihStr = "Geçersiz Tarih";
            try {
                 tarihStr = new Date(kayit.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short'});
            } catch(e) {/* Hata olursa varsayılan kalır */}

            const eskiFiyatBilgisi = kayit.eski_fiyat_degeri ? ` | <span class="text-warning">Eski Fiyat:</span> ${parseFloat(kayit.eski_fiyat_degeri).toFixed(2)} TL` : '';
            const duzenleyen = kayit.duzenleyen_kullanici_id ? utils.sanitizeHTML(kayit.duzenleyen_kullanici_id.kullanici_adi) : 'Bilinmiyor';
            const sebep = kayit.duzenleme_sebebi ? utils.sanitizeHTML(kayit.duzenleme_sebebi) : '-';

            content += `<li class="list-group-item">
                            <p class="mb-1 small text-secondary">${tarihStr} - ${duzenleyen}</p>
                            <p class="mb-1"><span class="text-warning">Eski Litre:</span> ${kayit.eski_litre_degeri} Litre ${eskiFiyatBilgisi}</p>
                            <p class="mb-0"><span class="text-info">Sebep:</span> ${sebep}</p>
                        </li>`;
        });
        modalBody.innerHTML = content + '</ul>';
    },


    sifreDegistirmeAc() {
        const mevcutSifreInput = document.getElementById('mevcut-sifre-input');
        const yeniSifreInput = document.getElementById('kullanici-yeni-sifre-input');
        const yeniSifreTekrarInput = document.getElementById('kullanici-yeni-sifre-tekrar-input');

        if(mevcutSifreInput) mevcutSifreInput.value = '';
        if(yeniSifreInput) yeniSifreInput.value = '';
        if(yeniSifreTekrarInput) yeniSifreTekrarInput.value = '';

        if (!this.sifreDegistirModal) {
             console.error("Şifre Değiştirme Modalı (sifreDegistirModal) başlatılmamış!");
             gosterMesaj("Şifre değiştirme penceresi başlatılamadı.", "danger");
             return;
        }
        this.sifreDegistirModal.show();
    },

    getSifreDegistirmeFormVerisi: () => ({
        mevcutSifre: document.getElementById('mevcut-sifre-input') ? document.getElementById('mevcut-sifre-input').value : '',
        yeniSifre: document.getElementById('kullanici-yeni-sifre-input') ? document.getElementById('kullanici-yeni-sifre-input').value : '',
        yeniSifreTekrar: document.getElementById('kullanici-yeni-sifre-tekrar-input') ? document.getElementById('kullanici-yeni-sifre-tekrar-input').value : ''
    }),

    async checkOfflineUserLicense() {
        const offlineUserString = localStorage.getItem('offlineUser');
        if (offlineUserString) {
            try {
                const user = JSON.parse(offlineUserString);
                const lisansBitisStr = user.lisans_bitis_tarihi;
                if (lisansBitisStr && lisansBitisStr !== 'None') {
                     if (isNaN(new Date(lisansBitisStr).getTime())) {
                          gosterMesaj('Lisans tarihiniz geçersiz, çevrimdışı kayıt yapılamaz.', 'danger');
                          return false;
                     }
                    if (new Date() >= new Date(lisansBitisStr)) { // >= ile tam bitiş gününü de kapsa
                        gosterMesaj('Lisansınızın süresi dolduğu için çevrimdışı kayıt yapamazsınız.', 'danger');
                        return false;
                    }
                } else {
                    gosterMesaj('Geçerli bir lisans bulunamadığı için çevrimdışı kayıt yapamazsınız.', 'danger');
                    return false;
                }
            } catch (e) {
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
