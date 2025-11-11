// charts.js
// Ana paneldeki (index.html) grafikleri ve özetleri yükleyen script.
// RLS'e uyumlu yeni API rotalarıyla güncellendi.

// --- Global Chart Değişkenleri ---
let haftalikChart = null;
let tedarikciChart = null;

/**
 * Ana paneldeki "GÜNLÜK ÖZET" kartını (Toplam Litre, Girdi Sayısı)
 * RLS'e uyumlu API'dan yükler.
 * @param {string | null} tarih - 'YYYY-MM-DD' formatında. Boş bırakılırsa bugünü alır.
 */
async function loadDailySummary(tarih = null) {
    const litreElement = document.getElementById('gunluk-toplam-litre');
    const sayiElement = document.getElementById('gunluk-girdi-sayisi');
    const loaderElement = document.getElementById('gunluk-ozet-loader');

    if (!litreElement || !sayiElement || !loaderElement) return; // İlgili elementler yoksa çık
    
    loaderElement.style.display = 'block'; // Yükleniyor...

    try {
        let url = '/api/gunluk_ozet'; // Rota /api/rapor/ değil, /api/ (main.py)
        if (tarih) {
            url += `?tarih=${tarih}`;
        }
        
        // 'sirket_id' GÖNDERİLMEDİ (RLS halleder)
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const summary = await response.json();
        
        litreElement.textContent = (summary.toplam_litre || 0).toLocaleString('tr-TR') + " lt";
        sayiElement.textContent = (summary.girdi_sayisi || 0).toLocaleString('tr-TR');

    } catch (error) {
        console.error("Günlük özet yüklenirken hata:", error);
        litreElement.textContent = "Hata";
        sayiElement.textContent = "Hata";
    } finally {
        loaderElement.style.display = 'none'; // Yükleme bitti
    }
}

/**
 * Ana paneldeki "HAFTALIK SÜT GİRİŞİ" (Çizgi Grafik) verisini
 * RLS'e uyumlu API'dan yükler.
 */
async function loadWeeklyChart() {
    const ctx = document.getElementById('haftalikSutGirisiChart');
    if (!ctx) return; // Grafik canvas'ı yoksa çık
    
    const loader = document.getElementById('haftalik-chart-loader');
    if(loader) loader.style.display = 'block';

    try {
        // 'sirket_id' GÖNDERİLMEDİ (RLS halleder)
        const response = await fetch('/api/haftalik_ozet'); // Rota /api/rapor/ değil, /api/
        if (!response.ok) throw new Error('Haftalık veri alınamadı');
        
        const data = await response.json();
        
        if (haftalikChart) {
            haftalikChart.destroy(); // Önceki grafiği temizle
        }

        const labels = data.map(d => {
            const date = new Date(d.gun);
            return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
        });
        const values = data.map(d => d.toplam_litre);

        haftalikChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Toplam Litre',
                    data: values,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    } catch (error) {
        console.error("Haftalık grafik yüklenirken hata:", error);
    } finally {
        if(loader) loader.style.display = 'none';
    }
}

/**
 * Ana paneldeki "TEDARİKÇİ DAĞILIMI" (Pasta Grafik) verisini
 * RLS'e uyumlu API'dan yükler.
 */
async function loadSupplierChart() {
    const ctx = document.getElementById('tedarikciDagilimiChart');
    if (!ctx) return; // Grafik canvas'ı yoksa çık

    const loader = document.getElementById('tedarikci-chart-loader');
    if(loader) loader.style.display = 'block';

    try {
        // 'sirket_id' GÖNDERİLMEDİ (RLS halleder)
        const response = await fetch('/api/tedarikci_dagilimi'); // Rota /api/rapor/ değil, /api/
        if (!response.ok) throw new Error('Tedarikçi dağılımı alınamadı');
        
        const data = await response.json();
        
        if (tedarikciChart) {
            tedarikciChart.destroy(); // Önceki grafiği temizle
        }

        if (data.labels.length === 0) {
            document.getElementById('tedarikci-chart-container').innerHTML = 
                '<p class="text-center text-muted">Son 7 günde veri bulunamadı.</p>';
            return;
        }

        tedarikciChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Litre',
                    data: data.data,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)',
                        'rgba(255, 159, 64, 0.8)'
                    ],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        align: 'start',
                        labels: {
                            boxWidth: 20
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error("Tedarikçi grafiği yüklenirken hata:", error);
    } finally {
        if(loader) loader.style.display = 'none';
    }
}

// index.html yüklendiğinde bu fonksiyonlar çağrılır
document.addEventListener('DOMContentLoaded', () => {
    // Sadece ana paneldeysek (index.html) bu fonksiyonları çağır
    // 'kullaniciRolu' main.js'de tanımlanır
    if (window.location.pathname === '/panel' && window.kullaniciRolu && window.kullaniciRolu !== 'ciftci') {
        loadDailySummary();
        loadWeeklyChart();
        loadSupplierChart();
    }
});