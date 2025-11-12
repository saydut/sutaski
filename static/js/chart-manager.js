// Bu script, index.html (Anasayfa) için Chart.js grafiklerini oluşturur.
// main.js tarafından çağrılır.

(function() {
    // Grafik instancelarını sakla ki tekrar çizim gerektiğinde (örn: tema değişimi) eskisi silinebilsin
    let dailyMilkChartInstance = null;
    let supplierPieChartInstance = null;

    // Koyu tema (dark mode) için renk ayarları
    const getChartColors = () => {
        const isDarkMode = document.documentElement.classList.contains('dark');
        return {
            gridColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            labelColor: isDarkMode ? '#E5E7EB' : '#374151', // text-gray-200 veya text-gray-700
            primaryColor: 'rgb(59, 130, 246)', // Tailwind 'blue-500'
            primaryBg: 'rgba(59, 130, 246, 0.2)'
        };
    };

    /**
     * Günlük Süt Toplama (Line) Grafiğini çizer.
     * @param {object} chartData - { labels: ['Tarih1', ...], values: [100, ...] }
     */
    const createDailyMilkChart = (chartData) => {
        const ctx = document.getElementById('dailyMilkChart');
        if (!ctx) return; // Canvas bulunamadı

        const colors = getChartColors();
        
        // Eğer varsa eski grafiği yok et
        if (dailyMilkChartInstance) {
            dailyMilkChartInstance.destroy();
        }

        dailyMilkChartInstance = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: chartData.labels, // ['01.10', '02.10', ...]
                datasets: [{
                    label: 'Toplam Süt (Litre)',
                    data: chartData.values, // [120, 150, ...]
                    borderColor: colors.primaryColor,
                    backgroundColor: colors.primaryBg,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: colors.labelColor },
                        grid: { color: colors.gridColor }
                    },
                    x: {
                        ticks: { color: colors.labelColor },
                        grid: { color: colors.gridColor }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: colors.labelColor }
                    }
                }
            }
        });
    };

    /**
     * Tedarikçi Dağılımı (Pie/Doughnut) Grafiğini çizer.
     * @param {object} chartData - { labels: ['Ahmet', ...], values: [500, ...] }
     */
    const createSupplierPieChart = (chartData) => {
        const ctx = document.getElementById('supplierDistributionChart');
        if (!ctx) return;

        const colors = getChartColors();

        if (supplierPieChartInstance) {
            supplierPieChartInstance.destroy();
        }

        supplierPieChartInstance = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: chartData.labels, // ['Ahmet Yılmaz', 'Mehmet Kaya', ...]
                datasets: [{
                    label: 'Süt Dağılımı',
                    data: chartData.values, // [3500, 2800, ...]
                    backgroundColor: [
                        'rgb(59, 130, 246)',  // blue-500
                        'rgb(16, 185, 129)',  // green-500
                        'rgb(234, 179, 8)',   // yellow-500
                        'rgb(168, 85, 247)',  // purple-500
                        'rgb(239, 68, 68)'    // red-500
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: colors.labelColor }
                    }
                }
            }
        });
    };

    // Fonksiyonları global 'window' objesine ekle ki main.js erişebilsin
    window.ChartManager = {
        createDailyMilkChart,
        createSupplierPieChart
    };
    
    // Tema değişikliğini dinle ve grafikleri yeniden çiz
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            // Renklerin güncellenmesi için küçük bir gecikme
            setTimeout(() => {
                if (dailyMilkChartInstance) dailyMilkChartInstance.update();
                if (supplierPieChartInstance) supplierPieChartInstance.update();
            }, 100); 
            // Not: Daha karmaşık renk değişiklikleri için destroy() ve yeniden create() gerekebilir,
            // ancak Chart.js 3+ genelde renkleri dinamik olarak alabilir.
            // Şimdilik sadece renkleri güncellemeyi deneyelim.
            // Eğer renkler (grid, label) değişmezse, destroy/create metoduna dönmeliyiz.
        });
    }

})();