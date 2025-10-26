// static/js/reports.js

let detayliChart = null;
let baslangicTarihiSecici = null; // Flatpickr instance'ları
let bitisTarihiSecici = null;

function formatDateToYYYYMMDD(date) {
    if (!date) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function pdfIndir() {
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
        dateFormat: "d.m.Y", // Kullanıcıya gösterilecek format
        altInput: true,     // Kullanıcıya gösterilecek alternatif input
        altFormat: "d.m.Y", // Alternatif input formatı
        locale: "tr",
        defaultDate: birAyOnce,
        onChange: function(selectedDates, dateStr, instance) {
            // Başlangıç tarihi değiştiğinde bitiş tarihinin minimumunu ayarla
            if (bitisTarihiSecici && selectedDates.length > 0) {
                bitisTarihiSecici.set('minDate', selectedDates[0]);
            }
        }
    });

    bitisTarihiSecici = flatpickr("#bitis-tarihi", {
        dateFormat: "d.m.Y", // Kullanıcıya gösterilecek format
        altInput: true,     // Kullanıcıya gösterilecek alternatif input
        altFormat: "d.m.Y", // Alternatif input formatı
        locale: "tr",
        defaultDate: "today",
        minDate: birAyOnce // Başlangıçta minimum tarihi ayarla
    });


    ayYilSecicileriniDoldur('rapor-ay', 'rapor-yil');

    // --- YENİ EKLENEN GRAFİK ÇAĞRILARI ---
    // Ana panelden taşınan haftalık ve tedarikçi dağılımı grafiklerini oluştur.
    // charts objesinin charts.js'den geldiğini varsayıyoruz (base.html'de yüklü)
    if (typeof charts !== 'undefined') {
        charts.haftalikGrafigiOlustur();
        charts.tedarikciGrafigiOlustur();
    } else {
        console.error("charts objesi bulunamadı. charts.js'in yüklendiğinden emin olun.");
    }
    // --- GRAFİK ÇAĞRILARI SONU ---

    // Detaylı raporu başlangıçta oluşturmak için flatpickr'ın hazır olmasını bekle
    setTimeout(() => {
        raporOlustur(); // Detaylı rapor grafiğini oluşturur
    }, 100);
};

function ozetVerileriniDoldur(summaryData) {
    document.getElementById('ozet-kartlari').style.display = 'flex';
    document.getElementById('ozet-toplam-litre').textContent = `${summaryData.totalLitre.toFixed(2)} L`; // toFixed(2) eklendi
    document.getElementById('ozet-gunluk-ortalama').textContent = `${summaryData.averageDailyLitre.toFixed(2)} L`; // toFixed(2) eklendi
    document.getElementById('ozet-girdi-sayisi').textContent = summaryData.entryCount;
    document.getElementById('ozet-gun-sayisi').textContent = summaryData.dayCount;
}

function tedarikciTablosunuDoldur(breakdownData) {
    const tabloBody = document.getElementById('tedarikci-dokum-tablosu');
    tabloBody.innerHTML = '';
    if (!breakdownData || breakdownData.length === 0) { // breakdownData null kontrolü eklendi
        tabloBody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Veri yok.</td></tr>';
        return;
    }
    breakdownData.forEach(item => {
        // Litre değerini formatla
        const litreFormatted = parseFloat(item.litre).toFixed(2);
        const row = `<tr><td>${utils.sanitizeHTML(item.name)}</td><td>${litreFormatted}</td><td>${item.entryCount}</td></tr>`;
        tabloBody.innerHTML += row;
    });
}

async function raporOlustur() {
    const baslangicDate = baslangicTarihiSecici.selectedDates[0];
    const bitisDate = bitisTarihiSecici.selectedDates[0];

    // YENİ: Tarih seçicilerin backend'e göndereceği YYYY-MM-DD formatını düzeltelim
    const baslangic = baslangicDate ? formatDateToYYYYMMDD(baslangicDate) : null;
    const bitis = bitisDate ? formatDateToYYYYMMDD(bitisDate) : null;

    const mesajElementi = document.getElementById('rapor-sonuc-mesaji');
    const grafikBaslik = document.getElementById('grafik-baslik');
    const canvas = document.getElementById('detayliRaporGrafigi'); // Canvas elementini al
    if (!canvas) return; // Canvas yoksa çık
    const ctx = canvas.getContext('2d');

    document.getElementById('ozet-kartlari').style.display = 'none';
    document.getElementById('tedarikci-dokum-tablosu').innerHTML = '';

    if (!baslangic || !bitis) {
        mesajElementi.textContent = "Lütfen geçerli bir başlangıç ve bitiş tarihi seçin.";
        mesajElementi.style.display = 'block';
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Grafiği temizle
        if (detayliChart) {
            unregisterChart(detayliChart);
            detayliChart.destroy();
            detayliChart = null;
        }
        return;
    }

    if (!navigator.onLine) {
        mesajElementi.innerHTML = '<p class="text-warning">Rapor oluşturmak için internet bağlantısı gereklidir.</p>';
        mesajElementi.style.display = 'block';
        if (detayliChart) {
            unregisterChart(detayliChart);
            detayliChart.destroy();
            detayliChart = null;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    mesajElementi.innerHTML = '<div class="spinner-border" role="status"></div><p class="mt-2">Rapor oluşturuluyor...</p>';
    mesajElementi.style.display = 'block';

    if (detayliChart) {
        unregisterChart(detayliChart);
        detayliChart.destroy();
        detayliChart = null;
    }

    try {
        const veri = await api.request(`/api/rapor/detayli_rapor?baslangic=${baslangic}&bitis=${bitis}`); // api.js kullandığımızı varsayıyoruz

        if (!veri || !veri.chartData || veri.chartData.labels.length === 0) {
            mesajElementi.textContent = "Seçilen tarih aralığında veri bulunamadı.";
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            grafikBaslik.textContent = "Veri Yok";
            tedarikciTablosunuDoldur([]); // Boş tablo göster
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
        registerChart(detayliChart); // Yeni grafiği kaydet.

        if (typeof updateAllChartThemes === 'function') updateAllChartThemes();
    } catch (error) {
        console.error("Detaylı rapor oluşturulurken hata:", error);
        mesajElementi.textContent = `Hata: ${error.message}`;
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Hata durumunda grafiği temizle
    }
}