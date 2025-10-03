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
        const canvas = document.getElementById('tedarikciDagilimGrafigi');
        const ctx = canvas.getContext('2d');

        // Adım 1: Önceki grafiği temizle ve "Yükleniyor..." durumunu ayarla
        if (this.tedarikciChart) {
            this.tedarikciChart.destroy();
        }
        canvas.style.display = 'none'; // Canvas'ı (grafik alanı) tamamen gizle
        veriYokMesaji.style.display = 'block'; // Mesaj/yükleniyor alanını göster
        veriYokMesaji.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>'; // İçine spinner koy

        try {
            const veri = await api.fetchTedarikciDagilimi();
            
            if (veri.labels.length === 0) {
                veriYokMesaji.textContent = 'Son 30 günde veri bulunamadı.';
                return; // Canvas gizli kalacak, sadece bu yazı görünecek.
            }

            // Adım 2: Veriyi işle (Çok fazla tedarikçiyi "Diğerleri" altında grupla)
            const GRAFIKTE_GOSTERILECEK_SAYI = 9; // En büyük 9 dilimi göster
            let islenmisVeri = {
                labels: veri.labels,
                data: veri.data
            };

            // Eğer gösterilecek sayıdan daha fazla tedarikçi varsa gruplama yap
            if (veri.labels.length > GRAFIKTE_GOSTERILECEK_SAYI + 1) {
                const digerleriToplami = veri.data.slice(GRAFIKTE_GOSTERILECEK_SAYI).reduce((a, b) => a + b, 0);
                
                islenmisVeri.labels = veri.labels.slice(0, GRAFIKTE_GOSTERILECEK_SAYI);
                islenmisVeri.labels.push('Diğerleri'); // Yeni bir etiket ekle
                
                islenmisVeri.data = veri.data.slice(0, GRAFIKTE_GOSTERILECEK_SAYI);
                islenmisVeri.data.push(digerleriToplami); // Diğerlerinin toplamını ekle
            }
            
            // Adım 3: Grafiği oluştur ve göster
            veriYokMesaji.style.display = 'none'; // Yükleniyor alanını gizle
            canvas.style.display = 'block'; // Grafik alanını göster

            this.tedarikciChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: islenmisVeri.labels, // İşlenmiş etiketleri kullan
                    datasets: [{
                        label: 'Litre',
                        data: islenmisVeri.data, // İşlenmiş veriyi kullan
                        backgroundColor: [ // Daha canlı ve ayırt edici bir renk paleti
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
            veriYokMesaji.textContent = 'Grafik yüklenemedi.'; // Hata mesajını ayarla
        }
    }
};
