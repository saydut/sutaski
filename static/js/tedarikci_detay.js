// static/js/tedarikci_detay.js

let tedarikciDetayMevcutGorunum = 'tablo'; // YENİ İSİM
const yuklenenSekmeler = { sut: false, yem: false, finans: false };
const KAYIT_SAYISI = 10;

// Sayfa yüklendiğinde çalışır
window.onload = () => {
    // tedarikciDetayMevcutGorunum kullanılıyor
    tedarikciDetayMevcutGorunum = localStorage.getItem('tedarikciDetayGorunum') || 'tablo';
    gorunumuAyarla(tedarikciDetayMevcutGorunum); // Fonksiyona değişkeni ver

    ayYilSecicileriniDoldur('rapor-ay', 'rapor-yil'); // utils.js'den
    ozetVerileriniYukle(); // Bu dosyadaki fonksiyon
    sutGirdileriniYukle(1); // İlk sekmeyi yükle (Bu dosyadaki fonksiyon)
    sekmeOlaylariniAyarla(); // Bu dosyadaki fonksiyon
};

// Arayüzü ayarlar (div'leri göster/gizle, butonları aktif/pasif yap)
function gorunumuAyarla(aktifGorunum) { // Parametre eklendi
    document.querySelectorAll('.gorunum-konteyneri-detay').forEach(el => {
        // ID'nin içinde aktif görünüm adının geçip geçmediğini kontrol et
        if (el.id.includes(aktifGorunum)) {
            // Kart görünümü için display: flex kullan (row içinde oldukları için)
            el.style.display = el.classList.contains('row') ? 'flex' : 'block';
        } else {
            el.style.display = 'none';
        }
    });
    const tableBtn = document.getElementById('btn-view-table');
    const cardBtn = document.getElementById('btn-view-card');
    if(tableBtn) tableBtn.classList.toggle('active', aktifGorunum === 'tablo');
    if(cardBtn) cardBtn.classList.toggle('active', aktifGorunum === 'kart');
}


// Liste/Kart görünümünü değiştir
function gorunumuDegistir(yeniGorunum) {
    // tedarikciDetayMevcutGorunum kullanılıyor
    if (tedarikciDetayMevcutGorunum === yeniGorunum) return;
    tedarikciDetayMevcutGorunum = yeniGorunum;
    localStorage.setItem('tedarikciDetayGorunum', tedarikciDetayMevcutGorunum);
    gorunumuAyarla(tedarikciDetayMevcutGorunum); // Fonksiyona değişkeni ver

    const aktifSekme = document.querySelector('.nav-tabs .nav-link.active');
    if (!aktifSekme) return; // Aktif sekme yoksa çık
    const aktifSekmeId = aktifSekme.id;

    // Görünüm değiştiğinde, diğer sekmelerin "yüklendi" durumunu sıfırla ki tekrar yüklensinler
    if (aktifSekmeId !== 'sut-tab') yuklenenSekmeler.sut = false;
    if (aktifSekmeId !== 'yem-tab') yuklenenSekmeler.yem = false;
    if (aktifSekmeId !== 'finans-tab') yuklenenSekmeler.finans = false;

    // Mevcut aktif sekmeyi yeni görünüme göre yeniden yükle
    if (aktifSekmeId === 'sut-tab') sutGirdileriniYukle(1);
    else if (aktifSekmeId === 'yem-tab') yemIslemleriniYukle(1);
    else if (aktifSekmeId === 'finans-tab') finansalIslemleriYukle(1);
}

// Sekme olaylarını ayarlar (diğer sekmeler açıldığında veri yükler)
function sekmeOlaylariniAyarla() {
    const yemTab = document.getElementById('yem-tab');
    const finansTab = document.getElementById('finans-tab');

    if(yemTab) {
        yemTab.addEventListener('show.bs.tab', () => {
            if (!yuklenenSekmeler.yem) yemIslemleriniYukle(1);
        });
    }
    if(finansTab) {
        finansTab.addEventListener('show.bs.tab', () => {
            if (!yuklenenSekmeler.finans) finansalIslemleriYukle(1);
        });
    }
}

// Tedarikçi özet verilerini yükler
async function ozetVerileriniYukle() {
    const ozetKartlariContainer = document.getElementById('ozet-kartlari');
    const baslikElementi = document.getElementById('tedarikci-adi-baslik');
    if(baslikElementi) baslikElementi.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
    if(ozetKartlariContainer) ozetKartlariContainer.innerHTML = '<div class="col-12 text-center p-5"><div class="spinner-border"></div></div>';

    try {
        // TEDARIKCI_ID değişkeninin HTML içinde tanımlı olduğunu varsayıyoruz
        const data = await api.request(`/api/tedarikci/${TEDARIKCI_ID}/ozet`); // api.js'den
        if(baslikElementi) baslikElementi.innerText = data.isim;
        ozetKartlariniDoldur(data); // Bu dosyadaki fonksiyon
    } catch (error) {
        if(baslikElementi) baslikElementi.innerText = "Hata";
        if(ozetKartlariContainer) ozetKartlariContainer.innerHTML = `<div class="col-12 text-center p-4 text-danger">${error.message}</div>`;
        gosterMesaj("Özet yüklenemedi: " + error.message, "danger"); // ui.js'den
    }
}

// Süt girdilerini yükler
async function sutGirdileriniYukle(sayfa = 1) {
    yuklenenSekmeler.sut = true;
    await genelVeriYukleyici({ // data-loader.js'den
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/sut_girdileri?sayfa=${sayfa}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'girdiler',
        tabloBodyId: 'sut-girdileri-tablosu',
        kartContainerId: 'sut-kart-gorunumu', // Düzeltme: ID'ler farklı olmalı
        veriYokId: 'sut-veri-yok',
        sayfalamaId: 'sut-sayfalama',
        tabloRenderFn: renderSutAsTable,
        kartRenderFn: renderSutAsCards,
        yukleFn: sutGirdileriniYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        // tedarikciDetayMevcutGorunum kullanılıyor
        mevcutGorunum: tedarikciDetayMevcutGorunum
    });
}

// Yem işlemlerini yükler
async function yemIslemleriniYukle(sayfa = 1) {
    yuklenenSekmeler.yem = true;
    await genelVeriYukleyici({ // data-loader.js'den
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/yem_islemleri?sayfa=${sayfa}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'yem-islemleri-tablosu',
        kartContainerId: 'yem-kart-gorunumu', // Düzeltme: ID'ler farklı olmalı
        veriYokId: 'yem-veri-yok',
        sayfalamaId: 'yem-sayfalama',
        tabloRenderFn: renderYemAsTable,
        kartRenderFn: renderYemAsCards,
        yukleFn: yemIslemleriniYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        // tedarikciDetayMevcutGorunum kullanılıyor
        mevcutGorunum: tedarikciDetayMevcutGorunum
    });
}

// Finansal işlemleri yükler
async function finansalIslemleriYukle(sayfa = 1) {
    yuklenenSekmeler.finans = true;
    await genelVeriYukleyici({ // data-loader.js'den
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/finansal_islemler?sayfa=${sayfa}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'finansal-islemler-tablosu',
        kartContainerId: 'finans-kart-gorunumu', // Düzeltme: ID'ler farklı olmalı
        veriYokId: 'finans-veri-yok',
        sayfalamaId: 'finans-sayfalama',
        tabloRenderFn: renderFinansAsTable,
        kartRenderFn: renderFinansAsCards,
        yukleFn: finansalIslemleriYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        // tedarikciDetayMevcutGorunum kullanılıyor
        mevcutGorunum: tedarikciDetayMevcutGorunum
    });
}

// --- RENDER FONKSİYONLARI ---

// Süt girdisini tablo satırı olarak render et
function renderSutAsTable(container, veriler) {
    veriler.forEach(girdi => {
        // DÜZELTME: girdi.tarih yerine girdi.taplanma_tarihi kullanıldı.
        const tarihStr = girdi.taplanma_tarihi ? new Date(girdi.taplanma_tarihi).toLocaleDateString('tr-TR') : 'Geçersiz Tarih';
        // DÜZELTME: parseFloat'tan önce kontrol eklendi.
        const litre = parseFloat(girdi.litre || 0);
        const fiyat = parseFloat(girdi.fiyat || 0);
        const tutar = litre * fiyat;
        // Kullanıcı adını güvenli hale getir
        const kullaniciAdi = girdi.kullanicilar ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : 'Bilinmiyor';
        container.innerHTML += `<tr>
            <td>${tarihStr}</td>
            <td class="text-end">${litre.toFixed(2)} L</td>
            <td class="text-end">${fiyat.toFixed(2)} TL</td>
            <td class="text-end">${tutar.toFixed(2)} TL</td>
            <td>${kullaniciAdi}</td>
        </tr>`;
    });
}

// Süt girdisini kart olarak render et
function renderSutAsCards(container, veriler) {
    veriler.forEach(girdi => {
        // DÜZELTME: girdi.tarih yerine girdi.taplanma_tarihi kullanıldı.
        const tarihStr = girdi.taplanma_tarihi ? new Date(girdi.taplanma_tarihi).toLocaleDateString('tr-TR') : 'Geçersiz Tarih';
        // DÜZELTME: parseFloat'tan önce kontrol eklendi.
        const litre = parseFloat(girdi.litre || 0);
        const fiyat = parseFloat(girdi.fiyat || 0);
        const tutar = litre * fiyat;
        const kullaniciAdi = girdi.kullanicilar ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : 'Bilinmiyor';
        container.innerHTML += `<div class="col-lg-4 col-md-6 col-12">
            <div class="card p-2 h-100">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between">
                        <span class="fs-4 fw-bold text-primary">${litre.toFixed(2)} L</span>
                        <span class="fs-5 fw-bold text-success">${tutar.toFixed(2)} TL</span>
                    </div>
                    <div class="text-secondary small mt-1">Birim Fiyat: ${fiyat.toFixed(2)} TL</div>
                    <div class="d-flex justify-content-between align-items-end mt-2">
                        <small class="text-secondary">${tarihStr}</small>
                        <small class="text-secondary">Giren: ${kullaniciAdi}</small>
                    </div>
                </div>
            </div>
        </div>`;
    });
}

// Yem işlemini tablo satırı olarak render et
function renderYemAsTable(container, veriler) {
    veriler.forEach(islem => {
        // DÜZELTME: islem.tarih yerine islem.islem_tarihi kullanıldı.
        const tarihStr = islem.islem_tarihi ? new Date(islem.islem_tarihi).toLocaleDateString('tr-TR') : 'Geçersiz Tarih';
        // DÜZELTME: islem.yem_urunleri['yem_adi'] kontrolü eklendi.
        const yemAdi = islem.yem_urunleri && islem.yem_urunleri.yem_adi ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Bilinmeyen Yem';
        // DÜZELTME: parseFloat'tan önce kontrol eklendi.
        const miktar = parseFloat(islem.miktar_kg || 0);
        // DÜZELTME: islem.birim_fiyat yerine islem.islem_anindaki_birim_fiyat kullanıldı ve kontrol eklendi.
        const birimFiyat = parseFloat(islem.islem_anindaki_birim_fiyat || 0);
        const toplamTutar = parseFloat(islem.toplam_tutar || 0); // Bu zaten hesaplanmış geliyor
        const kullaniciAdi = islem.kullanicilar ? utils.sanitizeHTML(islem.kullanicilar.kullanici_adi) : 'Bilinmiyor';
        container.innerHTML += `<tr>
            <td>${tarihStr}</td>
            <td>${yemAdi}</td>
            <td class="text-end">${miktar.toFixed(2)} KG</td>
            <td class="text-end">${birimFiyat.toFixed(2)} TL</td>
            <td class="text-end">${toplamTutar.toFixed(2)} TL</td>
            <td>${kullaniciAdi}</td>
        </tr>`;
    });
}

// Yem işlemini kart olarak render et
function renderYemAsCards(container, veriler) {
    veriler.forEach(islem => {
        // DÜZELTME: islem.tarih yerine islem.islem_tarihi kullanıldı.
        const tarihStr = islem.islem_tarihi ? new Date(islem.islem_tarihi).toLocaleDateString('tr-TR') : 'Geçersiz Tarih';
        // DÜZELTME: islem.yem_urunleri['yem_adi'] kontrolü eklendi.
        const yemAdi = islem.yem_urunleri && islem.yem_urunleri.yem_adi ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Bilinmeyen Yem';
        // DÜZELTME: parseFloat'tan önce kontrol eklendi.
        const miktar = parseFloat(islem.miktar_kg || 0);
        const birimFiyat = parseFloat(islem.islem_anindaki_birim_fiyat || 0);
        const toplamTutar = parseFloat(islem.toplam_tutar || 0);
        const kullaniciAdi = islem.kullanicilar ? utils.sanitizeHTML(islem.kullanicilar.kullanici_adi) : 'Bilinmiyor';
        container.innerHTML += `<div class="col-lg-4 col-md-6 col-12">
            <div class="card p-2 h-100">
                <div class="card-body p-2">
                    <h6 class="card-title mb-1">${yemAdi}</h6>
                    <div class="d-flex justify-content-between">
                        <span class="fs-4 fw-bold text-primary">${miktar.toFixed(2)} KG</span>
                        <span class="fs-5 fw-bold text-danger">${toplamTutar.toFixed(2)} TL</span>
                    </div>
                     <div class="text-secondary small mt-1">Birim Fiyat: ${birimFiyat.toFixed(2)} TL</div>
                    <div class="d-flex justify-content-between align-items-end mt-2">
                        <small class="text-secondary">${tarihStr}</small>
                        <small class="text-secondary">Giren: ${kullaniciAdi}</small>
                    </div>
                </div>
            </div>
        </div>`;
    });
}

// Finansal işlemi tablo olarak render et
function renderFinansAsTable(container, veriler) {
    veriler.forEach(islem => {
        // DÜZELTME: islem.tarih yerine islem.islem_tarihi kullanıldı.
        const tarihStr = islem.islem_tarihi ? new Date(islem.islem_tarihi).toLocaleDateString('tr-TR') : 'Geçersiz Tarih';
        // DÜZELTME: parseFloat'tan önce kontrol eklendi.
        const tutar = parseFloat(islem.tutar || 0);
        const kullaniciAdi = islem.kullanicilar ? utils.sanitizeHTML(islem.kullanicilar.kullanici_adi) : 'Bilinmiyor';
        container.innerHTML += `<tr>
            <td>${tarihStr}</td>
            <td><span class="badge bg-${islem.islem_tipi === 'Ödeme' ? 'success' : 'warning'}">${utils.sanitizeHTML(islem.islem_tipi)}</span></td>
            <td class="text-end">${tutar.toFixed(2)} TL</td>
            <td>${utils.sanitizeHTML(islem.aciklama) || '-'}</td>
            <td>${kullaniciAdi}</td>
        </tr>`;
    });
}

// Finansal işlemi kart olarak render et
function renderFinansAsCards(container, veriler) {
    veriler.forEach(islem => {
        // DÜZELTME: islem.tarih yerine islem.islem_tarihi kullanıldı.
        const tarihStr = islem.islem_tarihi ? new Date(islem.islem_tarihi).toLocaleDateString('tr-TR') : 'Geçersiz Tarih';
        const isOdeme = islem.islem_tipi === 'Ödeme';
        // DÜZELTME: parseFloat'tan önce kontrol eklendi.
        const tutar = parseFloat(islem.tutar || 0);
        const kullaniciAdi = islem.kullanicilar ? utils.sanitizeHTML(islem.kullanicilar.kullanici_adi) : 'Bilinmiyor';
        container.innerHTML += `<div class="col-lg-4 col-md-6 col-12">
             <div class="finance-card ${isOdeme ? 'odeme' : 'avans'}" style="padding: 0.5rem; height: 100%;">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="tutar ${isOdeme ? 'text-success' : 'text-danger'}" style="font-size: 1.5rem;">${tutar.toFixed(2)} TL</h5>
                    <span class="badge bg-${isOdeme ? 'success' : 'warning'}">${utils.sanitizeHTML(islem.islem_tipi)}</span>
                </div>
                <p class="aciklama flex-grow-1">${utils.sanitizeHTML(islem.aciklama) || 'Açıklama yok'}</p>
                <div class="d-flex justify-content-between align-items-end">
                    <small class="text-secondary">${tarihStr}</small>
                    <small class="text-secondary">Giren: ${kullaniciAdi}</small>
                </div>
            </div>
        </div>`;
    });
}

// Özet kartlarını doldur
function ozetKartlariniDoldur(ozet) {
    const container = document.getElementById('ozet-kartlari');
    if (!container) return; // Element yoksa çık
    const toplam_sut_alacagi = parseFloat(ozet.toplam_sut_alacagi || 0).toFixed(2);
    const toplam_yem_borcu = parseFloat(ozet.toplam_yem_borcu || 0).toFixed(2);
    const toplam_odeme = parseFloat(ozet.toplam_odeme || 0).toFixed(2);
    const net_bakiye = parseFloat(ozet.net_bakiye || 0).toFixed(2);

    container.innerHTML = `
        <div class="col-lg-3 col-md-6 col-12"><div class="card p-3 text-center h-100"><div class="fs-6 text-secondary">Toplam Süt Alacağı</div><h4 class="fw-bold mb-0 text-success">${toplam_sut_alacagi} TL</h4></div></div>
        <div class="col-lg-3 col-md-6 col-12"><div class="card p-3 text-center h-100"><div class="fs-6 text-secondary">Toplam Yem Borcu</div><h4 class="fw-bold mb-0 text-danger">${toplam_yem_borcu} TL</h4></div></div>
        <div class="col-lg-3 col-md-6 col-12"><div class="card p-3 text-center h-100"><div class="fs-6 text-secondary">Toplam Ödeme</div><h4 class="fw-bold mb-0 text-warning">${toplam_odeme} TL</h4></div></div>
        <div class="col-lg-3 col-md-6 col-12"><div class="card p-3 text-center h-100"><div class="fs-6 text-secondary">Net Bakiye</div><h4 class="fw-bold mb-0 text-primary">${net_bakiye} TL</h4></div></div>
    `;
}

// --- PDF Fonksiyonları ---

// Hesap özeti PDF'ini indir
function hesapOzetiIndir() {
    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const url = `/api/tedarikci/${TEDARIKCI_ID}/hesap_ozeti_pdf?ay=${ay}&yil=${yil}`;

    // utils.js'deki indirVeAc fonksiyonunu kullan
    indirVeAc(url, 'pdf-indir-btn', {
        success: 'Hesap özeti indirildi ve yeni sekmede açıldı.',
        error: 'PDF özeti oluşturulurken hata oluştu.'
    });
}

// Müstahsil makbuzu PDF'ini indir
function mustahsilMakbuzuIndir() {
    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const url = `/api/tedarikci/${TEDARIKCI_ID}/mustahsil_makbuzu_pdf?ay=${ay}&yil=${yil}`;

    // utils.js'deki indirVeAc fonksiyonunu kullan
    indirVeAc(url, 'mustahsil-indir-btn', {
        success: 'Müstahsil makbuzu indirildi ve yeni sekmede açıldı.',
        error: 'Müstahsil makbuzu oluşturulurken hata oluştu.'
    });
}
