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