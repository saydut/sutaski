// Bu dosya, login.html sayfasının tüm JavaScript mantığını içerir.

// Giriş formundaki butona tıklandığında veya Enter'a basıldığında tetiklenir
async function girisYap() {
    const kullaniciAdi = document.getElementById('kullanici-input').value;
    const sifre = document.getElementById('sifre-input').value;

    if (!kullaniciAdi || !sifre) {
        gosterMesaj("Lütfen tüm alanları doldurun.", "danger");
        return;
    }

    try {
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
            // Giriş başarılıysa ana sayfaya yönlendir
            window.location.href = '/';
        } else {
            // Başarısızsa hatayı göster
            gosterMesaj(result.error || "Bir hata oluştu.", "danger");
        }
    } catch (error) {
        console.error("Giriş yaparken hata oluştu:", error);
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    }
}

// Enter tuşuna basıldığında da giriş yapmayı sağla
document.getElementById('sifre-input').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Formun varsayılan submit davranışını engelle
        girisYap();
    }
});
