// Bu dosya, login.html sayfasının tüm JavaScript mantığını içerir.

async function girisYap() {
    const kullaniciAdi = document.getElementById('kullanici-input').value;
    const sifre = document.getElementById('sifre-input').value;
    const girisButton = document.querySelector('.btn-primary');
    const originalButtonText = girisButton.innerHTML;

    if (!kullaniciAdi || !sifre) {
        gosterMesaj("Lütfen tüm alanları doldurun.", "danger");
        return;
    }

    girisButton.disabled = true;
    girisButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Giriş Yapılıyor...`;

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
            localStorage.setItem('offlineUser', JSON.stringify(result.user));
            window.location.href = '/';
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
        event.preventDefault(); // Formun varsayılan submit davranışını engelle
        girisYap();
    }
});