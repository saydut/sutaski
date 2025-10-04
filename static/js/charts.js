// ====================================================================================
// GRAFİK YÖNETİMİ (charts.js) - ÇEVRİMDIŞI ÖNBELLEKLEME DESTEKLİ
// Bu dosya, Chart.js kütüphanesi ile ilgili tüm işlemleri içerir.
// Gerekli veriyi api.js üzerinden çeker ve grafikleri oluşturur/günceller.
// Çevrimdışı olduğunda offline.js üzerinden önbelleklenmiş veriyi kullanır.
// ====================================================================================

const charts = {
    haftalikChart: null,
    tedarikciChart: null,

    /**
     * Son 7 günlük süt toplama grafiğini oluşturur.
     * Çevrimdışı ise önbellekteki veriyi kullanır.
     */
    async haftalikGrafigiOlustur() {
        try {
            let veri;
            if (navigator.onLine) {
                veri = await api.fetchHaftalikOzet();
                await cacheAnaPanelData('haftalikOzet', veri); // Veriyi önbelleğe al
            } else {
                veri = await getCachedAnaPanelData('haftalikOzet'); // Önbellekten çek
                if (!veri) {
                    console.warn("Haftalık özet için önbellekte veri yok.");
                    // İsteğe bağlı: Grafik alanında bir mesaj gösterilebilir.
                    const ctx = document.getElementById('haftalikRaporGrafigi');
                    if(ctx) ctx.getContext('2d').clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                    return;
                }
            }

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
     * Çevrimdışı ise önbellekteki veriyi kullanır.
     */
    async tedarikciGrafigiOlustur() {
        const veriYokMesaji = document.getElementById('tedarikci-veri-yok');
        const canvas = document.getElementById('tedarikciDagilimGrafigi');
        const ctx = canvas.getContext('2d');

        if (this.tedarikciChart) { this.tedarikciChart.destroy(); }
        canvas.style.display = 'none';
        veriYokMesaji.style.display = 'block';
        veriYokMesaji.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';

        try {
            let veri;
            if (navigator.onLine) {
                veri = await api.fetchTedarikciDagilimi();
                await cacheAnaPanelData('tedarikciDagilim', veri); // Veriyi önbelleğe al
            } else {
                veri = await getCachedAnaPanelData('tedarikciDagilim'); // Önbellekten çek
                if (!veri) {
                    veriYokMesaji.textContent = 'Önbellekte veri bulunamadı.';
                    return;
                }
            }
            
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
                        backgroundColor: ['#3B82F6', '#EF4444', '#F59E0B', '#10B981', '#6366F1', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4', '#64748B'],
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