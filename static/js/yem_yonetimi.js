let tedarikciSecici, yemUrunSecici;
let yemUrunuModal, yemSilmeOnayModal;
let allYemUrunleri = []; // Tüm yem ürünlerini burada saklayacağız

// Sayfa yüklendiğinde çalışacak ana fonksiyon
window.onload = function() {
    yemUrunuModal = new bootstrap.Modal(document.getElementById('yemUrunuModal'));
    yemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemSilmeOnayModal'));
    
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    yemUrunSecici = new TomSelect("#yem-urun-sec", { create: false, sortField: { field: "text", direction: "asc" } });

    verileriYukle();
};

/**
 * Gerekli tüm başlangıç verilerini paralel olarak yükler.
 */
async function verileriYukle() {
    const spinner = '<tr><td colspan="3" class="text-center p-4"><div class="spinner-border" role="status"><span class="visually-hidden">Yükleniyor...</span></div></td></tr>';
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
 * Sunucudan yem ürünlerini çeker, tabloyu ve seçim kutusunu doldurur.
 */
async function yemUrunleriniDoldur() {
    try {
        const response = await fetch('/yem/api/urunler');
        if (!response.ok) throw new Error('Yem ürünleri yüklenemedi.');

        allYemUrunleri = await response.json(); // Gelen veriyi global değişkene ata
        
        const tbody = document.getElementById('yem-urunleri-tablosu');
        tbody.innerHTML = '';
        if (allYemUrunleri.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-secondary p-4">Kayıtlı yem ürünü bulunamadı.</td></tr>';
        } else {
            allYemUrunleri.forEach(urun => {
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
        document.getElementById('yem-urunleri-tablosu').innerHTML = `<tr><td colspan="3" class="text-center text-danger p-4">${error.message}</td></tr>`;
    }
}


// YENİ: "Yeni Yem Ekle" butonuna basıldığında modal'ı temizler ve açar.
function yeniYemModaliniAc() {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yeni Yem Ürünü Ekle';
    document.getElementById('yem-urun-form').reset();
    document.getElementById('edit-yem-id').value = '';
    yemUrunuModal.show();
}

// YENİ: "Düzenle" butonuna basıldığında modal'ı doldurur ve açar.
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
 * "Çıkışı Kaydet" butonuna tıklandığında çalışır. Form verilerini sunucuya gönderir.
 */
async function yemCikisiYap() {
    const tedarikci_id = tedarikciSecici.getValue();
    const yem_urun_id = yemUrunSecici.getValue();
    const miktar_kg = document.getElementById('miktar-input').value;
    const aciklama = document.getElementById('aciklama-input').value.trim();

    if (!tedarikci_id || !yem_urun_id || !miktar_kg || parseFloat(miktar_kg) <= 0) {
        gosterMesaj('Lütfen tedarikçi, yem ürünü seçin ve geçerli bir miktar girin.', 'warning');
        return;
    }

    try {
        const response = await fetch('/yem/api/islemler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tedarikci_id, yem_urun_id, miktar_kg, aciklama })
        });
        const result = await response.json();

        if (response.ok) {
            gosterMesaj('Yem çıkışı başarıyla kaydedildi.', 'success');
            // Formu temizle
            tedarikciSecici.clear();
            document.getElementById('miktar-input').value = '';
            document.getElementById('aciklama-input').value = '';
            // Stok bilgisini güncellemek için yem listesini ve seçim kutusunu yenile
            await yemUrunleriniDoldur();
        } else {
            gosterMesaj(result.error || 'Bir hata oluştu.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}

/**
 * Yeni yem ürünü modal'ındaki "Kaydet" butonuna tıklandığında çalışır.
 */
// GÜNCELLENDİ: Hem ekleme hem de düzenleme yapacak şekilde güncellendi.
async function yemUrunuKaydet() {
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
    }
}

// YENİ: Silme onay modal'ını açar.
function yemSilmeOnayiAc(id, isim) {
    document.getElementById('silinecek-yem-id').value = id;
    document.getElementById('silinecek-yem-adi').innerText = isim;
    yemSilmeOnayModal.show();
}

// YENİ: Silme işlemini gerçekleştiren fonksiyon.
async function yemUrunuSil() {
    const id = document.getElementById('silinecek-yem-id').value;
    try {
        const response = await fetch(`/yem/api/urunler/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            yemSilmeOnayModal.hide();
            await yemUrunleriniDoldur(); // Listeyi yenile
        } else {
            gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}
