// Bu script, index.html (Anasayfa) için dashboard verilerini yükler.
document.addEventListener('DOMContentLoaded', async () => {
    
    // Yüklendiğini belirtmek için varsayılan değerleri ayarla
    const summaryElements = {
        milk: document.getElementById('summary-total-milk'),
        feed: document.getElementById('summary-total-feed'),
        payment: document.getElementById('summary-total-payment'),
        supplier: document.getElementById('summary-supplier-count')
    };

    const recentActionsBody = document.getElementById('recent-actions-body');

    // Başlangıçta yükleniyor... durumunu ayarla
    const setLoadingState = () => {
        summaryElements.milk.textContent = '...';
        summaryElements.feed.textContent = '...';
        summaryElements.payment.textContent = '...';
        summaryElements.supplier.textContent = '...';
        recentActionsBody.innerHTML = `<tr><td class="py-2 px-4 text-center">Yükleniyor...</td></tr>`;
    };

    // Gelen veriye göre "Son İşlemler" tablosunu doldur
    const renderRecentActions = (actions) => {
        recentActionsBody.innerHTML = ''; // Temizle
        if (!actions || actions.length === 0) {
            recentActionsBody.innerHTML = `<tr><td class="py-2 px-4 text-center">Son işlem bulunamadı.</td></tr>`;
            return;
        }

        actions.forEach(action => {
            let icon, color, text;
            switch(action.tip) {
                case 'sut':
                    icon = 'fas fa-tint';
                    color = 'text-blue-500';
                    text = `<strong>${action.tedarikci_ad}</strong> için <strong>${action.detay.litre} Litre</strong> süt girdisi yapıldı.`;
                    break;
                case 'yem':
                    icon = 'fas fa-seedling';
                    color = 'text-green-500';
                    text = `<strong>${action.tedarikci_ad}</strong> için <strong>${formatCurrency(action.tutar)}</strong> tutarında yem satışı yapıldı.`;
                    break;
                case 'odeme':
                    icon = 'fas fa-lira-sign';
                    color = 'text-yellow-500';
                    text = `<strong>${action.tedarikci_ad}</strong> hesabına <strong>${formatCurrency(action.tutar)}</strong> ödeme yapıldı.`;
                    break;
            }

            recentActionsBody.innerHTML += `
                <tr class="border-b dark:border-gray-700">
                    <td class="py-3 px-4"><i class="${icon} ${color} w-6 text-center"></i></td>
                    <td class="py-3 px-4">${text}</td>
                    <td class="py-3 px-4 text-sm text-gray-500 dark:text-gray-400 text-right">${formatDate(action.tarih)}</td>
                </tr>
            `;
        });
    };

    // Ana veri yükleme fonksiyonu
    const loadDashboardData = async () => {
        setLoadingState();
        try {
            // Tüm dashboard verilerini tek bir API çağrısı ile al
            const data = await apiCall('/api/dashboard/all');

            // 1. Özet Kartlarını Güncelle
            summaryElements.milk.textContent = data.summary.total_sut.toLocaleString('tr-TR') || 0;
            summaryElements.feed.textContent = formatCurrency(data.summary.total_yem || 0);
            summaryElements.payment.textContent = formatCurrency(data.summary.total_odeme || 0);
            summaryElements.supplier.textContent = data.summary.aktif_tedarikci || 0;

            // 2. Grafikleri Çiz (chart-manager.js'deki fonksiyonları çağır)
            if (window.ChartManager) {
                window.ChartManager.createDailyMilkChart(data.charts.daily_milk);
                window.ChartManager.createSupplierPieChart(data.charts.supplier_distribution);
            } else {
                console.error("ChartManager yüklenemedi.");
            }
            
            // 3. Son İşlemler Tablosunu Doldur
            renderRecentActions(data.recent_actions);

        } catch (error) {
            showToast(`Dashboard verileri yüklenemedi: ${error.message}`, 'error');
            // Hata durumunda tablolara hata mesajı bas
            recentActionsBody.innerHTML = `<tr><td class="py-2 px-4 text-center text-red-500">Veri yüklenemedi.</td></tr>`;
        }
    };

    // Sayfa yüklendiğinde verileri çek
    await loadDashboardData();
});