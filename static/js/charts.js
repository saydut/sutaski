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
            
            // --- HATA DÜZELTMESİ ---
            // Grafiği yok etmeden önce var olup olmadığını kontrol et
            if (this.haftalikChart) {
                this.haftalikChart.destroy();
                this.haftalikChart = null; // Referansı temizle
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
     * Son 30 günlük tedarikçi dağılımı grafiğini (doughnut) oluşturur.
     */
    async tedarikciGrafigiOlustur() {
        const veriYokMesaji = document.getElementById('tedarikci-veri-yok');
        const canvas = document.getElementById('tedarikciDagilimGrafigi');
        if (!canvas) return; // Canvas elementi yoksa işlemi durdur
        const ctx = canvas.getContext('2d');

        // --- HATA DÜZELTMESİ ---
        // Grafiği yok etmeden önce var olup olmadığını kontrol et
        if (this.tedarikciChart) {
            this.tedarikciChart.destroy();
            this.tedarikciChart = null; // Referansı temizle
        }
        
        canvas.style.display = 'none';
        veriYokMesaji.style.display = 'block';
        veriYokMesaji.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';

        try {
            const veri = await api.fetchTedarikciDagilimi();
            
            if (veri.labels.length === 0) {
                veriYokMesaji.textContent = 'Son 30 günde veri bulunamadı.';
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
            
            veriYokMesaji.style.display = 'none';
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
            veriYokMesaji.textContent = 'Grafik yüklenemedi.';
        }
    }
};

