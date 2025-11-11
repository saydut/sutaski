// ====================================================================================
// ARAYÜZ YÖNETİMİ (ui.js) - RLS/AUTH GÜNCELLENDİ
// Sadece temel UI yardımcıları (mesaj gösterme) kaldı.
// 'checkOfflineLicense' fonksiyonu, yeni sunucu tabanlı Auth sistemiyle
// uyumsuz olduğu için kaldırıldı.
// ====================================================================================

// Bu kontrollerin (renderUtils, utils) 'render-utils.js' ve 'utils.js' 
// dosyalarından geldiğini varsayıyoruz.
if (typeof renderUtils === 'undefined') {
    console.error("ui.js: renderUtils objesi bulunamadı. render-utils.js yüklendi mi?");
}
if (typeof utils === 'undefined') {
    console.error("ui.js: utils objesi bulunamadı. utils.js yüklendi mi?");
}


/**
 * Kullanıcıya dinamik olarak bir mesaj gösterir.
 * @param {string} mesaj - Gösterilecek mesaj (HTML içerebilir).
 * @param {string} tip - Alert tipi ('success', 'info', 'warning', 'danger').
 * @param {number} sure - Mesajın ekranda kalma süresi (milisaniye).
 * @param {boolean} allowHTML - Mesajın HTML olarak yorumlanıp yorumlanmayacağı.
 */
function gosterMesaj(mesaj, tip = 'info', sure = 5000, allowHTML = false) { // YENİ: allowHTML eklendi
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        console.error("'alert-container' ID'li element bulunamadı.");
        // Eğer ana panelde değilsek (login vb) ve bu ID yoksa, 
        // global bir fallback (örn. konsol) kullanalım.
        console.log(`MESAJ (${tip}): ${mesaj}`);
        return;
    }
    
    const alertId = 'alert-' + Date.now();
    let alertMessage = mesaj;
    
    // allowHTML true değilse, metni güvenli hale getir (XSS koruması)
    if (!allowHTML) {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = mesaj;
        alertMessage = tempDiv.innerHTML;
    }

    const alert = `
        <div id="${alertId}" class="alert alert-${tip} alert-dismissible fade show" role="alert">
            ${alertMessage}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    // Eski mesajları temizleyip yenisini ekle
    alertContainer.innerHTML = alert;

    // Belirli bir süre sonra otomatik kapat
    // (Eğer 'sure' parametresi 0'dan büyükse)
    if (sure > 0) {
        setTimeout(() => {
            const alertElement = document.getElementById(alertId);
            if (alertElement) {
                // Bootstrap 5'in 'close' metodunu programatik olarak tetikle
                const bsAlert = bootstrap.Alert.getOrCreateInstance(alertElement);
                if (bsAlert) {
                    bsAlert.close();
                } else {
                    alertElement.remove(); // Fallback
                }
            }
        }, sure);
    }
}

// Global scope'a ekle
window.gosterMesaj = gosterMesaj;

// ESKİ 'checkOfflineLicense' fonksiyonu, yeni Auth (sunucu tabanlı)
// sistemiyle (localStorage yerine cookie/token kullanır) artık uyumsuz 
// olduğu için KALDIRILDI.