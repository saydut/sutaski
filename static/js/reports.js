let detayliChart = null;
let baslangicTarihiSecici = null; // Flatpickr instance'ları
let bitisTarihiSecici = null;

// SİLİNDİ: updateChartThemes fonksiyonu buradan kaldırıldı.

function formatDateToYYYYMMDD(date) {
    if (!date) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function ayYilSecicileriniDoldur() {
    const aySecici = document.getElementById('rapor-ay');
    const yilSecici = document.getElementById('rapor-yil');
    const aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const simdikiTarih = new Date();
    const simdikiYil = simdikiTarih.getFullYear();
    const simdikiAy = simdikiTarih.getMonth();

    aylar.forEach((ay, index) => { aySecici.add(new Option(ay, index + 1)); });
    aySecici.value = simdikiAy + 1;

    for (let i = 0; i < 5; i++) {
        yilSecici.add(new Option(simdikiYil - i, simdikiYil - i));
    }
}

// static/js/reports.js

async function pdfIndir() {
    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const button = document.getElementById('pdf-indir-btn');
    const originalContent = button.innerHTML;

    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm"></span> İşleniyor...`;

    try {
        // 1. PDF dosyasını arka planda BİR KEZ talep ediyoruz.
        const response = await fetch(`/api/rapor/aylik_pdf?ay=${ay}&yil=${yil}`);

        if (!response.ok) {
            throw new Error('PDF raporu oluşturulurken bir hata oluştu.');
        }

        // 2. Sunucunun gönderdiği dosya adını alıyoruz.
        const disposition = response.headers.get('Content-Disposition');
        let filename = `rapor.pdf`; // Varsayılan
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        // 3. Gelen veriyi bir 'blob' nesnesine çeviriyoruz.
        const blob = await response.blob();

        // 4. Bu blob için geçici bir URL oluşturuyoruz. Bu URL'yi her iki işlem için de kullanacağız.
        const url = window.URL.createObjectURL(blob);

        // --- İŞLEM 1: YENİ SEKMEDE AÇMA ---
        window.open(url, '_blank');

        // --- İŞLEM 2: DOSYAYI İNDİRME ---
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename; // İndirilecek dosyanın adını belirliyoruz.
        document.body.appendChild(a);
        a.click();
        a.remove(); // Linki temizliyoruz.

        // 5. İşlemler bittikten sonra geçici URL'i bellekten siliyoruz.
        setTimeout(() => window.URL.revokeObjectURL(url), 100);

        // 6. Kullanıcıya bildirim veriyoruz.
        gosterMesaj("Rapor indirildi ve yeni sekmede açıldı.", "success");

    } catch (error) {
        console.error("PDF işlenirken hata:", error);
        gosterMesaj(error.message, "danger");
    } finally {
        // 7. Butonu eski haline getiriyoruz.
        button.disabled = false;
        button.innerHTML = originalContent;
    }
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

    ayYilSecicileriniDoldur();
    
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

    mesajElementi.innerHTML = '<div class="spinner-border" role="status"></div><p class="mt-2">Rapor oluşturuluyor...</p>';
    mesajElementi.style.display = 'block';
    if (detayliChart) detayliChart.destroy();
    
    try {
        const response = await fetch(`/api/rapor/detayli_rapor?baslangic=${baslangic}&bitis=${bitis}`);
        const veri = await response.json();

        if (!response.ok) throw new Error(veri.error || 'Rapor verisi alınamadı.');
        
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
        
        // DEĞİŞİKLİK: Chart'ı oluşturduktan sonra yöneticiye kaydet
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