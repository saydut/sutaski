/**
 * Kullanıcıya dinamik olarak bir mesaj gösterir.
 * @param {string} mesaj Gösterilecek metin.
 * @param {string} tip Mesajın türü (success, danger, warning, info). Bootstrap alert renklerini belirler.
 * @param {number} sure Ms cinsinden ne kadar süre ekranda kalacağı. Varsayılan 5000 (5 saniye).
 */
function gosterMesaj(mesaj, tip = 'info', sure = 5000) {
    // Mesajların gösterileceği ana kapsayıcıyı bul
    const container = document.getElementById('alert-container');
    // Eğer sayfada bu kapsayıcı yoksa, işlemi durdur
    if (!container) {
        console.error("'alert-container' ID'li element sayfada bulunamadı.");
        return;
    }

    // Yeni bir alert div'i oluştur
    const alertDiv = document.createElement('div');
    // Bootstrap sınıflarını ve rolünü ata
    alertDiv.className = `alert alert-${tip} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    // İçeriğini (mesaj ve kapatma düğmesi) ayarla
    alertDiv.innerHTML = `${mesaj} <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`;
    
    // Oluşturulan alert'i kapsayıcının içine ekle
    container.appendChild(alertDiv);
    
    // Belirtilen süre sonra alert'i otomatik olarak kapat
    setTimeout(() => {
        // Bootstrap'in Alert bileşenini kullanarak güvenli bir şekilde kapat
        const alertInstance = bootstrap.Alert.getOrCreateInstance(alertDiv);
        if(alertInstance) { 
            alertInstance.close(); 
        }
    }, sure);
}

// --- YENİ EKLENEN FONKSİYON ---
/**
 * Hem yerel kullanıcı verisini siler hem de sunucudan çıkış yapar.
 */
function guvenliCikis() {
    // Önce yerel depodaki kullanıcı bilgisini temizle
    localStorage.removeItem('offlineUser');
    // Sonra sunucudaki logout adresine yönlendir
    window.location.href = '/logout';
}
// --- YENİ FONKSİYON SONU ---


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
        // "Uygulama Hakkında" modalını açacak bir link de ekleyebiliriz.
        const mesaj = `
            <strong>Uygulama güncellendi!</strong> Sürüm ${mevcutVersiyon}'a hoş geldiniz.
            <a href="#" class="alert-link" data-bs-toggle="modal" data-bs-target="#hakkindaModal">Yenilikleri görmek için tıklayın.</a>
        `;
        
        // Bu önemli bir bildirim olduğu için süresini uzatıyoruz (10 saniye)
        gosterMesaj(mesaj, 'info', 10000); 

        // Kullanıcının bu sürümü gördüğünü tarayıcısına kaydet.
        localStorage.setItem('sutaski_app_version', mevcutVersiyon);
    }
}