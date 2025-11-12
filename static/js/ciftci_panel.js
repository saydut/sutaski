// Bu script, ciftci_panel.html (Tedarikçi arayüzü) sayfasının mantığını yönetir.
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elementleri ---
    const nameHeader = document.getElementById('ciftci-ad-soyad');
    const balanceCard = document.getElementById('ciftci-balance');
    
    // Özet Kartları
    const lastMilkDate = document.getElementById('ciftci-last-milk-date');
    const lastMilkLitre = document.getElementById('ciftci-last-milk-litre');
    const lastFeedDate = document.getElementById('ciftci-last-feed-date');
    const lastFeedTutar = document.getElementById('ciftci-last-feed-tutar');
    const lastPaymentDate = document.getElementById('ciftci-last-payment-date');
    const lastPaymentTutar = document.getElementById('ciftci-last-payment-tutar');

    // Tablo Body'leri
    const historyTable = document.getElementById('history-table-body');
    const milkTable = document.getElementById('milk-table-body');
    const feedTable = document.getElementById('feed-table-body');
    const paymentTable = document.getElementById('payment-table-body');
    
    // Tab Butonları
    const tabsContainer = document.getElementById('supplier-tabs');
    
    // Talep Modalı
    const openTalepModalBtn = document.getElementById('open-talep-modal-btn');
    const talepForm = document.getElementById('talep-form');

    /**
     * Tabloya "Veri yok" satırı ekler
     */
    const renderEmptyRow = (tbody, colSpan) => {
        tbody.innerHTML = `<tr><td colspan="${colSpan}" class="p-4 text-center">Kayıt bulunamadı.</td></tr>`;
    };
    
    // --- Render Fonksiyonları (tedarikci_detay.js'den uyarlandı) ---

    const renderHistoryTable = (data) => {
        historyTable.innerHTML = '';
        if (!data || data.length === 0) return renderEmptyRow(historyTable, 3);
        data.forEach(item => {
            let icon, color, detay, tutar;
            if (item.tip === 'sut') {
                icon = 'fas fa-tint'; color = 'text-blue-500';
                detay = `${item.detay.litre} Litre`;
                tutar = item.tutar;
            } else if (item.tip === 'yem') {
                icon = 'fas fa-seedling'; color = 'text-green-500';
                detay = `${item.detay.miktar} adet ${item.detay.yem_tipi}`;
                tutar = -item.tutar;
            } else if (item.tip === 'odeme') {
                icon = 'fas fa-lira-sign'; color = 'text-yellow-500';
                detay = item.detay.aciklama || 'Ödeme';
                tutar = -item.tutar;
            }
            historyTable.innerHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(item.tarih)}</td>
                    <td class="table-cell"><i class="${icon} ${color} mr-2"></i> ${detay}</td>
                    <td class="table-cell font-medium ${tutar > 0 ? 'text-red-500' : 'text-green-500'}">${formatCurrency(tutar)}</td>
                </tr>`;
        });
    };
    
    const renderMilkTable = (data) => {
        milkTable.innerHTML = '';
        if (!data || data.length === 0) return renderEmptyRow(milkTable, 3);
        data.forEach(item => {
            milkTable.innerHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(item.tarih)}</td>
                    <td class="table-cell">${item.litre} Litre</td>
                    <td class="table-cell font-medium text-red-500">${formatCurrency(item.toplam_tutar)}</td>
                </tr>`;
        });
    };
    
    const renderFeedTable = (data) => {
        feedTable.innerHTML = '';
        if (!data || data.length === 0) return renderEmptyRow(feedTable, 3);
        data.forEach(item => {
            feedTable.innerHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(item.tarih)}</td>
                    <td class="table-cell">${item.yem_tipi}</td>
                    <td class="table-cell font-medium text-green-500">${formatCurrency(item.toplam_tutar)}</td>
                </tr>`;
        });
    };
    
    const renderPaymentTable = (data) => {
        paymentTable.innerHTML = '';
        if (!data || data.length === 0) return renderEmptyRow(paymentTable, 3);
        data.forEach(item => {
            paymentTable.innerHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(item.tarih)}</td>
                    <td class="table-cell font-medium text-green-500">${formatCurrency(item.tutar)}</td>
                    <td class="table-cell">${item.aciklama || '-'}</td>
                </tr>`;
        });
    };

    /**
     * Ana veri yükleme fonksiyonu
     */
    const loadCiftciData = async () => {
        try {
            const data = await apiCall('/api/ciftci/data');
            
            // 1. Başlık
            nameHeader.textContent = data.ad_soyad;

            // 2. Bakiye Kartı
            balanceCard.textContent = formatCurrency(data.bakiye);
            balanceCard.className = `text-4xl font-bold ${data.bakiye > 0 ? 'text-red-500' : 'text-green-500'}`;

            // 3. Özet Kartları
            if(data.son_sut) {
                lastMilkDate.textContent = formatDate(data.son_sut.tarih);
                lastMilkLitre.textContent = `${data.son_sut.litre} Litre`;
            } else {
                lastMilkDate.textContent = 'Kayıt yok';
                lastMilkLitre.textContent = '0 Litre';
            }
            if(data.son_yem) {
                lastFeedDate.textContent = formatDate(data.son_yem.tarih);
                lastFeedTutar.textContent = formatCurrency(data.son_yem.tutar);
            } else {
                lastFeedDate.textContent = 'Kayıt yok';
                lastFeedTutar.textContent = '0 TL';
            }
            if(data.son_odeme) {
                lastPaymentDate.textContent = formatDate(data.son_odeme.tarih);
                lastPaymentTutar.textContent = formatCurrency(data.son_odeme.tutar);
            } else {
                lastPaymentDate.textContent = 'Kayıt yok';
                lastPaymentTutar.textContent = '0 TL';
            }

            // 4. Tabloları Doldur
            renderHistoryTable(data.islem_gecmisi);
            renderMilkTable(data.sut_kayitlari);
            renderFeedTable(data.yem_kayitlari);
            renderPaymentTable(data.odeme_kayitlari);
            
        } catch (error) {
            showToast(`Veriler yüklenemedi: ${error.message}`, 'error');
            nameHeader.textContent = 'Hata';
            balanceCard.textContent = 'Hata';
        }
    };
    
    // --- Event Listeners ---

    // Tab Değiştirme
    tabsContainer.addEventListener('click', (e) => {
        const targetButton = e.target.closest('button');
        if (!targetButton || targetButton.classList.contains('active')) return;
        const tabName = targetButton.dataset.tab;
        tabsContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        targetButton.classList.add('active');
        document.querySelectorAll('.tab-content-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`tab-content-${tabName}`).classList.add('active');
    });

    // Talep Modalını Aç
    openTalepModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        talepForm.reset();
        window.openModal('talep-modal');
    });

    // Talep Formu Gönderme
    talepForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(talepForm);
        const body = Object.fromEntries(formData.entries());

        try {
            const response = await apiCall('/api/ciftci/talep', 'POST', body);
            showToast(response.mesaj, 'success');
            window.closeModal('talep-modal');
        } catch (error) {
            showToast(`Hata: ${error.message}`, 'error');
        }
    });

    // Sayfa yüklendiğinde verileri çek
    loadCiftciData();
});