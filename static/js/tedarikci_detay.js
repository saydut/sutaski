// static/js/tedarikci_detay.js (SAYFALAMA DESTEKLİ YENİ VERSİYON)

// Hangi sekmenin verisinin yüklendiğini takip etmek için
const yuklenenSekmeler = {
    sut: false,
    yem: false,
    finans: false
};
const KAYIT_SAYISI = 10; // Sayfa başına gösterilecek kayıt sayısı

window.onload = () => {
    ayYilSecicileriniDoldur(); // Raporlama için ay/yıl dropdown'larını doldur
    ozetVerileriniYukle();     // Sadece özet kartlarını yükle
    sutGirdileriniYukle(1);    // Varsayılan olarak ilk sekmenin ilk sayfasını yükle
    sekmeOlaylariniAyarla();   // Diğer sekmelere tıklandığında veri yüklemesi için olayları ayarla
};

/**
 * Diğer sekmelere ilk kez tıklandığında ilgili veriyi yüklemek için olay dinleyicileri ekler.
 */
function sekmeOlaylariniAyarla() {
    document.getElementById('yem-tab').addEventListener('show.bs.tab', () => {
        if (!yuklenenSekmeler.yem) {
            yemIslemleriniYukle(1);
        }
    }, { once: true }); // Olay sadece bir kez tetiklensin

    document.getElementById('finans-tab').addEventListener('show.bs.tab', () => {
        if (!yuklenenSekmeler.finans) {
            finansalIslemleriYukle(1);
        }
    }, { once: true });
}

/**
 * Sayfalama navigasyonunu oluşturan yardımcı fonksiyon.
 */
function sayfalamaNavOlustur(containerId, toplamOge, aktifSayfa, sayfaDegistirCallback) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const toplamSayfa = Math.ceil(toplamOge / KAYIT_SAYISI);
    if (toplamSayfa <= 1) return;
    
    const ul = document.createElement('ul');
    ul.className = 'pagination pagination-sm';
    for (let i = 1; i <= toplamSayfa; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === aktifSayfa ? 'active' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.innerText = i;
        a.onclick = (e) => { e.preventDefault(); sayfaDegistirCallback(i); };
        li.appendChild(a);
        ul.appendChild(li);
    }
    container.appendChild(ul);
}

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
                        <td class="text-end">${parseFloat(girdi.fiyat).toFixed(2)}</td>
                        <td class="text-end">${tutar.toFixed(2)}</td>
                        <td>${girdi.kullanicilar.kullanici_adi}</td>
                    </tr>`;
            });
        }
        sayfalamaNavOlustur('sut-sayfalama', data.toplam_kayit, sayfa, sutGirdileriniYukle);
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
                        <td class="text-end">${parseFloat(islem.miktar_kg).toFixed(2)}</td>
                        <td class="text-end">${parseFloat(islem.islem_anindaki_birim_fiyat).toFixed(2)}</td>
                        <td class="text-end">${parseFloat(islem.toplam_tutar).toFixed(2)}</td>
                        <td>${islem.kullanicilar.kullanici_adi}</td>
                    </tr>`;
            });
        }
        sayfalamaNavOlustur('yem-sayfalama', data.toplam_kayit, sayfa, yemIslemleriniYukle);
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
        sayfalamaNavOlustur('finans-sayfalama', data.toplam_kayit, sayfa, finansalIslemleriYukle);
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


// --- PDF İndirme ve Raporlama Fonksiyonları (DEĞİŞİKLİK YOK) ---

function ayYilSecicileriniDoldur() {
    // Bu fonksiyon utils.js'e taşınabilir, şimdilik burada bırakıyorum.
    const aySecici = document.getElementById('rapor-ay');
    const yilSecici = document.getElementById('rapor-yil');
    const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const simdikiTarih = new Date();
    const simdikiYil = simdikiTarih.getFullYear();
    const simdikiAy = simdikiTarih.getMonth();
    aylar.forEach((ay, index) => { aySecici.add(new Option(ay, index + 1)); });
    aySecici.value = simdikiAy + 1;
    for (let i = 0; i < 5; i++) { yilSecici.add(new Option(simdikiYil - i, simdikiYil - i)); }
}

async function pdfIndir(endpoint, buttonId, successMessage, errorMessage) {
    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const button = document.getElementById(buttonId);
    const originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm"></span> İşleniyor...`;
    try {
        const response = await fetch(`/api/tedarikci/${TEDARIKCI_ID}/${endpoint}?ay=${ay}&yil=${yil}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || errorMessage);
        }
        const disposition = response.headers.get('Content-Disposition');
        let filename = `rapor.pdf`;
        if (disposition && disposition.includes('attachment')) {
            const filenameMatch = /filename[^;=\n]*=(['"]?)([^'";\n]+)\1?/;
            const matches = filenameMatch.exec(disposition);
            if (matches && matches[2]) { filename = matches[2]; }
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        const a = document.createElement('a');
        a.style.display = 'none'; a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
        gosterMesaj(successMessage, "success");
    } catch (error) {
        gosterMesaj(error.message, "danger");
    } finally {
        button.disabled = false;
        button.innerHTML = originalContent;
    }
}

function hesapOzetiIndir() {
    pdfIndir('hesap_ozeti_pdf', 'pdf-indir-btn', 'Hesap özeti indirildi ve yeni sekmede açıldı.', 'PDF özeti oluşturulurken hata oluştu.');
}

function mustahsilMakbuzuIndir() {
    pdfIndir('mustahsil_makbuzu_pdf', 'mustahsil-indir-btn', 'Müstahsil makbuzu indirildi ve yeni sekmede açıldı.', 'Müstahsil makbuzu oluşturulurken hata oluştu.');
}