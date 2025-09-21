const girdilerSayfaBasi = 10; // Bu sayfa için 10 girdi gösterilecek
let mevcutSayfa = 1;

window.onload = () => {
    verileriYukle(1); // Sayfa yüklendiğinde 1. sayfayı yükle
};

async function verileriYukle(sayfa = 1) {
    mevcutSayfa = sayfa;
    const ozetKartlariContainer = document.getElementById('ozet-kartlari');
    const girdilerTabloBody = document.getElementById('girdiler-tablosu');
    const baslikElementi = document.getElementById('tedarikci-adi-baslik');
    
    if (sayfa === 1) {
        baslikElementi.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
        ozetKartlariContainer.innerHTML = '';
        girdilerTabloBody.innerHTML = `<tr><td colspan="3" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    }

    try {
        const response = await fetch(`/api/tedarikci/${TEDARIKCI_ID}/detay?sayfa=${sayfa}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Tedarikçi detayları alınamadı.');
        }
        const data = await response.json();
        
        baslikElementi.innerText = data.isim;
        
        if (sayfa === 1) {
            ozetKartlariniDoldur(data.ozet);
        }
        
        girdileriTabloyaEkle(data.girdiler);
        sayfalamaNavOlustur('sayfalama-nav', data.toplam_girdi_sayisi, sayfa, girdilerSayfaBasi, verileriYukle);

    } catch (error) {
        console.error("Hata:", error);
        baslikElementi.innerText = "Hata";
        baslikElementi.classList.add('text-danger');
        girdilerTabloBody.innerHTML = `<tr><td colspan="3" class="text-center p-4 text-danger">${error.message}</td></tr>`;
    }
}

function ozetKartlariniDoldur(ozet) {
    const container = document.getElementById('ozet-kartlari');
    container.innerHTML = `
        <div class="col-lg-3 col-md-6 col-12"><div class="card p-3 text-center h-100"><div class="fs-6 text-secondary">Toplam Süt</div><h4 class="fw-bold mb-0">${ozet.toplam_litre.toFixed(2)} L</h4></div></div>
        <div class="col-lg-3 col-md-6 col-12"><div class="card p-3 text-center h-100"><div class="fs-6 text-secondary">Toplam Girdi</div><h4 class="fw-bold mb-0">${ozet.girdi_sayisi}</h4></div></div>
        <div class="col-lg-3 col-md-6 col-12"><div class="card p-3 text-center h-100"><div class="fs-6 text-secondary">Girdi Başına Ortalama</div><h4 class="fw-bold mb-0">${ozet.ortalama_litre.toFixed(2)} L</h4></div></div>
        <div class="col-lg-3 col-md-6 col-12"><div class="card p-3 text-center h-100"><div class="fs-6 text-secondary">İlk Girdi Tarihi</div><h4 class="fw-bold mb-0">${ozet.ilk_girdi_tarihi || '-'}</h4></div></div>
    `;
}

function girdileriTabloyaEkle(girdiler) {
    const tbody = document.getElementById('girdiler-tablosu');
    tbody.innerHTML = '';

    if (girdiler.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center p-4 text-secondary">Bu tedarikçiye ait girdi bulunamadı.</td></tr>';
    } else {
        girdiler.forEach(girdi => {
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
}

function sayfalamaNavOlustur(containerId, toplamOge, aktifSayfa, sayfaBasiOge, sayfaDegistirCallback) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const toplamSayfa = Math.ceil(toplamOge / sayfaBasiOge);
    if (toplamSayfa <= 1) return;

    const ul = document.createElement('ul');
    ul.className = 'pagination';

    for (let i = 1; i <= toplamSayfa; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === aktifSayfa ? 'active' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.innerText = i;
        a.onclick = (e) => {
            e.preventDefault();
            sayfaDegistirCallback(i);
        };
        li.appendChild(a);
        ul.appendChild(li);
    }
    container.appendChild(ul);
}

