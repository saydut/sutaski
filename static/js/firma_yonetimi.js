// static/js/firma_yonetimi.js

let silmeOnayModal;
let kullaniciDuzenleModal; // YENİ: Düzenleme modalı için değişken
let tedarikciSeciciTomSelect; // YENİ: Düzenleme modalındaki TomSelect instance'ı

// Sayfa yüklendiğinde çalışacak ana fonksiyon
window.onload = function() {
    // Gerekli modalları başlat
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));
    kullaniciDuzenleModal = new bootstrap.Modal(document.getElementById('kullaniciDuzenleModal')); // YENİ

    // Yeni kullanıcı ekleme formunun gönderilme olayını dinle
    document.getElementById('yeni-kullanici-form').addEventListener('submit', yeniKullaniciEkle);

    // Düzenleme modalındaki çoklu tedarikçi seçiciyi başlat
    // YENİ: TomSelect'i burada başlatıyoruz
    tedarikciSeciciTomSelect = new TomSelect("#edit-tedarikci-sec", {
        plugins: ['remove_button'], // Seçilenleri kolayca kaldırmak için
        create: false,
        sortField: { field: "text", direction: "asc" }
    });

    // Sayfa verilerini sunucudan yükle
    verileriYukle();
};

/**
 * Sunucudan kullanıcı listesini ve lisans limitini çeker, ardından arayüzü günceller.
 */
async function verileriYukle() {
    const tabloBody = document.getElementById('kullanicilar-tablosu');
    const lisansBilgisiElementi = document.getElementById('lisans-bilgisi');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');

    // Yükleniyor durumunu göster
    tabloBody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="spinner-border spinner-border-sm"></div> Yükleniyor...</td></tr>';
    lisansBilgisiElementi.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    veriYokMesaji.style.display = 'none';

    try {
        const data = await api.request('/firma/api/yonetim_data'); // api.js kullandığımızı varsayıyoruz

        lisansBilgisiniGoster(data.kullanicilar, data.limit);
        kullaniciTablosunuDoldur(data.kullanicilar);

    } catch (error) {
        tabloBody.innerHTML = '';
        gosterMesaj(error.message || 'Veriler yüklenirken bir hata oluştu.', 'danger');
        lisansBilgisiElementi.innerText = 'Hata';
    }
}

/**
 * Kullanıcı listesini tabloya render eder.
 * @param {Array} kullanicilar - Sunucudan gelen kullanıcı objeleri dizisi.
 */
function kullaniciTablosunuDoldur(kullanicilar) {
    const tabloBody = document.getElementById('kullanicilar-tablosu');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    tabloBody.innerHTML = '';

    if (!kullanicilar || kullanicilar.length === 0) {
        veriYokMesaji.style.display = 'block';
        return;
    }

    veriYokMesaji.style.display = 'none';

    kullanicilar.forEach(kullanici => {
        const olusturulmaTarihi = new Date(kullanici.created_at).toLocaleDateString('tr-TR');
        const rolText = kullanici.rol.charAt(0).toUpperCase() + kullanici.rol.slice(1);

        // YENİ: Düzenle butonu eklendi, onclick ile duzenlemeModaliniAc fonksiyonunu çağırıyor
        const row = `
            <tr id="kullanici-satir-${kullanici.id}">
                <td><strong>${utils.sanitizeHTML(kullanici.kullanici_adi)}</strong></td>
                <td><span class="badge bg-secondary">${rolText}</span></td>
                <td>${olusturulmaTarihi}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="duzenlemeModaliniAc(${kullanici.id})">
                        <i class="bi bi-pencil"></i> Düzenle
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="silmeOnayiAc(${kullanici.id}, '${utils.sanitizeHTML(kullanici.kullanici_adi)}')">
                        <i class="bi bi-trash"></i> Sil
                    </button>
                </td>
            </tr>
        `;
        tabloBody.innerHTML += row;
    });
}

/**
 * Lisans kullanım durumunu arayüzde gösterir.
 * @param {Array} kullanicilar - Mevcut kullanıcıların listesi.
 * @param {number} limit - Maksimum toplayıcı limiti.
 */
function lisansBilgisiniGoster(kullanicilar, limit) {
    const lisansBilgisiElementi = document.getElementById('lisans-bilgisi');
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
 * @param {Event} event - Form submit olayı.
 */
async function yeniKullaniciEkle(event) {
    event.preventDefault(); // Formun sayfayı yenilemesini engelle

    const kaydetButton = document.getElementById('kaydet-btn');
    const originalButtonText = kaydetButton.innerHTML;
    const veri = {
        kullanici_adi: document.getElementById('kullanici-adi-input').value.trim(),
        sifre: document.getElementById('sifre-input').value,
        // YENİ: Telefon ve adres bilgilerini de gönderiyoruz
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
        document.getElementById('yeni-kullanici-form').reset(); // Formu temizle
        await verileriYukle(); // Listeyi ve lisans sayacını güncelle

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = '<i class="bi bi-plus-circle me-2"></i>Toplayıcıyı Ekle'; // Buton metnini eski haline getir
    }
}

/**
 * Silme onay modal'ını açar.
 * @param {number} id - Silinecek kullanıcının ID'si.
 * @param {string} kullaniciAdi - Silinecek kullanıcının adı.
 */
function silmeOnayiAc(id, kullaniciAdi) {
    document.getElementById('silinecek-kullanici-id').value = id;
    document.getElementById('silinecek-kullanici-adi').innerText = kullaniciAdi;
    silmeOnayModal.show();
}

/**
 * API'yi çağırarak kullanıcıyı siler.
 */
async function kullaniciSil() {
    const id = document.getElementById('silinecek-kullanici-id').value;
    silmeOnayModal.hide();

    // İyimser Arayüz Güncellemesi
    const silinecekSatir = document.getElementById(`kullanici-satir-${id}`);
    const originalHTML = silinecekSatir ? silinecekSatir.outerHTML : null; // Geri yükleme için sakla
    const parent = silinecekSatir ? silinecekSatir.parentNode : null;
    const nextSibling = silinecekSatir ? silinecekSatir.nextSibling : null;

    if (silinecekSatir) {
        silinecekSatir.style.transition = 'opacity 0.4s ease';
        silinecekSatir.style.opacity = '0';
        setTimeout(() => silinecekSatir.remove(), 400);
    }

    try {
        const result = await api.request(`/firma/api/kullanici_sil/${id}`, { method: 'DELETE' });
        gosterMesaj(result.message, 'success');
        // Silme başarılı olduğu için sadece lisans sayacını güncelle
        const data = await api.request('/firma/api/yonetim_data');
        lisansBilgisiniGoster(data.kullanicilar, data.limit);

        // Eğer silindikten sonra hiç kullanıcı kalmadıysa "veri yok" mesajını göster
        if (parent && parent.children.length === 0) {
            document.getElementById('veri-yok-mesaji').style.display = 'block';
        }

    } catch (error) {
        gosterMesaj(error.message, 'danger');
        // Hata durumunda satırı geri ekle (eğer önceden varsa)
        if (originalHTML && parent) {
            const temp = document.createElement('tbody'); // Geçici bir element
            temp.innerHTML = originalHTML;
            const restoredRow = temp.firstChild;
            restoredRow.style.opacity = '1'; // Görünür yap
            parent.insertBefore(restoredRow, nextSibling); // Eski yerine ekle
        }
        await verileriYukle(); // Listeyi tam olarak senkronize etmek için yeniden yükle
    }
}

// --- YENİ FONKSİYONLAR ---

/**
 * Kullanıcı düzenleme modalını açar ve ilgili verileri yükler.
 * @param {number} kullaniciId - Düzenlenecek kullanıcının ID'si.
 */
async function duzenlemeModaliniAc(kullaniciId) {
    const modalElement = document.getElementById('kullaniciDuzenleModal');
    const tedarikciAtamaAlani = document.getElementById('tedarikci-atama-alani');
    const form = document.getElementById('kullanici-duzenle-form');
    form.reset(); // Önceki verileri temizle
    tedarikciSeciciTomSelect.clear(); // TomSelect'i temizle
    tedarikciSeciciTomSelect.clearOptions();

    // Geçici yükleniyor durumu
    modalElement.querySelector('.modal-title').innerText = 'Yükleniyor...';
    tedarikciAtamaAlani.style.display = 'none';

    try {
        const data = await api.request(`/firma/api/kullanici_detay/${kullaniciId}`);
        const kullanici = data.kullanici_detay.kullanici;
        const atananTedarikciler = data.kullanici_detay.atanan_tedarikciler;
        const tumTedarikciler = data.tum_tedarikciler;

        // Modal başlığını ve ID'yi ayarla
        modalElement.querySelector('.modal-title').innerText = `Kullanıcı Düzenle: ${utils.sanitizeHTML(kullanici.kullanici_adi)}`;
        document.getElementById('edit-kullanici-id').value = kullanici.id;

        // Form alanlarını doldur
        document.getElementById('edit-kullanici-adi-input').value = kullanici.kullanici_adi;
        document.getElementById('edit-telefon-input').value = kullanici.telefon_no || '';
        document.getElementById('edit-adres-input').value = kullanici.adres || '';
        document.getElementById('edit-sifre-input').value = ''; // Şifre alanını her zaman boş başlat

        // Eğer kullanıcı toplayıcı ise tedarikçi seçme alanını göster ve doldur
        if (kullanici.rol === 'toplayici') {
            tedarikciAtamaAlani.style.display = 'block';

            // TomSelect'i tüm tedarikçilerle doldur
            const options = tumTedarikciler.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.isim) }));
            tedarikciSeciciTomSelect.addOptions(options);

            // Önceden atanmış tedarikçileri seçili hale getir
            tedarikciSeciciTomSelect.setValue(atananTedarikciler);
        } else {
            tedarikciAtamaAlani.style.display = 'none'; // Muhasebeci ise gizle
        }

        kullaniciDuzenleModal.show(); // Modalı göster

    } catch (error) {
        gosterMesaj(error.message || 'Kullanıcı detayları yüklenemedi.', 'danger');
    }
}

/**
 * Kullanıcı bilgilerini ve atamalarını günceller.
 */
async function kullaniciGuncelle() {
    const id = document.getElementById('edit-kullanici-id').value;
    const guncelleButton = document.getElementById('guncelle-btn');
    const originalButtonText = guncelleButton.innerHTML;

    const veri = {
        kullanici_adi: document.getElementById('edit-kullanici-adi-input').value.trim(),
        sifre: document.getElementById('edit-sifre-input').value, // Boşsa backend bunu dikkate almayacak
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
        kullaniciDuzenleModal.hide();
        await verileriYukle(); // Listeyi güncelle

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        guncelleButton.disabled = false;
        guncelleButton.innerHTML = 'Değişiklikleri Kaydet';
    }
}

// --- YENİ FONKSİYON: Çiftçi Şifresini Sıfırla ---
async function sifreSifirlaCiftci(kullaniciId, kullaniciAdi) {
    if (!confirm(`${kullaniciAdi} adlı çiftçinin şifresini sıfırlamak istediğinizden emin misiniz? Yeni 4 haneli bir şifre oluşturulacaktır.`)) {
        return;
    }

    // Butonu geçici olarak devre dışı bırak (opsiyonel ama iyi olur)
    const button = event.target.closest('button'); // Tıklanan butonu bul
    let originalButtonHtml = '';
    if(button) {
        originalButtonHtml = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;
    }

    try {
        // Backend API'sini çağır (POST metodu ile)
        const result = await api.request(`/firma/api/ciftci_sifre_sifirla/${kullaniciId}`, {
            method: 'POST'
        });

        // Başarılı olursa yeni şifreyi göster
        const mesaj = `${result.message}<br><strong class="fs-5">${kullaniciAdi}</strong> için yeni şifre: <strong class="fs-4 text-danger">${result.yeni_sifre}</strong><br><small>Bu şifreyi çiftçiye iletin.</small>`;
        gosterMesaj(mesaj, 'success', 15000); // 15 saniye göster

    } catch (error) {
        // Hata olursa mesaj göster
        gosterMesaj(error.message || 'Şifre sıfırlanırken bir hata oluştu.', 'danger');
    } finally {
        // Butonu tekrar aktif et
        if(button) {
            button.disabled = false;
            button.innerHTML = originalButtonHtml;
        }
    }
}
// --- YENİ FONKSİYON SONU ---