// main.js

// ====================================================================================
// ANA UYGULAMA MANTIĞI (main.js)
// ====================================================================================

// --- Global Değişkenler ---
let mevcutGorunum = 'liste';
let mevcutSayfa = 1;
const girdilerSayfaBasi = 6;
let mevcutTedarikciIstatistikleri = null; // Tedarikçi istatistiklerini saklamak için yeni değişken
let veriOnayModal = null; // Onay modalı için yeni değişken
let kullaniciRolu = null; // YENİ: Kullanıcı rolünü global olarak saklamak için

/**
 * Uygulama kabuğu yüklendiğinde çalışır.
 * Tarayıcıda kayıtlı kullanıcı varsa bilgileri ekrana basar.
 * Yoksa ve internet de yoksa, giriş sayfasına yönlendirir.
 * Ayrıca global kullanıcı rolünü ayarlar.
 */
function initOfflineState() {
    // Önce body'deki data attribute'undan rolü almayı dene (sayfa sunucudan render edildiyse)
    kullaniciRolu = document.body.dataset.userRole || null;

    const offlineUserString = localStorage.getItem('offlineUser');

    // Eğer rol hala belirlenemediyse ve offline kullanıcı verisi varsa, oradan al
    if (!kullaniciRolu && offlineUserString) {
        try {
            const user = JSON.parse(offlineUserString);
            kullaniciRolu = user.rol; // Global rolü ayarla
            document.body.dataset.userRole = user.rol; // Body'ye de ekle
            document.body.dataset.lisansBitis = user.lisans_bitis_tarihi;

            // Diğer bilgileri de ekrana bas (sadece kullanıcı arayüzü için)
            const userNameEl = document.getElementById('user-name-placeholder');
            const companyNameEl = document.getElementById('company-name-placeholder');
            if (userNameEl) userNameEl.textContent = user.kullanici_adi;
            if (companyNameEl) companyNameEl.textContent = user.sirket_adi;

        } catch (e) {
            console.error("Offline kullanıcı verisi okunamadı:", e);
            localStorage.removeItem('offlineUser'); // Bozuk veriyi temizle
        }
    }

    // Rol hala yoksa ve internet de yoksa girişe yönlendir
    if (!kullaniciRolu && !navigator.onLine) {
         console.warn("Kullanıcı rolü belirlenemedi ve çevrimdışı. Giriş sayfasına yönlendiriliyor.");
         window.location.href = '/login';
    }

    // Muhasebeci rolü için veri giriş panelini gizle (Rol belirlendikten sonra çalışır)
    const veriGirisPaneli = document.getElementById('veri-giris-paneli');
     if (veriGirisPaneli) {
        veriGirisPaneli.style.display = (kullaniciRolu === 'muhasebeci') ? 'none' : 'block';
    }

}

// Uygulama başlangıç noktası
window.onload = async function() {
    initOfflineState(); // Global `kullaniciRolu` değişkenini ayarlar

    // --- YENİ: Rol Kontrolü ve Yönlendirme ---
    if (kullaniciRolu === 'ciftci') {
        // Eğer kullanıcı çiftçi ise, ciftci_panel.js'deki başlatma fonksiyonunu çağır
        if (typeof initCiftciPanel === 'function') {
            await initCiftciPanel(); // async olduğu için await eklendi
        } else {
            console.error("initCiftciPanel fonksiyonu bulunamadı. ciftci_panel.js yüklendi mi?");
        }
        // Çiftçi için bu dosyadaki diğer işlemler yapılmayacak.
        return;
    }

    // --- Çiftçi Değilse Normal Panel Başlatma İşlemleri ---
    ui.init(); // ui.js'deki genel UI başlatmaları
    veriOnayModal = new bootstrap.Modal(document.getElementById('veriOnayModal'));
    ui.lisansUyarisiKontrolEt();

    // TomSelect (Tedarikçi Seçici) BAŞLATMA KODU (Sadece muhasebeci olmayanlar için)
    const veriGirisPaneli = document.getElementById('veri-giris-paneli');
    if (kullaniciRolu !== 'muhasebeci' && veriGirisPaneli && document.getElementById('tedarikci-sec')) {
        ui.tedarikciSecici = new TomSelect("#tedarikci-sec", {
            create: false,
            sortField: { field: "text", direction: "asc" },
            onChange: (value) => {
                 if (value && navigator.onLine) {
                    // Tedarikçi istatistiklerini ve son fiyatını asenkron olarak çek
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
                           // Fiyat otomatik dolunca görsel geri bildirim ver
                           fiyatInput.classList.add('fiyat-guncellendi');
                           setTimeout(() => fiyatInput.classList.remove('fiyat-guncellendi'), 500);
                       }
                    }).catch(err => console.warn("Son fiyat getirilemedi:", err));
                } else {
                    mevcutTedarikciIstatistikleri = null; // Seçim kalkınca istatistikleri sıfırla
                }
            }
        });
    }

    mevcutGorunum = localStorage.getItem('anaPanelGorunum') || 'liste';
    gorunumuAyarla(mevcutGorunum); // Normal panel için görünümü ayarla

    await baslangicVerileriniYukle(); // **Bu fonksiyonu çağırıyoruz**

    // Kaydet butonu olay dinleyicisi (Sadece muhasebeci olmayanlar için)
    const kaydetBtn = document.getElementById('kaydet-girdi-btn');
    if(kaydetBtn && kullaniciRolu !== 'muhasebeci') {
        kaydetBtn.addEventListener('click', sutGirdisiEkle);
    }
};


/**
 * Uygulamanın ihtiyaç duyduğu tüm başlangıç verilerini paralel olarak yükler.
 * (FONKSİYONUN TAM VE DÜZELTİLMİŞ HALİ)
 */
async function baslangicVerileriniYukle() {
    console.log("Başlangıç verileri yükleniyor..."); // Kontrol için log
    document.getElementById('girdiler-baslik').textContent = 'Bugünkü Girdiler';

    // Paralel olarak yüklenecek işlemlerin Promise'lerini bir diziye ekle
    const promises = [
        ozetVerileriniYukle() // Özet kartları için veri yükle
        // Grafik oluşturma çağrıları raporlar.js'e taşındığı için buradan kaldırıldı.
    ];

    // Eğer kullanıcı muhasebeci değilse, tedarikçi listesini de yüklemesi gerekiyor
    if (kullaniciRolu !== 'muhasebeci') {
        // tedarikcileriYukle() fonksiyonu zaten async, doğrudan diziye ekleyebiliriz
        promises.push(tedarikcileriYukle());
    }

    try {
        // Tüm Promise'lerin BİRLİKTE tamamlanmasını bekle
        await Promise.all(promises);
        console.log("Özet ve Tedarikçiler (gerekiyorsa) yüklendi."); // Kontrol için log

        // Önemli: girdileriGoster fonksiyonunu ancak yukarıdaki işlemler BİTTİKTEN SONRA çağır.
        // Çünkü girdileriGoster, çevrimdışı girdileri birleştirirken ui.tumTedarikciler listesine ihtiyaç duyuyor.
        await girdileriGoster(1); // Girdileri yükle ve göster (await eklendi)

    } catch (error) {
        console.error("Başlangıç verileri yüklenirken bir hata oluştu:", error);
        gosterMesaj("Başlangıç verileri yüklenemedi. Lütfen sayfayı yenileyin.", "danger");
        // Hata durumunda bile arayüzün takılı kalmaması için girdileri boş göster
        ui.renderGirdiler([], mevcutGorunum);
    }
}


/**
 * Seçilen tarihe göre özet verilerini yükler ve arayüzü günceller.
 * (Bu fonksiyon async olmalı çünkü içinde await api.fetchGunlukOzet var)
 */
async function ozetVerileriniYukle(tarih = null) {
    ui.toggleOzetPanelsLoading(true); // Yükleniyor animasyonunu başlat
    const effectiveDate = tarih || utils.getLocalDateString(new Date()); // Tarih yoksa bugünü kullan
    const cacheKey = `ozet_${effectiveDate}`; // Önbellek anahtarı

    // İnternet yoksa önbellekten yüklemeyi dene
    if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            try {
                ui.updateOzetPanels(JSON.parse(cachedData), effectiveDate);
            } catch (e) {
                 console.error("Önbellek verisi okunamadı:", e);
                 ui.updateOzetPanels(null, effectiveDate, true); // Hata durumunu göster
            }
        } else {
            ui.updateOzetPanels(null, effectiveDate, true); // Önbellekte de yoksa hata göster
        }
        ui.toggleOzetPanelsLoading(false); // Yükleniyor animasyonunu bitir
        return;
    }

    // İnternet varsa API'den çek
    try {
        const data = await api.fetchGunlukOzet(effectiveDate); // await eklendi
        ui.updateOzetPanels(data, effectiveDate);
        // Başarılı olursa önbelleğe kaydet
        localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
        console.error("Özet yüklenirken hata:", error);
        ui.updateOzetPanels(null, effectiveDate, true); // Hata durumunu göster
    } finally {
        ui.toggleOzetPanelsLoading(false); // Yükleniyor animasyonunu bitir
    }
}

/**
 * Süt girdilerini sunucudan/yerelden alır ve arayüzde gösterir.
 * (Bu fonksiyon async olmalı çünkü içinde await api.fetchSutGirdileri ve await bekleyenGirdileriGetir var)
 */
async function girdileriGoster(sayfa = 1, tarih = null) {
    mevcutSayfa = sayfa;
    // Tarihi al (ya fonksiyondan gelen ya da tarih seçiciden, yoksa bugün)
    const effectiveDate = tarih || (ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString(new Date()));
    const cacheKey = `girdiler_${effectiveDate}_sayfa_${sayfa}`;

    ui.showGirdilerLoadingSkeleton(mevcutGorunum); // Yükleniyor iskeletini göster

    // İnternet yoksa önbellekten yükle
    if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            try {
                const { girdiler, toplam_girdi_sayisi } = JSON.parse(cachedData);
                 // Çevrimdışı girdileri de birleştirmeyi dene (eğer tarih bugünse)
                const bekleyenGirdiler = await bekleyenGirdileriGetir();
                const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler({ girdiler: girdiler, toplam_girdi_sayisi: toplam_girdi_sayisi }, bekleyenGirdiler, effectiveDate);

                ui.renderGirdiler(tumGirdiler, mevcutGorunum);
                // Sayfalamayı toplam girdi sayısına göre oluştur
                ui.sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, sayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, effectiveDate));

            } catch(e) {
                 console.error("Önbellek verisi (girdiler) okunamadı:", e);
                 ui.renderGirdiler([], mevcutGorunum); // Hata durumunda boş göster
            }
        } else {
            ui.renderGirdiler([], mevcutGorunum); // Önbellekte de yoksa boş göster
        }
        return;
    }

    // İnternet varsa API'den çek
    try {
        // Sunucudan veriyi al
        const sunucuVerisi = await api.fetchSutGirdileri(effectiveDate, sayfa); // await eklendi
        // Başarılı olursa önbelleğe kaydet
        localStorage.setItem(cacheKey, JSON.stringify(sunucuVerisi));

        // IndexedDB'deki bekleyen girdileri al
        const bekleyenGirdiler = await bekleyenGirdileriGetir(); // await eklendi
        // Sunucu verisi ile bekleyenleri birleştir (ui.js'deki fonksiyon)
        const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, effectiveDate);

        // Birleştirilmiş veriyi ekrana render et
        ui.renderGirdiler(tumGirdiler, mevcutGorunum);
        // Sayfalamayı toplam girdi sayısına göre oluştur
        ui.sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, sayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, effectiveDate));

    } catch (error) {
        console.error("Girdileri gösterirken hata:", error);
        gosterMesaj("Girdiler yüklenirken bir hata oluştu.", "danger");
        ui.renderGirdiler([], mevcutGorunum); // Hata durumunda boş göster
    }
}


/**
 * Tedarikçi listesini yükler ve seçim kutusunu doldurur.
 * (FONKSİYONUN DÜZELTİLMİŞ HALİ - async eklendi)
 */
async function tedarikcileriYukle() { // async eklendi
    // Eğer TomSelect başlatılmadıysa (örn. muhasebeci ise) çık
    if (!ui.tedarikciSecici) {
        console.log("Tedarikçi seçici (TomSelect) bu rol için aktif değil.");
        return;
    }
    console.log("Tedarikçiler yükleniyor..."); // Kontrol için log
    try {
        // store.js'deki async fonksiyonu await ile bekle
        const tedarikciler = await store.getTedarikciler();
        console.log("Tedarikçiler store'dan alındı:", tedarikciler); // Kontrol için log
        ui.tumTedarikciler = tedarikciler; // Gelecekteki çevrimdışı birleştirme için sakla
        ui.doldurTedarikciSecici(tedarikciler); // ui.js'deki fonksiyonla TomSelect'i doldur
        console.log("Tedarikçi seçici dolduruldu."); // Kontrol için log
    } catch (error) {
        console.error("Tedarikçiler yüklenirken hata:", error);
        gosterMesaj("Tedarikçiler yüklenemedi.", "danger");
    }
}


// ====================================================================================
// OLAY YÖNETİCİLERİ (EVENT HANDLERS) - BU KISIM AYNI KALIYOR
// ====================================================================================

// ... (girdileriFiltrele, filtreyiTemizle, sutGirdisiEkle, degeriDogrulaVeKaydet, gercekKaydetmeIsleminiYap, ...)
// ... (sutGirdisiDuzenle, sutGirdisiSil, gecmisiGoster, sifreDegistir, verileriDisaAktar, ...)
// ... (gorunumuAyarla, gorunumuDegistir fonksiyonları burada veya ui.js'de olabilir, önceki kodda burada olduğu için burada bırakıyorum)

function girdileriFiltrele() {
    const secilenTarih = ui.tarihFiltreleyici.selectedDates[0];
    if (secilenTarih) {
        const formatliTarih = utils.getLocalDateString(secilenTarih);
        ui.updateGirdilerBaslik(formatliTarih); // Başlığı güncelle (ui.js içinde)
        girdileriGoster(1, formatliTarih);    // Girdileri yükle
        ozetVerileriniYukle(formatliTarih); // Özet kartlarını yükle
    }
}

function filtreyiTemizle() {
    // Tarih seçiciyi bugüne ayarla, bu otomatik olarak onChange olayını tetikleyip
    // girdileriFiltrele fonksiyonunu çağıracaktır (ui.js'deki flatpickr ayarı sayesinde).
    if (ui.tarihFiltreleyici) {
        ui.tarihFiltreleyici.setDate(new Date(), true); // true parametresi onChange'i tetikler
    }
}

// Yeni süt girdisi ekleme butonu tıklandığında
async function sutGirdisiEkle() {
    const { tedarikciId, litre, fiyat } = ui.getGirdiFormVerisi(); // Veriyi formdan al (ui.js içinde)
    if (!tedarikciId || !litre || !fiyat || parseFloat(litre) <= 0) {
        gosterMesaj("Lütfen tüm alanları doğru doldurun ve litre 0'dan büyük olsun.", "warning");
        return;
    }

    const yeniGirdi = {
        tedarikci_id: parseInt(tedarikciId),
        litre: parseFloat(litre),
        fiyat: parseFloat(fiyat)
    };
    // Değeri doğrulayıp kaydetmeyi dene (anormal değer kontrolü içerir)
    await degeriDogrulaVeKaydet(yeniGirdi);
}

// Litre değerinin normallik kontrolünü yapar ve kaydetme işlemine devam eder
async function degeriDogrulaVeKaydet(girdi) {
    // İnternet yoksa veya istatistik verisi yoksa direkt kaydet
    if (!navigator.onLine || !mevcutTedarikciIstatistikleri) {
        await gercekKaydetmeIsleminiYap(girdi);
        return;
    }

    const { ortalama_litre, standart_sapma } = mevcutTedarikciIstatistikleri;
    const girilenLitre = girdi.litre;

    // Eğer ortalama hesaplanabildiyse kontrol yap
    if (ortalama_litre > 0) {
        let altSinir, ustSinir;

        // Standart sapma varsa +/- 2 standart sapma aralığını kullan
        if (standart_sapma > 0) {
            altSinir = ortalama_litre - (standart_sapma * 2);
            ustSinir = ortalama_litre + (standart_sapma * 2);
        } else {
            // Standart sapma yoksa (az veri varsa), ortalamanın %50'si kadar tolerans bırak
            const tolerans = Math.max(ortalama_litre * 0.5, 5); // En az 5 litre tolerans
            altSinir = ortalama_litre - tolerans;
            ustSinir = ortalama_litre + tolerans;
        }
        altSinir = Math.max(0, altSinir); // Alt sınır 0'dan küçük olamaz

        // Girilen değer normal aralığın dışındaysa kullanıcıyı uyar
        if (girilenLitre < altSinir || girilenLitre > ustSinir) {
            const mesaj = `Girdiğiniz <strong>${girilenLitre} Litre</strong> değeri, bu tedarikçinin ortalama (${ortalama_litre.toFixed(1)} L) girdisinden farklı görünüyor. Emin misiniz?`;
            document.getElementById('onay-mesaji').innerHTML = mesaj; // Modal içindeki mesajı ayarla

            // Modaldaki "Onayla ve Kaydet" butonunun tıklama olayını ayarla
            document.getElementById('onayla-ve-kaydet-btn').onclick = async () => {
                veriOnayModal.hide(); // Modalı kapat
                await gercekKaydetmeIsleminiYap(girdi); // Kaydetmeye devam et
            };

            veriOnayModal.show(); // Uyarı modalını göster
            return; // Kullanıcı onaylayana kadar işlemi durdur
        }
    }
    // Değer normalse veya kontrol yapılamadıysa direkt kaydet
    await gercekKaydetmeIsleminiYap(girdi);
}


// Kaydetme işlemini gerçekleştiren fonksiyon (online/offline durumunu yönetir)
async function gercekKaydetmeIsleminiYap(yeniGirdi) {
    // --- ÇEVRİMDIŞI KAYDETME ---
    if (!navigator.onLine) {
        ui.toggleGirdiKaydetButton(true); // Kaydet butonunu "Kaydediliyor..." yap
        try {
            // Lisans kontrolünü yap (ui.js içinde)
            const isOfflineUserValid = await ui.checkOfflineUserLicense();
            if (!isOfflineUserValid) return; // Lisans geçersizse çık

            // Girdiyi IndexedDB'ye kaydet (offline.js içinde)
            const basarili = await kaydetCevrimdisi(yeniGirdi);
            if (basarili) {
                ui.resetGirdiFormu(); // Formu temizle
                await girdileriGoster(); // Listeyi yenile (offline girdi ile birlikte)
            }
        } finally {
            ui.toggleGirdiKaydetButton(false); // Kaydet butonunu eski haline getir
        }
        return;
    }

    // --- İYİMSER ARAYÜZ GÜNCELLEMESİ (ONLINE) ---
    const listeElementi = document.getElementById('girdiler-listesi');
    const kartListesi = document.getElementById('girdiler-kart-listesi');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    const geciciId = `gecici-${Date.now()}`; // Benzersiz bir geçici ID
    // Tedarikçi adını TomSelect'ten al
    const tedarikciAdi = ui.tedarikciSecici && ui.tedarikciSecici.options[yeniGirdi.tedarikci_id] ? ui.tedarikciSecici.options[yeniGirdi.tedarikci_id].text : 'Bilinmeyen Tedarikçi';
    // Kullanıcı adını al (offlineUser'dan veya session'dan - basitlik için offlineUser varsayalım)
    const kullaniciAdi = JSON.parse(localStorage.getItem('offlineUser'))?.kullanici_adi || 'Siz';
    const anlikSaat = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const tutar = yeniGirdi.litre * yeniGirdi.fiyat;

    // Seçili görünüme göre geçici "Kaydediliyor..." elemanı oluştur
    let geciciElementHTML = '';
    if (mevcutGorunum === 'liste') {
        geciciElementHTML = `
            <div class="list-group-item" id="${geciciId}" style="opacity: 0.6;">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1 girdi-baslik">${tedarikciAdi} - ${yeniGirdi.litre} Litre <span class="badge bg-info text-dark ms-2"><i class="bi bi-arrow-repeat"></i> Kaydediliyor...</span></h5>
                </div>
                <p class="mb-1 girdi-detay">Toplayan: ${kullaniciAdi} | Saat: ${anlikSaat}</p>
            </div>`;
        listeElementi.insertAdjacentHTML('afterbegin', geciciElementHTML); // Listenin başına ekle
    } else {
        geciciElementHTML = `
            <div class="col-xl-6 col-12" id="${geciciId}" style="opacity: 0.6;">
                <div class="card p-2 h-100">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-start">
                             <div>
                                <h6 class="card-title mb-0">${tedarikciAdi}</h6>
                                <small class="text-secondary">Toplayan: ${kullaniciAdi}</small>
                            </div>
                            <span class="badge bg-info text-dark"><i class="bi bi-arrow-repeat"></i> Kaydediliyor...</span>
                        </div>
                         <div class="d-flex justify-content-between align-items-center my-2">
                            <span class="fs-4 fw-bold text-primary">${yeniGirdi.litre} L</span>
                            <span class="fs-5 fw-bold text-success">${tutar.toFixed(2)} TL</span>
                        </div>
                        <small class="text-secondary">Saat: ${anlikSaat}</small>
                    </div>
                </div>
            </div>`;
         kartListesi.insertAdjacentHTML('afterbegin', geciciElementHTML); // Kart listesinin başına ekle
    }

    if (veriYokMesaji) veriYokMesaji.style.display = 'none'; // "Veri yok" mesajını gizle
    const geciciElement = document.getElementById(geciciId); // Eklenen elemanı bul

    const orjinalFormVerisi = { ...yeniGirdi }; // Hata durumunda formu geri doldurmak için sakla
    ui.resetGirdiFormu(); // Formu temizle
    ui.toggleGirdiKaydetButton(true); // Kaydet butonunu "Kaydediliyor..." yap

    // API'ye kaydetmeyi dene
    try {
        const result = await api.postSutGirdisi(yeniGirdi); // await eklendi
        gosterMesaj("Süt girdisi başarıyla kaydedildi.", "success");

        // Geçici elemanı kaldır
        if(geciciElement) geciciElement.remove();

        // Özet kartlarını ve listeyi API'den dönen güncel verilerle yenile
        const bugun = utils.getLocalDateString(); // Bugünün tarihini al
        ui.updateOzetPanels(result.yeni_ozet, bugun);
        await girdileriGoster(1, bugun); // Listenin ilk sayfasını yenile (await eklendi)

        // Grafik verilerini güncellemek için ilgili fonksiyonları çağır (artık raporlar sayfasında)
        // Bu fonksiyonların raporlar.js içinde global olduğunu varsayıyoruz
        /* if (typeof charts !== 'undefined') {
            charts.haftalikGrafigiOlustur();
            charts.tedarikciGrafigiOlustur();
        } */

    } catch (error) {
        console.error("İyimser ekleme başarısız oldu:", error);
        gosterMesaj("Kayıt başarısız: " + (error.message || 'İnternet bağlantınızı kontrol edin.'), "danger");

        // Geçici elemanı kaldır
         if(geciciElement) geciciElement.remove();

        // Formu eski değerlerle doldur
        if(ui.tedarikciSecici) ui.tedarikciSecici.setValue(orjinalFormVerisi.tedarikci_id);
        document.getElementById('litre-input').value = orjinalFormVerisi.litre;
        document.getElementById('fiyat-input').value = orjinalFormVerisi.fiyat;

        // Eğer liste boş kaldıysa "veri yok" mesajını tekrar göster
        if (listeElementi.children.length === 0 && kartListesi.children.length === 0 && veriYokMesaji) {
            veriYokMesaji.style.display = 'block';
        }
    } finally {
        ui.toggleGirdiKaydetButton(false); // Kaydet butonunu eski haline getir
    }
}


// Süt girdisi düzenleme modalındaki kaydet butonuna basılınca
async function sutGirdisiDuzenle() {
    // İnternet yoksa uyarı ver ve çık
    if (!navigator.onLine) {
        gosterMesaj("Girdileri düzenlemek için internet bağlantısı gereklidir.", "warning");
        return;
    }
    // Formdan verileri al (ui.js içinde)
    const { girdiId, yeniLitre, yeniFiyat, duzenlemeSebebi } = ui.getDuzenlemeFormVerisi();
    if (!yeniLitre || !yeniFiyat || parseFloat(yeniLitre) <= 0) { // Fiyat 0 olabilir mi? Kalsın şimdilik. Litre > 0 olmalı.
        gosterMesaj("Lütfen yeni litre ve fiyat değerlerini girin (Litre 0'dan büyük olmalı).", "warning");
        return;
    }

    // API'ye güncelleme isteği gönder
    try {
        const result = await api.updateSutGirdisi(girdiId, { // await eklendi
            yeni_litre: parseFloat(yeniLitre),
            yeni_fiyat: parseFloat(yeniFiyat),
            duzenleme_sebebi: duzenlemeSebebi
        });
        gosterMesaj("Girdi başarıyla güncellendi.", "success");
        ui.duzenleModal.hide(); // Modalı kapat

        // Güncellemenin yapıldığı tarihi al (eğer tarih filtresi aktifse)
        const formatliTarih = ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
        // Özet kartlarını güncelle
        ui.updateOzetPanels(result.yeni_ozet, formatliTarih);
        // Listeyi güncelle (mevcut sayfada kalarak)
        await girdileriGoster(mevcutSayfa, formatliTarih); // await eklendi
    } catch (error) {
        gosterMesaj(`Girdi düzenlenemedi: ${error.message || 'Bilinmeyen hata.'}`, "danger");
    }
}

// Silme onay modalındaki "Evet, Sil" butonuna basılınca
async function sutGirdisiSil() {
    // İnternet yoksa uyarı ver ve çık
    if (!navigator.onLine) {
        gosterMesaj("Girdileri silmek için internet bağlantısı gereklidir.", "warning");
        ui.silmeOnayModal.hide();
        return;
    }
    const girdiId = ui.getSilinecekGirdiId(); // Silinecek ID'yi al (ui.js içinde)
    ui.silmeOnayModal.hide(); // Modalı kapat

    // --- İYİMSER ARAYÜZ GÜNCELLEMESİ ---
    // Silinecek elemanı bul (liste veya kart görünümüne göre)
    const silinecekElement = document.getElementById(mevcutGorunum === 'liste' ? `girdi-liste-${girdiId}` : `girdi-kart-${girdiId}`);
    if (!silinecekElement) return; // Eleman bulunamazsa çık

    // Hata durumunda geri yükleyebilmek için bilgilerini sakla
    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    const originalHTML = silinecekElement.outerHTML;

    // Elemanı animasyonla kaldır
    silinecekElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    silinecekElement.style.opacity = '0';
    silinecekElement.style.transform = 'translateX(-50px)';
    // Animasyon bittikten sonra DOM'dan kaldır
    setTimeout(() => { if(silinecekElement.parentNode) silinecekElement.remove() }, 400);

    // API'ye silme isteği gönder
    try {
        const result = await api.deleteSutGirdisi(girdiId); // await eklendi
        gosterMesaj(result.message, 'success');

        // Silme işleminin yapıldığı tarihi al
        const formatliTarih = ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
        // Özet kartlarını güncelle
        ui.updateOzetPanels(result.yeni_ozet, formatliTarih);
        // Listeyi ve sayfalamayı güncelle (ilk sayfaya dönerek)
        await girdileriGoster(1, formatliTarih); // await eklendi

    } catch (error) {
        console.error("İyimser silme başarısız oldu:", error);
        gosterMesaj('Silme işlemi başarısız, girdi geri yüklendi.', 'danger');

        // --- HATA DURUMUNDA GERİ YÜKLEME ---
        if (originalHTML && parent) {
             const tempDiv = document.createElement(mevcutGorunum === 'kart' ? 'div' : 'tbody');
             tempDiv.innerHTML = originalHTML;
             const restoredElement = tempDiv.firstChild;
             restoredElement.style.opacity = '1'; // Stilleri sıfırla
             restoredElement.style.transform = 'translateX(0)';
             parent.insertBefore(restoredElement, nextSibling); // Eski yerine ekle
             // "Veri yok" mesajı varsa gizle
             const veriYokMesaji = document.getElementById('veri-yok-mesaji');
             if(veriYokMesaji) veriYokMesaji.style.display = 'none';
        }
        // İsteğe bağlı: Listeyi tam senkronize etmek için yeniden yükle
        // await girdileriGoster(mevcutSayfa, formatliTarih);
    }
}


// Geçmiş ikonuna tıklanınca
async function gecmisiGoster(girdiId) {
    ui.gecmisModal.show(); // Modalı aç
    ui.renderGecmisModalContent(null, true); // Modal içine yükleniyor animasyonu koy (ui.js)
    try {
        // API'den geçmiş verisini çek
        const gecmisKayitlari = await api.fetchGirdiGecmisi(girdiId); // await eklendi
        // Modal içeriğini doldur (ui.js)
        ui.renderGecmisModalContent(gecmisKayitlari);
    } catch (error) {
        // Hata olursa modal içinde hata göster (ui.js)
        ui.renderGecmisModalContent(null, false, error.message);
    }
}

// Şifre değiştirme modalındaki kaydet butonuna basılınca (Profil sayfasında olmalı ama burada kalmış)
// Bu fonksiyonun profil.js'e taşınması daha mantıklı olur. Şimdilik burada bırakıyorum.
async function sifreDegistir() {
    // Verileri formdan al (ui.js)
    const { mevcutSifre, yeniSifre, yeniSifreTekrar } = ui.getSifreDegistirmeFormVerisi();
    if (!mevcutSifre || !yeniSifre || !yeniSifreTekrar) {
        gosterMesaj("Lütfen tüm şifre alanlarını doldurun.", "warning");
        return;
    }
    // API'ye istek gönder
    try {
        const result = await api.postChangePassword({ mevcut_sifre: mevcutSifre, yeni_sifre: yeniSifre, yeni_sifre_tekrar: yeniSifreTekrar }); // await eklendi
        gosterMesaj(result.message, 'success');
        ui.sifreDegistirModal.hide(); // Modalı kapat
    } catch (error) {
        gosterMesaj(error.message || "Bir hata oluştu.", 'danger');
    }
}

// Excel'e aktar butonuna basılınca
async function verileriDisaAktar() {
    // Seçili tarihi al
    const secilenTarih = ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : null;
    try {
        // API'den CSV blob verisini ve dosya adını al (api.js içinde özel fonksiyon)
        const { filename, blob } = await api.fetchCsvExport(secilenTarih); // await eklendi
        // İndirme işlemini tetikle (utils.js içinde olabilir veya burada)
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(objectUrl); // Hafızayı temizle
        a.remove();
        gosterMesaj("Veriler başarıyla CSV olarak indirildi.", "success");
    } catch (error) {
        gosterMesaj(error.message, "danger");
    }
}


// Liste/Kart görünüm değiştirme butonlarına basılınca
function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return; // Zaten o görünümdeyse bir şey yapma
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('anaPanelGorunum', yeniGorunum); // Seçimi kaydet
    gorunumuAyarla(yeniGorunum); // Arayüzü güncelle
    // Girdileri mevcut sayfaya ve tarihe göre yeniden render et
    const formatliTarih = ui.tarihFiltreleyici && ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString();
    girdileriGoster(mevcutSayfa, formatliTarih);
}

// Arayüzü seçilen görünüme göre ayarlar (div'leri göster/gizle, butonları aktif/pasif yap)
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
        // Kart görünümü için display: flex kullanmak daha iyi olabilir (row içinde oldukları için)
        // Ama style.css'de .row g-3 zaten bunu sağlıyor olabilir, block da iş görür.
        if(kartDiv) kartDiv.style.display = 'block'; // Veya 'flex' deneyebilirsin
        if(listeBtn) listeBtn.classList.remove('active');
        if(kartBtn) kartBtn.classList.add('active');
    }
}

// --- Dosya Sonu ---