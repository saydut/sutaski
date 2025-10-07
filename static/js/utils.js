// ====================================================================================
// YARDIMCI FONKSİYONLAR (utils.js)
// Projenin farklı yerlerinde kullanılabilen genel amaçlı fonksiyonları içerir.
// ====================================================================================

const utils = {
    /**
     * JavaScript Date nesnesini 'YYYY-MM-DD' formatında bir string'e çevirir.
     * @param {Date} date - Formatlanacak tarih nesnesi. Varsayılan: şimdi.
     * @returns {string}
     */
    getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};


/**
 * Kullanıcıya dinamik olarak bir mesaj gösterir.
 * @param {string} mesaj Gösterilecek metin.
 * @param {string} tip Mesajın türü (success, danger, warning, info).
 * @param {number} sure Ms cinsinden ne kadar süre ekranda kalacağı.
 */
function gosterMesaj(mesaj, tip = 'info', sure = 5000) {
    const container = document.getElementById('alert-container');
    if (!container) {
        console.error("'alert-container' ID'li element sayfada bulunamadı.");
        return;
    }
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${tip} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `${mesaj} <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
    container.appendChild(alertDiv);
    setTimeout(() => {
        const alertInstance = bootstrap.Alert.getOrCreateInstance(alertDiv);
        if(alertInstance) { 
            alertInstance.close(); 
        }
    }, sure);
}

/**
 * Hem yerel kullanıcı verisini siler hem de sunucudan çıkış yapar.
 */
function guvenliCikis() {
    localStorage.removeItem('offlineUser');
    window.location.href = '/logout';
}

document.addEventListener('DOMContentLoaded', () => {
    yeniOzellikBildirimiKontrolEt();
});

/**
 * Uygulama sürümünü kontrol eder ve yeni bir sürüm varsa kullanıcıya bir defalık bildirim gösterir.
 */
function yeniOzellikBildirimiKontrolEt() {
    const mevcutVersiyon = document.body.dataset.appVersion;
    if (!mevcutVersiyon) return;
    const kullanicininGorduguVersiyon = localStorage.getItem('sutaski_app_version');
    if (mevcutVersiyon !== kullanicininGorduguVersiyon) {
        const mesaj = `
            <strong>Uygulama güncellendi!</strong> Sürüm ${mevcutVersiyon}'a hoş geldiniz.
            <a href="#" class="alert-link" data-bs-toggle="modal" data-bs-target="#hakkindaModal">Yenilikleri görmek için tıklayın.</a>
        `;
        gosterMesaj(mesaj, 'info', 10000); 
        localStorage.setItem('sutaski_app_version', mevcutVersiyon);
    }
}

/**
 * Verilen select elementlerini mevcut ay ve yıl seçenekleriyle doldurur.
 * @param {string} aySeciciId - Ay <select> elementinin ID'si.
 * @param {string} yilSeciciId - Yıl <select> elementinin ID'si.
 */
function ayYilSecicileriniDoldur(aySeciciId, yilSeciciId) {
    const aySecici = document.getElementById(aySeciciId);
    const yilSecici = document.getElementById(yilSeciciId);
    if (!aySecici || !yilSecici) return;

    const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const simdikiTarih = new Date();
    const simdikiYil = simdikiTarih.getFullYear();
    const simdikiAy = simdikiTarih.getMonth();

    aySecici.innerHTML = '';
    yilSecici.innerHTML = '';

    aylar.forEach((ay, index) => { aySecici.add(new Option(ay, index + 1)); });
    aySecici.value = simdikiAy + 1;

    for (let i = 0; i < 5; i++) {
        yilSecici.add(new Option(simdikiYil - i, simdikiYil - i));
    }
}

/**
 * Bir API endpoint'inden PDF dosyasını indirir ve yeni sekmede açar.
 * @param {string} url - PDF'i getirecek API adresi.
 * @param {string} buttonId - İşlemi tetikleyen butonun ID'si.
 * @param {object} messages - {success: string, error: string} formatında mesajlar.
 */
async function indirVeAc(url, buttonId, messages) {
    const button = document.getElementById(buttonId);
    if (!button) {
        console.error(`Buton bulunamadı: ${buttonId}`);
        return;
    }
    const originalContent = button.innerHTML;

    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm"></span> İşleniyor...`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: messages.error }));
            throw new Error(errorData.error || messages.error);
        }
        
        const disposition = response.headers.get('Content-Disposition');
        let filename = `rapor.pdf`;
        if (disposition && disposition.includes('attachment')) {
            const filenameMatch = /filename[^;=\n]*=(['"]?)([^'";\n]+)\1?/;
            const matches = filenameMatch.exec(disposition);
            if (matches && matches[2]) {
                filename = matches[2].replace(/['"]/g, '');
            }
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        
        // Yeni sekmede aç ve indir
        window.open(objectUrl, '_blank');
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Temizlik
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(objectUrl), 100);
        
        gosterMesaj(messages.success, "success");

    } catch (error) {
        gosterMesaj(error.message, "danger");
    } finally {
        button.disabled = false;
        button.innerHTML = originalContent;
    }
}


/**
 * Veriyi yükler, belirtilen görünüme göre render eder ve sayfalama oluşturur.
 * @param {object} config - Yapılandırma objesi.
 */
async function genelVeriYukleyici(config) {
    const tabloBody = document.getElementById(config.tabloBodyId);
    const kartContainer = document.getElementById(config.kartContainerId);
    const veriYok = document.getElementById(config.veriYokId);
    const sayfalamaNav = document.getElementById(config.sayfalamaId);

    // Çevrimdışı kontrolü
    if (!navigator.onLine) {
        veriYok.innerHTML = `<p class="text-warning">Bu verileri görüntülemek için internet bağlantısı gereklidir.</p>`;
        veriYok.style.display = 'block';
        if(tabloBody) tabloBody.innerHTML = '';
        if(kartContainer) kartContainer.innerHTML = '';
        if(sayfalamaNav) sayfalamaNav.innerHTML = '';
        return;
    }

    // Yükleniyor animasyonları
    const spinnerHtml = `<tr><td colspan="6" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    const kartSpinnerHtml = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;
    if(tabloBody) tabloBody.innerHTML = spinnerHtml;
    if(kartContainer) kartContainer.innerHTML = kartSpinnerHtml;
    veriYok.style.display = 'none';

    try {
        const response = await fetch(config.apiURL);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Veriler yüklenemedi.');

        if(tabloBody) tabloBody.innerHTML = '';
        if(kartContainer) kartContainer.innerHTML = '';

        const veriler = data[config.veriAnahtari];
        // Backend'den gelen toplam kayıt sayısı anahtarının farklı olabilme ihtimaline karşı kontrol ekliyoruz
        const toplamKayit = data.toplam_kayit || data.toplam_urun_sayisi || data.toplam_islem_sayisi;

        if (!veriler || veriler.length === 0) {
            veriYok.style.display = 'block';
        } else {
            if (config.mevcutGorunum === 'tablo') {
                config.tabloRenderFn(tabloBody, veriler);
            } else {
                config.kartRenderFn(kartContainer, veriler);
            }
        }
        
        ui.sayfalamaNavOlustur(config.sayfalamaId, toplamKayit, config.sayfa, config.kayitSayisi, config.yukleFn);

    } catch (e) {
        const errorHtml = `<tr><td colspan="6" class="text-center p-4 text-danger">${e.message}</td></tr>`;
        const kartErrorHtml = `<div class="col-12 text-center p-4 text-danger">${e.message}</div>`;
        if(tabloBody) tabloBody.innerHTML = errorHtml;
        if(kartContainer) kartContainer.innerHTML = kartErrorHtml;
    }
}