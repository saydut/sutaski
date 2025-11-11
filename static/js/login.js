// Bu dosya, login.html sayfasının tüm JavaScript mantığını içerir.
// Yeni Auth (email ile giriş) sistemine güncellendi.

async function girisYap() {
    // 1. 'kullanici-input' ID'si yerine 'email' ID'sinden (login.html'de güncellediğimiz) oku
    const email = document.getElementById('email').value; 
    const sifre = document.getElementById('sifre-input').value;
    const girisButton = document.querySelector('.btn-primary');
    const originalButtonText = girisButton.innerHTML;

    // 2. 'kullaniciAdi' -> 'email' kontrolü
    if (!email || !sifre) {
        gosterMesaj("Lütfen e-posta ve şifre alanlarını doldurun.", "danger");
        return;
    }

    girisButton.disabled = true;
    girisButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Giriş Yapılıyor...`;

    try {
        // Rota '/api/login' (blueprints/auth.py) doğru
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                // 3. 'kullanici_adi' yerine 'email' gönder
                email: email, 
                sifre: sifre
            })
        });

        const result = await response.json();

        if (response.ok) {
            // 4. (KALDIRILDI) localStorage.setItem('offlineUser', ...)
            // Yeni Auth sisteminde buna gerek yok, Flask session (cookie) yeterli.
            window.location.href = '/panel'; // Başarılı girişte ana panele yönlendir
        } else {
            gosterMesaj(result.error || "Bir hata oluştu.", "danger");
            girisButton.disabled = false;
            girisButton.innerHTML = originalButtonText;
        }
    } catch (error) {
        console.error("Giriş yaparken hata oluştu:", error);
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
        girisButton.disabled = false;
        girisButton.innerHTML = originalButtonText;
    }
}

// Enter tuşuna basıldığında da giriş yapmayı sağla
document.getElementById('sifre-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Formun submit olmasını engelle
        girisYap();
    }
});

// 5. 'kullanici-input' -> 'email' olarak güncellendi
document.getElementById('email').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); 
        girisYap();
    }
});

// 'gosterMesaj' fonksiyonu (ui.js dosyasında olduğunu varsayıyoruz)
function gosterMesaj(mesaj, tip = 'info') {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        console.error("'alert-container' ID'li element bulunamadı.");
        return;
    }
    const alert = `
        <div class="alert alert-${tip} alert-dismissible fade show" role="alert">
            ${mesaj}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    alertContainer.innerHTML = alert;
}

// Tema değiştirici (Aynı kalabilir)
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDarkMode = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        });

        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        }
    }
});