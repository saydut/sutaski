// Bu dosya, register.html sayfasının tüm JavaScript mantığını içerir.

async function kayitOl() {
    const kullaniciAdi = document.getElementById('kullanici-input').value;
    const sifre = document.getElementById('sifre-input').value;
    const sirketAdi = document.getElementById('sirket-input').value;

    if (!kullaniciAdi || !sifre || !sirketAdi) {
        gosterMesaj("Lütfen tüm alanları doldurun.", "danger");
        return;
    }

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
            // 2 saniye sonra giriş sayfasına yönlendir
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            gosterMesaj(result.error || "Bir hata oluştu.", "danger");
        }
    } catch (error) {
        console.error("Kayıt olurken hata oluştu:", error);
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    }
}

// Enter tuşuna basıldığında da kayıt olmayı sağla
document.getElementById('sifre-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        kayitOl();
    }
});
