// static/js/login.js - Modernize Edilmiş Sürüm

async function girisYap() {
    // 1. Elementleri HTML'deki YENİ ID'lere göre seçiyoruz
    const kullaniciInput = document.getElementById('kullanici-input');
    const sifreInput = document.getElementById('sifre-input');
    const girisButton = document.getElementById('giris-btn');
    const errorBox = document.getElementById('error-box');
    const errorMessage = document.getElementById('error-message');

    const kullaniciAdi = kullaniciInput.value;
    const sifre = sifreInput.value;
    
    // Orijinal buton metnini sakla
    const originalButtonText = girisButton.innerHTML;

    // 2. Validasyon
    if (!kullaniciAdi || !sifre) {
        gosterHata("Lütfen tüm alanları doldurun.");
        return;
    }

    // 3. UI Durumunu Güncelle (Yükleniyor...)
    girisButton.disabled = true;
    girisButton.classList.add('opacity-75', 'cursor-not-allowed');
    // Tailwind uyumlu spinner ve metin
    girisButton.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Giriş Yapılıyor...`;
    
    // Varsa önceki hatayı gizle
    errorBox.classList.add('hidden');

    try {
        // 4. API İsteği (Mantık AYNEN korundu)
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kullanici_adi: kullaniciAdi,
                sifre: sifre
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Başarılı Giriş
            // Offline kullanım için user bilgisini sakla (Eski mantık)
            localStorage.setItem('offlineUser', JSON.stringify(result.user));
            
            // Butonu yeşil yap ve başarı mesajı göster
            girisButton.classList.remove('bg-brand-600', 'hover:bg-brand-500');
            girisButton.classList.add('bg-green-600', 'hover:bg-green-500');
            girisButton.innerHTML = `<i class="fa-solid fa-check mr-2"></i> Başarılı! Yönlendiriliyor...`;

            // Yönlendirme
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        } else {
            // Hata Durumu (API'den gelen hata)
            gosterHata(result.error || "Kullanıcı adı veya şifre hatalı.");
            resetButton(girisButton, originalButtonText);
        }
    } catch (error) {
        console.error("Giriş yaparken hata oluştu:", error);
        gosterHata("Sunucuya bağlanırken bir sorun oluştu. İnternetinizi kontrol edin.");
        resetButton(girisButton, originalButtonText);
    }
}

// Yardımcı Fonksiyon: Tailwind Hata Kutusunu Göster
function gosterHata(mesaj) {
    const errorBox = document.getElementById('error-box');
    const errorMessage = document.getElementById('error-message');
    
    errorMessage.textContent = mesaj;
    errorBox.classList.remove('hidden');
    // Hafif bir sallanma efekti ekle (opsiyonel görsel iyileştirme)
    errorBox.classList.add('animate-pulse');
    setTimeout(() => errorBox.classList.remove('animate-pulse'), 500);
}

// Yardımcı Fonksiyon: Butonu Eski Haline Getir
function resetButton(btn, originalText) {
    btn.disabled = false;
    btn.classList.remove('opacity-75', 'cursor-not-allowed');
    btn.innerHTML = originalText;
}

// Enter Tuşu Desteği
document.getElementById('sifre-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        girisYap();
    }
});

// PWA Service Worker Kaydı (Eski sisteminle uyumluluk için gerekli)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => console.log('SW registered'))
            .catch(err => console.log('SW registration failed: ', err));
    });
}