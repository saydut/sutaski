// Bu script, tedarikci_detay.html sayfasının mantığını yönetir.
// 'CURRENT_SUPPLIER_ID' ve 'CURRENT_SUPPLIER_NAME' değişkenleri
// tedarikci_detay.html içinden global olarak tanımlanmıştır.

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elementleri ---
    const nameHeader = document.getElementById('supplier-name-header');
    const codeHeader = document.getElementById('supplier-code-header');
    const balanceCard = document.getElementById('supplier-balance');
    const milkCard = document.getElementById('supplier-total-milk');
    const feedCard = document.getElementById('supplier-total-feed');
    
    // Tablo Body'leri
    const historyTable = document.getElementById('history-table-body');
    const milkTable = document.getElementById('milk-table-body');
    const feedTable = document.getElementById('feed-table-body');
    const paymentTable = document.getElementById('payment-table-body');
    
    // Tab Butonları
    const tabsContainer = document.getElementById('supplier-tabs');

    /**
     * Tabloya "Veri yok" satırı ekler
     */
    const renderEmptyRow = (tbody, colSpan) => {
        tbody.innerHTML = `<tr><td colspan="${colSpan}" class="p-4 text-center">Bu kritere uygun kayıt bulunamadı.</td></tr>`;
    };

    /**
     * İşlem Geçmişi tablosunu doldurur
     */
    const renderHistoryTable = (data) => {
        historyTable.innerHTML = '';
        if (!data || data.length === 0) return renderEmptyRow(historyTable, 4);

        data.forEach(item => {
            let icon, color, detay, tutar;
            
            if (item.tip === 'sut') {
                icon = 'fas fa-tint'; color = 'text-blue-500';
                detay = `${item.detay.litre} Litre`;
                tutar = item.tutar; // Süt alımı borçtur (pozitif)
            } else if (item.tip === 'yem') {
                icon = 'fas fa-seedling'; color = 'text-green-500';
                detay = `${item.detay.miktar} adet ${item.detay.yem_tipi}`;
                tutar = -item.tutar; // Yem satışı alacaktır (negatif)
            } else if (item.tip === 'odeme') {
                icon = 'fas fa-lira-sign'; color = 'text-yellow-500';
                detay = item.detay.aciklama || 'Ödeme';
                tutar = -item.tutar; // Ödeme alacaktır (negatif)
            }

            historyTable.innerHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(item.tarih)}</td>
                    <td class="table-cell"><i class="${icon} ${color} mr-2"></i> ${item.tip.charAt(0).toUpperCase() + item.tip.slice(1)}</td>
                    <td class="table-cell">${detay}</td>
                    <td class="table-cell font-medium ${tutar > 0 ? 'text-red-500' : 'text-green-500'}">${formatCurrency(tutar)}</td>
                </tr>
            `;
        });
    };

    /**
     * Süt tablosunu doldurur
     */
    const renderMilkTable = (data) => {
        milkTable.innerHTML = '';
        if (!data || data.length === 0) return renderEmptyRow(milkTable, 4);
        data.forEach(item => {
            milkTable.innerHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(item.tarih)}</td>
                    <td class="table-cell">${item.litre} Litre</td>
                    <td class="table-cell">${formatCurrency(item.birim_fiyat)}</td>
                    <td class="table-cell font-medium text-red-500">${formatCurrency(item.toplam_tutar)}</td>
                </tr>
            `;
        });
    };

    /**
     * Yem tablosunu doldurur
     */
    const renderFeedTable = (data) => {
        feedTable.innerHTML = '';
        if (!data || data.length === 0) return renderEmptyRow(feedTable, 5);
        data.forEach(item => {
            feedTable.innerHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(item.tarih)}</td>
                    <td class="table-cell">${item.yem_tipi}</td>
                    <td class="table-cell">${item.miktar}</td>
                    <td class="table-cell">${formatCurrency(item.birim_fiyat)}</td>
                    <td class="table-cell font-medium text-green-500">${formatCurrency(item.toplam_tutar)}</td>
                </tr>
            `;
        });
    };
    
    /**
     * Ödeme tablosunu doldurur
     */
    const renderPaymentTable = (data) => {
        paymentTable.innerHTML = '';
        if (!data || data.length === 0) return renderEmptyRow(paymentTable, 3);
        data.forEach(item => {
            paymentTable.innerHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(item.tarih)}</td>
                    <td class="table-cell font-medium text-green-500">${formatCurrency(item.tutar)}</td>
                    <td class="table-cell">${item.aciklama || '-'}</td>
                </tr>
            `;
        });
    };


    /**
     * Ana veri yükleme fonksiyonu
     */
    const loadSupplierDetails = async (id) => {
        if (!id) return;
        
        try {
            const data = await apiCall(`/api/tedarikci/${id}`);
            
            // 1. Başlık ve Global Adı Güncelle
            nameHeader.textContent = data.ad_soyad;
            codeHeader.textContent = `Tedarikçi Kodu: ${data.tedarikci_kodu}`;
            // islem_yonetimi.js'nin kullanması için global değişkeni güncelle
            window.CURRENT_SUPPLIER_NAME = data.ad_soyad; 

            // 2. Özet Kartlarını Doldur
            balanceCard.textContent = formatCurrency(data.bakiye);
            balanceCard.className = `text-3xl font-bold ${data.bakiye > 0 ? 'text-red-500' : 'text-green-500'}`;
            milkCard.textContent = data.ozet_bu_ay.total_sut || 0;
            feedCard.textContent = formatCurrency(data.ozet_bu_ay.total_yem || 0);

            // 3. Tabloları Doldur
            renderHistoryTable(data.islem_gecmisi);
            renderMilkTable(data.sut_kayitlari);
            renderFeedTable(data.yem_kayitlari);
            renderPaymentTable(data.odeme_kayitlari);
            
        } catch (error) {
            showToast(`Tedarikçi detayları yüklenemedi: ${error.message}`, 'error');
            nameHeader.textContent = 'Hata';
            codeHeader.textContent = 'Tedarikçi bulunamadı veya yüklenemedi.';
        }
    };
    
    // --- Event Listeners ---

    // Tab Değiştirme
    tabsContainer.addEventListener('click', (e) => {
        const targetButton = e.target.closest('button');
        if (!targetButton || targetButton.classList.contains('active')) return;

        const tabName = targetButton.dataset.tab;
        
        // Tüm butonlardan 'active' sınıfını kaldır
        tabsContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        // Tıklanan butona 'active' ekle
        targetButton.classList.add('active');

        // Tüm tab içeriklerini gizle
        document.querySelectorAll('.tab-content-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        // İlgili tab içeriğini göster
        document.getElementById(`tab-content-${tabName}`).classList.add('active');
    });

    // Sayfa yüklendiğinde verileri çek
    loadSupplierDetails(CURRENT_SUPPLIER_ID);
    
    // Diğer JS dosyalarının (örn: islem_yonetimi.js) bu sayfayı
    // yenileyebilmesi için fonksiyonu global'e ata
    window.loadSupplierDetails = loadSupplierDetails;
});