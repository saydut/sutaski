// ====================================================================================
// ANA UYGULAMA MANTIĞI (main.js)
// Bu dosya, uygulamanın ana orkestrasyonunu yapar.
// Olay dinleyicilerini (buton tıklamaları vb.) ayarlar ve ilgili
// api.js, ui.js ve charts.js fonksiyonlarını çağırır.
// ====================================================================================

// --- Global Değişkenler ---
let mevcutGorunum = 'liste';
let mevcutSayfa = 1;
const girdilerSayfaBasi = 6;
let mevcutTedarikciIstatistikleri = null; // Tedarikçi istatistiklerini saklamak için yeni değişken
let veriOnayModal = null; // Onay modalı için yeni değişken

/**
 * Uygulama kabuğu yüklendiğinde çalışır.
 * Tarayıcıda kayıtlı kullanıcı varsa bilgileri ekrana basar.
 * Yoksa ve internet de yoksa, giriş sayfasına yönlendirir.
 */
function initOfflineState() {
    const offlineUserString = localStorage.getItem('offlineUser');
    
    if (!document.body.dataset.userRole) {
        if (offlineUserString) {
            const user = JSON.parse(offlineUserString);
            
            document.body.dataset.userRole = user.rol;
            document.body.dataset.lisansBitis = user.lisans_bitis_tarihi;

            const userNameEl = document.getElementById('user-name-placeholder');
            const companyNameEl = document.getElementById('company-name-placeholder');
            const veriGirisPaneli = document.getElementById('veri-giris-paneli');
            
            if (userNameEl) userNameEl.textContent = user.kullanici_adi;
            if (companyNameEl) companyNameEl.textContent = user.sirket_adi;
            
            if (user.rol === 'muhasebeci' && veriGirisPaneli) {
                veriGirisPaneli.style.display = 'none';
            } else if (veriGirisPaneli) {
                 veriGirisPaneli.style.display = 'block';
            }

        } else if (!navigator.onLine) {
            window.location.href = '/login';
        }
    }
}

// Uygulama başlangıç noktası
window.onload = async function() {
    initOfflineState();
    ui.init(); // Temel UI bileşenlerini (modallar, flatpickr) başlatır
    veriOnayModal = new bootstrap.Modal(document.getElementById('veriOnayModal')); 
    ui.lisansUyarisiKontrolEt();

    // --- TomSelect (Tedarikçi Seçici) BAŞLATMA KODU BURAYA TAŞINDI ---
    if (document.getElementById('veri-giris-paneli').style.display !== 'none' && document.getElementById('tedarikci-sec')) {
        ui.tedarikciSecici = new TomSelect("#tedarikci-sec", {
            create: false,
            sortField: { field: "text", direction: "asc" },
            onChange: (value) => {
                // Seçili tedarikçinin istatistiklerini çek
                if (value && navigator.onLine) {
                    api.fetchTedarikciIstatistikleri(value)
                        .then(data => {
                            mevcutTedarikciIstatistikleri = data[0] || null;
                            console.log("İstatistikler yüklendi:", mevcutTedarikciIstatistikleri);
                        })
                        .catch(err => {
                            console.warn("Tedarikçi istatistikleri alınamadı:", err);
                            mevcutTedarikciIstatistikleri = null;
                        });

                    // Son fiyatı getir
                    api.fetchSonFiyat(value).then(data => {
                       if(data && data.son_fiyat) {
                           const fiyatInput = document.getElementById('fiyat-input');
                           fiyatInput.value = parseFloat(data.son_fiyat).toFixed(2);
                           fiyatInput.classList.add('fiyat-guncellendi');
                           setTimeout(() => fiyatInput.classList.remove('fiyat-guncellendi'), 500);
                       }
                    }).catch(err => console.warn("Son fiyat getirilemedi:", err));
                } else {
                    // Seçim temizlenirse istatistikleri de temizle
                    mevcutTedarikciIstatistikleri = null;
                }
            }
        });
    }
    // --- BİTİŞ ---

    mevcutGorunum = localStorage.getItem('anaPanelGorunum') || 'liste';
    gorunumuAyarla(mevcutGorunum);

    await baslangicVerileriniYukle();

    // --- BUTON DİNLEYİCİSİ DÜZELTMESİ ---
    const kaydetBtn = document.getElementById('kaydet-girdi-btn');
    if(kaydetBtn) {
        kaydetBtn.addEventListener('click', sutGirdisiEkle);
    }
    // --- BİTİŞ ---

    const duzenleModalEl = document.getElementById('duzenleModal');
    const silmeOnayModalEl = document.getElementById('silmeOnayModal');
    
    const grafikYenileCallback = () => {
        charts.haftalikGrafigiOlustur();
        charts.tedarikciGrafigiOlustur();
    };

    if (duzenleModalEl) duzenleModalEl.addEventListener('hidden.bs.modal', grafikYenileCallback);
    if (silmeOnayModalEl) silmeOnayModalEl.addEventListener('hidden.bs.modal', grafikYenileCallback);
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
    girdileriGoster(1);
}

/**
 * Seçilen tarihe göre özet verilerini yükler ve arayüzü günceller.
 */
async function ozetVerileriniYukle(tarih = null) {
    ui.toggleOzetPanelsLoading(true);
    const effectiveDate = tarih || utils.getLocalDateString(new Date());
    const cacheKey = `ozet_${effectiveDate}`;

    if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            ui.updateOzetPanels(JSON.parse(cachedData), effectiveDate);
        } else {
            ui.updateOzetPanels(null, effectiveDate, true);
        }
        ui.toggleOzetPanelsLoading(false);
        return;
    }

    try {
        const data = await api.fetchGunlukOzet(effectiveDate);
        ui.updateOzetPanels(data, effectiveDate);
        localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (error) {
        console.error("Özet yüklenirken hata:", error);
        ui.updateOzetPanels(null, effectiveDate, true);
    } finally {
        ui.toggleOzetPanelsLoading(false);
    }
}

/**
 * Süt girdilerini sunucudan/yerelden alır ve arayüzde gösterir.
 */
async function girdileriGoster(sayfa = 1, tarih = null) {
    mevcutSayfa = sayfa;
    const effectiveDate = tarih || (ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : utils.getLocalDateString(new Date()));
    const cacheKey = `girdiler_${effectiveDate}_sayfa_${sayfa}`;

    ui.showGirdilerLoadingSkeleton(mevcutGorunum);

    if (!navigator.onLine) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            const { girdiler, toplam_girdi_sayisi } = JSON.parse(cachedData);
            ui.renderGirdiler(girdiler, mevcutGorunum);
            ui.sayfalamaNavOlustur('girdiler-sayfalama', toplam_girdi_sayisi, sayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, effectiveDate));
        } else {
            ui.renderGirdiler([], mevcutGorunum);
        }
        return; 
    }
    
    try {
        const sunucuVerisi = await api.fetchSutGirdileri(effectiveDate, sayfa);
        localStorage.setItem(cacheKey, JSON.stringify(sunucuVerisi));

        const bekleyenGirdiler = await bekleyenGirdileriGetir();
        const { tumGirdiler, toplamGirdi } = ui.mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, effectiveDate);
        
        ui.renderGirdiler(tumGirdiler, mevcutGorunum);
        ui.sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, sayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, effectiveDate));

    } catch (error) {
        console.error("Girdileri gösterirken hata:", error);
        ui.renderGirdiler([], mevcutGorunum);
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
// ====================================================================================

function girdileriFiltrele() {
    const secilenTarih = ui.tarihFiltreleyici.selectedDates[0];
    if (secilenTarih) {
        const formatliTarih = utils.getLocalDateString(secilenTarih);
        ui.updateGirdilerBaslik(formatliTarih);
        girdileriGoster(1, formatliTarih);
        ozetVerileriniYukle(formatliTarih);
    }
}

function filtreyiTemizle() {
    ui.tarihFiltreleyici.setDate(new Date(), true);
    baslangicVerileriniYukle();
}

// --- AKILLI DOĞRULAMA ENTEGRASYONU ---

async function sutGirdisiEkle() {
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

    // Değeri doğrula ve kaydetme işlemine devam et
    await degeriDogrulaVeKaydet(yeniGirdi);
}

/**
 * Girilen değeri tedarikçinin istatistikleriyle karşılaştırır ve gerekirse onay ister.
 * @param {object} girdi - Kaydedilecek girdi verisi.
 */
async function degeriDogrulaVeKaydet(girdi) {
    // Çevrimdışıysak veya istatistik verisi yoksa, kontrol etmeden direkt kaydet.
    if (!navigator.onLine || !mevcutTedarikciIstatistikleri) {
        await gercekKaydetmeIsleminiYap(girdi);
        return;
    }

    const { ortalama_litre, standart_sapma } = mevcutTedarikciIstatistikleri;
    const girilenLitre = girdi.litre;

    // Anlamlı bir istatistik varsa (ortalama 0'dan büyükse) kontrol yap.
    if (ortalama_litre > 0) {
        let altSinir, ustSinir;

        if (standart_sapma > 0) {
            // DURUM 1: Verilerde değişkenlik var. İstatistiksel aralığı kullan.
            altSinir = ortalama_litre - (standart_sapma * 2);
            ustSinir = ortalama_litre + (standart_sapma * 2);
        } else {
            // DURUM 2 (HATA DÜZELTMESİ): Standart sapma 0. Tüm geçmiş girdiler aynı.
            const tolerans = Math.max(ortalama_litre * 0.5, 5); 
            altSinir = ortalama_litre - tolerans;
            ustSinir = ortalama_litre + tolerans;
        }

        // Eğer girilen değer hesaplanan "normal" aralığın dışındaysa...
        if (girilenLitre < altSinir || girilenLitre > ustSinir) {
            const mesaj = `Girdiğiniz <strong>${girilenLitre} Litre</strong> değeri, bu tedarikçinin ortalama (${ortalama_litre.toFixed(1)} L) girdisinden farklı görünüyor. Emin misiniz?`;
            document.getElementById('onay-mesaji').innerHTML = mesaj;
            
            document.getElementById('onayla-ve-kaydet-btn').onclick = async () => {
                veriOnayModal.hide();
                await gercekKaydetmeIsleminiYap(girdi);
            };

            veriOnayModal.show();
            return; // Onay beklediğimiz için burada duruyoruz.
        }
    }

    // Değer normalse veya kontrol için yeterli veri yoksa, direkt kaydet.
    await gercekKaydetmeIsleminiYap(girdi);
}

/**
 * Asıl kaydetme mantığını içeren fonksiyon (iyimser güncelleme ve çevrimdışı).
 * @param {object} yeniGirdi - Kaydedilecek girdi verisi.
 */
async function gercekKaydetmeIsleminiYap(yeniGirdi) {
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

    const listeElementi = document.getElementById('girdiler-listesi');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    const geciciId = `gecici-${Date.now()}`;
    const tedarikciAdi = ui.tedarikciSecici.options[yeniGirdi.tedarikci_id].text;
    const kullaniciAdi = JSON.parse(localStorage.getItem('offlineUser'))?.kullanici_adi || 'Siz';

    const geciciElement = document.createElement('div');
    geciciElement.className = 'list-group-item';
    geciciElement.id = geciciId;
    geciciElement.style.opacity = '0.6';
    geciciElement.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
            <h5 class="mb-1 girdi-baslik">${tedarikciAdi} - ${yeniGirdi.litre} Litre <span class="badge bg-info text-dark ms-2"><i class="bi bi-arrow-repeat"></i> Kaydediliyor...</span></h5>
        </div>
        <p class="mb-1 girdi-detay">Toplayan: ${kullaniciAdi} | Saat: ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</p>
    `;
    
    veriYokMesaji.style.display = 'none';
    listeElementi.prepend(geciciElement);

    const orjinalFormVerisi = { ...yeniGirdi };
    ui.resetGirdiFormu();

    try {
        const result = await api.postSutGirdisi(yeniGirdi);
        gosterMesaj("Süt girdisi başarıyla kaydedildi.", "success");
        const bugun = utils.getLocalDateString();
        ui.updateOzetPanels(result.yeni_ozet, bugun);
        
        charts.haftalikGrafigiOlustur();
        charts.tedarikciGrafigiOlustur();

        await girdileriGoster(1, bugun);

    } catch (error) {
        console.error("İyimser ekleme başarısız oldu:", error);
        gosterMesaj("Kayıt başarısız. İnternet bağlantınızı kontrol edin.", "danger");
        
        document.getElementById(geciciId)?.remove();
        
        ui.tedarikciSecici.setValue(orjinalFormVerisi.tedarikci_id);
        document.getElementById('litre-input').value = orjinalFormVerisi.litre;
        document.getElementById('fiyat-input').value = orjinalFormVerisi.fiyat;
        
        if (listeElementi.children.length === 0) {
            veriYokMesaji.style.display = 'block';
        }
    }
}

// --- DİĞER OLAY YÖNETİCİLERİ ---

async function sutGirdisiDuzenle() {
    const { girdiId, yeniLitre, yeniFiyat, duzenlemeSebebi } = ui.getDuzenlemeFormVerisi();
    if (!yeniLitre || !yeniFiyat) {
        gosterMesaj("Lütfen yeni litre ve fiyat değerlerini girin.", "warning");
        return;
    }
    
    try {
        const result = await api.updateSutGirdisi(girdiId, { 
            yeni_litre: parseFloat(yeniLitre), 
            yeni_fiyat: parseFloat(yeniFiyat),
            duzenleme_sebebi: duzenlemeSebebi 
        });
        gosterMesaj("Girdi başarıyla güncellendi.", "success");
        ui.duzenleModal.hide();
        const formatliTarih = ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : null;
        ui.updateOzetPanels(result.yeni_ozet, formatliTarih);
        await girdileriGoster(mevcutSayfa, formatliTarih);
    } catch (error) {
        gosterMesaj(`Girdi düzenlenemedi: ${error.message || 'Bilinmeyen hata.'}`, "danger");
    }
}

async function sutGirdisiSil() {
    const girdiId = ui.getSilinecekGirdiId();
    ui.silmeOnayModal.hide();

    const silinecekElement = document.getElementById(mevcutGorunum === 'liste' ? `girdi-liste-${girdiId}` : `girdi-kart-${girdiId}`);
    if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    silinecekElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    silinecekElement.style.opacity = '0';
    silinecekElement.style.transform = 'translateX(-50px)';
    
    setTimeout(() => silinecekElement.remove(), 400);

    try {
        const result = await api.deleteSutGirdisi(girdiId);
        gosterMesaj(result.message, 'success');
        const formatliTarih = ui.tarihFiltreleyici.selectedDates[0] ? utils.getLocalDateString(ui.tarihFiltreleyici.selectedDates[0]) : null;
        ui.updateOzetPanels(result.yeni_ozet, formatliTarih);
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


