// static/js/ciftci_panel.js

// --- Çiftçi Portalı için Global Değişkenler ---
let ciftciSutSayfasi = 1;
let ciftciYemSayfasi = 1;
let ciftciFinansSayfasi = 1;
const CIFTCI_SAYFA_BASI = 5; // Sayfa başına öğe sayısı

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
 */
function arayuzuRoleGoreAyarla() {
    // Bu fonksiyon aynı kalıyor
    const ciftciPanelElement = document.getElementById('ciftci-panel');
    const anaWrapper = document.querySelector('.main-wrapper');
    const kullaniciRolu = document.body.dataset.userRole;

    if (kullaniciRolu === 'ciftci') {
        if(anaWrapper) {
             Array.from(anaWrapper.children).forEach(child => {
                 if (child.id !== 'ciftci-panel' && child.id !== 'alert-container') {
                     child.style.display = 'none';
                 }
             });
        }
        if (ciftciPanelElement) ciftciPanelElement.style.display = 'block';
        if(anaWrapper) anaWrapper.classList.add('ciftci-panel-ana');

    } else {
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
    const finansTabloBody = document.getElementById('ciftci-finans-tablosu');
    const sutVeriYok = document.getElementById('ciftci-sut-veri-yok');
    const yemVeriYok = document.getElementById('ciftci-yem-veri-yok');
    const finansVeriYok = document.getElementById('ciftci-finans-veri-yok');

    // Yükleniyor göstergelerini ayarla
    if (ozetContainer) ozetContainer.innerHTML = '<div class="col-12 text-center p-5"><div class="spinner-border text-primary"></div></div>';
    if (sutTabloBody) sutTabloBody.innerHTML = '<tr><td colspan="4" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
    if (yemTabloBody) yemTabloBody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
    if (finansTabloBody) finansTabloBody.innerHTML = '<tr><td colspan="4" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
    if(sutVeriYok) sutVeriYok.style.display = 'none';
    if(yemVeriYok) yemVeriYok.style.display = 'none';
    if(finansVeriYok) finansVeriYok.style.display = 'none';


    try {
        // API'lerden verileri paralel olarak çek
        const [ozetData, sutData, yemData, finansData] = await Promise.all([
            api.request('/api/ciftci/ozet'),
            api.request(`/api/ciftci/sut_girdileri?sayfa=${ciftciSutSayfasi}&limit=${CIFTCI_SAYFA_BASI}`),
            api.request(`/api/ciftci/yem_alimlarim?sayfa=${ciftciYemSayfasi}&limit=${CIFTCI_SAYFA_BASI}`),
            api.request(`/api/ciftci/finans_islemleri?sayfa=${ciftciFinansSayfasi}&limit=${CIFTCI_SAYFA_BASI}`)
        ]);

        renderCiftciOzet(ozetData);
        renderCiftciSutGirdileri(sutData.girdiler);
        ui.sayfalamaNavOlustur('ciftci-sut-sayfalama', sutData.toplam_kayit, ciftciSutSayfasi, CIFTCI_SAYFA_BASI, ciftciSutSayfasiniDegistir);
        renderCiftciYemAlimlari(yemData.islemler);
        ui.sayfalamaNavOlustur('ciftci-yem-sayfalama', yemData.toplam_kayit, ciftciYemSayfasi, CIFTCI_SAYFA_BASI, ciftciYemSayfasiniDegistir);
        renderCiftciFinansIslemleri(finansData.islemler);
        ui.sayfalamaNavOlustur('ciftci-finans-sayfalama', finansData.toplam_kayit, ciftciFinansSayfasi, CIFTCI_SAYFA_BASI, ciftciFinansSayfasiniDegistir);

    } catch (error) {
        gosterMesaj(error.message || 'Çiftçi verileri yüklenirken bir hata oluştu.', 'danger');
        // Hata durumunda tüm alanları temizle
        if (ozetContainer) ozetContainer.innerHTML = '<div class="col-12 text-center p-4 text-danger">Özet yüklenemedi.</div>';
        if (sutTabloBody) sutTabloBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger p-3">Süt girdileri yüklenemedi.</td></tr>';
        if (yemTabloBody) yemTabloBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger p-3">Yem alımları yüklenemedi.</td></tr>';
        if (finansTabloBody) finansTabloBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger p-3">Finans işlemleri yüklenemedi.</td></tr>';
    }
}

/**
 * Çiftçi özet kartlarını doldurur. (DÜZELTİLDİ)
 * @param {object} ozet - API'dan gelen özet verisi.
 */
function renderCiftciOzet(ozet) {
    const container = document.getElementById('ciftci-ozet-kartlari');
    if (!container || !ozet) return;

    // Tailwind Grid ve Card Yapısı
    // Not: Container'ın kendisi HTML tarafında zaten "grid grid-cols-1..." classına sahip olmalı veya burada kapsayıcı div eklenmeli.
    // Ancak buradaki yapıya göre container içine direkt eleman ekliyoruz.
    // HTML tarafında container ID'sine sahip div'e "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" eklemeyi unutmayın.
    // (Aşağıda HTML yapısını bozmadan string üretiyorum)

    container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"; // Grid yapısını JS ile zorla

    container.innerHTML = `
        <div class="bg-green-50 rounded-xl p-4 border border-green-100 shadow-sm text-center">
            <div class="text-xs font-semibold text-green-800 uppercase mb-1">Toplam Süt Alacağı</div>
            <h4 class="text-xl font-bold text-green-600" id="ciftci-toplam-sut">0.00 TL</h4>
        </div>
        <div class="bg-red-50 rounded-xl p-4 border border-red-100 shadow-sm text-center">
            <div class="text-xs font-semibold text-red-800 uppercase mb-1">Toplam Yem Borcu</div>
            <h4 class="text-xl font-bold text-red-600" id="ciftci-toplam-yem">0.00 TL</h4>
        </div>
        <div class="bg-yellow-50 rounded-xl p-4 border border-yellow-100 shadow-sm text-center">
            <div class="text-xs font-semibold text-yellow-800 uppercase mb-1">Şirketten Ödeme</div>
            <h4 class="text-xl font-bold text-yellow-600" id="ciftci-toplam-sirket-odeme">0.00 TL</h4>
        </div>
        <div class="bg-blue-50 rounded-xl p-4 border border-blue-100 shadow-sm text-center">
            <div class="text-xs font-semibold text-blue-800 uppercase mb-1">Tahsilat</div>
            <h4 class="text-xl font-bold text-blue-600" id="ciftci-toplam-tahsilat">0.00 TL</h4>
        </div>
        <div class="bg-indigo-50 rounded-xl p-4 border border-indigo-100 shadow-sm text-center">
            <div class="text-xs font-semibold text-indigo-800 uppercase mb-1">Net Bakiye</div>
            <h4 class="text-xl font-bold text-indigo-600" id="ciftci-net-bakiye">0.00 TL</h4>
        </div>
    `;
    // --- /DÜZELTME ---

    // Değerleri animasyonla göster (Yeni Alan Adları ile)
if (typeof animateCounter === 'function') {
        animateCounter(document.getElementById('ciftci-toplam-sut'), parseFloat(ozet.toplam_sut_alacagi || 0), 1000, ' TL', 2);
        animateCounter(document.getElementById('ciftci-toplam-yem'), parseFloat(ozet.toplam_yem_borcu || 0), 1000, ' TL', 2);
        animateCounter(document.getElementById('ciftci-toplam-sirket-odeme'), parseFloat(ozet.toplam_sirket_odemesi || 0), 1000, ' TL', 2);
        animateCounter(document.getElementById('ciftci-toplam-tahsilat'), parseFloat(ozet.toplam_tahsilat || 0), 1000, ' TL', 2);
        animateCounter(document.getElementById('ciftci-net-bakiye'), parseFloat(ozet.net_bakiye || 0), 1000, ' TL', 2);
    } else {
        document.getElementById('ciftci-toplam-sut').textContent = `${ozet.toplam_sut_alacagi || '0.00'} TL`;
        document.getElementById('ciftci-toplam-yem').textContent = `${ozet.toplam_yem_borcu || '0.00'} TL`;
        document.getElementById('ciftci-toplam-sirket-odeme').textContent = `${ozet.toplam_sirket_odemesi || '0.00'} TL`;
        // DÜZELTME: Tahsilat değerini ekle
        document.getElementById('ciftci-toplam-tahsilat').textContent = `${ozet.toplam_tahsilat || '0.00'} TL`;
        document.getElementById('ciftci-net-bakiye').textContent = `${ozet.net_bakiye || '0.00'} TL`;
    }
}

/**
 * Çiftçinin süt girdilerini tabloya render eder.
 */
function renderCiftciSutGirdileri(girdiler) {
    // Bu fonksiyon aynı kalıyor
    const tbody = document.getElementById('ciftci-sut-tablosu');
    const veriYok = document.getElementById('ciftci-sut-veri-yok');
    if (!tbody || !veriYok) return;
    tbody.innerHTML = '';
    veriYok.style.display = 'none';

    if (!girdiler || girdiler.length === 0) {
        veriYok.style.display = 'block';
        return;
    }

    girdiler.forEach(girdi => {
        let tarihStr = "Geçersiz Tarih";
        try {
            tarihStr = new Date(girdi.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { console.error("Tarih formatlama hatası (Süt):", girdi.tarih, e); }

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
 */
function renderCiftciYemAlimlari(islemler) {
    // Bu fonksiyon aynı kalıyor
    const tbody = document.getElementById('ciftci-yem-tablosu');
    const veriYok = document.getElementById('ciftci-yem-veri-yok');
     if (!tbody || !veriYok) return;
    tbody.innerHTML = '';
    veriYok.style.display = 'none';

    if (!islemler || islemler.length === 0) {
        veriYok.style.display = 'block';
        return;
    }

    islemler.forEach(islem => {
         let tarihStr = "Geçersiz Tarih";
        try {
            tarihStr = new Date(islem.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { console.error("Tarih formatlama hatası (Yem):", islem.tarih, e); }

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
 * Çiftçinin finansal işlemlerini (ödeme/avans) tabloya render eder.
 */
function renderCiftciFinansIslemleri(islemler) {
    // Bu fonksiyon aynı kalıyor
    const tbody = document.getElementById('ciftci-finans-tablosu');
    const veriYok = document.getElementById('ciftci-finans-veri-yok');
    if (!tbody || !veriYok) return;
    tbody.innerHTML = '';
    veriYok.style.display = 'none';

    if (!islemler || islemler.length === 0) {
        veriYok.style.display = 'block';
        return;
    }

    islemler.forEach(islem => {
        let tarihStr = "Geçersiz Tarih";
        try {
            tarihStr = new Date(islem.tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch (e) { console.error("Tarih formatlama hatası (Finans):", islem.tarih, e); }

        let tipBadgeClass = 'bg-secondary';
        let tutarRenkClass = '';
        let islemTipiText = utils.sanitizeHTML(islem.islem_tipi);

        if (islem.islem_tipi === 'Ödeme' || islem.islem_tipi === 'Avans') {
            tipBadgeClass = islem.islem_tipi === 'Ödeme' ? 'bg-success' : 'bg-warning';
            tutarRenkClass = 'text-success';
            islemTipiText = islem.islem_tipi === 'Ödeme' ? 'Hakediş Ödemesi' : 'Avans Alındı';
        } else if (islem.islem_tipi === 'Tahsilat') {
            tipBadgeClass = 'bg-info';
            tutarRenkClass = 'text-danger';
            islemTipiText = 'Şirkete Ödeme Yapıldı';
        }

        tbody.innerHTML += `
            <tr>
                <td>${tarihStr}</td>
                <td><span class="badge ${tipBadgeClass}">${islemTipiText}</span></td>
                <td>${utils.sanitizeHTML(islem.aciklama) || '-'}</td>
                <td class="text-end fw-bold ${tutarRenkClass}">${islem.tutar} TL</td>
            </tr>
        `;
    });
}

/**
 * Çiftçi süt girdileri listesinde sayfa değiştirir.
 */
async function ciftciSutSayfasiniDegistir(yeniSayfa) {
    // Bu fonksiyon aynı kalıyor
    if (ciftciSutSayfasi === yeniSayfa) return;
    ciftciSutSayfasi = yeniSayfa;
    const sutTabloBody = document.getElementById('ciftci-sut-tablosu');
    if (sutTabloBody) sutTabloBody.innerHTML = '<tr><td colspan="4" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
    try {
        const sutData = await api.request(`/api/ciftci/sut_girdileri?sayfa=${ciftciSutSayfasi}&limit=${CIFTCI_SAYFA_BASI}`);
        renderCiftciSutGirdileri(sutData.girdiler);
        ui.sayfalamaNavOlustur('ciftci-sut-sayfalama', sutData.toplam_kayit, ciftciSutSayfasi, CIFTCI_SAYFA_BASI, ciftciSutSayfasiniDegistir);
    } catch (error) {
         if (sutTabloBody) sutTabloBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger p-3">Süt girdileri yüklenemedi.</td></tr>';
         gosterMesaj('Süt girdileri yüklenirken hata oluştu.', 'danger');
    }
}

/**
 * Çiftçi yem alımları listesinde sayfa değiştirir.
 */
async function ciftciYemSayfasiniDegistir(yeniSayfa) {
    // Bu fonksiyon aynı kalıyor
    if (ciftciYemSayfasi === yeniSayfa) return;
    ciftciYemSayfasi = yeniSayfa;
     const yemTabloBody = document.getElementById('ciftci-yem-tablosu');
    if (yemTabloBody) yemTabloBody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
     try {
        const yemData = await api.request(`/api/ciftci/yem_alimlarim?sayfa=${ciftciYemSayfasi}&limit=${CIFTCI_SAYFA_BASI}`);
        renderCiftciYemAlimlari(yemData.islemler);
        ui.sayfalamaNavOlustur('ciftci-yem-sayfalama', yemData.toplam_kayit, ciftciYemSayfasi, CIFTCI_SAYFA_BASI, ciftciYemSayfasiniDegistir);
    } catch (error) {
         if (yemTabloBody) yemTabloBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger p-3">Yem alımları yüklenemedi.</td></tr>';
         gosterMesaj('Yem alımları yüklenirken hata oluştu.', 'danger');
    }
}

/**
 * Çiftçi finans işlemleri listesinde sayfa değiştirir.
 */
async function ciftciFinansSayfasiniDegistir(yeniSayfa) {
    // Bu fonksiyon aynı kalıyor
    if (ciftciFinansSayfasi === yeniSayfa) return;
    ciftciFinansSayfasi = yeniSayfa;
    const finansTabloBody = document.getElementById('ciftci-finans-tablosu');
    if (finansTabloBody) finansTabloBody.innerHTML = '<tr><td colspan="4" class="text-center p-4"><div class="spinner-border spinner-border-sm text-primary"></div></td></tr>';
    try {
        const finansData = await api.request(`/api/ciftci/finans_islemleri?sayfa=${ciftciFinansSayfasi}&limit=${CIFTCI_SAYFA_BASI}`);
        renderCiftciFinansIslemleri(finansData.islemler);
        ui.sayfalamaNavOlustur('ciftci-finans-sayfalama', finansData.toplam_kayit, ciftciFinansSayfasi, CIFTCI_SAYFA_BASI, ciftciFinansSayfasiniDegistir);
    } catch (error) {
         if (finansTabloBody) finansTabloBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger p-3">Finans işlemleri yüklenemedi.</td></tr>';
         gosterMesaj('Finans işlemleri yüklenirken hata oluştu.', 'danger');
    }
}

