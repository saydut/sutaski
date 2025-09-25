let tedarikciSecici, yemUrunSecici;
let yemUrunuModal;

// Sayfa yüklendiğinde çalışacak ana fonksiyon
window.onload = function() {
    // Bootstrap Modal instance'ını oluştur
    yemUrunuModal = new bootstrap.Modal(document.getElementById('yemUrunuModal'));
    
    // TomSelect (gelişmiş seçim kutuları) instance'larını başlat
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    yemUrunSecici = new TomSelect("#yem-urun-sec", { create: false, sortField: { field: "text", direction: "asc" } });

    // Sayfa için gerekli verileri (tedarikçiler, yemler) sunucudan çek
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

        const urunler = await response.json();
        
        // Yem ürünleri tablosunu doldur
        const tbody = document.getElementById('yem-urunleri-tablosu');
        tbody.innerHTML = '';
        if (urunler.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-secondary p-4">Kayıtlı yem ürünü bulunamadı.</td></tr>';
        } else {
            urunler.forEach(urun => {
                const tr = `
                    <tr>
                        <td><strong>${urun.yem_adi}</strong></td>
                        <td class="text-end">${parseFloat(urun.stok_miktari_kg).toFixed(2)} KG</td>
                        <td class="text-end">${parseFloat(urun.birim_fiyat).toFixed(2)} TL</td>
                    </tr>`;
                tbody.innerHTML += tr;
            });
        }

        // Yem çıkışı formundaki seçim kutusunu doldur
        yemUrunSecici.clear();
        yemUrunSecici.clearOptions();
        const options = urunler.map(u => ({ 
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
async function yemUrunuKaydet() {
    const yem_adi = document.getElementById('yem-adi-input').value.trim();
    const stok_miktari_kg = document.getElementById('yem-stok-input').value;
    const birim_fiyat = document.getElementById('yem-fiyat-input').value;
    
    if (!yem_adi || !stok_miktari_kg || !birim_fiyat) {
        gosterMesaj('Lütfen ürün için tüm alanları doldurun.', 'warning');
        return;
    }

    try {
        const response = await fetch('/yem/api/urunler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yem_adi, stok_miktari_kg, birim_fiyat })
        });
        
        if (response.ok) {
            gosterMesaj('Yeni yem ürünü başarıyla eklendi.', 'success');
            yemUrunuModal.hide(); // Modalı kapat
            // Formu temizle
            document.getElementById('yem-adi-input').value = '';
            document.getElementById('yem-stok-input').value = '';
            document.getElementById('yem-fiyat-input').value = '';
            await yemUrunleriniDoldur(); // Listeyi yenile
        } else {
            const result = await response.json();
            gosterMesaj(result.error || 'Ekleme sırasında hata.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucu hatası.', 'danger');
    }
}
