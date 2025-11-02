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

// --- Süt Raporu Yardımcı Fonksiyonları (Mevcut) ---
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
// --- Süt Raporu Yardımcı Fonksiyonları Sonu ---


// --- YENİ: Kârlılık Raporu Yardımcı Fonksiyonları ---

/**
 * Kârlılık kartlarındaki sayıları (TL) formatlar ve doldurur.
 * @param {object} data - API'den gelen kârlılık verisi.
 */
function karlilikKartlariniDoldur(data) {
    const formatla = (val) => `${parseFloat(val).toFixed(2)} TL`;
    
    document.getElementById('karlilik-toplam-gelir').textContent = formatla(data.toplam_gelir);
    document.getElementById('karlilik-toplam-gider').textContent = formatla(data.toplam_gider);
    document.getElementById('karlilik-net-kar').textContent = formatla(data.net_kar);
    
    // Net kâr/zarar durumuna göre renk ayarı
    const netKarElementi = document.getElementById('karlilik-net-kar');
    const netKarDeger = parseFloat(data.net_kar);
    netKarElementi.classList.remove('text-success', 'text-danger', 'text-primary');
    if (netKarDeger > 0) {
        netKarElementi.classList.add('text-success'); // Kâr
    } else if (netKarDeger < 0) {
        netKarElementi.classList.add('text-danger'); // Zarar
    } else {
        netKarElementi.classList.add('text-primary'); // Nötr
    }

    // Detay kartları
    document.getElementById('karlilik-sut-geliri').textContent = formatla(data.toplam_sut_geliri);
    document.getElementById('karlilik-tahsilat-geliri').textContent = formatla(data.toplam_finans_tahsilati);
    document.getElementById('karlilik-yem-gideri').textContent = formatla(data.toplam_yem_gideri);
    document.getElementById('karlilik-finans-gideri').textContent = formatla(data.toplam_finans_odemesi);
    document.getElementById('karlilik-genel-masraf').textContent = formatla(data.toplam_genel_masraf);
}

/**
 * Kârlılık raporu verilerini çeker ve kartları doldurur.
 */
async function karlilikRaporuOlustur(baslangic, bitis) {
    // Sadece firma yetkilisi veya admin bu raporu görebilir
    const kullaniciRolu = document.body.dataset.userRole;
    if (kullaniciRolu !== 'admin' && kullaniciRolu !== 'firma_yetkilisi') {
        return; // Yetkisi yoksa hiçbir şey yapma
    }

    const container = document.getElementById('karlilik-raporu-container');
    const mesajElementi = document.getElementById('karlilik-sonuc-mesaji');
    const kartlarElementi = document.getElementById('karlilik-kartlari');
    const tarihAraligiSpan = document.getElementById('karlilik-tarih-araligi');

    if (!container || !mesajElementi || !kartlarElementi || !tarihAraligiSpan) return;

    container.style.display = 'block'; // Ana kartı görünür yap
    kartlarElementi.style.display = 'none'; // Veri kartlarını gizle
    mesajElementi.style.display = 'block'; // Yükleniyor mesajını göster
    mesajElementi.innerHTML = '<div class="spinner-border" role="status"></div><p class="mt-2">Kârlılık analizi hesaplanıyor...</p>';

    // Tarih başlığını ayarla
    const formatliBaslangic = baslangicTarihiSecici.selectedDates[0].toLocaleDateString('tr-TR');
    const formatliBitis = bitisTarihiSecici.selectedDates[0].toLocaleDateString('tr-TR');
    tarihAraligiSpan.textContent = `${formatliBaslangic} - ${formatliBitis}`;
    
    try {
        const veri = await api.fetchKarlilikRaporu(baslangic, bitis);
        
        if (!veri) {
            throw new Error("Kârlılık verisi alınamadı.");
        }
        
        karlilikKartlariniDoldur(veri);
        mesajElementi.style.display = 'none'; // Yükleniyor'u gizle
        kartlarElementi.style.display = 'block'; // Kartları göster

    } catch (error) {
        console.error("Kârlılık raporu oluşturulurken hata:", error);
        mesajElementi.textContent = `Hata: ${error.message}`;
        kartlarElementi.style.display = 'none';
    }
}
// --- YENİ Fonksiyonlar Sonu ---


/**
 * Detaylı Süt Raporunu (Grafik ve Döküm) oluşturur.
 * (Mevcut 'raporOlustur' fonksiyonunun mantığı buraya taşındı)
 */
async function sutRaporuOlustur(baslangic, bitis) {
    const mesajElementi = document.getElementById('rapor-sonuc-mesaji');
    const grafikBaslik = document.getElementById('grafik-baslik');
    const canvas = document.getElementById('detayliRaporGrafigi');
    if (!canvas || !mesajElementi || !grafikBaslik) return;
    const ctx = canvas.getContext('2d');

    // Önceki raporun kalıntılarını temizle
    document.getElementById('ozet-kartlari').style.display = 'none';
    document.getElementById('tedarikci-dokum-tablosu').innerHTML = '';
    
    mesajElementi.innerHTML = '<div class="spinner-border" role="status"></div><p class="mt-2">Süt raporu oluşturuluyor...</p>';
    mesajElementi.style.display = 'block';

    if (detayliChart) {
        unregisterChart(detayliChart);
        detayliChart.destroy();
        detayliChart = null;
    }

    try {
        const veri = await api.request(`/api/rapor/detayli_rapor?baslangic=${baslangic}&bitis=${bitis}`); 

        if (!veri || !veri.chartData || veri.chartData.labels.length === 0) {
            mesajElementi.textContent = "Seçilen tarih aralığında süt verisi bulunamadı.";
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            grafikBaslik.textContent = "Veri Yok";
            tedarikciTablosunuDoldur([]);
            return;
        }

        mesajElementi.style.display = 'none';

        const formatliBaslangic = baslangicTarihiSecici.selectedDates[0].toLocaleDateString('tr-TR');
        const formatliBitis = bitisTarihiSecici.selectedDates[0].toLocaleDateString('tr-TR');
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
        console.error("Detaylı süt raporu oluşturulurken hata:", error);
        mesajElementi.textContent = `Süt Raporu Hatası: ${error.message}`;
        ctx.clearRect(0, 0, canvas.width, canvas.height); 
    }
}


/**
 * Ana Rapor Oluşturma Fonksiyonu
 * Hem Süt Raporunu hem de Kârlılık Raporunu tetikler.
 */
async function raporOlustur() {
    const baslangicDate = baslangicTarihiSecici.selectedDates[0];
    const bitisDate = bitisTarihiSecici.selectedDates[0];

    const baslangic = baslangicDate ? formatDateToYYYYMMDD(baslangicDate) : null;
    const bitis = bitisDate ? formatDateToYYYYMMDD(bitisDate) : null;

    // Süt raporu için elementler (hata mesajı için)
    const mesajElementi = document.getElementById('rapor-sonuc-mesaji');
    const canvas = document.getElementById('detayliRaporGrafigi');
    
    // Kârlılık raporu için elementler (hata mesajı için)
    const karlilikContainer = document.getElementById('karlilik-raporu-container');
    const karlilikMesajElementi = document.getElementById('karlilik-sonuc-mesaji');
    const karlilikKartlarElementi = document.getElementById('karlilik-kartlari');
    
    // Temizleme (Tarih seçilmemişse)
    const temizle = () => {
        if(mesajElementi) {
            mesajElementi.textContent = "Lütfen geçerli bir başlangıç ve bitiş tarihi seçin.";
            mesajElementi.style.display = 'block';
        }
        if (detayliChart) { unregisterChart(detayliChart); detayliChart.destroy(); detayliChart = null; }
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        
        if (karlilikContainer) karlilikContainer.style.display = 'none';
        if (karlilikMesajElementi) karlilikMesajElementi.style.display = 'none';
        if (karlilikKartlarElementi) karlilikKartlarElementi.style.display = 'none';
    };

    if (!baslangic || !bitis) {
        temizle();
        return;
    }

    if (!navigator.onLine) {
        if(mesajElementi) {
            mesajElementi.innerHTML = '<p class="text-warning">Rapor oluşturmak için internet bağlantısı gereklidir.</p>';
            mesajElementi.style.display = 'block';
        }
        if (karlilikMesajElementi) {
            karlilikMesajElementi.innerHTML = '<p class="text-warning">Rapor oluşturmak için internet bağlantısı gereklidir.</p>';
            karlilikMesajElementi.style.display = 'block';
        }
        if (karlilikContainer) karlilikContainer.style.display = 'block';
        return;
    }

    // İki raporu da paralel olarak başlat
    // Not: Hata yönetimi (try/catch) fonksiyonların kendi içinde yapılıyor.
    await Promise.allSettled([
        sutRaporuOlustur(baslangic, bitis),
        karlilikRaporuOlustur(baslangic, bitis)
    ]);
}