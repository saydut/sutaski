// Bu script SADECE login.html'de çalışır.
// utils.js veya api.js'e erişimi YOKTUR (çünkü base.html'e dahil değil).
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    
    // Hata mesajlarını göstermek için özel bir fonksiyon (utils.js'deki showToast'a benzer)
    const showLoginError = (message) => {
        // Hata konteynerini bul veya oluştur
        let errorContainer = document.getElementById('login-error-toast');
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.id = 'login-error-toast';
            // Flask'in flash mesajlarıyla aynı stilde yapalım
            errorContainer.className = "p-4 rounded-md bg-red-100 border border-red-400 text-red-700 mb-4";
            
            // Hata mesajını başlığın altına ekle
            const heading = loginForm.parentElement.querySelector('h2');
            heading.insertAdjacentElement('afterend', errorContainer);
        }
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    };
    
    // Kullanıcı forma yazmaya başlarsa,
    // hem Flask'ten gelen (sayfa yenilenince) hem de JS ile oluşan hataları temizle
    loginForm.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            // Flask flash mesajlarını gizle
            const flashMessages = document.querySelector('.mb-4 > .p-4');
            if (flashMessages) flashMessages.style.display = 'none';
            
            // JS hata mesajını gizle
            const errorToast = document.getElementById('login-error-toast');
            if (errorToast) errorToast.style.display = 'none';
        });
    });

    // Form gönderildiğinde (submit)
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Sayfanın yeniden yüklenmesini engelle

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const actionUrl = loginForm.action; // URL'yi formun 'action' attribute'undan al

        try {
            const response = await fetch(actionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Giriş başarılıysa, backend'in söylediği URL'ye yönlendir
                window.location.href = data.redirect_url || '/'; 
            } else {
                // Giriş başarısızsa, hatayı ekranda göster
                showLoginError(data.hata || 'Bilinmeyen bir hata oluştu.');
            }
        } catch (error) {
            console.error('Giriş hatası:', error);
            showLoginError('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
        }
    });
});