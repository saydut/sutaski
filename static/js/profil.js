// static/js/profil.js

window.onload = function() {
    profilBilgileriniYukle();
};

/**
 * Sayfa yüklendiğinde sunucudan mevcut profil bilgilerini çeker ve formları doldurur.
 */
async function profilBilgileriniYukle() {
    try {
        const response = await fetch('/api/profil');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Profil bilgileri yüklenemedi.');
        }

        // Gelen iç içe veriye göre form alanlarını doldur
        if (data.kullanici) {
            document.getElementById('kullanici-adi-input').value = data.kullanici.kullanici_adi || '';
            document.getElementById('eposta-input').value = data.kullanici.eposta || '';
            document.getElementById('kullanici-telefon-input').value = data.kullanici.telefon_no || '';
        }

        if (data.sirket) {
            document.getElementById('sirket-adi-input').value = data.sirket.sirket_adi || '';
            document.getElementById('sirket-vkn-input').value = data.sirket.vergi_kimlik_no || '';
            document.getElementById('sirket-adres-input').value = data.sirket.adres || '';
        }

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    }
}

/**
 * "Değişiklikleri Kaydet" butonuna basıldığında çalışır, formdaki verileri sunucuya gönderir.
 */
async function profilGuncelle() {
    const kaydetButton = document.getElementById('kaydet-btn');
    const originalButtonText = kaydetButton.innerHTML;

    // Kullanıcı verilerini bir obje içinde grupla
    const kullanici_data = {
        eposta: document.getElementById('eposta-input').value.trim(),
        telefon_no: document.getElementById('kullanici-telefon-input').value.trim()
    };

    // Şirket verilerini bir obje içinde grupla
    const sirket_data = {
        vergi_kimlik_no: document.getElementById('sirket-vkn-input').value.trim(),
        adres: document.getElementById('sirket-adres-input').value.trim()
    };

    // Şifre verilerini bir obje içinde grupla
    const sifre_data = {
        mevcut_sifre: document.getElementById('mevcut-sifre-input').value,
        yeni_sifre: document.getElementById('yeni-sifre-input').value,
        yeni_sifre_tekrar: document.getElementById('yeni-sifre-tekrar-input').value
    };

    // Şifre alanı kontrolleri
    if (sifre_data.yeni_sifre || sifre_data.yeni_sifre_tekrar) {
        if (!sifre_data.mevcut_sifre) {
            gosterMesaj('Yeni bir şifre belirlemek için mevcut şifrenizi girmelisiniz.', 'warning');
            return;
        }
        if (sifre_data.yeni_sifre !== sifre_data.yeni_sifre_tekrar) {
            gosterMesaj('Yeni şifreler eşleşmiyor.', 'warning');
            return;
        }
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Güncelleniyor...`;

    try {
        const response = await fetch('/api/profil', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            // Tüm veriyi gruplanmış objeler halinde gönder
            body: JSON.stringify({
                kullanici: kullanici_data,
                sirket: sirket_data,
                sifreler: sifre_data
            })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Güncelleme sırasında bir hata oluştu.');
        }

        gosterMesaj(result.message, 'success');
        
        // Sadece şifre alanlarını temizle
        document.getElementById('mevcut-sifre-input').value = '';
        document.getElementById('yeni-sifre-input').value = '';
        document.getElementById('yeni-sifre-tekrar-input').value = '';

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = 'Değişiklikleri Kaydet';
    }
}