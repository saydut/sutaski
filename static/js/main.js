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

// DOSYANIN EN BAŞINA EKLENECEK KOD
let mevcutGorunum = 'liste';


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
// EKLENECEK KOD SONU


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

// BU KOD BLOĞUNU KOPYALAYIP MEVCUT window.onload'un YERİNE YAPIŞTIR

// Uygulama başlangıç noktası
window.onload = async function() {
    // Çevrimdışı durumu ve PWA kabuğunu başlat
    initOfflineState();

    // UI component'lerini (modallar, tarih seçiciler vb.) başlat
    ui.init();

    mevcutGorunum = localStorage.getItem('anaPanelGorunum') || 'liste';
    gorunumuAyarla(mevcutGorunum);

    // Lisans durumunu kontrol et ve gerekiyorsa uyarı göster
    ui.lisansUyarisiKontrolEt();

    // Başlangıç verilerini yükle (özet, grafikler, tedarikçiler ve ilk sayfa girdileri)
    await baslangicVerileriniYukle();

    // --- YENİ EKLENEN BİLDİRİM KONTROL KODU ---
    initializePushNotifications(); 
    // --- YENİ KOD SONU ---
};

// --- YENİ EKLENEN FONKSİYONLAR ---

// URL safe base64 decode/encode fonksiyonu
function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Abone olma işlemini başlatan ana fonksiyon
async function subscribeUser() {
    try {
        const registration = await navigator.serviceWorker.ready;
        // VAPID_PUBLIC_KEY değişkeni index.html'den geliyor olmalı
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        console.log('Kullanıcı başarıyla abone oldu:', subscription);

        // Abonelik bilgisini sunucuya gönder
        await fetch('/api/save-subscription', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        gosterMesaj('Bildirimlere başarıyla abone oldunuz!', 'success');
        document.getElementById('subscribe-button').style.display = 'none';

    } catch (error) {
        console.error('Abonelik sırasında hata:', error);
        gosterMesaj('Bildirimlere abone olunamadı. Lütfen sayfa ayarlarından bildirim izinlerini kontrol edin.', 'danger');
    }
}

// Sayfa yüklendiğinde bildirim durumunu kontrol eden ana fonksiyon
function initializePushNotifications() {
    const subscribeButton = document.getElementById('subscribe-button');
    if (!subscribeButton) {
        console.error('Abone ol butonu HTML içinde bulunamadı.');
        return;
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            registration.pushManager.getSubscription().then(subscription => {
                if (subscription === null && Notification.permission === 'default') {
                    // Kullanıcı abone değil VE henüz izin vermemiş/engellememiş
                    subscribeButton.style.display = 'block';
                    subscribeButton.onclick = () => {
                        Notification.requestPermission().then(permission => {
                            if (permission === 'granted') {
                                subscribeUser();
                            }
                        });
                    };
                }
            });
        });
    } else {
        console.warn('Bu tarayıcı anlık bildirimleri desteklemiyor.');
    }
}

// --- YENİ FONKSİYONLARIN SONU ---

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
    ui.toggleOzetPanelsLoading(true);
    const effectiveDate = tarih || utils.getLocalDateString(new Date());

    try {
        let data;
        if (navigator.onLine) {
            data = await api.fetchGunlukOzet(effectiveDate);
            // Sadece bugünün özetini önbelleğe al
            if (effectiveDate === utils.getLocalDateString(new Date())) {
                await cacheAnaPanelData('gunlukOzet', data);
            }
        } else {
            data = await getCachedAnaPanelData('gunlukOzet');
            if (!data) throw new Error("Önbellekte özet veri bulunamadı.");
        }
        ui.updateOzetPanels(data, effectiveDate);
    } catch (error) {
        console.error("Özet yüklenirken hata:", error);
        ui.updateOzetPanels(null, effectiveDate, true);
    } finally {
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
    tarih = tarih || (ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString(new Date()));
    
    ui.toggleGirdilerListLoading(true);
    document.getElementById('veri-yok-mesaji').style.display = 'none';

    try {
        let sunucuVerisi = { girdiler: [], toplam_girdi_sayisi: 0 };
        if (navigator.onLine) {
            sunucuVerisi = await api.fetchSutGirdileri(tarih, sayfa);
            // Sadece bugünün ilk sayfa girdilerini önbelleğe al
            if (tarih === utils.getLocalDateString(new Date()) && sayfa === 1) {
                await cacheAnaPanelData('gunlukGirdiler', sunucuVerisi);
            }
        } else {
            // Çevrimdışıysak sadece bugünün ilk sayfasını önbellekten göstermeye çalış
            if (tarih === utils.getLocalDateString(new Date()) && sayfa === 1) {
                sunucuVerisi = await getCachedAnaPanelData('gunlukGirdiler');
                if (!sunucuVerisi) throw new Error("Önbellekte günlük girdi bulunamadı.");
            } else {
                 throw new Error("Çevrimdışı modda sadece bugünün ilk sayfası görüntülenebilir.");
            }
        }
        
        const bekleyenGirdiler = await bekleyenKayitlariGetir().then(kayitlar => kayitlar.sut || []);
        const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, tarih);
        
        ui.renderGirdiler(tumGirdiler, mevcutGorunum);
        ui.sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, sayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, tarih));

    } catch (error) {
        console.error("Girdileri gösterirken hata:", error);
        ui.renderGirdiler([], mevcutGorunum);
        gosterMesaj(error.message, 'warning'); // Kullanıcıya bilgi ver
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
    
    const ilkEleman = listeElementi.querySelector("div:not([id])");
    if (ilkEleman && listeElementi.children.length === 1) {
        ilkEleman.style.display = 'none';
    }
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
        await girdileriGoster(1, bugun);

    } catch (error) {
        // --- DEĞİŞİKLİK BURADA ---
        // Teknik hatayı konsola yazdır, kullanıcıya ise anlaşılır bir mesaj göster.
        console.error("İyimser ekleme başarısız oldu:", error);
        gosterMesaj("Kayıt başarısız. İnternet bağlantınızı kontrol edin.", "danger");
        
        // Hata durumunda geçici elemanı arayüzden kaldır.
        const silinecekElement = document.getElementById(geciciId);
        if (silinecekElement) silinecekElement.remove();

        // Kullanıcının girdiği verileri forma geri yükle.
        ui.tedarikciSecici.setValue(orjinalFormVerisi.tedarikciId);
        document.getElementById('litre-input').value = orjinalFormVerisi.litre;
        document.getElementById('fiyat-input').value = orjinalFormVerisi.fiyat;
        
        // Eğer listede başka eleman yoksa "veri yok" mesajının durumunu kontrol et.
        if(listeElementi.children.length === 1 && ilkEleman) {
            ilkEleman.style.display = 'block';
        }
    }
}

/**
 * Mevcut bir süt girdisini düzenleme formunu yönetir.
 */
async function sutGirdisiDuzenle() {
    const { girdiId, yeniLitre, yeniFiyat, duzenlemeSebebi } = ui.getDuzenlemeFormVerisi();
    if (!yeniLitre || !yeniFiyat) {
        gosterMesaj("Lütfen yeni litre ve fiyat değerlerini girin.", "warning");
        return;
    }

    // --- EKLENEN KONTROL ---
    if (!navigator.onLine) {
        gosterMesaj("Düzenleme işlemi için internet bağlantısı gereklidir.", "warning");
        return;
    }
    // --- KONTROL SONU ---
    
    const guncelVeri = {
        yeni_litre: parseFloat(yeniLitre),
        yeni_fiyat: parseFloat(yeniFiyat),
        duzenleme_sebebi: duzenlemeSebebi
    };
    
    try {
        const result = await api.updateSutGirdisi(girdiId, guncelVeri);
        gosterMesaj("Girdi başarıyla güncellendi.", "success");
        ui.duzenleModal.hide();
        
        const formatliTarih = ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : null;
        
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

    // --- EKLENEN KONTROL ---
    if (!navigator.onLine) {
        gosterMesaj("Silme işlemi için internet bağlantısı gereklidir.", "warning");
        return;
    }
    // --- KONTROL SONU ---

    const silinecekElement = document.getElementById(`girdi-liste-${girdiId}`) || document.getElementById(`girdi-kart-${girdiId}`);
    if (!silinecekElement) return;

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

