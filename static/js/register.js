// Bu script SADECE register.html'de çalışır.
// utils.js veya api.js'e erişimi YOKTUR (çünkü base.html'e dahil değil).
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');

    // Hata mesajlarını göstermek için özel bir fonksiyon
    const showRegisterError = (message) => {
        let errorContainer = document.getElementById('register-error-toast');
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.id = 'register-error-toast';
            errorContainer.className = "p-4 rounded-md bg-red-100 border border-red-400 text-red-700 mb-4";
            
            const heading = registerForm.parentElement.querySelector('h2');
            heading.insertAdjacentElement('afterend', errorContainer);
        }
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
    };

    // Kullanıcı forma yazmaya başlarsa hataları temizle
    registerForm.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            // Flask flash mesajlarını gizle
            const flashMessages = document.querySelector('.mb-4 > .p-4');
            if (flashMessages) flashMessages.style.display = 'none';
            
            // JS hata mesajını gizle
            const errorToast = document.getElementById('register-error-toast');
            if (errorToast) errorToast.style.display = 'none';
        });
    });

    // Form gönderildiğinde (submit)
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Sayfanın yeniden yüklenmesini engelle

        const sirket_adi = document.getElementById('sirket_adi').value;
        const kullanici_adi = document.getElementById('kullanici_adi').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const actionUrl = registerForm.action;

        // Basit şifre kontrolü
        if (password.length < 6) {
            showRegisterError('Şifre en az 6 karakter olmalıdır.');
            return;
        }

        try {
            const response = await fetch(actionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    sirket_adi, 
                    kullanici_adi, 
                    email, 
                    password 
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Kayıt başarılıysa, backend'in söylediği URL'ye yönlendir
                window.location.href = data.redirect_url || '/'; 
            } else {
                // Kayıt başarısızsa, hatayı ekranda göster
                showRegisterError(data.hata || 'Bilinmeyen bir hata oluştu.');
            }
        } catch (error) {
            console.error('Kayıt hatası:', error);
            showRegisterError('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.');
        }
    });
});