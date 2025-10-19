// static/js/ios-install-prompt.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Kullanıcının işletim sistemini kontrol et
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // 2. Uygulamanın zaten ana ekrandan başlatılıp başlatılmadığını kontrol et
    // 'standalone' modu, PWA'nın ana ekrandan açıldığını gösterir.
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);

    // 3. Kullanıcının bu mesajı daha önce kapatıp kapatmadığını kontrol et
    const hasDismissed = localStorage.getItem('iosInstallPromptDismissed');

    // Eğer kullanıcı iOS kullanıyorsa, uygulama ana ekranda değilse ve mesajı daha önce kapatmadıysa...
    if (isIOS && !isInStandaloneMode && !hasDismissed) {
        const promptElement = document.getElementById('ios-install-prompt');
        
        if (promptElement) {
            // Toast (balon mesaj) bileşenini Bootstrap ile başlat
            const installPrompt = new bootstrap.Toast(promptElement, {
                autohide: false // Otomatik olarak kapanmasın
            });

            // Mesajı göster
            installPrompt.show();

            // Kapatma butonuna tıklandığında...
            promptElement.querySelector('.btn-close').addEventListener('click', () => {
                // Kullanıcının bu mesajı kapattığını localStorage'a kaydet ki bir daha görmesin.
                localStorage.setItem('iosInstallPromptDismissed', 'true');
            });
        }
    }
});

