// ====================================================================================
// YARDIMCI FONKSİYONLAR (utils.js)
// Projenin farklı yerlerinde kullanılabilen genel amaçlı, arayüzden bağımsız fonksiyonları içerir.
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
    },

    /**
     * YENİ: innerHTML'e eklenecek metinleri güvenli hale getirir.
     * Bu, XSS saldırılarına karşı bir önlemdir.
     * @param {string} str - Temizlenecek metin.
     * @returns {string} - HTML etiketlerinden arındırılmış güvenli metin.
     */
    sanitizeHTML(str) {
        if (str === null || str === undefined) {
            return '';
        }
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }
};


/**
 * Hem yerel kullanıcı verisini siler hem de sunucudan çıkış yapar.
 */
function guvenliCikis() {
    console.log("Güvenli Çıkış yapılıyor...");
    // 1. Yerel depolamayı temizle
    localStorage.removeItem('offlineUser');
    console.log("localStorage['offlineUser'] temizlendi.");

    // 2. Global değişkenleri sıfırla (varsa)
    if (typeof kullaniciRolu !== 'undefined') {
        kullaniciRolu = null;
        console.log("Global 'kullaniciRolu' sıfırlandı.");
    }
     // window altındaki değişkenleri de sıfırlayalım (ihtiyaç olursa)
     window.anaPanelMevcutGorunum = 'liste';
     window.anaPanelMevcutSayfa = 1;

    // 3. Backend logout endpoint'ine yönlendir
    console.log("'/logout' adresine yönlendiriliyor.");
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
        gosterMesaj(mesaj, 'info', 10000, true); // YENİ: allowHTML: true
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
        
        window.open(objectUrl, '_blank');
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
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