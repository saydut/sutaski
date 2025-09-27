let tedarikciSecici, yemUrunSecici;
let yemUrunuModal, yemSilmeOnayModal;
let allYemUrunleri = [];
// Sıralama durumu için değişkenler
let mevcutYemSiralamaSutunu = 'yem_adi';
let mevcutYemSiralamaYonu = 'asc';

/**
 * Sayfa yüklendiğinde çalışacak ana fonksiyon.
 */
window.onload = function() {
    yemUrunuModal = new bootstrap.Modal(document.getElementById('yemUrunuModal'));
    yemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemSilmeOnayModal'));
    
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    yemUrunSecici = new TomSelect("#yem-urun-sec", { create: false, sortField: { field: "text", direction: "asc" } });

    verileriYukle();

    // Yem tablosu başlıklarına tıklama olaylarını ekle
    document.querySelectorAll('.sortable-yem').forEach(header => {
        header.addEventListener('click', () => {
            const sutun = header.dataset.sort;
            if (mevcutYemSiralamaSutunu === sutun) {
                mevcutYemSiralamaYonu = mevcutYemSiralamaYonu === 'asc' ? 'desc' : 'asc';
            } else {
                mevcutYemSiralamaSutunu = sutun;
                mevcutYemSiralamaYonu = 'asc';
            }
            yemleriSiralaVeGoster();
        });
    });
};

/**
 * Gerekli tüm başlangıç verilerini paralel olarak yükler.
 */
async function verileriYukle() {
    const spinner = '<tr><td colspan="4" class="text-center p-4"><div class="spinner-border"></div></td></tr>';
    document.getElementById('yem-urunleri-tablosu').innerHTML = spinner;
    
    await Promise.all([
        tedarikcileriDoldur(),
        yemUrunleriniDoldur()
    ]);
}

/**
 * Sunucudan tedarikçi listesini çeker ve seçim kutusunu doldurur.
 */
async function tedarikcileriDoldur() {
    try {
        const response = await fetch('/api/tedarikciler_liste');
        if (!response.ok) throw new Error('Tedarikçiler yüklenemedi.');
        
        const tedarikciler = await response.json();
        tedarikciSecici.clear();
        tedarikciSecici.clearOptions();
        const options = tedarikciler.map(t => ({ value: t.id, text: t.isim }));
        tedarikciSecici.addOptions(options);
    } catch (error) {
        console.error("Tedarikçi doldurma hatası:", error);
        gosterMesaj(error.message, "danger");
    }
}

/**
 * Sunucudan yem ürünlerini çeker ve sıralama fonksiyonunu çağırır.
 */
async function yemUrunleriniDoldur() {
    try {
        const response = await fetch('/yem/api/urunler');
        if (!response.ok) throw new Error('Yem ürünleri yüklenemedi.');
        allYemUrunleri = await response.json();
        
        yemleriSiralaVeGoster(); // Direkt render etmek yerine sıralama fonksiyonunu çağır

        // Seçim kutusunu doldur
        yemUrunSecici.clear();
        yemUrunSecici.clearOptions();
        const options = allYemUrunleri.map(u => ({ 
            value: u.id, 
            text: `${u.yem_adi} (Stok: ${parseFloat(u.stok_miktari_kg).toFixed(2)} kg)` 
        }));
        yemUrunSecici.addOptions(options);

    } catch (error) {
        console.error("Yem ürünleri doldurma hatası:", error);
        gosterMesaj(error.message, "danger");
        document.getElementById('yem-urunleri-tablosu').innerHTML = `<tr><td colspan="4" class="text-center text-danger p-4">${error.message}</td></tr>`;
    }
}

/**
 * Yemleri mevcut sıralama durumuna göre sıralar ve tabloyu günceller.
 */
function yemleriSiralaVeGoster() {
    let siraliYemler = [...allYemUrunleri]; // Orijinal diziyi bozmamak için kopyasını oluştur

    siraliYemler.sort((a, b) => {
        let valA = a[mevcutYemSiralamaSutunu];
        let valB = b[mevcutYemSiralamaSutunu];

        if (mevcutYemSiralamaSutunu !== 'yem_adi') {
            valA = parseFloat(valA || 0);
            valB = parseFloat(valB || 0);
        } else {
            valA = (valA || '').toLowerCase();
            valB = (valB || '').toLowerCase();
        }

        if (valA < valB) return mevcutYemSiralamaYonu === 'asc' ? -1 : 1;
        if (valA > valB) return mevcutYemSiralamaYonu === 'asc' ? 1 : -1;
        return 0;
    });
    
    renderYemTable(siraliYemler);
    yemBasliklariniGuncelle();
}

/**
 * Gelen yem listesine göre HTML tablosunu oluşturur.
 * @param {Array} urunler - Gösterilecek yem ürünlerinin listesi.
 */
function renderYemTable(urunler) {
    const tbody = document.getElementById('yem-urunleri-tablosu');
    tbody.innerHTML = '';
    if (urunler.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary p-4">Kayıtlı yem ürünü bulunamadı.</td></tr>';
    } else {
        urunler.forEach(urun => {
            const tr = `
                <tr>
                    <td><strong>${urun.yem_adi}</strong></td>
                    <td class="text-end">${parseFloat(urun.stok_miktari_kg).toFixed(2)} KG</td>
                    <td class="text-end">${parseFloat(urun.birim_fiyat).toFixed(2)} TL</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="yemDuzenleAc(${urun.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="yemSilmeOnayiAc(${urun.id}, '${urun.yem_adi}')"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>`;
            tbody.innerHTML += tr;
        });
    }
}

/**
 * Yem tablosu başlıklarındaki sıralama ikonlarını günceller.
 */
function yemBasliklariniGuncelle() {
    document.querySelectorAll('.sortable-yem').forEach(header => {
        const sutun = header.dataset.sort;
        header.classList.remove('asc', 'desc');
        if (sutun === mevcutYemSiralamaSutunu) {
            header.classList.add(mevcutYemSiralamaYonu);
        }
    });
}

/**
 * "Çıkışı Kaydet" butonuna tıklandığında çalışır. Form verilerini sunucuya gönderir.
 */
async function yemCikisiYap() {
    const kaydetButton = document.querySelector('.card .btn-primary');
    const originalButtonText = kaydetButton.innerHTML;
    const tedarikci_id = tedarikciSecici.getValue();
    const yem_urun_id = yemUrunSecici.getValue();
    const miktar_kg = document.getElementById('miktar-input').value;
    const aciklama = document.getElementById('aciklama-input').value.trim();

    if (!tedarikci_id || !yem_urun_id || !miktar_kg || parseFloat(miktar_kg) <= 0) {
        gosterMesaj('Lütfen tedarikçi, yem ürünü seçin ve geçerli bir miktar girin.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    try {
        const response = await fetch('/yem/api/islemler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tedarikci_id, yem_urun_id, miktar_kg, aciklama })
        });
        const result = await response.json();

        if (response.ok) {
            gosterMesaj(result.message, 'success');
            tedarikciSecici.clear();
            document.getElementById('miktar-input').value = '';
            document.getElementById('aciklama-input').value = '';
            await yemUrunleriniDoldur();
        } else {
            gosterMesaj(result.error || 'Bir hata oluştu.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

/**
 * "Yeni Yem Ekle" butonuna basıldığında modal'ı temizler ve açar.
 */
function yeniYemModaliniAc() {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yeni Yem Ürünü Ekle';
    document.getElementById('yem-urun-form').reset();
    document.getElementById('edit-yem-id').value = '';
    yemUrunuModal.show();
}

/**
 * "Düzenle" butonuna basıldığında modal'ı doldurur ve açar.
 * @param {number} id - Düzenlenecek yem ürününün ID'si.
 */
function yemDuzenleAc(id) {
    const urun = allYemUrunleri.find(y => y.id === id);
    if (urun) {
        document.getElementById('yemUrunuModalLabel').innerText = 'Yem Ürününü Düzenle';
        document.getElementById('edit-yem-id').value = urun.id;
        document.getElementById('yem-adi-input').value = urun.yem_adi;
        document.getElementById('yem-stok-input').value = parseFloat(urun.stok_miktari_kg);
        document.getElementById('yem-fiyat-input').value = parseFloat(urun.birim_fiyat);
        yemUrunuModal.show();
    }
}

/**
 * Ekleme/Düzenleme modal'ındaki kaydet butonuna basıldığında çalışır.
 */
async function yemUrunuKaydet() {
    const kaydetButton = document.querySelector('#yemUrunuModal .btn-primary');
    const originalButtonText = kaydetButton.innerHTML;
    const id = document.getElementById('edit-yem-id').value;
    const veri = {
        yem_adi: document.getElementById('yem-adi-input').value.trim(),
        stok_miktari_kg: document.getElementById('yem-stok-input').value,
        birim_fiyat: document.getElementById('yem-fiyat-input').value
    };
    
    if (!veri.yem_adi || !veri.stok_miktari_kg || !veri.birim_fiyat) {
        gosterMesaj('Lütfen tüm zorunlu alanları doldurun.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    const url = id ? `/yem/api/urunler/${id}` : '/yem/api/urunler';
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });
        
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            yemUrunuModal.hide();
            await yemUrunleriniDoldur();
        } else {
            gosterMesaj(result.error || 'İşlem sırasında bir hata oluştu.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

/**
 * Silme onay modal'ını açar.
 * @param {number} id - Silinecek yem ürününün ID'si.
 * @param {string} isim - Silinecek yem ürününün adı.
 */
function yemSilmeOnayiAc(id, isim) {
    document.getElementById('silinecek-yem-id').value = id;
    document.getElementById('silinecek-yem-adi').innerText = isim;
    yemSilmeOnayModal.show();
}

/**
 * Onay modal'ındaki sil butonuna basıldığında silme işlemini gerçekleştirir.
 */
async function yemUrunuSil() {
    const id = document.getElementById('silinecek-yem-id').value;
    try {
        const response = await fetch(`/yem/api/urunler/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            yemSilmeOnayModal.hide();
            await yemUrunleriniDoldur();
        } else {
            gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}

