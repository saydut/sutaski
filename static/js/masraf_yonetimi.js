// static/js/masraf_yonetimi.js (API Fonksiyonları Düzeltildi + Mobil Tablo Düzeltildi)

// --- Global Değişkenler ---
let kategoriModal, kategoriSilModal, masrafModal, masrafSilModal;
let masrafTarihSecici, editMasrafTarihSecici; // Flatpickr instance'ları
let kategoriSelect, editKategoriSelect; // TomSelect instance'ları
let tumKategoriler = []; // Kategorileri önbellekte tut (select'leri doldurmak için)
let mevcutMasrafSayfasi = 1;
const MASRAF_SAYFA_BASI = 15; // masraf_service.py'deki varsayılan ile aynı

/**
 * Sayfa yüklendiğinde çalışır.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Modalları başlat
    kategoriModal = new bootstrap.Modal(document.getElementById('kategoriDuzenleModal'));
    kategoriSilModal = new bootstrap.Modal(document.getElementById('kategoriSilmeOnayModal'));
    masrafModal = new bootstrap.Modal(document.getElementById('masrafDuzenleModal'));
    masrafSilModal = new bootstrap.Modal(document.getElementById('masrafSilmeOnayModal'));

    // Tarih Seçicileri (Flatpickr) Başlat
    const flatpickrConfig = {
        dateFormat: "Y-m-d", // API formatı
        altInput: true,      // Kullanıcıya gösterilecek format
        altFormat: "d.m.Y",  // Gösterilecek format
        locale: "tr"
    };
    masrafTarihSecici = flatpickr("#masraf-tarihi-input", { ...flatpickrConfig, defaultDate: "today" });
    editMasrafTarihSecici = flatpickr("#edit-masraf-tarihi-input", flatpickrConfig);

    // Kategori Seçicileri (TomSelect) Başlat
    const tomSelectConfig = { create: false, sortField: { field: "text", direction: "asc" } };
    kategoriSelect = new TomSelect("#masraf-kategori-sec", tomSelectConfig);
    editKategoriSelect = new TomSelect("#edit-masraf-kategori-sec", tomSelectConfig);

    // Olay Dinleyicileri (Event Listeners)
    document.getElementById('yeni-masraf-formu')?.addEventListener('submit', masrafEkle);
    document.getElementById('yeni-kategori-formu')?.addEventListener('submit', kategoriEkle);
    document.getElementById('guncelle-kategori-btn')?.addEventListener('click', kategoriGuncelle);
    document.getElementById('onayla-kategori-sil-btn')?.addEventListener('click', kategoriSilOnayla);
    document.getElementById('guncelle-masraf-btn')?.addEventListener('click', masrafGuncelle);
    document.getElementById('onayla-masraf-sil-btn')?.addEventListener('click', masrafSil);

    // Başlangıç verilerini yükle
    await kategorileriYukle(); // Önce kategoriler (select'leri doldurmak için)
    await masraflariYukle(1); // Sonra masraflar
});

// --- Kategori İşlemleri ---

/**
 * API'den tüm masraf kategorilerini çeker, listeyi ve select menülerini doldurur.
 */
async function kategorileriYukle() {
    const listeContainer = document.getElementById('kategori-listesi');
    const veriYokMesaji = document.getElementById('kategori-veri-yok');
    if (!listeContainer || !veriYokMesaji) return;

    listeContainer.innerHTML = '<li class="list-group-item text-center p-3"><div class="spinner-border spinner-border-sm"></div></li>';
    veriYokMesaji.style.display = 'none';

    try {
        // api.js'deki özel fonksiyonu kullan
        tumKategoriler = await api.fetchMasrafKategorileri();
        
        listeContainer.innerHTML = '';
        kategoriSelect.clearOptions();
        editKategoriSelect.clearOptions();

        if (!tumKategoriler || tumKategoriler.length === 0) {
            veriYokMesaji.style.display = 'block';
            return;
        }

        const kategoriOptions = [];
        tumKategoriler.forEach(kat => {
            const kategoriAdiHtml = utils.sanitizeHTML(kat.kategori_adi);
            kategoriOptions.push({ value: kat.id, text: kategoriAdiHtml });
            
            // Kategori listesini oluştur (sol taraf)
            // Mobil görünüm için responsive flex sınıfları
            listeContainer.innerHTML += `
                <li class="list-group-item d-sm-flex justify-content-sm-between align-items-sm-center" id="kategori-satir-${kat.id}">
                    <span class="d-block mb-2 mb-sm-0" style="word-break: break-word;">${kategoriAdiHtml}</span>
                    <div class="flex-shrink-0 ms-sm-2">
                        <button class="btn btn-sm btn-outline-primary py-0 px-1 me-1" onclick="kategoriDuzenleAc(${kat.id})" title="Düzenle">
                            <i class="bi bi-pencil" style="font-size: 0.8rem;"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="kategoriSilOnayiAc(${kat.id}, '${kategoriAdiHtml.replace(/'/g, "\\'")}')" title="Sil">
                            <i class="bi bi-trash" style="font-size: 0.8rem;"></i>
                        </button>
                    </div>
                </li>
            `;
        });
        
        kategoriSelect.addOptions(kategoriOptions);
        editKategoriSelect.addOptions(kategoriOptions);

    } catch (error) {
        listeContainer.innerHTML = '';
        gosterMesaj(error.message || 'Kategoriler yüklenemedi.', 'danger');
    }
}

/**
 * Yeni kategori ekleme formunu yönetir.
 */
async function kategoriEkle(event) {
    event.preventDefault();
    const input = document.getElementById('yeni-kategori-input');
    const button = document.getElementById('kaydet-kategori-btn');
    const kategoriAdi = input.value.trim();

    if (!kategoriAdi) {
        gosterMesaj("Kategori adı boş olamaz.", "warning");
        return;
    }

    const originalButtonHTML = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        // api.js'deki özel fonksiyonu kullan
        const result = await api.postMasrafKategorisi({ kategori_adi: kategoriAdi });
        
        gosterMesaj(result.message, 'success');
        input.value = '';
        await kategorileriYukle(); // Listeyi ve select'leri anında güncelle
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        button.disabled = false;
        button.innerHTML = originalButtonHTML;
    }
}

/**
 * Kategori düzenleme modalını açar ve doldurur.
 */
window.kategoriDuzenleAc = function(id) {
    const kategori = tumKategoriler.find(k => k.id === id);
    if (!kategori) {
        gosterMesaj("Kategori bulunamadı.", "danger");
        return;
    }
    document.getElementById('edit-kategori-id').value = id;
    document.getElementById('edit-kategori-input').value = kategori.kategori_adi;
    kategoriModal.show();
}

/**
 * Kategori güncelleme işlemini yapar.
 */
async function kategoriGuncelle() {
    const id = document.getElementById('edit-kategori-id').value;
    const kategoriAdi = document.getElementById('edit-kategori-input').value.trim();
    const button = document.getElementById('guncelle-kategori-btn');
    
    if (!kategoriAdi) {
        gosterMesaj("Kategori adı boş olamaz.", "warning");
        return;
    }

    const originalButtonText = button.textContent;
    button.disabled = true;
    button.textContent = "Kaydediliyor...";

    try {
        // api.js'deki özel fonksiyonu kullan
        const result = await api.updateMasrafKategorisi(id, { kategori_adi: kategoriAdi });
        gosterMesaj(result.message, 'success');
        kategoriModal.hide();
        await kategorileriYukle(); // Listeyi ve select'leri güncelle
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        button.disabled = false;
        button.textContent = originalButtonText;
    }
}

/**
 * Kategori silme onay modalını açar.
 */
window.kategoriSilOnayiAc = function(id, ad) {
    document.getElementById('silinecek-kategori-id').value = id;
    document.getElementById('silinecek-kategori-adi').textContent = ad;
    kategoriSilModal.show();
}

/**
 * Kategori silme işlemini onaylar ve API'ye gönderir.
 */
async function kategoriSilOnayla() {
    const id = document.getElementById('silinecek-kategori-id').value;
    const button = document.getElementById('onayla-kategori-sil-btn');
    const originalButtonText = button.textContent;
    button.disabled = true;
    button.textContent = "Siliniyor...";
    
    try {
        // api.js'deki özel fonksiyonu kullan
        const result = await api.deleteMasrafKategorisi(id);
        gosterMesaj(result.message, 'success');
        await kategorileriYukle(); // Listeyi ve select'leri güncelle
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kategoriSilModal.hide();
        button.disabled = false;
        button.textContent = originalButtonText;
    }
}

// --- Masraf İşlemleri ---

/**
 * API'den masraf kayıtlarını çeker ve tabloyu doldurur.
 */
async function masraflariYukle(sayfa = 1) {
    mevcutMasrafSayfasi = sayfa;
    const tabloBody = document.getElementById('masraf-tablosu');
    const veriYokMesaji = document.getElementById('masraf-veri-yok');
    if (!tabloBody || !veriYokMesaji) return;

    tabloBody.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm"></div> Yükleniyor...</td></tr>';
    veriYokMesaji.style.display = 'none';

    try {
        // api.js'deki özel fonksiyonu kullan
        const data = await api.fetchMasraflar(sayfa, MASRAF_SAYFA_BASI);
        
        tabloBody.innerHTML = ''; // Tabloyu temizle
        
        if (!data.masraflar || data.masraflar.length === 0) {
            veriYokMesaji.style.display = 'block';
            document.getElementById('masraf-sayfalama').innerHTML = ''; // Sayfalamayı temizle
            return;
        }

        data.masraflar.forEach(masraf => {
            const tarih = new Date(masraf.masraf_tarihi + 'T00:00:00').toLocaleDateString('tr-TR', {timeZone: 'UTC'});
            const kategori = masraf.masraf_kategorileri ? utils.sanitizeHTML(masraf.masraf_kategorileri.kategori_adi) : '<em class="text-muted">Kategori Silinmiş</em>';
            const aciklama = utils.sanitizeHTML(masraf.aciklama) || '-';
            const tutar = parseFloat(masraf.tutar).toFixed(2);
            
            // DÜZELTME: Mobil görünüm için HTML'deki sınıflarla eşleşen sınıflar
            // text-nowrap KESİNLİKLE KALDIRILDI.
            tabloBody.innerHTML += `
                <tr id="masraf-satir-${masraf.id}">
                    <td>${tarih}</td>
                    <td>${kategori}</td>
                    <td class="d-none d-sm-table-cell">${aciklama}</td>
                    <td class="text-end fw-bold">${tutar} TL</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary py-0 px-1 me-1" onclick="masrafDuzenleAc(${masraf.id})" title="Düzenle">
                            <i class="bi bi-pencil" style="font-size: 0.8rem;"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="masrafSilOnayiAc(${masraf.id})" title="Sil">
                            <i class="bi bi-trash" style="font-size: 0.8rem;"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        ui.sayfalamaNavOlustur('masraf-sayfalama', data.toplam_kayit, data.sayfa, data.limit, masraflariYukle);

    } catch (error) {
        tabloBody.innerHTML = '';
        gosterMesaj(error.message || 'Masraflar yüklenirken bir hata oluştu.', 'danger');
    }
}

/**
 * Yeni masraf ekleme formunu yönetir.
 */
async function masrafEkle(event) {
    event.preventDefault();
    const button = document.getElementById('kaydet-masraf-btn');
    const originalButtonHTML = button.innerHTML;
    
    const masrafTarihi = formatDateToYYYYMMDD(masrafTarihSecici.selectedDates[0]);

    const veri = {
        kategori_id: kategoriSelect.getValue(),
        tutar: document.getElementById('masraf-tutar-input').value,
        masraf_tarihi: masrafTarihi,
        aciklama: document.getElementById('masraf-aciklama-input').value.trim()
    };

    if (!veri.kategori_id || !veri.tutar || !veri.masraf_tarihi) {
        gosterMesaj("Kategori, Tutar ve Masraf Tarihi zorunludur.", "warning");
        return;
    }

    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...';

    try {
        // api.js'deki özel fonksiyonu kullan
        const result = await api.postMasraf(veri);
        
        gosterMesaj(result.message, 'success');
        document.getElementById('yeni-masraf-formu').reset();
        kategoriSelect.clear();
        masrafTarihSecici.setDate(new Date()); // Tarihi bugüne döndür
        await masraflariYukle(1); // Listeyi yenile (ilk sayfaya dön)
        
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        button.disabled = false;
        button.innerHTML = originalButtonHTML;
    }
}

/**
 * Masraf düzenleme modalını açar ve doldurur.
 */
window.masrafDuzenleAc = async function(id) {
    try {
        // api.js'deki özel fonksiyonu kullan
        const data = await api.fetchMasraflar(mevcutMasrafSayfasi, MASRAF_SAYFA_BASI);
        const masraf = data.masraflar.find(m => m.id === id);
        
        if (!masraf) {
            gosterMesaj("Masraf detayı bulunamadı. Lütfen sayfayı yenileyin.", "warning");
            return;
        }
        
        document.getElementById('edit-masraf-id').value = masraf.id;
        document.getElementById('edit-masraf-tutar-input').value = parseFloat(masraf.tutar).toFixed(2);
        document.getElementById('edit-masraf-aciklama-input').value = masraf.aciklama || '';
        
        editMasrafTarihSecici.setDate(masraf.masraf_tarihi, true);
        editKategoriSelect.setValue(masraf.kategori_id, true);
        
        masrafModal.show();
        
    } catch (error) {
         gosterMesaj(error.message || "Masraf detayı yüklenemedi.", "danger");
    }
}

/**
 * Masraf güncelleme işlemini yapar.
 */
async function masrafGuncelle() {
    const id = document.getElementById('edit-masraf-id').value;
    const button = document.getElementById('guncelle-masraf-btn');
    
    const masrafTarihi = formatDateToYYYYMMDD(editMasrafTarihSecici.selectedDates[0]);

    const veri = {
        kategori_id: editKategoriSelect.getValue(),
        tutar: document.getElementById('edit-masraf-tutar-input').value,
        masraf_tarihi: masrafTarihi,
        aciklama: document.getElementById('edit-masraf-aciklama-input').value.trim()
    };

    if (!veri.kategori_id || !veri.tutar || !veri.masraf_tarihi) {
        gosterMesaj("Kategori, Tutar ve Masraf Tarihi zorunludur.", "warning");
        return;
    }

    const originalButtonText = button.textContent;
    button.disabled = true;
    button.textContent = "Kaydediliyor...";

    try {
        // api.js'deki özel fonksiyonu kullan
        const result = await api.updateMasraf(id, veri);
        gosterMesaj(result.message, 'success');
        masrafModal.hide();
        await masraflariYukle(mevcutMasrafSayfasi); // Mevcut sayfayı yenile
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        button.disabled = false;
        button.textContent = originalButtonText;
    }
}

/**
 * Masraf silme onay modalını açar.
 */
window.masrafSilOnayiAc = function(id) {
    document.getElementById('silinecek-masraf-id').value = id;
    masrafSilModal.show();
}

/**
 * Masraf silme işlemini onaylar ve API'ye gönderir.
 */
async function masrafSil() {
    const id = document.getElementById('silinecek-masraf-id').value;
    const button = document.getElementById('onayla-masraf-sil-btn');
    const originalButtonText = button.textContent;
    button.disabled = true;
    button.textContent = "Siliniyor...";
    
    try {
        // api.js'deki özel fonksiyonu kullan
        const result = await api.deleteMasraf(id);
        gosterMesaj(result.message, 'success');
        
        const tabloBody = document.getElementById('masraf-tablosu');
        if (tabloBody && tabloBody.rows.length === 1 && mevcutMasrafSayfasi > 1) {
            await masraflariYukle(mevcutMasrafSayfasi - 1);
        } else {
            await masraflariYukle(mevcutMasrafSayfasi);
        }
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        masrafSilModal.hide();
        button.disabled = false;
        button.textContent = originalButtonText;
    }
}

/**
 * JavaScript Date objesini 'YYYY-MM-DD' formatına çevirir.
 */
function formatDateToYYYYMMDD(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}