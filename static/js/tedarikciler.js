// Bu dosya, tedarikciler.html sayfasının mantığını yönetir.

// Tüm tedarikçi verilerini global olarak saklayalım ki arama yaparken tekrar API'ye gitmeyelim.
let allSuppliers = [];

/**
 * Sayfa yüklendiğinde tedarikçi verilerini çeker.
 */
window.onload = async () => {
    const tbody = document.getElementById('tedarikciler-tablosu');
    tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4"><div class="spinner-border" role="status"><span class="visually-hidden">Yükleniyor...</span></div></td></tr>`;
    
    try {
        const response = await fetch('/api/tedarikciler_liste');
        if (!response.ok) {
            throw new Error('Veri çekilemedi.');
        }
        allSuppliers = await response.json();
        renderTable(allSuppliers); // Gelen veriyle tabloyu doldur
    } catch (error) {
        console.error("Hata:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger p-4">Tedarikçiler yüklenirken bir hata oluştu.</td></tr>`;
    }

    // Arama input'una her tuşa basıldığında filtreleme yap
    const aramaInput = document.getElementById('arama-input');
    aramaInput.addEventListener('keyup', () => {
        const searchTerm = aramaInput.value.toLowerCase();
        const filteredSuppliers = allSuppliers.filter(supplier => 
            supplier.isim.toLowerCase().includes(searchTerm)
        );
        renderTable(filteredSuppliers);
    });
};

/**
 * Gelen tedarikçi verisine göre HTML tablosunu oluşturur ve ekrana basar.
 * @param {Array} suppliers Gösterilecek tedarikçilerin listesi.
 */
function renderTable(suppliers) {
    const tbody = document.getElementById('tedarikciler-tablosu');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    tbody.innerHTML = ''; // Tabloyu temizle

    if (suppliers.length === 0) {
        veriYokMesaji.style.display = 'block'; // Veri yok mesajını göster
    } else {
        veriYokMesaji.style.display = 'none'; // Veri yok mesajını gizle
        suppliers.forEach(supplier => {
            const tr = `
                <tr>
                    <td><strong>${supplier.isim}</strong></td>
                    <td class="text-end">${supplier.toplam_litre.toFixed(2)} L</td>
                    <td class="text-end">${supplier.girdi_sayisi}</td>
                    <td class="text-center">
                        <a href="/tedarikci/${supplier.id}" class="btn btn-sm btn-outline-info">
                            Detayları Gör <i class="bi bi-arrow-right-short"></i>
                        </a>
                    </td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });
    }
}
