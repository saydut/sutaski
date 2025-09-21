// Bu dosya, tedarikci_detay.html sayfasının mantığını yönetir.

const girdilerSayfaBasi = 10;
let mevcutSayfa = 1;
let tumGirdiler = [];

/**
 * Sayfa yüklendiğinde ilgili tedarikçinin detay verilerini çeker.
 */
window.onload = async () => {
    try {
        const response = await fetch(`/api/tedarikci/${TEDARIKCI_ID}/detay`);
        if (!response.ok) {
            throw new Error('Tedarikçi detayları alınamadı.');
        }
        const data = await response.json();
        
        // Gelen verilerle arayüzü doldur
        document.getElementById('tedarikci-adi-baslik').innerText = data.isim;
        ozetKartlariniDoldur(data.ozet);
        
        tumGirdiler = data.girdiler;
        sayfaRenderEt(); // İlk sayfayı göster

    } catch (error) {
        console.error("Hata:", error);
        document.getElementById('tedarikci-adi-baslik').innerText = "Hata";
        document.getElementById('tedarikci-adi-baslik').classList.add('text-danger');
    }
};

/**
 * Özet istatistik kartlarını oluşturur ve ekrana basar.
 * @param {object} ozet Sunucudan gelen özet verileri.
 */
function ozetKartlariniDoldur(ozet) {
    const container = document.getElementById('ozet-kartlari');
    container.innerHTML = `
        <div class="col-lg-3 col-md-6 col-12">
            <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Toplam Getirdiği Süt</div>
                <h4 class="fw-bold mb-0">${ozet.toplam_litre.toFixed(2)} L</h4>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-12">
            <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Toplam Girdi Sayısı</div>
                <h4 class="fw-bold mb-0">${ozet.girdi_sayisi}</h4>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-12">
            <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">Girdi Başına Ortalama</div>
                <h4 class="fw-bold mb-0">${ozet.ortalama_litre.toFixed(2)} L</h4>
            </div>
        </div>
        <div class="col-lg-3 col-md-6 col-12">
            <div class="card p-3 text-center h-100">
                <div class="fs-6 text-secondary">İlk Girdi Tarihi</div>
                <h4 class="fw-bold mb-0">${ozet.ilk_girdi_tarihi}</h4>
            </div>
        </div>
    `;
}

/**
 * Belirtilen sayfadaki girdileri tabloya yazar ve sayfalama kontrollerini oluşturur.
 */
function sayfaRenderEt() {
    const tbody = document.getElementById('girdiler-tablosu');
    tbody.innerHTML = '';

    // Sayfaya göre gösterilecek girdileri hesapla
    const baslangic = (mevcutSayfa - 1) * girdilerSayfaBasi;
    const bitis = baslangic + girdilerSayfaBasi;
    const sayfaGirdileri = tumGirdiler.slice(baslangic, bitis);

    if (sayfaGirdileri.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-secondary">Bu tedarikçiye ait girdi bulunamadı.</td></tr>';
    } else {
        sayfaGirdileri.forEach(girdi => {
            const tr = `
                <tr>
                    <td>${new Date(girdi.taplanma_tarihi).toLocaleString('tr-TR')}</td>
                    <td class="text-end">${girdi.litre.toFixed(2)} L</td>
                    <td>${girdi.kullanicilar.kullanici_adi}</td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });
    }

    sayfalamaNavOlustur();
}

/**
 * Sayfalama (pagination) navigasyonunu oluşturur.
 */
function sayfalamaNavOlustur() {
    const nav = document.getElementById('sayfalama-nav');
    nav.innerHTML = '';
    const toplamSayfa = Math.ceil(tumGirdiler.length / girdilerSayfaBasi);

    if (toplamSayfa <= 1) return; // Tek sayfa varsa navigasyona gerek yok

    const ul = document.createElement('ul');
    ul.className = 'pagination';

    for (let i = 1; i <= toplamSayfa; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === mevcutSayfa ? 'active' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.innerText = i;
        a.onclick = (e) => {
            e.preventDefault();
            mevcutSayfa = i;
            sayfaRenderEt();
        };
        li.appendChild(a);
        ul.appendChild(li);
    }
    nav.appendChild(ul);
}
