// Bu dosya, register.html sayfasının tüm JavaScript mantığını içerir.

async function kayitOl() {
    const kullaniciAdi = document.getElementById('kullanici-input').value;
    const sifre = document.getElementById('sifre-input').value;
    const sirketAdi = document.getElementById('sirket-input').value;
    const kayitButton = document.querySelector('.btn-primary');
    const originalButtonText = kayitButton.innerHTML;

    if (!kullaniciAdi || !sifre || !sirketAdi) {
        gosterMesaj("Lütfen tüm alanları doldurun.", "danger");
        return;
    }

    kayitButton.disabled = true;
    kayitButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kayıt Olunuyor...`;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kullanici_adi: kullaniciAdi,
                sifre: sifre,
                sirket_adi: sirketAdi
            })
        });

        const result = await response.json();

        if (response.ok) {
            gosterMesaj("Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...", "success");
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            gosterMesaj(result.error || "Bir hata oluştu.", "danger");
            
            // --- YENİ EKLENEN BLOK ---
            // Eğer sunucu bakım modu nedeniyle "redirect_to_landing" bayrağını gönderirse,
            // kullanıcıyı ana sayfaya yönlendir.
            if (result.redirect_to_landing === true) {
                setTimeout(() => {
                    window.location.href = '/'; // Ana landing sayfasına git
                }, 2000); // Mesajı okuması için 2 saniye bekle
            }
            // --- YENİ BLOK SONU ---

            kayitButton.disabled = false;
            kayitButton.innerHTML = originalButtonText;
        }
    } catch (error) {
        console.error("Kayıt olurken hata oluştu:", error);
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
        kayitButton.disabled = false;
        kayitButton.innerHTML = originalButtonText;
    }
}

// Enter tuşuna basıldığında da kayıt olmayı sağla
document.getElementById('sifre-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        kayitOl();
    }
});