// static/js/tedarikci_detay.js (MERKEZİ SAYFALAMA KULLANAN YENİ VERSİYON)

const yuklenenSekmeler = {
    sut: false,
    yem: false,
    finans: false
};
const KAYIT_SAYISI = 10;

window.onload = () => {
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

async function sutGirdileriniYukle(sayfa = 1) {
    yuklenenSekmeler.sut = true;
    const tbody = document.getElementById('sut-girdileri-tablosu');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    
    try {
        const response = await fetch(`/api/tedarikci/${TEDARIKCI_ID}/sut_girdileri?sayfa=${sayfa}`);
        const data = await response.json();
        tbody.innerHTML = '';
        if (data.girdiler.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-secondary">Süt girdisi bulunamadı.</td></tr>';
        } else {
            data.girdiler.forEach(girdi => {
                const tutar = parseFloat(girdi.litre || 0) * parseFloat(girdi.fiyat || 0);
                tbody.innerHTML += `
                    <tr>
                        <td>${new Date(girdi.taplanma_tarihi).toLocaleDateString('tr-TR')}</td>
                        <td class="text-end">${parseFloat(girdi.litre).toFixed(2)} L</td>
                        <td class="text-end">${parseFloat(girdi.fiyat).toFixed(2)} TL</td>
                        <td class="text-end">${tutar.toFixed(2)} TL</td>
                        <td>${girdi.kullanicilar.kullanici_adi}</td>
                    </tr>`;
            });
        }
        // DEĞİŞİKLİK: 'ui.' öneki eklendi ve sayfa başına kayıt sayısı parametresi verildi.
        ui.sayfalamaNavOlustur('sut-sayfalama', data.toplam_kayit, sayfa, KAYIT_SAYISI, sutGirdileriniYukle);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-danger">Veriler yüklenemedi.</td></tr>`;
    }
}

async function yemIslemleriniYukle(sayfa = 1) {
    yuklenenSekmeler.yem = true;
    const tbody = document.getElementById('yem-islemleri-tablosu');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;

    try {
        const response = await fetch(`/api/tedarikci/${TEDARIKCI_ID}/yem_islemleri?sayfa=${sayfa}`);
        const data = await response.json();
        tbody.innerHTML = '';
        if (data.islemler.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-secondary">Yem alımı bulunamadı.</td></tr>';
        } else {
            data.islemler.forEach(islem => {
                tbody.innerHTML += `
                    <tr>
                        <td>${new Date(islem.islem_tarihi).toLocaleDateString('tr-TR')}</td>
                        <td>${islem.yem_urunleri.yem_adi}</td>
                        <td class="text-end">${parseFloat(islem.miktar_kg).toFixed(2)} KG</td>
                        <td class="text-end">${parseFloat(islem.islem_anindaki_birim_fiyat).toFixed(2)} TL</td>
                        <td class="text-end">${parseFloat(islem.toplam_tutar).toFixed(2)} TL</td>
                        <td>${islem.kullanicilar.kullanici_adi}</td>
                    </tr>`;
            });
        }
        // DEĞİŞİKLİK: 'ui.' öneki eklendi ve sayfa başına kayıt sayısı parametresi verildi.
        ui.sayfalamaNavOlustur('yem-sayfalama', data.toplam_kayit, sayfa, KAYIT_SAYISI, yemIslemleriniYukle);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-danger">Veriler yüklenemedi.</td></tr>`;
    }
}

async function finansalIslemleriYukle(sayfa = 1) {
    yuklenenSekmeler.finans = true;
    const tbody = document.getElementById('finansal-islemler-tablosu');
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;

    try {
        const response = await fetch(`/api/tedarikci/${TEDARIKCI_ID}/finansal_islemler?sayfa=${sayfa}`);
        const data = await response.json();
        tbody.innerHTML = '';
        if (data.islemler.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-secondary">Finansal işlem bulunamadı.</td></tr>';
        } else {
            data.islemler.forEach(islem => {
                tbody.innerHTML += `
                    <tr>
                        <td>${new Date(islem.islem_tarihi).toLocaleDateString('tr-TR')}</td>
                        <td><span class="badge bg-${islem.islem_tipi === 'Ödeme' ? 'success' : 'warning'}">${islem.islem_tipi}</span></td>
                        <td class="text-end">${parseFloat(islem.tutar).toFixed(2)} TL</td>
                        <td>${islem.aciklama || '-'}</td>
                        <td>${islem.kullanicilar.kullanici_adi}</td>
                    </tr>`;
            });
        }
        // DEĞİŞİKLİK: 'ui.' öneki eklendi ve sayfa başına kayıt sayısı parametresi verildi.
        ui.sayfalamaNavOlustur('finans-sayfalama', data.toplam_kayit, sayfa, KAYIT_SAYISI, finansalIslemleriYukle);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-danger">Veriler yüklenemedi.</td></tr>`;
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
    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const url = `/api/tedarikci/${TEDARIKCI_ID}/hesap_ozeti_pdf?ay=${ay}&yil=${yil}`;
    
    indirVeAc(url, 'pdf-indir-btn', {
        success: 'Hesap özeti indirildi ve yeni sekmede açıldı.',
        error: 'PDF özeti oluşturulurken hata oluştu.'
    });
}

function mustahsilMakbuzuIndir() {
    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const url = `/api/tedarikci/${TEDARIKCI_ID}/mustahsil_makbuzu_pdf?ay=${ay}&yil=${yil}`;

    indirVeAc(url, 'mustahsil-indir-btn', {
        success: 'Müstahsil makbuzu indirildi ve yeni sekmede açıldı.',
        error: 'Müstahsil makbuzu oluşturulurken hata oluştu.'
    });
}