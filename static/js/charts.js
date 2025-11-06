// ====================================================================================
// GRAFİK YÖNETİMİ (charts.js)
// Bu dosya, Chart.js kütüphanesi ile ilgili tüm işlemleri içerir.
// Gerekli veriyi api.js üzerinden çeker ve grafikleri oluşturur/günceller.
// ====================================================================================

const charts = {
    haftalikChart: null,
    tedarikciChart: null,

    /**
     * Son 7 günlük süt toplama grafiğini oluşturur.
     */
    async haftalikGrafigiOlustur() {
        try {
            const veri = await api.fetchHaftalikOzet();
            const canvas = document.getElementById('haftalikRaporGrafigi');
            if (!canvas) return; // Canvas elementi yoksa işlemi durdur
            const ctx = canvas.getContext('2d');
            
            if (this.haftalikChart) {
                unregisterChart(this.haftalikChart);
                this.haftalikChart.destroy();
                this.haftalikChart = null; 
            }

            this.haftalikChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: veri.labels,
                    datasets: [{
                        label: 'Toplanan Süt (Litre)',
                        data: veri.data,
                        borderWidth: 1,
                        borderRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true },
                        x: { grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (c) => ` Toplam: ${c.parsed.y} Litre` } }
                    }
                }
            });

            registerChart(this.haftalikChart); 
            if (typeof updateAllChartThemes === 'function') {
                updateAllChartThemes();
            }

        } catch (error) {
            console.error("Haftalık grafik oluşturulurken hata:", error.message);
        }
    },


    /**
     * Tedarikçi dağılımı grafiğini (doughnut) oluşturur.
     * YENİ: Opsiyonel 'period' parametresi alır.
     */
    async tedarikciGrafigiOlustur(period = 'monthly') { // Varsayılan 'monthly'
        const veriYokMesaji = document.getElementById('tedarikci-veri-yok');
        const canvas = document.getElementById('tedarikciDagilimGrafigi');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        if (this.tedarikciChart) {
            unregisterChart(this.tedarikciChart);
            this.tedarikciChart.destroy();
            this.tedarikciChart = null;
        }
        
        canvas.style.display = 'none';
        if (veriYokMesaji) {
            veriYokMesaji.style.display = 'block';
            veriYokMesaji.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';
        }

        try {
            // YENİ: API'yi 'period' parametresi ile çağır
            const veri = await api.fetchTedarikciDagilimi(period);
            
            if (veri.labels.length === 0) {
                let mesaj = 'Veri bulunamadı.';
                if(period === 'daily') mesaj = 'Son 24 saatte veri yok.';
                else if(period === 'weekly') mesaj = 'Son 7 günde veri yok.';
                else if(period === 'monthly') mesaj = 'Son 30 günde veri yok.';
                
                if (veriYokMesaji) veriYokMesaji.textContent = mesaj;
                return;
            }

            const GRAFIKTE_GOSTERILECEK_SAYI = 9;
            let islenmisVeri = { labels: veri.labels, data: veri.data };

            if (veri.labels.length > GRAFIKTE_GOSTERILECEK_SAYI + 1) {
                const digerleriToplami = veri.data.slice(GRAFIKTE_GOSTERILECEK_SAYI).reduce((a, b) => a + b, 0);
                islenmisVeri.labels = veri.labels.slice(0, GRAFIKTE_GOSTERILECEK_SAYI);
                islenmisVeri.labels.push('Diğerleri');
                islenmisVeri.data = veri.data.slice(0, GRAFIKTE_GOSTERILECEK_SAYI);
                islenmisVeri.data.push(digerleriToplami);
            }
            
            if (veriYokMesaji) veriYokMesaji.style.display = 'none';
            canvas.style.display = 'block';

            this.tedarikciChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: islenmisVeri.labels,
                    datasets: [{
                        label: 'Litre',
                        data: islenmisVeri.data,
                        backgroundColor: [
                            '#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#6366F1', 
                            '#8B5CF6', '#EC4899', '#F97316', '#06B6D4', '#64748B'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: { font: { size: 12 } }
                        }
                    }
                }
            });

            registerChart(this.tedarikciChart); 
            if (typeof updateAllChartThemes === 'function') {
                updateAllChartThemes();
            }

        } catch (error) {
            console.error("Tedarikçi grafiği oluşturulurken hata:", error.message);
            if (veriYokMesaji) veriYokMesaji.textContent = 'Grafik yüklenemedi.';
        }
    }
};

// YENİ: Butonları dinlemek için DOMContentLoaded olayı
// Bu kod, 'charts' objesini global yaptığı için 'reports.js' içinden de erişilebilir.
document.addEventListener('DOMContentLoaded', function() {
    const filtreGrubu = document.getElementById('tedarikci-filtre-grup');
    
    if (filtreGrubu) {
        // Butonlara tıklama olayı ekle
        filtreGrubu.addEventListener('change', (event) => {
            if (event.target.name === 'tedarikci-periyot') {
                const secilenPeriyot = event.target.value; // 'daily', 'weekly', 'monthly'
                charts.tedarikciGrafigiOlustur(secilenPeriyot);
            }
        });
    }
});