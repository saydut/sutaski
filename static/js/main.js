// ====================================================================================
// ANA UYGULAMA MANTIĞI (main.js)
// Bu dosya, uygulamanın ana orkestrasyonunu yapar.
// Olay dinleyicilerini (buton tıklamaları vb.) ayarlar ve ilgili
// api.js, ui.js ve charts.js fonksiyonlarını çağırır.
// ====================================================================================


function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    document.getElementById(`${aktifGorunum}-gorunumu`).style.display = 'block';

    document.getElementById('btn-view-list').classList.toggle('active', aktifGorunum === 'liste');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}

function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('anaPanelGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);
    girdileriGoster(1, ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : null);
}
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
let mevcutGorunum = 'liste';
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

    mevcutGorunum = localStorage.getItem('anaPanelGorunum') || 'liste';
    gorunumuAyarla(mevcutGorunum);

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
    } finally {
        // Hata olsa da olmasa da yükleniyor animasyonunu kaldır
        ui.toggleOzetPanelsLoading(false); 
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
    document.getElementById('veri-yok-mesaji').style.display = 'none';
    try {
        // Çevrimiçi ise sunucudan veri çek
        const sunucuVerisi = navigator.onLine ? await api.fetchSutGirdileri(tarih, sayfa) : { girdiler: [], toplam_girdi_sayisi: 0 };
        
        // Çevrimdışı bekleyen girdileri al
        const bekleyenGirdiler = await bekleyenGirdileriGetir();
        
        // Sunucu verisi ile çevrimdışı veriyi birleştir
        const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, tarih);
        
        // Birleştirilmiş veriyi arayüzde göster
        ui.renderGirdiler(tumGirdiler, mevcutGorunum);
        
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
        const tedarikciler = await store.getTedarikciler();
        ui.tumTedarikciler = tedarikciler; 
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
/**
 * Yeni süt girdisi ekleme formunu yönetir. (HATA YÖNETİMİ DÜZELTİLDİ)
 * İnternet varsa, kullanıcıyı bekletmemek için "İyimser Arayüz Güncellemesi" yapar.
 * İnternet yoksa, veriyi çevrimdışı kaydeder.
 */
async function sutGirdisiEkle() {
    // 1. Formdan verileri al ve kontrol et
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

    // --- ÇEVRİMDIŞI MANTIĞI ---
    if (!navigator.onLine) {
        ui.toggleGirdiKaydetButton(true);
        try {
            const isOfflineUserValid = await ui.checkOfflineUserLicense();
            if (!isOfflineUserValid) return; 
            
            const basarili = await kaydetCevrimdisi(yeniGirdi);
            if (basarili) {
                ui.resetGirdiFormu();
                await girdileriGoster();
            }
        } finally {
            ui.toggleGirdiKaydetButton(false);
        }
        return;
    }

    // --- İYİMSER (OPTIMISTIC) GÜNCELLEME MANTIĞI ---
    const listeElementi = document.getElementById('girdiler-listesi');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    const geciciId = `gecici-${Date.now()}`;
    const tedarikciAdi = ui.tedarikciSecici.options[tedarikciId].text;
    const kullaniciAdi = JSON.parse(localStorage.getItem('offlineUser'))?.kullanici_adi || 'Siz';

    const geciciElement = document.createElement('div');
    geciciElement.className = 'list-group-item';
    geciciElement.id = geciciId;
    geciciElement.style.opacity = '0.6';
    geciciElement.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
            <h5 class="mb-1 girdi-baslik">${tedarikciAdi} - ${litre} Litre <span class="badge bg-info text-dark ms-2"><i class="bi bi-arrow-repeat"></i> Kaydediliyor...</span></h5>
        </div>
        <p class="mb-1 girdi-detay">Toplayan: ${kullaniciAdi} | Saat: ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
    `;
    
    // "Veri Yok" mesajını gizle ve geçici elemanı ekle
    veriYokMesaji.style.display = 'none';
    listeElementi.prepend(geciciElement);

    const orjinalFormVerisi = { tedarikciId, litre, fiyat };
    ui.resetGirdiFormu();

    try {
        const result = await api.postSutGirdisi(yeniGirdi);
        gosterMesaj("Süt girdisi başarıyla kaydedildi.", "success");
        const bugun = utils.getLocalDateString();
        ui.updateOzetPanels(result.yeni_ozet, bugun);
        
        await charts.haftalikGrafigiOlustur();
        await charts.tedarikciGrafigiOlustur();

        // Başarılı kayıttan sonra listeyi sunucudan gelen en güncel haliyle yenile
        await girdileriGoster(1, bugun);

    } catch (error) {
        console.error("İyimser ekleme başarısız oldu:", error);
        gosterMesaj("Kayıt başarısız. İnternet bağlantınızı kontrol edin.", "danger");
        
        const silinecekElement = document.getElementById(geciciId);
        if (silinecekElement) silinecekElement.remove();

        // Formu eski haline getir
        ui.tedarikciSecici.setValue(orjinalFormVerisi.tedarikciId);
        document.getElementById('litre-input').value = orjinalFormVerisi.litre;
        document.getElementById('fiyat-input').value = orjinalFormVerisi.fiyat;
        
        // Listeyi kontrol et, eğer tamamen boş kaldıysa "Veri Yok" mesajını geri getir
        if (listeElementi.children.length === 0) {
            veriYokMesaji.style.display = 'block';
        }
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
        const result = await api.updateSutGirdisi(girdiId, { yeni_litre: parseFloat(yeniLitre), duzenleme_sebebi: duzenlemeSebebi });
        gosterMesaj("Girdi başarıyla güncellendi.", "success");
        ui.duzenleModal.hide();
        
        const formatliTarih = ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : null;
        
        // DEĞİŞİKLİK: Özet verisini API yanıtından al, tekrar istek atma.
        ui.updateOzetPanels(result.yeni_ozet, formatliTarih);
        await charts.haftalikGrafigiOlustur();
        await charts.tedarikciGrafigiOlustur();
        await girdileriGoster(mevcutSayfa, formatliTarih);

    } catch (error) {
        gosterMesaj(`Girdi düzenlenemedi: ${error.message || 'Bilinmeyen hata.'}`, "danger");
    }
}

/**
 * Bir süt girdisini silme işlemini yönetir.
 */
/**
 * Bir süt girdisini iyimser (optimistic) bir şekilde siler.
 * Önce arayüzden kaldırır, sonra sunucuya isteği gönderir.
 */
async function sutGirdisiSil() {
    const girdiId = ui.getSilinecekGirdiId();
    ui.silmeOnayModal.hide();

    // DÜZELTME: Mevcut görünüme göre doğru elemanı seçiyoruz
    const silinecekElement = document.getElementById(mevcutGorunum === 'liste' ? `girdi-liste-${girdiId}` : `girdi-kart-${girdiId}`);
    if (!silinecekElement) {
        console.error("Silinecek element bulunamadı!");
        return;
    }

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    silinecekElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    silinecekElement.style.opacity = '0';
    silinecekElement.style.transform = 'translateX(-50px)';
    
    setTimeout(() => {
        if (silinecekElement.parentNode) {
            parent.removeChild(silinecekElement);
        }
    }, 400);

    try {
        const result = await api.deleteSutGirdisi(girdiId);
        gosterMesaj(result.message, 'success');
        const formatliTarih = ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : null;
        ui.updateOzetPanels(result.yeni_ozet, formatliTarih);
        await charts.haftalikGrafigiOlustur();
        await charts.tedarikciGrafigiOlustur();
        // Silme sonrası listeyi yenilerken toplam girdi sayısı değişebileceği için ilk sayfaya dönmek en sağlıklısı
        await girdileriGoster(1, formatliTarih);

    } catch (error) {
        console.error("İyimser silme başarısız oldu:", error);
        gosterMesaj('Silme işlemi başarısız, girdi geri yüklendi.', 'danger');

        silinecekElement.style.opacity = '1';
        silinecekElement.style.transform = 'translateX(0)';
        if (!silinecekElement.parentNode) {
            parent.insertBefore(silinecekElement, nextSibling);
        }
    }
}

/**
 * Bir girdinin düzenleme geçmişini API'den alır ve modal'da gösterir.
 * @param {number} girdiId - Geçmişi gösterilecek girdinin ID'si.
 */
async function gecmisiGoster(girdiId) {
    ui.gecmisModal.show();
    ui.renderGecmisModalContent(null, true); 
    try {
        const gecmisKayitlari = await api.fetchGirdiGecmisi(girdiId);
        ui.renderGecmisModalContent(gecmisKayitlari);
    } catch (error) {
        ui.renderGecmisModalContent(null, false, error.message);
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

