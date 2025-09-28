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
            const ctx = document.getElementById('haftalikRaporGrafigi').getContext('2d');
            
            if (this.haftalikChart) {
                this.haftalikChart.destroy();
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

            // Oluşturulan grafiği merkezi yöneticiye kaydet
            registerChart(this.haftalikChart);
            
            // Temanın anında uygulanması için güncelleme fonksiyonunu çağır
            if (typeof updateAllChartThemes === 'function') {
                updateAllChartThemes();
            }

        } catch (error) {
            console.error("Haftalık grafik oluşturulurken hata:", error.message);
            // İsteğe bağlı: Grafik alanında bir hata mesajı gösterilebilir.
        }
    },

    /**
     * Son 30 günlük tedarikçi dağılımı grafiğini (doughnut) oluşturur.
     */
    async tedarikciGrafigiOlustur() {
        const veriYokMesaji = document.getElementById('tedarikci-veri-yok');
        try {
            const veri = await api.fetchTedarikciDagilimi();
            const ctx = document.getElementById('tedarikciDagilimGrafigi').getContext('2d');
            
            if (this.tedarikciChart) {
                this.tedarikciChart.destroy();
            }
            
            if (veri.labels.length === 0) {
                veriYokMesaji.style.display = 'block';
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                return;
            }
            
            veriYokMesaji.style.display = 'none';

            this.tedarikciChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: veri.labels,
                    datasets: [{
                        label: 'Litre',
                        data: veri.data,
                        backgroundColor: ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)'],
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
            veriYokMesaji.textContent = 'Grafik yüklenemedi.';
            veriYokMesaji.style.display = 'block';
        }
    }
};
