/**
 * Kullanıcıya dinamik olarak bir mesaj gösterir.
 * Mesaj, 5 saniye sonra otomatik olarak kaybolur.
 * @param {string} mesaj Gösterilecek metin.
 * @param {string} tip Mesajın türü (success, danger, warning, info). Bootstrap alert renklerini belirler.
 */
function gosterMesaj(mesaj, tip = 'info') {
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
    
    // 5 saniye sonra alert'i otomatik olarak kapat
    setTimeout(() => {
        // Bootstrap'in Alert bileşenini kullanarak güvenli bir şekilde kapat
        const alertInstance = bootstrap.Alert.getOrCreateInstance(alertDiv);
        if(alertInstance) { 
            alertInstance.close(); 
        }
    }, 5000);
}
