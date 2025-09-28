// ====================================================================================
// ANA UYGULAMA MANTIĞI (main.js)
// Bu dosya, uygulamanın ana orkestrasyonunu yapar.
// Olay dinleyicilerini (buton tıklamaları vb.) ayarlar ve ilgili
// api.js, ui.js ve charts.js fonksiyonlarını çağırır.
// ====================================================================================

/**
 * Uygulama kabuğu yüklendiğinde çalışır.
 * Tarayıcıda kayıtlı kullanıcı varsa bilgileri ekrana basar.
 * Yoksa ve internet de yoksa, giriş sayfasına yönlendirir.
 */
function initOfflineState() {
    const offlineUserString = localStorage.getItem('offlineUser');
    
    // Eğer body etiketinde sunucudan gelen bir kullanıcı rolü yoksa 
    // (yani sayfa önbellekten yüklenmişse)
    if (!document.body.dataset.userRole) {
        if (offlineUserString) {
            const user = JSON.parse(offlineUserString);
            
            // Placeholder'ları ve data-* özelliklerini doldur
            document.body.dataset.userRole = user.rol;
            document.body.dataset.lisansBitis = user.lisans_bitis_tarihi;

            const userNameEl = document.getElementById('user-name-placeholder');
            const companyNameEl = document.getElementById('company-name-placeholder');
            const adminLinkContainer = document.getElementById('admin-panel-link-container');
            const veriGirisPaneli = document.getElementById('veri-giris-paneli');
            
            if (userNameEl) userNameEl.textContent = user.kullanici_adi;
            if (companyNameEl) companyNameEl.textContent = user.sirket_adi;

            // Rol bazlı arayüz elemanlarını göster/gizle
            if (user.rol === 'admin' && adminLinkContainer) {
                adminLinkContainer.style.display = 'block';
            } else if (adminLinkContainer) {
                adminLinkContainer.style.display = 'none';
            }
            
            if (user.rol === 'muhasebeci' && veriGirisPaneli) {
                veriGirisPaneli.style.display = 'none';
            } else if (veriGirisPaneli) {
                 veriGirisPaneli.style.display = 'block';
            }

        } else if (!navigator.onLine) {
            // Hem yerel kayıt yok hem de internet yoksa, giriş sayfasına git
            window.location.href = '/login';
        }
    }
}

let mevcutSayfa = 1;
const girdilerSayfaBasi = 6;

// Uygulama başlangıç noktası
window.onload = async function() {
    // Çevrimdışı durumu ve PWA kabuğunu başlat
    initOfflineState();

    // UI component'lerini (modallar, tarih seçiciler vb.) başlat
    ui.init();

    // Lisans durumunu kontrol et ve gerekiyorsa uyarı göster
    ui.lisansUyarisiKontrolEt();

    // Başlangıç verilerini yükle (özet, grafikler, tedarikçiler ve ilk sayfa girdileri)
    await baslangicVerileriniYukle();
};

/**
 * Uygulamanın ihtiyaç duyduğu tüm başlangıç verilerini paralel olarak yükler.
 */
async function baslangicVerileriniYukle() {
    document.getElementById('girdiler-baslik').textContent = 'Bugünkü Girdiler';
    
    const promises = [
        ozetVerileriniYukle(),
        charts.haftalikGrafigiOlustur(),
        charts.tedarikciGrafigiOlustur()
    ];

    if (document.body.dataset.userRole !== 'muhasebeci') {
        promises.push(tedarikcileriYukle());
    }

    await Promise.all(promises);
    girdileriGoster(1); // İlk sayfa girdilerini yükle
}

/**
 * Seçilen tarihe göre özet verilerini (toplam litre ve girdi sayısı) yükler ve arayüzü günceller.
 * @param {string|null} tarih - 'YYYY-MM-DD' formatında tarih. Boş bırakılırsa bugün.
 */
async function ozetVerileriniYukle(tarih = null) {
    ui.toggleOzetPanelsLoading(true); // Yükleniyor animasyonunu göster
    const effectiveDate = tarih || utils.getLocalDateString(new Date());

    try {
        const data = await api.fetchGunlukOzet(effectiveDate);
        ui.updateOzetPanels(data, effectiveDate);
    } catch (error) {
        console.error("Özet yüklenirken hata:", error);
        ui.updateOzetPanels(null, effectiveDate, true); // Hata durumunu UI'a bildir
    }
}

/**
 * Belirtilen sayfa ve tarih için süt girdilerini sunucudan ve/veya yerel veritabanından alır,
 * ardından arayüzde gösterir.
 * @param {number} sayfa - Gösterilecek sayfa numarası.
 * @param {string|null} tarih - Filtrelenecek tarih ('YYYY-MM-DD'). Boş bırakılırsa bugün.
 */
async function girdileriGoster(sayfa = 1, tarih = null) {
    mevcutSayfa = sayfa;
    if (!tarih) {
        tarih = ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString(new Date());
    }
    
    ui.toggleGirdilerListLoading(true);

    try {
        // Çevrimiçi ise sunucudan veri çek
        const sunucuVerisi = navigator.onLine ? await api.fetchSutGirdileri(tarih, sayfa) : { girdiler: [], toplam_girdi_sayisi: 0 };
        
        // Çevrimdışı bekleyen girdileri al
        const bekleyenGirdiler = await bekleyenGirdileriGetir();
        
        // Sunucu verisi ile çevrimdışı veriyi birleştir
        const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, tarih);
        
        // Birleştirilmiş veriyi arayüzde göster
        ui.renderGirdilerListesi(tumGirdiler);
        
        // Sayfalamayı oluştur
        ui.sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, sayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, tarih));

    } catch (error) {
        console.error("Girdileri gösterirken hata:", error);
        ui.renderGirdilerListesi([], "Girdiler yüklenirken bir hata oluştu.");
    } finally {
        ui.toggleGirdilerListLoading(false);
    }
}

/**
 * Tedarikçi listesini yükler ve seçim kutusunu doldurur.
 */
async function tedarikcileriYukle() {
    if (!ui.tedarikciSecici) return;
    try {
        const tedarikciler = await api.fetchTedarikciler();
        ui.tumTedarikciler = tedarikciler; // UI modülünün de bu listeye erişmesi için
        ui.doldurTedarikciSecici(tedarikciler);
    } catch (error) {
        console.error("Tedarikçiler yüklenirken hata:", error);
        gosterMesaj("Tedarikçiler yüklenemedi.", "danger");
    }
}


// ====================================================================================
// OLAY YÖNETİCİLERİ (EVENT HANDLERS)
// Kullanıcı etkileşimlerine yanıt veren fonksiyonlar.
// ====================================================================================

/**
 * 'Filtrele' butonuna tıklandığında çalışır.
 */
function girdileriFiltrele() {
    const secilenTarih = ui.tarihFiltreleyici.selectedDates[0];
    if (secilenTarih) {
        const formatliTarih = utils.getLocalDateString(secilenTarih);
        ui.updateGirdilerBaslik(formatliTarih);
        girdileriGoster(1, formatliTarih);
        ozetVerileriniYukle(formatliTarih);
    }
}

/**
 * 'Temizle' butonuna tıklandığında filtreyi temizler ve bugünün verilerini yükler.
 */
function filtreyiTemizle() {
    ui.tarihFiltreleyici.setDate(new Date(), true);
    baslangicVerileriniYukle();
}

/**
 * Yeni süt girdisi ekleme formunu yönetir.
 */
async function sutGirdisiEkle() {
    const { tedarikciId, litre, fiyat } = ui.getGirdiFormVerisi();
    if (!tedarikciId || !litre || !fiyat) {
        gosterMesaj("Lütfen tüm alanları doğru doldurun.", "warning");
        return;
    }

    const yeniGirdi = {
        tedarikci_id: parseInt(tedarikciId),
        litre: parseFloat(litre),
        fiyat: parseFloat(fiyat)
    };

    ui.toggleGirdiKaydetButton(true); // Butonu "kaydediliyor" durumuna getir

    try {
        // Çevrimdışı ise yerel veritabanına kaydet
        if (!navigator.onLine) {
            const isOfflineUserValid = await ui.checkOfflineUserLicense();
            if (!isOfflineUserValid) return; // Lisans kontrolü başarısızsa çık
            
            const basarili = await kaydetCevrimdisi(yeniGirdi);
            if (basarili) {
                ui.resetGirdiFormu();
                await girdileriGoster(); // Listeyi yenile
            }
            return;
        }

        // Çevrimiçi ise API'ye gönder
        await api.postSutGirdisi(yeniGirdi);
        gosterMesaj("Süt girdisi başarıyla kaydedildi.", "success");
        ui.resetGirdiFormu();
        
        // Sadece ilgili verileri yeniden çekerek performansı artır
        const formatliTarih = ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : null;
        await Promise.all([
            girdileriGoster(mevcutSayfa, formatliTarih),
            ozetVerileriniYukle(formatliTarih)
        ]);

    } catch (error) {
        gosterMesaj(`Süt girdisi eklenemedi: ${error.message || 'Bilinmeyen hata.'}`, "danger");
    } finally {
        ui.toggleGirdiKaydetButton(false); // Butonu eski haline getir
    }
}

/**
 * Mevcut bir süt girdisini düzenleme formunu yönetir.
 */
async function sutGirdisiDuzenle() {
    const { girdiId, yeniLitre, duzenlemeSebebi } = ui.getDuzenlemeFormVerisi();
    if (!yeniLitre || !duzenlemeSebebi) {
        gosterMesaj("Lütfen yeni litre değerini ve düzenleme sebebini girin.", "warning");
        return;
    }
    
    try {
        await api.updateSutGirdisi(girdiId, { yeni_litre: parseFloat(yeniLitre), duzenleme_sebebi: duzenlemeSebebi });
        gosterMesaj("Girdi başarıyla güncellendi.", "success");
        ui.duzenleModal.hide();
        
        const formatliTarih = ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : null;
        await Promise.all([
            girdileriGoster(mevcutSayfa, formatliTarih), 
            ozetVerileriniYukle(formatliTarih)
        ]);
    } catch (error) {
        gosterMesaj(`Girdi düzenlenemedi: ${error.message || 'Bilinmeyen hata.'}`, "danger");
    }
}

/**
 * Bir süt girdisini silme işlemini yönetir.
 */
async function sutGirdisiSil() {
    const girdiId = ui.getSilinecekGirdiId();
    try {
        await api.deleteSutGirdisi(girdiId);
        gosterMesaj("Girdi başarıyla silindi.", 'success');
        ui.silmeOnayModal.hide();
        
        const formatliTarih = ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : null;
        await Promise.all([
            girdileriGoster(mevcutSayfa, formatliTarih), 
            ozetVerileriniYukle(formatliTarih)
        ]);
    } catch (error) {
        gosterMesaj(error.message || 'Silme işlemi başarısız.', 'danger');
    }
}

/**
 * Bir girdinin düzenleme geçmişini API'den alır ve modal'da gösterir.
 * @param {number} girdiId - Geçmişi gösterilecek girdinin ID'si.
 */
async function gecmisiGoster(girdiId) {
    ui.gecmisModal.show();
    ui.renderGecmisModalContent(null, true); // Yükleniyor durumunu göster
    try {
        const gecmisKayitlari = await api.fetchGirdiGecmisi(girdiId);
        ui.renderGecmisModalContent(gecmisKayitlari);
    } catch (error) {
        ui.renderGecmisModalContent(null, false, error.message); // Hata durumunu göster
    }
}

/**
 * Kullanıcının şifresini değiştirme işlemini yönetir.
 */
async function sifreDegistir() {
    const { mevcutSifre, yeniSifre, yeniSifreTekrar } = ui.getSifreDegistirmeFormVerisi();
    if (!mevcutSifre || !yeniSifre || !yeniSifreTekrar) {
        gosterMesaj("Lütfen tüm şifre alanlarını doldurun.", "warning");
        return;
    }

    try {
        const result = await api.postChangePassword({ mevcut_sifre: mevcutSifre, yeni_sifre: yeniSifre, yeni_sifre_tekrar: yeniSifreTekrar });
        gosterMesaj(result.message, 'success');
        ui.sifreDegistirModal.hide();
    } catch (error) {
        gosterMesaj(error.message || "Bir hata oluştu.", 'danger');
    }
}

/**
 * Görüntülenen verileri CSV formatında dışa aktarır.
 */
async function verileriDisaAktar() {
    const secilenTarih = ui.tarihFiltreleyici.selectedDates[0];
    const formatliTarih = secilenTarih ? utils.getLocalDateString(secilenTarih) : null;
    try {
        const { filename, blob } = await api.fetchCsvExport(formatliTarih);
        
        // Blob'dan bir URL oluştur ve indirme linki tetikle
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Temizlik
        window.URL.revokeObjectURL(objectUrl);
        a.remove();
        
        gosterMesaj("Veriler başarıyla CSV olarak indirildi.", "success");
    } catch (error) {
        gosterMesaj(error.message, "danger");
    }
}

