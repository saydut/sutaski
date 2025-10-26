// static/js/ciftci_panel.js

// --- Çiftçi Portalı için Global Değişkenler ---
let ciftciSutSayfasi = 1;
let ciftciYemSayfasi = 1;
const CIFTCI_SAYFA_BASI = 10; // Çiftçi listeleri için sayfa başına öğe sayısı
// kullaniciRolu değişkeni main.js'de tanımlı ve burada da erişilebilir olmalı
// Eğer main.js'deki kullaniciRolu global değilse, onu burada tekrar tanımlamak gerekebilir.
// Şimdilik main.js'deki global olduğunu varsayalım.
// let kullaniciRolu = null; // Gerekirse bu satırı açıp main.js'den rolü alacak kodu ekle

/**
 * Çiftçi Paneli Başlatma Fonksiyonu
 * main.js tarafından çağrılır.
 */
async function initCiftciPanel() {
    console.log("Çiftçi Paneli Başlatılıyor...");
    arayuzuRoleGoreAyarla(); // Önce arayüzü ayarla
    await ciftciVerileriniYukle(); // Sonra verileri yükle
}

/**
 * Arayüzü Çiftçi Rolüne Göre Ayarlar
 * Normal panel elementlerini gizler, çiftçi panelini gösterir.
 */
function arayuzuRoleGoreAyarla() {
    const normalPanelElements = document.querySelectorAll('.normal-panel-icerik'); // Normal panel öğeleri (index.html'e bu class eklenecek)
    const ciftciPanelElement = document.getElementById('ciftci-panel'); // Çiftçi paneli container (index.html'e eklenecek)
    const anaWrapper = document.querySelector('.main-wrapper'); // Ana içerik alanı

    if (kullaniciRolu === 'ciftci') {
        // Ana wrapper'dan normal panel içeriğini gizle
        if(anaWrapper) {
            // Sadece .normal-panel-icerik sınıfına sahip olmayanları (yani çiftçi panelini) bırak
             Array.from(anaWrapper.children).forEach(child => {
                 if (!child.classList.contains('ciftci-panel-ana') && child.id !== 'alert-container') { // alert-container hariç
                     child.style.display = 'none';
                 }
             });
        }

        // Çiftçi panelini göster
        if (ciftciPanelElement) {
             ciftciPanelElement.style.display = 'block';
             // ciftci-panel-ana sınıfını ana wrapper'a ekleyerek sadece çiftçi içeriğini göster
             if(anaWrapper) anaWrapper.classList.add('ciftci-panel-ana');
        }

        // Üstteki Hızlı İşlemler menüsünü de gizleyebiliriz (isteğe bağlı)
         const hizliIslemler = document.querySelector('.d-flex.align-items-center.gap-2.flex-wrap');
         // if (hizliIslemler) hizliIslemler.style.display = 'none'; // Şimdilik kalsın, belki profiline erişmek ister.

        // Alt navigasyon barını da çiftçiye göre ayarlayalım (Gerekirse)
        const bottomNav = document.querySelector('.bottom-nav-custom');
        if (bottomNav) {
            // Sadece Anasayfa ve Profil linklerini bırakabiliriz veya hepsini kaldırabiliriz
            // Şimdilik varsayılan bırakalım.
        }

    } else {
         // Bu dosya sadece çiftçi için çalışmalı, diğer roller için main.js devreye girer.
         // Ama güvenlik için çiftçi değilse gizleme kodu eklenebilir.
         if (ciftciPanelElement) ciftciPanelElement.style.display = 'none';
         if(anaWrapper) anaWrapper.classList.remove('ciftci-panel-ana');
    }
}


/**
 * Çiftçi Paneli için gerekli verileri API'dan çeker.
 */
async function ciftciVerileriniYukle() {
    const ozetContainer = document.getElementById('ciftci-ozet-kartlari');
    const sutTabloBody = document.getElementById('ciftci-sut-tablosu');
    const yemTabloBody = document.getElementById('ciftci-yem-tablosu');
    const sutVeriYok = document.getElementById('ciftci-sut-veri-yok');
    const yemVeriYok = document.getElementById('ciftci-yem-veri-yok');

    // Yükleniyor göstergelerini ayarla
    if (ozetContainer) ozetContainer.innerHTML = '<div class="col-12 text-center p-5"><div class="spinner-border text-primary"></div></div>';
    if (sutTabloBody) sutTabloBody.innerHTML = '<tr><td colspan="4" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
    if (yemTabloBody) yemTabloBody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
    if(sutVeriYok) sutVeriYok.style.display = 'none';
    if(yemVeriYok) yemVeriYok.style.display = 'none';


    try {
        // API'lerden verileri paralel olarak çek (api.js'deki request fonksiyonunu kullanıyoruz)
        const [ozetData, sutData, yemData] = await Promise.all([
            api.request('/api/ciftci/ozet'),
            api.request(`/api/ciftci/sut_girdileri?sayfa=${ciftciSutSayfasi}&limit=${CIFTCI_SAYFA_BASI}`),
            api.request(`/api/ciftci/yem_alimlarim?sayfa=${ciftciYemSayfasi}&limit=${CIFTCI_SAYFA_BASI}`)
        ]);

        renderCiftciOzet(ozetData);
        renderCiftciSutGirdileri(sutData.girdiler);
        ui.sayfalamaNavOlustur('ciftci-sut-sayfalama', sutData.toplam_kayit, ciftciSutSayfasi, CIFTCI_SAYFA_BASI, ciftciSutSayfasiniDegistir);
        renderCiftciYemAlimlari(yemData.islemler);
        ui.sayfalamaNavOlustur('ciftci-yem-sayfalama', yemData.toplam_kayit, ciftciYemSayfasi, CIFTCI_SAYFA_BASI, ciftciYemSayfasiniDegistir);

    } catch (error) {
        gosterMesaj(error.message || 'Çiftçi verileri yüklenirken bir hata oluştu.', 'danger');
        if (ozetContainer) ozetContainer.innerHTML = '<div class="col-12 text-center p-4 text-danger">Özet yüklenemedi.</div>';
        if (sutTabloBody) sutTabloBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger p-3">Süt girdileri yüklenemedi.</td></tr>';
        if (yemTabloBody) yemTabloBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger p-3">Yem alımları yüklenemedi.</td></tr>';
    }
}

/**
 * Çiftçi özet kartlarını doldurur.
 * @param {object} ozet - API'dan gelen özet verisi.
 */
function renderCiftciOzet(ozet) {
    const container = document.getElementById('ciftci-ozet-kartlari');
    if (!container) return;
    // AnimateCounter fonksiyonu ui.js içinde tanımlı olmalı
    container.innerHTML = `
        <div class="col-md-6 col-12 mb-3">
            <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Toplam Süt Alacağı</div>
                <h4 class="fw-bold mb-0 text-success" id="ciftci-toplam-sut">0.00 TL</h4>
            </div>
        </div>
        <div class="col-md-6 col-12 mb-3">
            <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Toplam Yem Borcu</div>
                <h4 class="fw-bold mb-0 text-danger" id="ciftci-toplam-yem">0.00 TL</h4>
            </div>
        </div>
        <div class="col-md-6 col-12 mb-3">
             <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Yapılan Ödeme</div>
                <h4 class="fw-bold mb-0 text-warning" id="ciftci-toplam-odeme">0.00 TL</h4>
            </div>
        </div>
         <div class="col-md-6 col-12 mb-3">
             <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Net Bakiye</div>
                <h4 class="fw-bold mb-0 text-primary" id="ciftci-net-bakiye">0.00 TL</h4>
            </div>
        </div>
    `;
    // Değerleri animasyonla göster
    if (typeof animateCounter === 'function') {
        animateCounter(document.getElementById('ciftci-toplam-sut'), parseFloat(ozet.toplam_sut_alacagi || 0), 1000, ' TL', 2);
        animateCounter(document.getElementById('ciftci-toplam-yem'), parseFloat(ozet.toplam_yem_borcu || 0), 1000, ' TL', 2);
        animateCounter(document.getElementById('ciftci-toplam-odeme'), parseFloat(ozet.toplam_odeme || 0), 1000, ' TL', 2);
        animateCounter(document.getElementById('ciftci-net-bakiye'), parseFloat(ozet.net_bakiye || 0), 1000, ' TL', 2);
    } else { // Animasyon fonksiyonu yoksa direkt yaz
        document.getElementById('ciftci-toplam-sut').textContent = `${ozet.toplam_sut_alacagi || '0.00'} TL`;
        document.getElementById('ciftci-toplam-yem').textContent = `${ozet.toplam_yem_borcu || '0.00'} TL`;
        document.getElementById('ciftci-toplam-odeme').textContent = `${ozet.toplam_odeme || '0.00'} TL`;
        document.getElementById('ciftci-net-bakiye').textContent = `${ozet.net_bakiye || '0.00'} TL`;
    }
}

/**
 * Çiftçinin süt girdilerini tabloya render eder.
 * @param {Array} girdiler - API'dan gelen girdi listesi.
 */
function renderCiftciSutGirdileri(girdiler) {
    const tbody = document.getElementById('ciftci-sut-tablosu');
    const veriYok = document.getElementById('ciftci-sut-veri-yok');
    if (!tbody || !veriYok) return;
    tbody.innerHTML = ''; // Temizle
    veriYok.style.display = 'none';

    if (!girdiler || girdiler.length === 0) {
        veriYok.style.display = 'block'; // Veri yok mesajını göster
        return;
    }

    girdiler.forEach(girdi => {
        // Tarihi daha güvenli formatla
        let tarihStr = "Geçersiz Tarih";
        try {
            tarihStr = new Date(girdi.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { console.error("Tarih formatlama hatası:", girdi.tarih, e); }

        tbody.innerHTML += `
            <tr>
                <td>${tarihStr}</td>
                <td class="text-end">${girdi.litre} L</td>
                <td class="text-end">${girdi.fiyat} TL</td>
                <td class="text-end fw-bold">${girdi.tutar} TL</td>
            </tr>
        `;
    });
}

/**
 * Çiftçinin yem alımlarını tabloya render eder.
 * @param {Array} islemler - API'dan gelen işlem listesi.
 */
function renderCiftciYemAlimlari(islemler) {
    const tbody = document.getElementById('ciftci-yem-tablosu');
    const veriYok = document.getElementById('ciftci-yem-veri-yok');
     if (!tbody || !veriYok) return;
    tbody.innerHTML = ''; // Temizle
    veriYok.style.display = 'none';

    if (!islemler || islemler.length === 0) {
        veriYok.style.display = 'block'; // Veri yok mesajını göster
        return;
    }

    islemler.forEach(islem => {
         // Tarihi daha güvenli formatla
        let tarihStr = "Geçersiz Tarih";
        try {
            tarihStr = new Date(islem.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { console.error("Tarih formatlama hatası:", islem.tarih, e); }

         tbody.innerHTML += `
            <tr>
                <td>${tarihStr}</td>
                <td>${utils.sanitizeHTML(islem.yem_adi)}</td>
                <td class="text-end">${islem.miktar_kg} KG</td>
                <td class="text-end">${islem.birim_fiyat} TL</td>
                <td class="text-end fw-bold">${islem.toplam_tutar} TL</td>
            </tr>
        `;
    });
}

/**
 * Çiftçi süt girdileri listesinde sayfa değiştirir.
 * @param {number} yeniSayfa - Gidilecek sayfa numarası.
 */
async function ciftciSutSayfasiniDegistir(yeniSayfa) {
    if (ciftciSutSayfasi === yeniSayfa) return; // Zaten o sayfadaysa bir şey yapma
    ciftciSutSayfasi = yeniSayfa;
    const sutTabloBody = document.getElementById('ciftci-sut-tablosu');
    if (sutTabloBody) sutTabloBody.innerHTML = '<tr><td colspan="4" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>'; // Yükleniyor...
    try {
        const sutData = await api.request(`/api/ciftci/sut_girdileri?sayfa=${ciftciSutSayfasi}&limit=${CIFTCI_SAYFA_BASI}`);
        renderCiftciSutGirdileri(sutData.girdiler);
        // Sayfalama navigasyonunu yeniden oluştur (ui.js'deki fonksiyonu kullanıyoruz)
        ui.sayfalamaNavOlustur('ciftci-sut-sayfalama', sutData.toplam_kayit, ciftciSutSayfasi, CIFTCI_SAYFA_BASI, ciftciSutSayfasiniDegistir);
    } catch (error) {
         if (sutTabloBody) sutTabloBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger p-3">Süt girdileri yüklenemedi.</td></tr>';
         gosterMesaj('Süt girdileri yüklenirken hata oluştu.', 'danger');
    }
}

/**
 * Çiftçi yem alımları listesinde sayfa değiştirir.
 * @param {number} yeniSayfa - Gidilecek sayfa numarası.
 */
async function ciftciYemSayfasiniDegistir(yeniSayfa) {
    if (ciftciYemSayfasi === yeniSayfa) return; // Zaten o sayfadaysa bir şey yapma
    ciftciYemSayfasi = yeniSayfa;
     const yemTabloBody = document.getElementById('ciftci-yem-tablosu');
    if (yemTabloBody) yemTabloBody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>'; // Yükleniyor...
     try {
        const yemData = await api.request(`/api/ciftci/yem_alimlarim?sayfa=${ciftciYemSayfasi}&limit=${CIFTCI_SAYFA_BASI}`);
        renderCiftciYemAlimlari(yemData.islemler);
        // Sayfalama navigasyonunu yeniden oluştur (ui.js'deki fonksiyonu kullanıyoruz)
        ui.sayfalamaNavOlustur('ciftci-yem-sayfalama', yemData.toplam_kayit, ciftciYemSayfasi, CIFTCI_SAYFA_BASI, ciftciYemSayfasiniDegistir);
    } catch (error) {
         if (yemTabloBody) yemTabloBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger p-3">Yem alımları yüklenemedi.</td></tr>';
         gosterMesaj('Yem alımları yüklenirken hata oluştu.', 'danger');
    }
}