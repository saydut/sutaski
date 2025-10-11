// ====================================================================================
// ARAYÜZ YÖNETİMİ (ui.js)
// Bu dosya, DOM manipülasyonu ile ilgili tüm fonksiyonları içerir.
// HTML elementlerini günceller, modalları yönetir, animasyonları kontrol eder.
// ====================================================================================

/**
 * Kullanıcıya dinamik olarak bir mesaj gösterir.
 * @param {string} mesaj Gösterilecek metin.
 * @param {string} tip Mesajın türü (success, danger, warning, info).
 * @param {number} sure Ms cinsinden ne kadar süre ekranda kalacağı.
 */
function gosterMesaj(mesaj, tip = 'info', sure = 5000) {
    const container = document.getElementById('alert-container');
    if (!container) {
        console.error("'alert-container' ID'li element sayfada bulunamadı.");
        return;
    }
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tip} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `${mesaj} <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
    container.appendChild(alertDiv);
    setTimeout(() => {
        const alertInstance = bootstrap.Alert.getOrCreateInstance(alertDiv);
        if(alertInstance) { 
            alertInstance.close(); 
        }
    }, sure);
}


const ui = {
    // Modal ve kütüphane instance'ları
    duzenleModal: null,
    gecmisModal: null,
    silmeOnayModal: null,
    sifreDegistirModal: null,
    tarihFiltreleyici: null,
    tedarikciSecici: null,
    tumTedarikciler: [], // Çevrimdışı girdileri işlemek için gerekli

    /**
     * Sayfa yüklendiğinde gerekli tüm UI bileşenlerini başlatır.
     */
    init() {
        this.duzenleModal = new bootstrap.Modal(document.getElementById('duzenleModal'));
        this.gecmisModal = new bootstrap.Modal(document.getElementById('gecmisModal'));
        this.silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));
        this.sifreDegistirModal = new bootstrap.Modal(document.getElementById('sifreDegistirModal'));
        
        this.tarihFiltreleyici = flatpickr("#tarih-filtre", {
            dateFormat: "d.m.Y",
            locale: "tr",
            defaultDate: "today"
        });
        
        if (document.getElementById('veri-giris-paneli').style.display !== 'none' && document.getElementById('tedarikci-sec')) {
            this.tedarikciSecici = new TomSelect("#tedarikci-sec", {
                create: false,
                sortField: { field: "text", direction: "asc" },
                onChange: (value) => {
                    if (value && navigator.onLine) {
                        // Seçim yapıldığında ve internet varsa, son fiyatı getir
                        api.fetchSonFiyat(value).then(data => {
                           if(data && data.son_fiyat) {
                               const fiyatInput = document.getElementById('fiyat-input');
                               fiyatInput.value = parseFloat(data.son_fiyat).toFixed(2);
                               // Kullanıcının dikkatini çekmek için küçük bir animasyon
                               fiyatInput.classList.add('fiyat-guncellendi');
                               setTimeout(() => fiyatInput.classList.remove('fiyat-guncellendi'), 500);
                           }
                        }).catch(err => console.warn("Son fiyat getirilemedi:", err));
                    }
                }
            });
        }
    },

    /**
     * Lisans bitiş tarihini kontrol eder ve gerekirse bir uyarı mesajı gösterir.
     */
    lisansUyarisiKontrolEt() {
        const lisansBitisStr = document.body.dataset.lisansBitis;
        if (!lisansBitisStr || lisansBitisStr === 'None' || lisansBitisStr === '') return;
        
        const lisansBitisTarihi = new Date(lisansBitisStr);
        const bugun = new Date();
        const gunFarki = Math.ceil((lisansBitisTarihi.getTime() - bugun.getTime()) / (1000 * 3600 * 24));
        
        if (gunFarki <= 0) {
            gosterMesaj(`<strong>Dikkat:</strong> Şirketinizin lisans süresi dolmuştur! Lütfen yöneticinizle iletişime geçin.`, 'danger');
        } else if (gunFarki <= 30) {
            gosterMesaj(`<strong>Bilgi:</strong> Şirketinizin lisans süresinin dolmasına ${gunFarki} gün kaldı.`, 'warning');
        }
    },

    /**
     * Özet panellerindeki (toplam litre/girdi) yükleniyor animasyonunu açar/kapatır.
     * @param {boolean} isLoading - Yükleniyor durumu.
     */
    toggleOzetPanelsLoading(isLoading) {
        const toplamLitrePanel = document.getElementById('toplam-litre-panel');
        const girdiSayisiPanel = document.getElementById('bugunku-girdi-sayisi');
        if (isLoading) {
            toplamLitrePanel.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
            girdiSayisiPanel.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
        }
    },

    /**
     * Özet panellerini gelen veriyle günceller.
     * @param {object|null} data - {toplam_litre, girdi_sayisi} içeren obje.
     * @param {string} effectiveDate - Panelin başlığında gösterilecek tarih.
     * @param {boolean} isError - Hata olup olmadığı.
     */
    updateOzetPanels(data, effectiveDate, isError = false) {
        const toplamLitrePanel = document.getElementById('toplam-litre-panel');
        const girdiSayisiPanel = document.getElementById('bugunku-girdi-sayisi');
        const ozetBaslik = document.getElementById('ozet-panel-baslik');
        const girdiSayisiBaslik = document.getElementById('girdi-sayisi-baslik');

        // Başlıkları güncelle
        const bugun = utils.getLocalDateString();
        if (effectiveDate && effectiveDate !== bugun) {
            const [yil, ay, gun] = effectiveDate.split('-');
            ozetBaslik.textContent = `${gun}.${ay}.${yil} TOPLAMI`;
            girdiSayisiBaslik.textContent = `${gun}.${ay}.${yil} TOPLAM GİRDİ`;
        } else {
            ozetBaslik.textContent = 'BUGÜNKÜ TOPLAM SÜT';
            girdiSayisiBaslik.textContent = 'BUGÜNKÜ TOPLAM GİRDİ';
        }

        if (isError) {
            toplamLitrePanel.textContent = 'Hata';
            girdiSayisiPanel.textContent = 'Hata';
        } else if (data) {
            toplamLitrePanel.textContent = `${data.toplam_litre} L`;
            girdiSayisiPanel.textContent = data.girdi_sayisi;
        }
    },
    
    /**
     * Süt girdileri listesi için yükleniyor animasyonunu yönetir.
     * @param {boolean} isLoading - Yükleniyor durumu.
     */
    toggleGirdilerListLoading(isLoading) {
        const listeElementi = document.getElementById('girdiler-listesi');
        if (isLoading) {
            listeElementi.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div></div>';
        }
    },

    /**
     * Sunucudan gelen ve çevrimdışı kaydedilen girdileri birleştirir.
     * @param {object} sunucuVerisi - Sunucudan gelen veri.
     * @param {Array} bekleyenGirdiler - IndexedDB'den gelen veriler.
     * @param {string} tarih - Görüntülenen tarih.
     * @returns {{tumGirdiler: Array, toplamGirdi: number}}
     */
    mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, tarih) {
        let tumGirdiler = sunucuVerisi.girdiler;
        let toplamGirdi = sunucuVerisi.toplam_girdi_sayisi;

        if (bekleyenGirdiler.length > 0 && tarih === utils.getLocalDateString(new Date())) {
            const islenmisBekleyenler = bekleyenGirdiler.map(girdi => {
                const tedarikci = this.tumTedarikciler.find(t => t.id === girdi.tedarikci_id);
                return {
                    id: `offline-${girdi.id}`,
                    litre: girdi.litre,
                    fiyat: girdi.fiyat,
                    taplanma_tarihi: girdi.eklendigi_zaman,
                    duzenlendi_mi: false,
                    isOffline: true,
                    kullanicilar: { kullanici_adi: 'Siz (Beklemede)' },
                    tedarikciler: { isim: tedarikci ? tedarikci.isim : `Bilinmeyen (ID: ${girdi.tedarikci_id})` }
                };
            });
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
    const listeKonteyneri = document.getElementById('liste-gorunumu');
    const kartKonteyneri = document.getElementById('kart-gorunumu');

    // Önce tüm alanları temizle
    document.getElementById('girdiler-listesi').innerHTML = '';
    document.getElementById('girdiler-kart-listesi').innerHTML = '';
    veriYokMesaji.style.display = 'none';

    if (girdiler.length === 0) {
        veriYokMesaji.style.display = 'block';
        listeKonteyneri.style.display = 'none';
        kartKonteyneri.style.display = 'none';
        return;
    }

    if (gorunum === 'liste') {
        this.renderGirdilerAsList(girdiler);
    } else {
        this.renderGirdilerAsCards(girdiler);
    }
},

/**
 * Girdileri liste formatında (list-group) render eder.
 * @param {Array} girdiler - Gösterilecek girdi objeleri dizisi.
 */
renderGirdilerAsList(girdiler) {
    const listeElementi = document.getElementById('girdiler-listesi');
    girdiler.forEach(girdi => {
        const tarihObj = new Date(girdi.taplanma_tarihi);
        const formatliTarih = !isNaN(tarihObj.getTime()) ? `${String(tarihObj.getHours()).padStart(2, '0')}:${String(tarihObj.getMinutes()).padStart(2, '0')}` : 'Geçersiz Saat';
        const duzenlendiEtiketi = girdi.duzenlendi_mi ? `<span class="badge bg-warning text-dark ms-2">Düzenlendi</span>` : '';
        const cevrimdisiEtiketi = girdi.isOffline ? `<span class="badge bg-info text-dark ms-2" title="İnternet geldiğinde gönderilecek"><i class="bi bi-cloud-upload"></i> Beklemede</span>` : '';
        let actionButtons = !girdi.isOffline && document.body.dataset.userRole !== 'muhasebeci' ? `
            <button class="btn btn-sm btn-outline-info border-0" title="Düzenle" onclick="ui.duzenlemeModaliniAc(${girdi.id}, ${girdi.litre}, ${girdi.fiyat})"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger border-0" title="Sil" onclick="ui.silmeOnayiAc(${girdi.id})"><i class="bi bi-trash"></i></button>` : '';
        const gecmisButonu = !girdi.isOffline ? `<button class="btn btn-sm btn-outline-secondary border-0" title="Geçmişi Gör" onclick="gecmisiGoster(${girdi.id})"><i class="bi bi-clock-history"></i></button>` : '';
        const fiyatBilgisi = girdi.fiyat ? `<span class="text-success">@ ${parseFloat(girdi.fiyat).toFixed(2)} TL</span>` : '';

        const girdiElementi = `
            <div class="list-group-item" id="girdi-liste-${girdi.id}">
                <div class="d-flex w-100 justify-content-between flex-wrap">
                    <h5 class="mb-1 girdi-baslik">${girdi.tedarikciler.isim} - ${girdi.litre} Litre ${fiyatBilgisi} ${duzenlendiEtiketi} ${cevrimdisiEtiketi}</h5>
                    <div class="btn-group">${actionButtons} ${gecmisButonu}</div>
                </div>
                <p class="mb-1 girdi-detay">Toplayan: ${girdi.kullanicilar.kullanici_adi} | Saat: ${formatliTarih}</p>
            </div>`;
        listeElementi.innerHTML += girdiElementi;
    });
},

/**
 * Girdileri kart formatında (grid) render eder.
 * @param {Array} girdiler - Gösterilecek girdi objeleri dizisi.
 */
renderGirdilerAsCards(girdiler) {
    const kartListesi = document.getElementById('girdiler-kart-listesi');
    girdiler.forEach(girdi => {
        const tarihObj = new Date(girdi.taplanma_tarihi);
        const formatliTarih = !isNaN(tarihObj.getTime()) ? `${String(tarihObj.getHours()).padStart(2, '0')}:${String(tarihObj.getMinutes()).padStart(2, '0')}` : 'Geçersiz Saat';
        const duzenlendiEtiketi = girdi.duzenlendi_mi ? `<span class="badge bg-warning text-dark">Düzenlendi</span>` : '';
        const cevrimdisiEtiketi = girdi.isOffline ? `<span class="badge bg-info text-dark" title="Beklemede"><i class="bi bi-cloud-upload"></i></span>` : '';
        let actionButtons = !girdi.isOffline && document.body.dataset.userRole !== 'muhasebeci' ? `
            <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="ui.duzenlemeModaliniAc(${girdi.id}, ${girdi.litre}, ${girdi.fiyat})"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="ui.silmeOnayiAc(${girdi.id})"><i class="bi bi-trash"></i></button>` : '';
        const gecmisButonu = !girdi.isOffline ? `<button class="btn btn-sm btn-outline-secondary" title="Geçmişi Gör" onclick="gecmisiGoster(${girdi.id})"><i class="bi bi-clock-history"></i></button>` : '';
        const tutar = parseFloat(girdi.litre || 0) * parseFloat(girdi.fiyat || 0);

        const kartElementi = `
        <div class="col-xl-6 col-12" id="girdi-kart-${girdi.id}">
            <div class="card p-2 h-100">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="card-title mb-0">${girdi.tedarikciler.isim}</h6>
                            <small class="text-secondary">Toplayan: ${girdi.kullanicilar.kullanici_adi}</small>
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
        container.innerHTML = '';
        const toplamSayfa = Math.ceil(toplamOge / sayfaBasiOge);
        if (toplamSayfa <= 1) return;

        const ul = document.createElement('ul');
        // Bootstrap'in daha küçük sayfalama stilini kullanalım, daha şık durur.
        ul.className = 'pagination pagination-sm justify-content-center';

        // Buton oluşturan yardımcı fonksiyon
        const createPageItem = (page, text, isDisabled = false, isActive = false) => {
            const li = document.createElement('li');
            li.className = `page-item ${isDisabled ? 'disabled' : ''} ${isActive ? 'active' : ''}`;
            const a = document.createElement('a');
            a.className = 'page-link';
            a.href = '#';
            a.innerHTML = text; // innerHTML kullanarak « gibi karakterleri yazdırabiliyoruz
            if (!isDisabled && page > 0) {
                a.onclick = (e) => {
                    e.preventDefault();
                    sayfaDegistirCallback(page);
                };
            }
            li.appendChild(a);
            return li;
        };

        // "Önceki" butonu
        ul.appendChild(createPageItem(aktifSayfa - 1, '&laquo;', aktifSayfa === 1));

        // Gösterilecek sayfa numaralarını hesaplayan akıllı mantık
        const pagesToShow = new Set();
        const sayfaAraligi = 2; // Aktif sayfanın sağında ve solunda kaç buton olacağı

        // Her zaman ilk ve son sayfayı ekle
        pagesToShow.add(1);
        pagesToShow.add(toplamSayfa);
        
        // Aktif sayfa ve etrafındakileri ekle
        for (let i = -sayfaAraligi; i <= sayfaAraligi; i++) {
            const page = aktifSayfa + i;
            if (page > 0 && page <= toplamSayfa) {
                pagesToShow.add(page);
            }
        }
        
        let sonEklenenSayfa = 0;
        const siraliSayfalar = Array.from(pagesToShow).sort((a, b) => a - b);

        for (const page of siraliSayfalar) {
            // Sayı grupları arasında 1'den fazla boşluk varsa "..." ekle
            if (sonEklenenSayfa > 0 && page - sonEklenenSayfa > 1) {
                ul.appendChild(createPageItem(0, '...', true));
            }
            ul.appendChild(createPageItem(page, page, false, page === aktifSayfa));
            sonEklenenSayfa = page;
        }

        // "Sonraki" butonu
        ul.appendChild(createPageItem(aktifSayfa + 1, '&raquo;', aktifSayfa === toplamSayfa));

        container.appendChild(ul);
    },
    
    /**
     * Tedarikçi seçim kutusunu (TomSelect) gelen veriyle doldurur.
     * @param {Array} tedarikciler - Tedarikçi listesi.
     */
    doldurTedarikciSecici(tedarikciler) {
        this.tedarikciSecici.clear();
        this.tedarikciSecici.clearOptions();
        const options = tedarikciler.map(t => ({ value: t.id, text: t.isim }));
        this.tedarikciSecici.addOptions(options);
    },

    /**
     * Girdiler listesinin başlığını seçilen tarihe göre günceller.
     */
    updateGirdilerBaslik(formatliTarih) {
        const baslik = document.getElementById('girdiler-baslik');
        if (formatliTarih === utils.getLocalDateString()) {
            baslik.textContent = 'Bugünkü Girdiler';
        } else {
            const [yil, ay, gun] = formatliTarih.split('-');
            baslik.textContent = `${gun}.${ay}.${yil} Tarihli Girdiler`;
        }
    },
    
    // FORM ve MODAL YÖNETİMİ
    
    getGirdiFormVerisi: () => ({
        tedarikciId: ui.tedarikciSecici.getValue(),
        litre: document.getElementById('litre-input').value,
        fiyat: document.getElementById('fiyat-input').value,
    }),
    
    resetGirdiFormu: () => {
        document.getElementById('litre-input').value = '';
        document.getElementById('fiyat-input').value = '';
        ui.tedarikciSecici.clear();
    },

    toggleGirdiKaydetButton: (isLoading) => {
        const kaydetButton = document.querySelector('#veri-giris-paneli button');
        kaydetButton.disabled = isLoading;
        kaydetButton.innerHTML = isLoading ? `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...` : `Kaydet`;
    },

    duzenlemeModaliniAc(girdiId, mevcutLitre, mevcutFiyat) {
        document.getElementById('edit-girdi-id').value = girdiId;
        document.getElementById('edit-litre-input').value = mevcutLitre;
        document.getElementById('edit-fiyat-input').value = mevcutFiyat;
        document.getElementById('edit-sebep-input').value = '';
        this.duzenleModal.show();
    },

    getDuzenlemeFormVerisi: () => ({
        girdiId: document.getElementById('edit-girdi-id').value,
        yeniLitre: document.getElementById('edit-litre-input').value,
        yeniFiyat: document.getElementById('edit-fiyat-input').value,
        duzenlemeSebebi: document.getElementById('edit-sebep-input').value.trim(),
    }),
    
    silmeOnayiAc(girdiId) {
        document.getElementById('silinecek-girdi-id').value = girdiId;
        this.silmeOnayModal.show();
    },
    
    getSilinecekGirdiId: () => document.getElementById('silinecek-girdi-id').value,

    renderGecmisModalContent(gecmisKayitlari, isLoading = false, error = null) {
        const modalBody = document.getElementById('gecmis-modal-body');
        if (isLoading) {
            modalBody.innerHTML = '<div class="text-center p-4"><div class="spinner-border"></div></div>';
            return;
        }
        if (error) {
            modalBody.innerHTML = `<p class="text-danger p-3">Geçmiş yüklenemedi: ${error}</p>`;
            return;
        }
        if (!gecmisKayitlari || gecmisKayitlari.length === 0) {
            modalBody.innerHTML = '<p class="p-3">Bu girdi için düzenleme geçmişi bulunamadı.</p>';
            return;
        }

        let content = '<ul class="list-group">';
        gecmisKayitlari.forEach(kayit => {
            const tarih = new Date(kayit.created_at).toLocaleString('tr-TR');
            const eskiFiyatBilgisi = kayit.eski_fiyat_degeri ? ` | <span class="text-warning">Eski Fiyat:</span> ${parseFloat(kayit.eski_fiyat_degeri).toFixed(2)} TL` : '';
            content += `<li class="list-group-item">
                            <p class="mb-1 fw-bold">${tarih} - ${kayit.duzenleyen_kullanici_id.kullanici_adi} tarafından düzenlendi.</p>
                            <p class="mb-1"><span class="text-warning">Eski Litre:</span> ${kayit.eski_litre_degeri} Litre ${eskiFiyatBilgisi}</p>
                            <p class="mb-0"><span class="text-info">Sebep:</span> ${kayit.duzenleme_sebebi}</p>
                        </li>`;
        });
        modalBody.innerHTML = content + '</ul>';
    },

    sifreDegistirmeAc() {
        document.getElementById('mevcut-sifre-input').value = '';
        document.getElementById('kullanici-yeni-sifre-input').value = '';
        document.getElementById('kullanici-yeni-sifre-tekrar-input').value = '';
        this.sifreDegistirModal.show();
    },

    getSifreDegistirmeFormVerisi: () => ({
        mevcutSifre: document.getElementById('mevcut-sifre-input').value,
        yeniSifre: document.getElementById('kullanici-yeni-sifre-input').value,
        yeniSifreTekrar: document.getElementById('kullanici-yeni-sifre-tekrar-input').value
    }),

    async checkOfflineUserLicense() {
        const offlineUserString = localStorage.getItem('offlineUser');
        if (offlineUserString) {
            const user = JSON.parse(offlineUserString);
            const lisansBitisStr = user.lisans_bitis_tarihi;
            if (lisansBitisStr && lisansBitisStr !== 'None') {
                if (new Date() > new Date(lisansBitisStr)) {
                    gosterMesaj('Lisansınızın süresi dolduğu için çevrimdışı kayıt yapamazsınız.', 'danger');
                    return false;
                }
            } else {
                gosterMesaj('Geçerli bir lisans bulunamadığı için çevrimdışı kayıt yapamazsınız.', 'danger');
                return false;
            }
        } else {
            gosterMesaj('Çevrimdışı kayıt için kullanıcı bilgisi bulunamadı. Lütfen önce online giriş yapın.', 'danger');
            return false;
        }
        return true;
    }
};
