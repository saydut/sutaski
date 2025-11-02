// static/js/tarife_yonetimi.js

// Modallar ve tarih seçiciler için global değişkenler
let duzenleModal, silmeOnayModal;
let yeniBaslangicTarihi, yeniBitisTarihi;
let duzenleBaslangicTarihi, duzenleBitisTarihi;
let tumTarifeler = []; // Tarifeleri burada saklayacağız (admin.js'deki gibi)

/**
 * JavaScript Date objesini 'YYYY-MM-DD' formatına çevirir.
 * Bu, flatpickr'dan gelen veriyi API'ye göndermek için gereklidir.
 * @param {Date} date - Formatlanacak tarih objesi.
 * @returns {string} - 'YYYY-MM-DD' formatında tarih metni veya tarih yoksa null.
 */
function formatDateToYYYYMMDD(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Sayfa yüklendiğinde çalışır.
 */
window.onload = function() {
    // Modalları başlat
    duzenleModal = new bootstrap.Modal(document.getElementById('tarifeDuzenleModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('tarifeSilmeOnayModal'));

    // Flatpickr (Tarih Seçici) instance'larını başlat
    const flatpickrConfig = {
        dateFormat: "Y-m-d", // API'ye gönderilecek format
        altInput: true,      // Kullanıcıya gösterilecek format
        altFormat: "d.m.Y",  // Gösterilecek format
        locale: "tr"
    };

    // Yeni Tarife Formu
    yeniBaslangicTarihi = flatpickr("#baslangic-tarihi-input", {
        ...flatpickrConfig,
        onChange: function(selectedDates, dateStr, instance) {
            // Başlangıç tarihi seçildiğinde, bitiş tarihinin minimumunu ayarla
            if (yeniBitisTarihi && selectedDates.length > 0) {
                yeniBitisTarihi.set('minDate', selectedDates[0]);
            }
        }
    });
    yeniBitisTarihi = flatpickr("#bitis-tarihi-input", flatpickrConfig);

    // Düzenleme Modalı Formu
    duzenleBaslangicTarihi = flatpickr("#edit-baslangic-tarihi-input", {
        ...flatpickrConfig,
        onChange: function(selectedDates, dateStr, instance) {
            if (duzenleBitisTarihi && selectedDates.length > 0) {
                duzenleBitisTarihi.set('minDate', selectedDates[0]);
            }
        }
    });
    duzenleBitisTarihi = flatpickr("#edit-bitis-tarihi-input", flatpickrConfig);

    // Form gönderim olayını yakala
    const yeniTarifeForm = document.getElementById('yeni-tarife-formu');
    if (yeniTarifeForm) {
        yeniTarifeForm.addEventListener('submit', tarifeEkle);
    }

    // Mevcut tarifeleri yükle
    tarifeleriYukle();
};

/**
 * Mevcut fiyat tarifelerini sunucudan çeker ve tabloyu doldurur.
 */
async function tarifeleriYukle() {
    const tabloBody = document.getElementById('tarife-tablosu');
    const veriYokMesaji = document.getElementById('tarife-veri-yok');
    if (!tabloBody || !veriYokMesaji) return;

    tabloBody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="spinner-border spinner-border-sm"></div> Yükleniyor...</td></tr>';
    veriYokMesaji.style.display = 'none';

    try {
        // api.js'teki merkezi request fonksiyonunu kullan
        tumTarifeler = await api.request('/tarife/api/listele'); // Global değişkene ata
        
        tabloBody.innerHTML = ''; // Tabloyu temizle
        
        if (!tumTarifeler || tumTarifeler.length === 0) {
            veriYokMesaji.style.display = 'block';
            return;
        }

        tumTarifeler.forEach(tarife => {
            // Tarihleri 'GG.AA.YYYY' formatına çevir
            // Gelen tarih YYYY-MM-DD formatında, timezone sorunu yaşamamak için 'T00:00:00' ekleyerek parse et
            const baslangic = new Date(tarife.baslangic_tarihi + 'T00:00:00').toLocaleDateString('tr-TR', {timeZone: 'UTC'});
            const bitis = tarife.bitis_tarihi ? new Date(tarife.bitis_tarihi + 'T00:00:00').toLocaleDateString('tr-TR', {timeZone: 'UTC'}) : 'Süresiz';
            const fiyat = parseFloat(tarife.fiyat).toFixed(2);
            
            // Satırı oluştur
            const row = `
                <tr id="tarife-satir-${tarife.id}">
                    <td><strong>${baslangic}</strong></td>
                    <td>${bitis}</td>
                    <td class="text-end fw-bold">${fiyat} TL</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="duzenlemeModaliniAc(${tarife.id})" title="Düzenle">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="silmeOnayiAc(${tarife.id})" title="Sil">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tabloBody.innerHTML += row;
        });

    } catch (error) {
        tabloBody.innerHTML = '';
        // gosterMesaj (ui.js'den) fonksiyonunu kullan
        gosterMesaj(error.message || 'Tarifeler yüklenirken bir hata oluştu.', 'danger');
    }
}

/**
 * Yeni tarife ekleme formunu sunucuya gönderir.
 */
async function tarifeEkle(event) {
    event.preventDefault(); // Formun normal submit olmasını engelle
    const kaydetButton = document.getElementById('kaydet-tarife-btn');
    if (!kaydetButton) return;
    const originalButtonText = kaydetButton.innerHTML;
    
    // Flatpickr'dan tarihleri al
    const baslangicTarihi = formatDateToYYYYMMDD(yeniBaslangicTarihi.selectedDates[0]);
    const bitisTarihi = formatDateToYYYYMMDD(yeniBitisTarihi.selectedDates[0]);

    const veri = {
        baslangic_tarihi: baslangicTarihi,
        bitis_tarihi: bitisTarihi, // null olabilir, backend bunu handle ediyor
        fiyat: document.getElementById('fiyat-input').value
    };

    if (!veri.baslangic_tarihi || !veri.fiyat) {
        gosterMesaj("Başlangıç tarihi ve fiyat alanları zorunludur.", "warning");
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    try {
        const result = await api.request('/tarife/api/ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });

        gosterMesaj(result.message, 'success');
        document.getElementById('yeni-tarife-formu').reset(); // Formu temizle
        yeniBaslangicTarihi.clear(); // Tarih seçicileri temizle
        yeniBitisTarihi.clear();
        await tarifeleriYukle(); // Tabloyu yenile

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

/**
 * Silme onay modalını açar.
 */
function silmeOnayiAc(id) {
    const idInput = document.getElementById('silinecek-tarife-id');
    if (idInput) idInput.value = id;
    if (silmeOnayModal) silmeOnayModal.show();
}

/**
 * API'yi çağırarak tarifeyi siler.
 */
async function tarifeSil() {
    const idInput = document.getElementById('silinecek-tarife-id');
    if (!idInput) return;
    const id = idInput.value;
    if (silmeOnayModal) silmeOnayModal.hide();

    // İyimser UI (Satırı hemen sil)
    const silinecekSatir = document.getElementById(`tarife-satir-${id}`);
    const originalHTML = silinecekSatir ? silinecekSatir.outerHTML : null;
    const parent = silinecekSatir ? silinecekSatir.parentNode : null;
    const nextSibling = silinecekSatir ? silinecekSatir.nextSibling : null;

    if (silinecekSatir) {
        silinecekSatir.style.transition = 'opacity 0.4s ease';
        silinecekSatir.style.opacity = '0';
        setTimeout(() => {
            if (silinecekSatir.parentNode) silinecekSatir.remove();
            if (parent && parent.children.length === 0) {
                document.getElementById('tarife-veri-yok').style.display = 'block';
            }
        }, 300);
    }

    try {
        const result = await api.request(`/tarife/api/sil/${id}`, { method: 'DELETE' });
        gosterMesaj(result.message, 'success');
        // Listeyi yenile (iyimsere ek olarak global diziyi de temizler)
        await tarifeleriYukle();
    } catch (error) {
        gosterMesaj(error.message, 'danger');
        // Hata durumunda silinen satırı geri yükle
        if (originalHTML && parent) {
            const temp = document.createElement('tbody');
            temp.innerHTML = originalHTML;
            const restoredRow = temp.firstChild;
            if (restoredRow) {
                restoredRow.style.opacity = '1';
                parent.insertBefore(restoredRow, nextSibling);
                document.getElementById('tarife-veri-yok').style.display = 'none';
            }
        }
    }
}

/**
 * Düzenleme modalını açar ve verileri doldurur.
 */
function duzenlemeModaliniAc(id) {
    // Global diziden veriyi bul
    const tarife = tumTarifeler.find(t => t.id === id);
    
    if (!tarife) {
        gosterMesaj("Düzenlenecek tarife verisi bulunamadı.", "danger");
        return;
    }

    // Modaldaki formları doldur
    document.getElementById('edit-tarife-id').value = tarife.id;
    document.getElementById('edit-fiyat-input').value = parseFloat(tarife.fiyat).toFixed(2);
    
    // Tarih seçicileri ayarla (timezone UTC varsayarak)
    duzenleBaslangicTarihi.setDate(tarife.baslangic_tarihi, true);
    duzenleBitisTarihi.setDate(tarife.bitis_tarihi || null, true); // Bitiş tarihi null olabilir

    if (duzenleModal) duzenleModal.show();
}

/**
 * Düzenleme modalındaki "Kaydet" butonuna basıldığında çalışır.
 */
async function tarifeGuncelle() {
    const guncelleButton = document.getElementById('guncelle-tarife-btn');
    if (!guncelleButton) return;
    
    const id = document.getElementById('edit-tarife-id').value;
    const originalButtonText = guncelleButton.innerHTML;
    
    // Flatpickr'dan tarihleri al
    const baslangicTarihi = formatDateToYYYYMMDD(duzenleBaslangicTarihi.selectedDates[0]);
    const bitisTarihi = formatDateToYYYYMMDD(duzenleBitisTarihi.selectedDates[0]);

    const veri = {
        baslangic_tarihi: baslangicTarihi,
        bitis_tarihi: bitisTarihi, // null olabilir
        fiyat: document.getElementById('edit-fiyat-input').value
    };

    if (!veri.baslangic_tarihi || !veri.fiyat) {
        gosterMesaj("Başlangıç tarihi ve fiyat alanları zorunludur.", "warning");
        return;
    }

    guncelleButton.disabled = true;
    guncelleButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Güncelleniyor...`;

    try {
        const result = await api.request(`/tarife/api/guncelle/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });

        gosterMesaj(result.message, 'success');
        if (duzenleModal) duzenleModal.hide();
        await tarifeleriYukle(); // Tabloyu yenile

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        guncelleButton.disabled = false;
        guncelleButton.innerHTML = originalButtonText;
    }
}