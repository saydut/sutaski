// static/js/tedarikci_detay.js (MERKEZİ SAYFALAMA KULLANAN YENİ VERSİYON)
let mevcutGorunum = 'tablo';


function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri-detay').forEach(el => {
        // ID'sinde aktif görünümün adını içerenleri göster, diğerlerini gizle
        if (el.id.includes(aktifGorunum)) {
            el.style.display = el.classList.contains('row') ? 'flex' : 'block';
        } else {
            el.style.display = 'none';
        }
    });
    document.getElementById('btn-view-table').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}

function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('tedarikciDetayGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);

    // Aktif olan sekmeyi yeniden yükle
    const aktifSekme = document.querySelector('.nav-tabs .nav-link.active');
    if (aktifSekme.id === 'sut-tab') sutGirdileriniYukle(1);
    else if (aktifSekme.id === 'yem-tab') yemIslemleriniYukle(1);
    else if (aktifSekme.id === 'finans-tab') finansalIslemleriYukle(1);
}
// EKLENECEK KOD SONU


const yuklenenSekmeler = {
    sut: false,
    yem: false,
    finans: false
};
const KAYIT_SAYISI = 10;

window.onload = () => {
    mevcutGorunum = localStorage.getItem('tedarikciDetayGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);

    ayYilSecicileriniDoldur('rapor-ay', 'rapor-yil');
    ozetVerileriniYukle();
    sutGirdileriniYukle(1);
    sekmeOlaylariniAyarla();
};

function sekmeOlaylariniAyarla() {
    document.getElementById('yem-tab').addEventListener('show.bs.tab', () => {
        if (!yuklenenSekmeler.yem) {
            yemIslemleriniYukle(1);
        }
    }, { once: true });

    document.getElementById('finans-tab').addEventListener('show.bs.tab', () => {
        if (!yuklenenSekmeler.finans) {
            finansalIslemleriYukle(1);
        }
    }, { once: true });
}

// ARTIK BU DOSYADA YEREL BİR "sayfalamaNavOlustur" FONKSİYONU YOK.

async function ozetVerileriniYukle() {
    const ozetKartlariContainer = document.getElementById('ozet-kartlari');
    const baslikElementi = document.getElementById('tedarikci-adi-baslik');
    baslikElementi.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
    ozetKartlariContainer.innerHTML = '<div class="col-12 text-center p-5"><div class="spinner-border"></div></div>';

    try {
        const response = await fetch(`/api/tedarikci/${TEDARIKCI_ID}/ozet`);
        if (!response.ok) throw new Error('Özet verileri alınamadı.');
        const data = await response.json();
        
        baslikElementi.innerText = data.isim;
        ozetKartlariniDoldur(data);

    } catch (error) {
        baslikElementi.innerText = "Hata";
        ozetKartlariContainer.innerHTML = `<div class="col-12 text-center p-4 text-danger">${error.message}</div>`;
    }
}



// --- Veri Yükleme Fonksiyonları ---

async function sutGirdileriniYukle(sayfa = 1) {
    yuklenenSekmeler.sut = true;
    await veriYukleVeGoster({
        sayfa: sayfa,
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/sut_girdileri?sayfa=${sayfa}`,
        veriAnahtari: 'girdiler',
        tabloBodyId: 'sut-girdileri-tablosu',
        kartContainerId: 'sut-kart-gorunumu',
        veriYokId: 'sut-veri-yok',
        sayfalamaId: 'sut-sayfalama',
        tabloRenderFn: renderSutAsTable,
        kartRenderFn: renderSutAsCards,
        yukleFn: sutGirdileriniYukle
    });
}

async function yemIslemleriniYukle(sayfa = 1) {
    yuklenenSekmeler.yem = true;
    await veriYukleVeGoster({
        sayfa: sayfa,
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/yem_islemleri?sayfa=${sayfa}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'yem-islemleri-tablosu',
        kartContainerId: 'yem-kart-gorunumu',
        veriYokId: 'yem-veri-yok',
        sayfalamaId: 'yem-sayfalama',
        tabloRenderFn: renderYemAsTable,
        kartRenderFn: renderYemAsCards,
        yukleFn: yemIslemleriniYukle
    });
}

async function finansalIslemleriYukle(sayfa = 1) {
    yuklenenSekmeler.finans = true;
    await veriYukleVeGoster({
        sayfa: sayfa,
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/finansal_islemler?sayfa=${sayfa}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'finansal-islemler-tablosu',
        kartContainerId: 'finans-kart-gorunumu',
        veriYokId: 'finans-veri-yok',
        sayfalamaId: 'finans-sayfalama',
        tabloRenderFn: renderFinansAsTable,
        kartRenderFn: renderFinansAsCards,
        yukleFn: finansalIslemleriYukle
    });
}

// --- Render Fonksiyonları ---

function renderSutAsTable(container, veriler) {
    veriler.forEach(girdi => {
        const tutar = parseFloat(girdi.litre || 0) * parseFloat(girdi.fiyat || 0);
        container.innerHTML += `<tr>
            <td>${new Date(girdi.taplanma_tarihi).toLocaleDateString('tr-TR')}</td>
            <td class="text-end">${parseFloat(girdi.litre).toFixed(2)} L</td>
            <td class="text-end">${parseFloat(girdi.fiyat).toFixed(2)} TL</td>
            <td class="text-end">${tutar.toFixed(2)} TL</td>
            <td>${girdi.kullanicilar.kullanici_adi}</td>
        </tr>`;
    });
}

function renderSutAsCards(container, veriler) {
    veriler.forEach(girdi => {
        const tutar = parseFloat(girdi.litre || 0) * parseFloat(girdi.fiyat || 0);
        container.innerHTML += `<div class="col-lg-4 col-md-6 col-12">
            <div class="card p-2 h-100">
                <div class="card-body p-2">
                    <div class="d-flex justify-content-between">
                        <span class="fs-4 fw-bold text-primary">${parseFloat(girdi.litre).toFixed(2)} L</span>
                        <span class="fs-5 fw-bold text-success">${tutar.toFixed(2)} TL</span>
                    </div>
                    <div class="text-secondary small mt-1">Birim Fiyat: ${parseFloat(girdi.fiyat).toFixed(2)} TL</div>
                    <div class="d-flex justify-content-between align-items-end mt-2">
                        <small class="text-secondary">${new Date(girdi.taplanma_tarihi).toLocaleDateString('tr-TR')}</small>
                        <small class="text-secondary">Giren: ${girdi.kullanicilar.kullanici_adi}</small>
                    </div>
                </div>
            </div>
        </div>`;
    });
}

function renderYemAsTable(container, veriler) {
    veriler.forEach(islem => {
        container.innerHTML += `<tr>
            <td>${new Date(islem.islem_tarihi).toLocaleDateString('tr-TR')}</td>
            <td>${islem.yem_urunleri.yem_adi}</td>
            <td class="text-end">${parseFloat(islem.miktar_kg).toFixed(2)} KG</td>
            <td class="text-end">${parseFloat(islem.islem_anindaki_birim_fiyat).toFixed(2)} TL</td>
            <td class="text-end">${parseFloat(islem.toplam_tutar).toFixed(2)} TL</td>
            <td>${islem.kullanicilar.kullanici_adi}</td>
        </tr>`;
    });
}

function renderYemAsCards(container, veriler) {
    veriler.forEach(islem => {
        container.innerHTML += `<div class="col-lg-4 col-md-6 col-12">
            <div class="card p-2 h-100">
                <div class="card-body p-2">
                    <h6 class="card-title mb-1">${islem.yem_urunleri.yem_adi}</h6>
                    <div class="d-flex justify-content-between">
                        <span class="fs-4 fw-bold text-primary">${parseFloat(islem.miktar_kg).toFixed(2)} KG</span>
                        <span class="fs-5 fw-bold text-danger">${parseFloat(islem.toplam_tutar).toFixed(2)} TL</span>
                    </div>
                     <div class="text-secondary small mt-1">Birim Fiyat: ${parseFloat(islem.islem_anindaki_birim_fiyat).toFixed(2)} TL</div>
                    <div class="d-flex justify-content-between align-items-end mt-2">
                        <small class="text-secondary">${new Date(islem.islem_tarihi).toLocaleDateString('tr-TR')}</small>
                        <small class="text-secondary">Giren: ${islem.kullanicilar.kullanici_adi}</small>
                    </div>
                </div>
            </div>
        </div>`;
    });
}

function renderFinansAsTable(container, veriler) {
    veriler.forEach(islem => {
        container.innerHTML += `<tr>
            <td>${new Date(islem.islem_tarihi).toLocaleDateString('tr-TR')}</td>
            <td><span class="badge bg-${islem.islem_tipi === 'Ödeme' ? 'success' : 'warning'}">${islem.islem_tipi}</span></td>
            <td class="text-end">${parseFloat(islem.tutar).toFixed(2)} TL</td>
            <td>${islem.aciklama || '-'}</td>
            <td>${islem.kullanicilar.kullanici_adi}</td>
        </tr>`;
    });
}

function renderFinansAsCards(container, veriler) {
    veriler.forEach(islem => {
        const isOdeme = islem.islem_tipi === 'Ödeme';
        container.innerHTML += `<div class="col-lg-4 col-md-6 col-12">
             <div class="finance-card ${isOdeme ? 'odeme' : 'avans'}" style="padding: 0.5rem; height: 100%;">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="tutar ${isOdeme ? 'text-success' : 'text-danger'}" style="font-size: 1.5rem;">${parseFloat(islem.tutar).toFixed(2)} TL</h5>
                    <span class="badge bg-${isOdeme ? 'success' : 'warning'}">${islem.islem_tipi}</span>
                </div>
                <p class="aciklama flex-grow-1">${islem.aciklama || 'Açıklama yok'}</p>
                <div class="d-flex justify-content-between align-items-end">
                    <small class="text-secondary">${new Date(islem.islem_tarihi).toLocaleDateString('tr-TR')}</small>
                    <small class="text-secondary">Giren: ${islem.kullanicilar.kullanici_adi}</small>
                </div>
            </div>
        </div>`;
    });
}

// --- Genel Veri Yükleme Motoru ---

async function veriYukleVeGoster(config) {
    const tabloBody = document.getElementById(config.tabloBodyId);
    const kartContainer = document.getElementById(config.kartContainerId);
    const veriYok = document.getElementById(config.veriYokId);
    
    // --- YENİ: Her veri türü için benzersiz bir önbellek anahtarı oluştur ---
    const cacheKey = `tedarikci_detay_${TEDARIKCI_ID}_${config.veriAnahtari}`;

    // --- YENİ ÇEVRİMDIŞI MANTIĞI ---
    if (!navigator.onLine) {
        tabloBody.innerHTML = `<tr><td colspan="6" class="text-center p-4"><div class="spinner-border"></div><p class="mt-2 small">Önbellek aranıyor...</p></td></tr>`;
        kartContainer.innerHTML = `<div class="col-12 text-center p-4"><div class="spinner-border"></div><p class="mt-2 small">Önbellek aranıyor...</p></div>`;
        veriYok.style.display = 'none';

        const data = await getCachedAnaPanelData(cacheKey);

        if (data) {
            gosterMesaj("Çevrimdışı mod: Önbellekteki veriler gösteriliyor.", "info");
            tabloBody.innerHTML = '';
            kartContainer.innerHTML = '';

            const veriler = data[config.veriAnahtari];
            if (veriler.length === 0) {
                veriYok.style.display = 'block';
            } else {
                if (mevcutGorunum === 'tablo') config.tabloRenderFn(tabloBody, veriler);
                else config.kartRenderFn(kartContainer, veriler);
            }
            // Çevrimdışıyken sayfalama olmaz
            document.getElementById(config.sayfalamaId).innerHTML = '';
        } else {
            tabloBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-warning">Çevrimdışı mod. Bu bölüm için önbellekte veri bulunamadı.</td></tr>`;
            kartContainer.innerHTML = `<div class="col-12 text-center p-4 text-warning">Çevrimdışı mod. Bu bölüm için önbellekte veri bulunamadı.</div>`;
        }
        return; // Fonksiyonu burada bitir
    }
    // --- ÇEVRİMDIŞI MANTIĞI SONU ---

    tabloBody.innerHTML = `<tr><td colspan="6" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    kartContainer.innerHTML = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;
    veriYok.style.display = 'none';

    try {
        const response = await fetch(config.apiURL);
        const data = await response.json();
        
        // --- YENİ: Başarılı API isteği sonrası veriyi önbelleğe al ---
        await cacheAnaPanelData(cacheKey, data);

        tabloBody.innerHTML = '';
        kartContainer.innerHTML = '';

        const veriler = data[config.veriAnahtari];
        if (veriler.length === 0) {
            veriYok.style.display = 'block';
        } else {
            if (mevcutGorunum === 'tablo') config.tabloRenderFn(tabloBody, veriler);
            else config.kartRenderFn(kartContainer, veriler);
        }
        ui.sayfalamaNavOlustur(config.sayfalamaId, data.toplam_kayit, config.sayfa, KAYIT_SAYISI, config.yukleFn);
    } catch (e) {
        tabloBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-danger">Veriler yüklenemedi.</td></tr>`;
        kartContainer.innerHTML = `<div class="col-12 text-center p-4 text-danger">Veriler yüklenemedi.</div>`;
    }
}


function ozetKartlariniDoldur(ozet) {
    const container = document.getElementById('ozet-kartlari');
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





function hesapOzetiIndir() {
    // --- YENİ EKLENEN KONTROL ---
    if (!navigator.onLine) {
        gosterMesaj("PDF oluşturmak için internet bağlantısı gereklidir.", "warning");
        return;
    }
    // --- KONTROL SONU ---

    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const url = `/api/tedarikci/${TEDARIKCI_ID}/hesap_ozeti_pdf?ay=${ay}&yil=${yil}`;
    
    indirVeAc(url, 'pdf-indir-btn', {
        success: 'Hesap özeti indirildi ve yeni sekmede açıldı.',
        error: 'PDF özeti oluşturulurken hata oluştu.'
    });
}

function mustahsilMakbuzuIndir() {
    // --- YENİ EKLENEN KONTROL ---
    if (!navigator.onLine) {
        gosterMesaj("PDF oluşturmak için internet bağlantısı gereklidir.", "warning");
        return;
    }
    // --- KONTROL SONU ---

    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const url = `/api/tedarikci/${TEDARIKCI_ID}/mustahsil_makbuzu_pdf?ay=${ay}&yil=${yil}`;

    indirVeAc(url, 'mustahsil-indir-btn', {
        success: 'Müstahsil makbuzu indirildi ve yeni sekmede açıldı.',
        error: 'Müstahsil makbuzu oluşturulurken hata oluştu.'
    });
}