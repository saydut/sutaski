// static/js/tedarikci_detay.js

let tedarikciDetayMevcutGorunum = 'tablo';
const yuklenenSekmeler = { sut: false, yem: false, finans: false };
const KAYIT_SAYISI = 10;

// Sayfa yüklendiğinde çalışır
window.onload = () => {
    tedarikciDetayMevcutGorunum = localStorage.getItem('tedarikciDetayGorunum') || 'tablo';
    gorunumuAyarla(tedarikciDetayMevcutGorunum);

    ayYilSecicileriniDoldur('rapor-ay', 'rapor-yil'); // utils.js'den
    ozetVerileriniYukle(); // Bu dosyadaki fonksiyon
    sutGirdileriniYukle(1); // İlk sekmeyi yükle
    sekmeOlaylariniAyarla();
};

// Arayüzü ayarlar (div'leri göster/gizle, butonları aktif/pasif yap)
function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri-detay').forEach(el => {
        if (el.id.includes(aktifGorunum)) {
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
    if (tedarikciDetayMevcutGorunum === yeniGorunum) return;
    tedarikciDetayMevcutGorunum = yeniGorunum;
    localStorage.setItem('tedarikciDetayGorunum', tedarikciDetayMevcutGorunum);
    gorunumuAyarla(tedarikciDetayMevcutGorunum);

    const aktifSekme = document.querySelector('.nav-tabs .nav-link.active');
    if (!aktifSekme) return;
    const aktifSekmeId = aktifSekme.id;

    // Görünüm değiştiğinde, diğer sekmelerin "yüklendi" durumunu sıfırla
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
        }, { once: false }); // once: false
    }
    if(finansTab) {
        finansTab.addEventListener('show.bs.tab', () => {
            if (!yuklenenSekmeler.finans) finansalIslemleriYukle(1);
        }, { once: false }); // once: false
    }
}

// Tedarikçi özet verilerini yükler (GÜNCELLENDİ)
async function ozetVerileriniYukle() {
    const ozetKartlariContainer = document.getElementById('ozet-kartlari');
    const baslikElementi = document.getElementById('tedarikci-adi-baslik');
    if(baslikElementi) baslikElementi.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
    if(ozetKartlariContainer) ozetKartlariContainer.innerHTML = '<div class="col-12 text-center p-5"><div class="spinner-border"></div></div>';

    try {
        // API endpoint'i /services/tedarikci_service.py içinde güncellenmişti
        const data = await api.request(`/api/tedarikci/${TEDARIKCI_ID}/ozet`);
        if(baslikElementi) baslikElementi.innerText = data.isim;
        ozetKartlariniDoldur(data); // Güncellenmiş özet kartı doldurma
    } catch (error) {
        if(baslikElementi) baslikElementi.innerText = "Hata";
        if(ozetKartlariContainer) ozetKartlariContainer.innerHTML = `<div class="col-12 text-center p-4 text-danger">${error.message}</div>`;
        gosterMesaj("Özet yüklenemedi: " + error.message, "danger");
    }
}

// Süt girdilerini yükler
async function sutGirdileriniYukle(sayfa = 1) {
    yuklenenSekmeler.sut = true;
    await genelVeriYukleyici({
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/sut_girdileri?sayfa=${sayfa}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'girdiler',
        tabloBodyId: 'sut-girdileri-tablosu',
        kartContainerId: 'sut-kart-gorunumu',
        veriYokId: 'sut-veri-yok',
        sayfalamaId: 'sut-sayfalama',
        tabloRenderFn: renderSutAsTable,
        kartRenderFn: renderSutAsCards,
        yukleFn: sutGirdileriniYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: tedarikciDetayMevcutGorunum
    });
}

// Yem işlemlerini yükler
async function yemIslemleriniYukle(sayfa = 1) {
    yuklenenSekmeler.yem = true;
    await genelVeriYukleyici({
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/yem_islemleri?sayfa=${sayfa}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'yem-islemleri-tablosu',
        kartContainerId: 'yem-kart-gorunumu',
        veriYokId: 'yem-veri-yok',
        sayfalamaId: 'yem-sayfalama',
        tabloRenderFn: renderYemAsTable,
        kartRenderFn: renderYemAsCards,
        yukleFn: yemIslemleriniYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: tedarikciDetayMevcutGorunum
    });
}

// Finansal işlemleri yükler
async function finansalIslemleriYukle(sayfa = 1) {
    yuklenenSekmeler.finans = true;
    await genelVeriYukleyici({
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/finansal_islemler?sayfa=${sayfa}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'finansal-islemler-tablosu',
        kartContainerId: 'finans-kart-gorunumu',
        veriYokId: 'finans-veri-yok',
        sayfalamaId: 'finans-sayfalama',
        tabloRenderFn: renderFinansAsTable,
        kartRenderFn: renderFinansAsCards,
        yukleFn: finansalIslemleriYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: tedarikciDetayMevcutGorunum
    });
}

// --- RENDER FONKSİYONLARI ---

// Süt girdisini tablo satırı olarak render et
function renderSutAsTable(container, veriler) {
    container.innerHTML = ''; // Temizle
    veriler.forEach(girdi => {
        const tarihStr = girdi.taplanma_tarihi ? new Date(girdi.taplanma_tarihi).toLocaleDateString('tr-TR') : 'Geçersiz Tarih';
        const litre = parseFloat(girdi.litre || 0);
        const fiyat = parseFloat(girdi.fiyat || 0);
        const tutar = litre * fiyat;
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
    container.innerHTML = ''; // Temizle
    veriler.forEach(girdi => {
        const tarihStr = girdi.taplanma_tarihi ? new Date(girdi.taplanma_tarihi).toLocaleDateString('tr-TR') : 'Geçersiz Tarih';
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
    container.innerHTML = ''; // Temizle
    veriler.forEach(islem => {
        const tarihStr = islem.islem_tarihi ? new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Geçersiz Tarih';
        const yemAdi = islem.yem_urunleri && islem.yem_urunleri.yem_adi ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Bilinmeyen Yem';
        const miktar = parseFloat(islem.miktar_kg || 0);
        const birimFiyat = parseFloat(islem.islem_anindaki_birim_fiyat || 0);
        const toplamTutar = parseFloat(islem.toplam_tutar || 0);
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
    container.innerHTML = ''; // Temizle
    veriler.forEach(islem => {
        const tarihStr = islem.islem_tarihi ? new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Geçersiz Tarih';
        const yemAdi = islem.yem_urunleri && islem.yem_urunleri.yem_adi ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Bilinmeyen Yem';
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

// Finansal işlemi tablo olarak render et (GÜNCELLENDİ)
function renderFinansAsTable(container, veriler) {
    container.innerHTML = ''; // Temizle
    veriler.forEach(islem => {
        const tarihStr = islem.islem_tarihi ? new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Geçersiz Tarih';
        const kullaniciAdi = islem.kullanicilar ? utils.sanitizeHTML(islem.kullanicilar.kullanici_adi) : 'Bilinmiyor';
        
        // --- YENİ: Renk ve Tip Mantığı ---
        let tipBadgeClass = 'bg-secondary';
        let tutarRenkClass = '';
        if (islem.islem_tipi === 'Ödeme' || islem.islem_tipi === 'Avans') {
            tipBadgeClass = islem.islem_tipi === 'Ödeme' ? 'bg-success' : 'bg-warning';
            tutarRenkClass = 'text-danger'; // Şirketten çıkış kırmızı
        } else if (islem.islem_tipi === 'Tahsilat') {
            tipBadgeClass = 'bg-info';
            tutarRenkClass = 'text-success'; // Şirkete giriş yeşil
        }
        // --- /YENİ ---

        container.innerHTML += `<tr>
            <td>${tarihStr}</td>
            <td><span class="badge ${tipBadgeClass}">${utils.sanitizeHTML(islem.islem_tipi)}</span></td>
            <td class="text-end ${tutarRenkClass}">${parseFloat(islem.tutar || 0).toFixed(2)} TL</td>
            <td>${utils.sanitizeHTML(islem.aciklama) || '-'}</td>
            <td>${kullaniciAdi}</td>
        </tr>`;
    });
}

// Finansal işlemi kart olarak render et (GÜNCELLENDİ)
function renderFinansAsCards(container, veriler) {
    container.innerHTML = ''; // Temizle
    veriler.forEach(islem => {
        const tarihStr = islem.islem_tarihi ? new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Geçersiz Tarih';
        const kullaniciAdi = islem.kullanicilar ? utils.sanitizeHTML(islem.kullanicilar.kullanici_adi) : 'Bilinmiyor';

        // --- YENİ: Renk ve Tip Mantığı ---
        let cardBorderClass = '';
        let tutarRenkClass = '';
        if (islem.islem_tipi === 'Ödeme' || islem.islem_tipi === 'Avans') {
            cardBorderClass = islem.islem_tipi === 'Ödeme' ? 'odeme' : 'avans'; // Yeşil veya Sarı sol kenarlık
            tutarRenkClass = 'text-danger'; // Şirketten çıkış kırmızı
        } else if (islem.islem_tipi === 'Tahsilat') {
            cardBorderClass = 'tahsilat'; // Mavi sol kenarlık (CSS'de tanımlı olmalı)
            tutarRenkClass = 'text-success'; // Şirkete giriş yeşil
        }
        // --- /YENİ ---
        
        container.innerHTML += `<div class="col-lg-4 col-md-6 col-12">
             <div class="finance-card ${cardBorderClass}" style="padding: 0.5rem; height: 100%;">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="tutar ${tutarRenkClass}" style="font-size: 1.5rem;">${parseFloat(islem.tutar || 0).toFixed(2)} TL</h5>
                    <span class="badge bg-${cardBorderClass === 'odeme' ? 'success' : (cardBorderClass === 'avans' ? 'warning' : 'info')}">${utils.sanitizeHTML(islem.islem_tipi)}</span>
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

// Özet kartlarını doldur (GÜNCELLENDİ)
function ozetKartlariniDoldur(ozet) {
    const container = document.getElementById('ozet-kartlari');
    if (!container) return;
    
    // API'den gelen yeni alan adlarını kullan (parseFloat ile Decimal'e çevrildiğinden emin ol)
    const toplam_sut_alacagi = parseFloat(ozet.toplam_sut_alacagi || 0).toFixed(2);
    const toplam_yem_borcu = parseFloat(ozet.toplam_yem_borcu || 0).toFixed(2);
    const toplam_sirket_odemesi = parseFloat(ozet.toplam_sirket_odemesi || 0).toFixed(2);
    const toplam_tahsilat = parseFloat(ozet.toplam_tahsilat || 0).toFixed(2);
    const net_bakiye = parseFloat(ozet.net_bakiye || 0).toFixed(2);

    container.innerHTML = `
        <div class="col-lg col-md-6 col-12">
            <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Toplam Süt Alacağı</div>
                <h4 class="fw-bold mb-0 text-success">${toplam_sut_alacagi} TL</h4>
            </div>
        </div>
        <div class="col-lg col-md-6 col-12">
            <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Toplam Yem Borcu</div>
                <h4 class="fw-bold mb-0 text-danger">${toplam_yem_borcu} TL</h4>
            </div>
        </div>
        <div class="col-lg col-md-6 col-12">
            <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Şirketten Ödeme (Avans+Hakediş)</div>
                <h4 class="fw-bold mb-0 text-warning">${toplam_sirket_odemesi} TL</h4>
            </div>
        </div>
        <div class="col-lg col-md-6 col-12">
            <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Tahsilat (Çiftçiden Alınan)</div>
                <h4 class="fw-bold mb-0 text-info">${toplam_tahsilat} TL</h4>
            </div>
        </div>
        <div class="col-lg col-md-12 col-12">
            <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Net Bakiye</div>
                <h4 class="fw-bold mb-0 text-primary">${net_bakiye} TL</h4>
            </div>
        </div>
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
