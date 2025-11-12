// static/js/firma_yonetimi.js

let silmeOnayModal;
let kullaniciDuzenleModal;
let tedarikciSeciciTomSelect;
let kullaniciSifreAyarlaModal; // GÜNCELLENDİ: İsim değişti

// Sayfa yüklendiğinde çalışacak ana fonksiyon
window.onload = function() {
    // Gerekli modalları başlat
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));
    kullaniciDuzenleModal = new bootstrap.Modal(document.getElementById('kullaniciDuzenleModal'));
    
    // GÜNCELLENDİ: Yeni modal ID'sini başlat
    const kullaniciModalElement = document.getElementById('kullaniciSifreAyarlaModal');
    if (kullaniciModalElement) {
        kullaniciSifreAyarlaModal = new bootstrap.Modal(kullaniciModalElement);
    } else {
        console.warn("Kullanıcı şifre ayarlama modal elementi (kullaniciSifreAyarlaModal) bulunamadı.");
    }


    // Yeni kullanıcı ekleme formunun gönderilme olayını dinle
    const yeniKullaniciForm = document.getElementById('yeni-kullanici-form');
    if(yeniKullaniciForm) yeniKullaniciForm.addEventListener('submit', yeniKullaniciEkle);

    // Düzenleme modalındaki çoklu tedarikçi seçiciyi başlat
    const editTedarikciSelect = document.getElementById('edit-tedarikci-sec');
    if(editTedarikciSelect) {
        tedarikciSeciciTomSelect = new TomSelect(editTedarikciSelect, {
            plugins: ['remove_button'], // Seçilenleri kolayca kaldırmak için
            create: false,
            sortField: { field: "text", direction: "asc" }
        });
    }

    // Sayfa verilerini sunucudan yükle
    verileriYukle();
};

/**
 * Sunucudan kullanıcı listesini ve lisans limitini çeker, ardından arayüzü günceller.
 */
async function verileriYukle() {
    // Bu fonksiyon aynı kalıyor
    const tabloBody = document.getElementById('kullanicilar-tablosu');
    const lisansBilgisiElementi = document.getElementById('lisans-bilgisi');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    if (!tabloBody || !lisansBilgisiElementi || !veriYokMesaji) {
        console.error("verileriYukle: Gerekli DOM elementleri bulunamadı.");
        return;
    }


    tabloBody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="spinner-border spinner-border-sm"></div> Yükleniyor...</td></tr>';
    lisansBilgisiElementi.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    veriYokMesaji.style.display = 'none';

    try {
        const data = await api.request('/firma/api/yonetim_data'); // api.js kullandığımızı varsayıyoruz
        if (data && data.kullanicilar && data.limit !== undefined) {
             lisansBilgisiniGoster(data.kullanicilar, data.limit);
             kullaniciTablosunuDoldur(data.kullanicilar);
        } else {
            throw new Error("API'den eksik veri geldi.");
        }

    } catch (error) {
        tabloBody.innerHTML = ''; // Hata durumunda yükleniyor... yazısını kaldır
        gosterMesaj(error.message || 'Veriler yüklenirken bir hata oluştu.', 'danger');
        lisansBilgisiElementi.innerText = 'Hata';
    }
}

/**
 * Lisans kullanım durumunu arayüzde gösterir.
 */
function lisansBilgisiniGoster(kullanicilar, limit) {
    // Bu fonksiyon aynı kalıyor
    const lisansBilgisiElementi = document.getElementById('lisans-bilgisi');
    if (!lisansBilgisiElementi) return; // Element yoksa çık
    const toplayiciSayisi = kullanicilar.filter(k => k.rol === 'toplayici').length;

    let renkSinifi = 'text-success';
    if (toplayiciSayisi >= limit) {
        renkSinifi = 'text-danger fw-bold';
    } else if (toplayiciSayisi >= limit * 0.8) {
        renkSinifi = 'text-warning';
    }

    lisansBilgisiElementi.innerHTML = `
        <span class="text-secondary small d-block">Toplayıcı Lisansı</span>
        <span class="${renkSinifi}">${toplayiciSayisi} / ${limit}</span>
    `;
}


/**
 * Yeni kullanıcı ekleme formunu yönetir.
 */
async function yeniKullaniciEkle(event) {
    // Bu fonksiyon aynı kalıyor
    event.preventDefault();
    const kaydetButton = document.getElementById('kaydet-btn');
    if (!kaydetButton) return; // Buton yoksa çık
    const originalButtonText = kaydetButton.innerHTML;
    const veri = {
        kullanici_adi: document.getElementById('kullanici-adi-input').value.trim(),
        sifre: document.getElementById('sifre-input').value,
        telefon_no: document.getElementById('telefon-input').value.trim(),
        adres: document.getElementById('adres-input').value.trim()
    };

    if (!veri.kullanici_adi || !veri.sifre) {
        gosterMesaj('Kullanıcı adı ve şifre alanları zorunludur.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Ekleniyor...`;

    try {
        const result = await api.request('/firma/api/toplayici_ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });

        gosterMesaj(result.message, 'success');
        document.getElementById('yeni-kullanici-form').reset();
        await verileriYukle();

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = '<i class="bi bi-plus-circle me-2"></i>Toplayıcıyı Ekle';
    }
}

/**
 * Kullanıcı listesini tabloya render eder. (GÜNCELLENDİ)
 * @param {Array} kullanicilar - Sunucudan gelen kullanıcı objeleri dizisi.
 */
function kullaniciTablosunuDoldur(kullanicilar) {
    const tabloBody = document.getElementById('kullanicilar-tablosu');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    if (!tabloBody || !veriYokMesaji) return; // Elementler yoksa çık

    tabloBody.innerHTML = ''; // Temizle

    if (!kullanicilar || kullanicilar.length === 0) {
        veriYokMesaji.style.display = 'block';
        return;
    }

    veriYokMesaji.style.display = 'none';

    kullanicilar.forEach(kullanici => {
        let olusturulmaTarihi = "Bilinmiyor";
        try {
            olusturulmaTarihi = new Date(kullanici.created_at).toLocaleDateString('tr-TR');
        } catch(e) { /* Hata olursa varsayılan kalır */ }

        // Rol metnini daha kullanıcı dostu yapalım
        let rolText = (kullanici.rol || '').replace('_', ' '); 
        rolText = rolText.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '); 
        if (rolText === 'Ciftci') rolText = 'Çiftçi'; 
        else if (rolText === 'Firma Yetkilisi') rolText = 'Yetkili';

        // Role göre rozet rengi
        let rolBadgeClass = 'bg-secondary'; 
        if (kullanici.rol === 'firma_yetkilisi') rolBadgeClass = 'bg-primary';
        else if (kullanici.rol === 'toplayici') rolBadgeClass = 'bg-info text-dark';
        else if (kullanici.rol === 'muhasebeci') rolBadgeClass = 'bg-warning text-dark';
        else if (kullanici.rol === 'ciftci') rolBadgeClass = 'bg-success';


        // --- GÜNCELLENDİ: Şifre ve Düzenle/Sil Butonları Mantığı ---
        let sifreButonu = '';
        let duzenleButonu = '';
        let silButonu = '';
        // GüvenliKullaniciAdi, HTML'deki onclick içine eklendiğinde ' (tek tırnak) hatası vermesin diye.
        const guvenliKullaniciAdi = (kullanici.kullanici_adi || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        // Kural: 'firma_yetkilisi' veya 'admin' rolü SİLİNEMEZ ve şifresi buradan AYARLANAMAZ.
        if (kullanici.rol !== 'firma_yetkilisi' && kullanici.rol !== 'admin') {
        
            // Şifre Ayarla Butonu (Anahtar) - Artık toplayıcı, muhasebeci ve çiftçi için gösterilecek
            sifreButonu = `
                <button class="btn btn-sm btn-outline-warning ms-1"
                        onclick="kullaniciSifreModaliniAc(${kullanici.id}, '${guvenliKullaniciAdi}')"
                        title="Kullanıcı Şifresini Ayarla">
                    <i class="bi bi-key-fill"></i>
                </button>`;
                
            // Sil Butonu
            silButonu = `
                <button class="btn btn-sm btn-outline-danger ms-1" onclick="silmeOnayiAc(${kullanici.id}, '${guvenliKullaniciAdi}')">
                    <i class="bi bi-trash"></i>
                </button>`;

            // Düzenle Butonu (Sadece toplayıcı ve muhasebeci için)
            if (kullanici.rol === 'toplayici' || kullanici.rol === 'muhasebeci') {
                 duzenleButonu = `
                    <button class="btn btn-sm btn-outline-primary" onclick="duzenlemeModaliniAc(${kullanici.id})">
                        <i class="bi bi-pencil"></i> Düzenle
                    </button>
                    `;
            }
        }
        // --- /GÜNCELLENDİ ---

        const row = `
            <tr id="kullanici-satir-${kullanici.id}">
                <td><strong>${utils.sanitizeHTML(kullanici.kullanici_adi)}</strong></td>
                <td><span class="badge ${rolBadgeClass}">${rolText}</span></td>
                <td>${olusturulmaTarihi}</td>
                <td class="text-center">
                    ${duzenleButonu}  ${sifreButonu}    ${silButonu}      </td>
            </tr>
        `; // DİKKAT: Hatalı {# ... #} yorumu buradan kaldırıldı.
        tabloBody.innerHTML += row;
    });
}


/**
 * Silme onay modal'ını açar.
 */
function silmeOnayiAc(id, kullaniciAdi) {
    // Bu fonksiyon aynı kalıyor
    const idInput = document.getElementById('silinecek-kullanici-id');
    const nameSpan = document.getElementById('silinecek-kullanici-adi');
    if(idInput) idInput.value = id;
    if(nameSpan) nameSpan.innerText = kullaniciAdi;
    if(silmeOnayModal) silmeOnayModal.show();
}

/**
 * API'yi çağırarak kullanıcıyı siler.
 */
async function kullaniciSil() {
    // Bu fonksiyon aynı kalıyor
    const idInput = document.getElementById('silinecek-kullanici-id');
    if (!idInput) return; // Input yoksa çık
    const id = idInput.value;
    if(silmeOnayModal) silmeOnayModal.hide();

    const silinecekSatir = document.getElementById(`kullanici-satir-${id}`);
    const originalHTML = silinecekSatir ? silinecekSatir.outerHTML : null;
    const parent = silinecekSatir ? silinecekSatir.parentNode : null;
    const nextSibling = silinecekSatir ? silinecekSatir.nextSibling : null;

    if (silinecekSatir) {
        silinecekSatir.style.transition = 'opacity 0.4s ease';
        silinecekSatir.style.opacity = '0';
        setTimeout(() => {
            if (silinecekSatir.parentNode) silinecekSatir.remove(); // Hâlâ varsa sil
             // Liste boşaldıysa "veri yok" mesajını kontrol et
             if (parent && parent.children.length === 0) {
                 const veriYokMesaji = document.getElementById('veri-yok-mesaji');
                 if(veriYokMesaji) veriYokMesaji.style.display = 'block';
             }
        }, 400);
    }

    try {
        const result = await api.request(`/firma/api/kullanici_sil/${id}`, { method: 'DELETE' });
        gosterMesaj(result.message, 'success');
        const data = await api.request('/firma/api/yonetim_data');
        lisansBilgisiniGoster(data.kullanicilar, data.limit);
        // Liste boşaldıysa "veri yok" mesajını burada da kontrol et (zaten yukarıda var ama garanti olsun)
        if (parent && parent.children.length === 0) {
             const veriYokMesaji = document.getElementById('veri-yok-mesaji');
             if(veriYokMesaji) veriYokMesaji.style.display = 'block';
        }
    } catch (error) {
        gosterMesaj(error.message, 'danger');
        if (originalHTML && parent) {
            const temp = document.createElement('tbody');
            temp.innerHTML = originalHTML;
            const restoredRow = temp.firstChild;
            if (restoredRow) { // Elementin varlığını kontrol et
                 restoredRow.style.opacity = '1';
                 parent.insertBefore(restoredRow, nextSibling);
                 // Veri yok mesajını gizle
                 const veriYokMesaji = document.getElementById('veri-yok-mesaji');
                 if(veriYokMesaji) veriYokMesaji.style.display = 'none';
            }
        }
        await verileriYukle(); // Hata durumunda listeyi tam senkronize et
    }
}

/**
 * Kullanıcı düzenleme modalını açar ve ilgili verileri yükler.
 */
async function duzenlemeModaliniAc(kullaniciId) {
    // Bu fonksiyon aynı kalıyor
    const modalElement = document.getElementById('kullaniciDuzenleModal');
    const tedarikciAtamaAlani = document.getElementById('tedarikci-atama-alani');
    const form = document.getElementById('kullanici-duzenle-form');
    if (!modalElement || !tedarikciAtamaAlani || !form || !tedarikciSeciciTomSelect) return; // Elementler yoksa çık

    form.reset();
    tedarikciSeciciTomSelect.clear();
    tedarikciSeciciTomSelect.clearOptions();
    modalElement.querySelector('.modal-title').innerText = 'Yükleniyor...';
    tedarikciAtamaAlani.style.display = 'none';

    try {
        const data = await api.request(`/firma/api/kullanici_detay/${kullaniciId}`);
        if (!data || !data.kullanici_detay || !data.kullanici_detay.kullanici || !data.tum_tedarikciler) {
            throw new Error("API'den eksik kullanıcı detayı geldi.");
        }
        const kullanici = data.kullanici_detay.kullanici;
        const atananTedarikciler = data.kullanici_detay.atanan_tedarikciler || [];
        const tumTedarikciler = data.tum_tedarikciler;

        modalElement.querySelector('.modal-title').innerText = `Kullanıcı Düzenle: ${utils.sanitizeHTML(kullanici.kullanici_adi)}`;
        document.getElementById('edit-kullanici-id').value = kullanici.id;
        document.getElementById('edit-kullanici-adi-input').value = kullanici.kullanici_adi;
        document.getElementById('edit-telefon-input').value = kullanici.telefon_no || '';
        document.getElementById('edit-adres-input').value = kullanici.adres || '';
        document.getElementById('edit-sifre-input').value = '';

        if (kullanici.rol === 'toplayici') {
            tedarikciAtamaAlani.style.display = 'block';
            const options = tumTedarikciler.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.isim) }));
            tedarikciSeciciTomSelect.addOptions(options);
            tedarikciSeciciTomSelect.setValue(atananTedarikciler);
        } else {
            tedarikciAtamaAlani.style.display = 'none';
        }

        if(kullaniciDuzenleModal) kullaniciDuzenleModal.show();

    } catch (error) {
        gosterMesaj(error.message || 'Kullanıcı detayları yüklenemedi.', 'danger');
    }
}

/**
 * Kullanıcı bilgilerini ve atamalarını günceller.
 */
async function kullaniciGuncelle() {
    // Bu fonksiyon aynı kalıyor
    const idInput = document.getElementById('edit-kullanici-id');
    const guncelleButton = document.getElementById('guncelle-btn');
    if (!idInput || !guncelleButton || !tedarikciSeciciTomSelect) return; // Elementler yoksa çık
    const id = idInput.value;
    const originalButtonText = guncelleButton.innerHTML;

    const veri = {
        kullanici_adi: document.getElementById('edit-kullanici-adi-input').value.trim(),
        sifre: document.getElementById('edit-sifre-input').value,
        telefon_no: document.getElementById('edit-telefon-input').value.trim(),
        adres: document.getElementById('edit-adres-input').value.trim(),
        atanan_tedarikciler: tedarikciSeciciTomSelect.getValue() // TomSelect'ten seçili ID'leri al
    };

     if (!veri.kullanici_adi) {
        gosterMesaj('Kullanıcı adı boş bırakılamaz.', 'warning');
        return;
    }

    guncelleButton.disabled = true;
    guncelleButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Güncelleniyor...`;

    try {
        const result = await api.request(`/firma/api/kullanici_guncelle/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });

        gosterMesaj(result.message, 'success');
        if(kullaniciDuzenleModal) kullaniciDuzenleModal.hide();
        await verileriYukle();

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        guncelleButton.disabled = false;
        guncelleButton.innerHTML = 'Değişiklikleri Kaydet';
    }
}

// --- GÜNCELLENDİ: Çiftçi fonksiyonları genel "Kullanıcı" fonksiyonlarına dönüştü ---

/**
 * Kullanıcı şifre ayarlama modalını açar ve kullanıcı bilgilerini doldurur.
 */
function kullaniciSifreModaliniAc(kullaniciId, kullaniciAdi) { // AD DEĞİŞTİ
    const idInput = document.getElementById('kullanici-sifre-ayarla-id'); // ID DEĞİŞTİ
    const nameSpan = document.getElementById('kullanici-sifre-ayarla-kullanici'); // ID DEĞİŞTİ
    const passInput = document.getElementById('kullanici-yeni-sifre-input'); // ID DEĞİŞTİ
    const passRepeatInput = document.getElementById('kullanici-yeni-sifre-tekrar-input'); // ID DEĞİŞTİ

    if (idInput) idInput.value = kullaniciId;
    if (nameSpan) nameSpan.innerText = kullaniciAdi;
    if (passInput) passInput.value = ''; // Alanları temizle
    if (passRepeatInput) passRepeatInput.value = '';

    if (kullaniciSifreAyarlaModal) { // AD DEĞİŞTİ
        kullaniciSifreAyarlaModal.show(); // AD DEĞİŞTİ
    } else {
        console.error("Kullanıcı şifre ayarlama modalı başlatılamamış!");
    }
}

/**
 * Kullanıcı şifre ayarlama modalındaki yeni şifreyi alır ve API'ye gönderir.
 */
async function kullaniciSifreKaydet() { // AD DEĞİŞTİ
    const idInput = document.getElementById('kullanici-sifre-ayarla-id'); // ID DEĞİŞTİ
    const yeniSifreInput = document.getElementById('kullanici-yeni-sifre-input'); // ID DEĞİŞTİ
    const yeniSifreTekrarInput = document.getElementById('kullanici-yeni-sifre-tekrar-input'); // ID DEĞİŞTİ
    const kaydetButton = document.querySelector('#kullaniciSifreAyarlaModal .btn-primary'); // ID DEĞİŞTİ
    
    if (!idInput || !yeniSifreInput || !yeniSifreTekrarInput || !kaydetButton) {
        console.error("kullaniciSifreKaydet: Gerekli DOM elementleri bulunamadı.");
        return;
    }

    const id = idInput.value;
    const yeniSifre = yeniSifreInput.value;
    const yeniSifreTekrar = yeniSifreTekrarInput.value;
    const originalButtonText = kaydetButton.innerHTML;

    if (!yeniSifre || !yeniSifreTekrar) {
        gosterMesaj('Lütfen yeni şifreyi ve tekrarını girin.', 'warning');
        return;
    }
    if (yeniSifre !== yeniSifreTekrar) {
        gosterMesaj('Girilen yeni şifreler eşleşmiyor.', 'warning');
        return;
    }
    // İsteğe bağlı: Minimum şifre uzunluğu kontrolü
    // if (yeniSifre.length < 4) {
    //     gosterMesaj('Yeni şifre en az 4 karakter olmalıdır.', 'warning');
    //     return;
    // }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    try {
        // GÜNCELLENDİ: Yeni API endpoint'ini ve metodu kullan
        const result = await api.request(`/firma/api/kullanici_sifre_setle/${id}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yeni_sifre: yeniSifre }) // Sadece yeni şifreyi gönder
        });

        gosterMesaj(result.message, 'success'); // Başarı mesajını göster
        if (kullaniciSifreAyarlaModal) kullaniciSifreAyarlaModal.hide(); // Modalı kapat

    } catch (error) {
        // Hata mesajını göster
        gosterMesaj(error.message || 'Şifre ayarlanırken bir hata oluştu.', 'danger');
    } finally {
        // Butonu tekrar aktif et
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = 'Şifreyi Kaydet';
    }
}