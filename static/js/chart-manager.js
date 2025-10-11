// static/js/chart-manager.js

// Sayfadaki tüm aktif Chart.js instance'larını tutacak olan dizi
let registeredCharts = []; // GÜNCELLENDİ: const'tan let'e çevrildi ki yeniden atanabilsin.

/**
 * Yeni oluşturulan bir chart'ı yönetim listesine ekler.
 * @param {Chart} chartInstance - new Chart() ile oluşturulmuş nesne.
 */
function registerChart(chartInstance) {
    if (chartInstance) {
        registeredCharts.push(chartInstance);
    }
}

/**
 * Bir chart'ı yönetim listesinden kaldırır.
 * Bu fonksiyon, bir chart .destroy() edilmeden hemen önce çağrılmalıdır.
 * @param {Chart} chartInstance - Kaldırılacak chart nesnesi.
 */
function unregisterChart(chartInstance) {
    if (!chartInstance) return;
    // Grafiği, ID'sine göre listeden filtreleyerek kaldırıyoruz.
    registeredCharts = registeredCharts.filter(chart => chart.id !== chartInstance.id);
}

/**
 * Kayıtlı tüm chart'ların temasını (renkler, çizgiler vb.) günceller.
 * Bu fonksiyon, tema değiştirildiğinde `theme.js` tarafından çağrılır.
 */
function updateAllChartThemes() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#E2E8F0' : '#333333';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const legendColor = isDark ? '#E2E8F0' : '#333333';
    const borderColor = isDark ? '#1E293B' : '#FFFFFF';
    
    // Grafik tiplerine özel renkler
    const barBgColor = isDark ? 'rgba(76, 125, 255, 0.8)' : 'rgba(74, 144, 226, 0.8)';
    const barBorderColor = isDark ? 'rgba(76, 125, 255, 1)' : 'rgba(74, 144, 226, 1)';
    const lineBgColor = isDark ? 'rgba(76, 125, 255, 0.3)' : 'rgba(74, 144, 226, 0.3)';
    const lineBorderColor = isDark ? 'rgba(76, 125, 255, 1)' : 'rgba(74, 144, 226, 1)';

    registeredCharts.forEach(chart => {
        if (!chart) return; // Ekstra güvenlik kontrolü
        // Genel ayarlar
        if (chart.options.scales.y) chart.options.scales.y.ticks.color = textColor;
        if (chart.options.scales.x) chart.options.scales.x.ticks.color = textColor;
        if (chart.options.scales.y) chart.options.scales.y.grid.color = gridColor;
        if (chart.options.plugins.legend) chart.options.plugins.legend.labels.color = legendColor;

        // Grafik tipine özel ayarlar
        const chartType = chart.config.type;
        const dataset = chart.data.datasets[0];

        if (chartType === 'bar') {
            dataset.backgroundColor = barBgColor;
            dataset.borderColor = barBorderColor;
        } else if (chartType === 'line') {
            dataset.backgroundColor = lineBgColor;
            dataset.borderColor = lineBorderColor;
        } else if (chartType === 'doughnut') {
            dataset.borderColor = borderColor;
        }
        
        chart.update();
    });
}
