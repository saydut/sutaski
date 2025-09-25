window.onload = () => {
    ayYilSecicileriniDoldur();
    verileriYukle();
};

async function verileriYukle() {
    const ozetKartlariContainer = document.getElementById('ozet-kartlari');
    const sutTabloBody = document.getElementById('sut-girdileri-tablosu');
    const yemTabloBody = document.getElementById('yem-islemleri-tablosu');
    const baslikElementi = document.getElementById('tedarikci-adi-baslik');
    
    // Yükleme animasyonlarını ayarla
    baslikElementi.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
    ozetKartlariContainer.innerHTML = '<div class="col-12 text-center p-5"><div class="spinner-border"></div></div>';
    sutTabloBody.innerHTML = `<tr><td colspan="5" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    yemTabloBody.innerHTML = `<tr><td colspan="6" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;

    try {
        const response = await fetch(`/api/tedarikci/${TEDARIKCI_ID}/detay`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Tedarikçi detayları alınamadı.');
        }
        const data = await response.json();
        
        baslikElementi.innerText = data.isim;
        ozetKartlariniDoldur(data.ozet);
        sutGirdileriniDoldur(data.sut_girdileri);
        yemIslemleriniDoldur(data.yem_islemleri);

    } catch (error) {
        console.error("Hata:", error);
        baslikElementi.innerText = "Hata";
        baslikElementi.classList.add('text-danger');
        ozetKartlariContainer.innerHTML = `<div class="col-12 text-center p-4 text-danger">${error.message}</div>`;
    }
}

function ozetKartlariniDoldur(ozet) {
    const container = document.getElementById('ozet-kartlari');
    container.innerHTML = `
        <div class="col-md-4 col-12"><div class="card p-3 text-center h-100"><div class="fs-6 text-secondary">Toplam Süt Alacağı</div><h4 class="fw-bold mb-0 text-success">${ozet.toplam_sut_alacagi} TL</h4></div></div>
        <div class="col-md-4 col-12"><div class="card p-3 text-center h-100"><div class="fs-6 text-secondary">Toplam Yem Borcu</div><h4 class="fw-bold mb-0 text-danger">${ozet.toplam_yem_borcu} TL</h4></div></div>
        <div class="col-md-4 col-12"><div class="card p-3 text-center h-100"><div class="fs-6 text-secondary">Net Bakiye</div><h4 class="fw-bold mb-0 text-primary">${ozet.net_bakiye} TL</h4></div></div>
    `;
}

function sutGirdileriniDoldur(girdiler) {
    const tbody = document.getElementById('sut-girdileri-tablosu');
    tbody.innerHTML = '';
    if (girdiler.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-secondary">Bu tedarikçiye ait süt girdisi bulunamadı.</td></tr>';
    } else {
        girdiler.forEach(girdi => {
            const litre = parseFloat(girdi.litre || 0);
            const fiyat = parseFloat(girdi.fiyat || 0);
            const tutar = litre * fiyat;
            const tr = `
                <tr>
                    <td>${new Date(girdi.taplanma_tarihi).toLocaleDateString('tr-TR')}</td>
                    <td class="text-end">${litre.toFixed(2)} L</td>
                    <td class="text-end">${fiyat.toFixed(2)}</td>
                    <td class="text-end">${tutar.toFixed(2)}</td>
                    <td>${girdi.kullanicilar.kullanici_adi}</td>
                </tr>`;
            tbody.innerHTML += tr;
        });
    }
}

function yemIslemleriniDoldur(islemler) {
    const tbody = document.getElementById('yem-islemleri-tablosu');
    tbody.innerHTML = '';
    if (islemler.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-secondary">Bu tedarikçiye ait yem alımı bulunamadı.</td></tr>';
    } else {
        islemler.forEach(islem => {
            const tr = `
                <tr>
                    <td>${new Date(islem.islem_tarihi).toLocaleDateString('tr-TR')}</td>
                    <td>${islem.yem_urunleri.yem_adi}</td>
                    <td class="text-end">${parseFloat(islem.miktar_kg).toFixed(2)}</td>
                    <td class="text-end">${parseFloat(islem.islem_anindaki_birim_fiyat).toFixed(2)}</td>
                    <td class="text-end">${parseFloat(islem.toplam_tutar).toFixed(2)}</td>
                    <td>${islem.kullanicilar.kullanici_adi}</td>
                </tr>`;
            tbody.innerHTML += tr;
        });
    }
}

function ayYilSecicileriniDoldur() {
    // Bu fonksiyon aynı kalıyor...
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

async function hesapOzetiIndir() {
    // Bu fonksiyon aynı kalıyor...
    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const button = document.getElementById('pdf-indir-btn');
    const originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm"></span> İşleniyor...`;
    try {
        const response = await fetch(`/api/tedarikci/${TEDARIKCI_ID}/hesap_ozeti_pdf?ay=${ay}&yil=${yil}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'PDF özeti oluşturulurken bir hata oluştu.');
        }
        const disposition = response.headers.get('Content-Disposition');
        let filename = `hesap_ozeti.pdf`;
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) { filename = matches[1].replace(/['"]/g, ''); }
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        const a = document.createElement('a');
        a.style.display = 'none'; a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
        gosterMesaj("Hesap özeti indirildi ve yeni sekmede açıldı.", "success");
    } catch (error) {
        console.error("PDF işlenirken hata:", error);
        gosterMesaj(error.message, "danger");
    } finally {
        button.disabled = false;
        button.innerHTML = originalContent;
    }
}