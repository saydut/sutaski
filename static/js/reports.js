let detayliChart = null;
let baslangicTarihiSecici = null; // Flatpickr instance'ları
let bitisTarihiSecici = null;

// SİLİNDİ: updateChartThemes fonksiyonu buradan kaldırıldı.

function formatDateToYYYYMMDD(date) {
    if (!date) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}



// static/js/reports.js

async function pdfIndir() {
    // --- KONTROLÜ BURAYA EKLEYİN ---
    if (!navigator.onLine) {
        gosterMesaj("PDF raporu oluşturmak için internet bağlantısı gereklidir.", "warning");
        return;
    }
    // --- KONTROL SONU ---

    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const url = `/api/rapor/aylik_pdf?ay=${ay}&yil=${yil}`;
    
    await indirVeAc(url, 'pdf-indir-btn', {
        success: 'Rapor indirildi ve yeni sekmede açıldı.',
        error: 'PDF raporu oluşturulurken bir hata oluştu.'
    });
}


window.onload = function() {
    const birAyOnce = new Date();
    birAyOnce.setMonth(birAyOnce.getMonth() - 1);
    
    baslangicTarihiSecici = flatpickr("#baslangic-tarihi", {
        dateFormat: "d.m.Y",
        locale: "tr",
        defaultDate: birAyOnce
    });
    
    bitisTarihiSecici = flatpickr("#bitis-tarihi", {
        dateFormat: "d.m.Y",
        locale: "tr",
        defaultDate: "today"
    });

    ayYilSecicileriniDoldur('rapor-ay', 'rapor-yil');
    
    // --- DEĞİŞİKLİK BURADA ---
    // raporOlustur() fonksiyonunu çağırmadan önce 100 milisaniye bekliyoruz.
    // Bu, flatpickr gibi kütüphanelerin mobil cihazlarda tam olarak yüklenip hazır olması için zaman tanır.
    setTimeout(() => {
        raporOlustur();
    }, 100); 
};

function ozetVerileriniDoldur(summaryData) {
    document.getElementById('ozet-kartlari').style.display = 'flex';
    document.getElementById('ozet-toplam-litre').textContent = `${summaryData.totalLitre} L`;
    document.getElementById('ozet-gunluk-ortalama').textContent = `${summaryData.averageDailyLitre} L`;
    document.getElementById('ozet-girdi-sayisi').textContent = summaryData.entryCount;
    document.getElementById('ozet-gun-sayisi').textContent = summaryData.dayCount;
}

function tedarikciTablosunuDoldur(breakdownData) {
    const tabloBody = document.getElementById('tedarikci-dokum-tablosu');
    tabloBody.innerHTML = '';
    if (breakdownData.length === 0) {
        tabloBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Veri yok.</td></tr>';
        return;
    }
    breakdownData.forEach(item => {
        const row = `<tr><td>${item.name}</td><td>${item.litre}</td><td>${item.entryCount}</td></tr>`;
        tabloBody.innerHTML += row;
    });
}

async function raporOlustur() {
    const baslangicDate = baslangicTarihiSecici.selectedDates[0];
    const bitisDate = bitisTarihiSecici.selectedDates[0];

    const baslangic = formatDateToYYYYMMDD(baslangicDate);
    const bitis = formatDateToYYYYMMDD(bitisDate);
    
    const mesajElementi = document.getElementById('rapor-sonuc-mesaji');
    const grafikBaslik = document.getElementById('grafik-baslik');
    const ctx = document.getElementById('detayliRaporGrafigi').getContext('2d');
    
    document.getElementById('ozet-kartlari').style.display = 'none';
    document.getElementById('tedarikci-dokum-tablosu').innerHTML = '';

    if (!baslangic || !bitis) return;

    // --- DEĞİŞEN ÇEVRİMDIŞI KONTROLÜ BAŞLANGICI ---
    if (!navigator.onLine) {
        mesajElementi.innerHTML = '<div class="spinner-border" role="status"></div><p class="mt-2">Rapor oluşturuluyor...</p>';
        mesajElementi.style.display = 'block';
        if (detayliChart) {
            unregisterChart(detayliChart); // Yöneticinin listesinden kaldır
            detayliChart.destroy();       // Şimdi grafiği güvenle yok et
        }
        
        // Önbellekten veriyi çekmeyi dene
        const veri = await getCachedAnaPanelData('detayli_rapor');

        if (veri) {
            gosterMesaj("Çevrimdışı mod: Önbellekten yüklenen son rapor gösteriliyor.", "info");
            mesajElementi.style.display = 'none';
            // Raporu önbellekteki veriyle oluştur
            const formatliBaslangic = new Date(veri.summaryData.baslangicTarihi).toLocaleDateString('tr-TR');
            const formatliBitis = new Date(veri.summaryData.bitisTarihi).toLocaleDateString('tr-TR');
            grafikBaslik.textContent = `${formatliBaslangic} - ${formatliBitis} Arası Günlük Süt Toplama Raporu (Önbellek)`;

            ozetVerileriniDoldur(veri.summaryData);
            tedarikciTablosunuDoldur(veri.supplierBreakdown);
            
            detayliChart = new Chart(ctx, {
                type: 'line',
                data: veri.chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true },
                        x: {}
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (context) => ` Toplam: ${context.parsed.y} Litre` } }
                    }
                }
            });
            registerChart(detayliChart);
            if (typeof updateAllChartThemes === 'function') updateAllChartThemes();
        } else {
            mesajElementi.innerHTML = '<p class="text-warning">Çevrimdışı mod. Bu rapor için önbellekte veri bulunamadı.</p>';
        }
        return;
    }
    // --- DEĞİŞEN ÇEVRİMDIŞI KONTROLÜ SONU ---

    mesajElementi.innerHTML = '<div class="spinner-border" role="status"></div><p class="mt-2">Rapor oluşturuluyor...</p>';
    mesajElementi.style.display = 'block';
    if (detayliChart) detayliChart.destroy();
    
    try {
        const response = await fetch(`/api/rapor/detayli_rapor?baslangic=${baslangic}&bitis=${bitis}`);
        const veri = await response.json();

        if (!response.ok) throw new Error(veri.error || 'Rapor verisi alınamadı.');
        
        // --- YENİ EKLENEN ÖNBELLEĞE KAYDETME KODU ---
        // Veriyi sunucudan başarıyla çektikten sonra önbelleğe kaydediyoruz.
        // Tarih bilgisini de ekleyelim ki çevrimdışıyken başlığı doğru yazabilelim.
        veri.summaryData.baslangicTarihi = baslangicDate.toISOString();
        veri.summaryData.bitisTarihi = bitisDate.toISOString();
        await cacheAnaPanelData('detayli_rapor', veri);
        // --- ÖNBELLEĞE KAYDETME SONU ---
        
        if (veri.chartData.labels.length === 0) {
            mesajElementi.textContent = "Seçilen tarih aralığında veri bulunamadı.";
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            grafikBaslik.textContent = "Veri Yok";
            tedarikciTablosunuDoldur([]);
            return;
        }
        
        mesajElementi.style.display = 'none';

        const formatliBaslangic = baslangicDate.toLocaleDateString('tr-TR');
        const formatliBitis = bitisDate.toLocaleDateString('tr-TR');
        grafikBaslik.textContent = `${formatliBaslangic} - ${formatliBitis} Arası Günlük Süt Toplama Raporu`;
        
        ozetVerileriniDoldur(veri.summaryData);
        tedarikciTablosunuDoldur(veri.supplierBreakdown);
        
        detayliChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: veri.chartData.labels,
                datasets: [{
                    label: 'Toplanan Süt (Litre)',
                    data: veri.chartData.data,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true },
                    x: {}
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (context) => ` Toplam: ${context.parsed.y} Litre` } }
                }
            }
        });
        registerChart(detayliChart);

        if (typeof updateAllChartThemes === 'function') updateAllChartThemes();
    } catch (error) {
        console.error("Detaylı rapor oluşturulurken hata:", error);
        mesajElementi.textContent = `Hata: ${error.message}`;
    }
}