const USER_ROLE = document.body.dataset.userRole;
let duzenleModal, gecmisModal, silmeOnayModal, sifreDegistirModal;
let haftalikChart = null;
let tedarikciChart = null;
let tarihFiltreleyici = null;
let tedarikciSecici = null;

let mevcutSayfa = 1;
const girdilerSayfaBasi = 6;

function updateChartThemes() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#E2E8F0' : '#333333';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const legendColor = isDark ? '#E2E8F0' : '#333333';
    const borderColor = isDark ? '#1E293B' : '#FFFFFF';
    const barBgColor = isDark ? 'rgba(76, 125, 255, 0.8)' : 'rgba(74, 144, 226, 0.8)';
    const barBorderColor = isDark ? 'rgba(76, 125, 255, 1)' : 'rgba(74, 144, 226, 1)';
    
    if (haftalikChart) {
        haftalikChart.options.scales.y.ticks.color = textColor;
        haftalikChart.options.scales.x.ticks.color = textColor;
        haftalikChart.options.scales.y.grid.color = gridColor;
        haftalikChart.data.datasets[0].backgroundColor = barBgColor;
        haftalikChart.data.datasets[0].borderColor = barBorderColor;
        haftalikChart.update();
    }
    if (tedarikciChart) {
        tedarikciChart.options.plugins.legend.labels.color = legendColor;
        tedarikciChart.data.datasets[0].borderColor = borderColor;
        tedarikciChart.update();
    }
}

window.onload = async function() {
    duzenleModal = new bootstrap.Modal(document.getElementById('duzenleModal'));
    gecmisModal = new bootstrap.Modal(document.getElementById('gecmisModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));
    sifreDegistirModal = new bootstrap.Modal(document.getElementById('sifreDegistirModal'));
    
    tarihFiltreleyici = flatpickr("#tarih-filtre", {
        dateFormat: "d.m.Y",
        locale: "tr",
        defaultDate: "today"
    });
    
    if (document.getElementById('tedarikci-sec')) {
        tedarikciSecici = new TomSelect("#tedarikci-sec",{
            create: false,
            sortField: { field: "text", direction: "asc" }
        });
    }

    await baslangicVerileriniYukle(); 
};

async function baslangicVerileriniYukle() {
    document.getElementById('girdiler-baslik').textContent = 'Bugünkü Girdiler';
    
    const promises = [
        ozetVerileriniYukle(),
        haftalikGrafigiOlustur(),
        tedarikciGrafigiOlustur()
    ];
    if (USER_ROLE !== 'muhasebeci') {
        promises.push(tedarikcileriYukle());
    }
    
    await Promise.all(promises);

    girdileriGoster(1);
}

// DÜZELTİLDİ: Artık yeni API formatından doğru veriyi okuyor.
async function ozetVerileriniYukle(tarih = null) {
    const toplamLitrePanel = document.getElementById('toplam-litre-panel');
    const girdiSayisiPanel = document.getElementById('bugunku-girdi-sayisi');
    const ozetBaslik = document.getElementById('ozet-panel-baslik');
    toplamLitrePanel.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
    girdiSayisiPanel.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
    
    let url = `/api/gunluk_ozet${tarih ? `?tarih=${tarih}` : ''}`;
    let girdiSayisiUrl = `/api/sut_girdileri${tarih ? `?tarih=${tarih}` : ''}`;
    
    const bugun = getLocalDateString();
    if (tarih && tarih !== bugun) {
        const [yil, ay, gun] = tarih.split('-');
        ozetBaslik.textContent = `${gun}.${ay}.${yil} TOPLAMI`;
    } else {
        ozetBaslik.textContent = 'BUGÜNKÜ TOPLAM SÜT';
    }

    try {
        const [toplamLitreResponse, girdiSayisiResponse] = await Promise.all([fetch(url), fetch(girdiSayisiUrl)]);
        
        const toplamLitreData = await toplamLitreResponse.json();
        const girdiSayisiData = await girdiSayisiResponse.json(); // API'den gelen obje {girdiler: [], toplam_girdi_sayisi: X}

        if (!toplamLitreResponse.ok) throw new Error(toplamLitreData.error || 'Özet verisi alınamadı');
        if (!girdiSayisiResponse.ok) throw new Error(girdiSayisiData.error ||'Girdi sayısı alınamadı');

        toplamLitrePanel.textContent = `${toplamLitreData.toplam_litre} L`;
        girdiSayisiPanel.textContent = girdiSayisiData.toplam_girdi_sayisi; // Doğru yerden sayıyı al

    } catch (error) {
        console.error("Özet yüklenirken hata:", error);
        toplamLitrePanel.textContent = 'Hata';
        girdiSayisiPanel.textContent = 'Hata';
    }
}


async function girdileriGoster(sayfa = 1, tarih = null) {
    mevcutSayfa = sayfa;
    if (!tarih) {
        tarih = tarihFiltreleyici.selectedDates[0] ? getLocalDateString(tarihFiltreleyici.selectedDates[0]) : getLocalDateString(new Date());
    }
    
    const listeElementi = document.getElementById('girdiler-listesi');
    listeElementi.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div></div>';
    
    let url = `/api/sut_girdileri?tarih=${tarih}&sayfa=${sayfa}`;
    try {
        const response = await fetch(url);
        const veri = await response.json();
        if (response.ok) {
            listeElementi.innerHTML = '';
            const girdiler = veri.girdiler;
            const toplamGirdi = veri.toplam_girdi_sayisi;

            if (girdiler.length === 0) {
                listeElementi.innerHTML = '<div class="list-group-item">Bu tarih için girdi bulunamadı.</div>';
            } else {
                girdiler.forEach(girdi => {
                    const tarihObj = new Date(girdi.taplanma_tarihi);
                    const formatliTarih = !isNaN(tarihObj.getTime()) ? `${String(tarihObj.getHours()).padStart(2, '0')}:${String(tarihObj.getMinutes()).padStart(2, '0')}` : 'Geçersiz Saat';
                    const duzenlendiEtiketi = girdi.duzenlendi_mi ? `<span class="badge bg-warning text-dark ms-2">Düzenlendi</span>` : '';
                    let actionButtons = '';
                    if (USER_ROLE !== 'muhasebeci') {
                        actionButtons = `
                            <button class="btn btn-sm btn-outline-info border-0" title="Düzenle" onclick="duzenlemeModaliniAc(${girdi.id}, ${girdi.litre})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger border-0" title="Sil" onclick="silmeOnayiAc(${girdi.id})"><i class="bi bi-trash"></i></button>`;
                    }
                    const girdiElementi = `<div class="list-group-item"><div class="d-flex w-100 justify-content-between"><h5 class="mb-1 girdi-baslik">${girdi.tedarikciler.isim} - ${girdi.litre} Litre ${duzenlendiEtiketi}</h5><div>${actionButtons}<button class="btn btn-sm btn-outline-secondary border-0" title="Geçmişi Gör" onclick="gecmisiGoster(${girdi.id})"><i class="bi bi-clock-history"></i></button></div></div><p class="mb-1 girdi-detay">Toplayan: ${girdi.kullanicilar.kullanici_adi} | Saat: ${formatliTarih}</p></div>`;
                    listeElementi.innerHTML += girdiElementi;
                });
            }
            sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, sayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, tarih));
        } else { 
            listeElementi.innerHTML = `<p class="text-danger p-3">${veri.error || 'Girdiler yüklenemedi.'}</p>`; 
        }
    } catch (error) { 
        console.error("Girdiler gösterilirken hata oluştu:", error); 
        listeElementi.innerHTML = '<p class="text-danger p-3">Girdiler yüklenirken bir hata oluştu.</p>'; 
    }
}

// --- Diğer tüm fonksiyonlar aynı kalacak ---

async function tedarikciGrafigiOlustur() {
    const veriYokMesaji = document.getElementById('tedarikci-veri-yok');
    try {
        const response = await fetch('/api/rapor/tedarikci_dagilimi');
        const veri = await response.json();
        if (!response.ok) throw new Error(veri.error || 'Veri alınamadı.');
        const ctx = document.getElementById('tedarikciDagilimGrafigi').getContext('2d');
        if (tedarikciChart) tedarikciChart.destroy();
        if (veri.labels.length === 0) {
            veriYokMesaji.style.display = 'block';
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            return;
        }
        veriYokMesaji.style.display = 'none';
        tedarikciChart = new Chart(ctx, {
            type: 'doughnut', 
            data: { labels: veri.labels, datasets: [{
                label: 'Litre', data: veri.data,
                backgroundColor: ['rgba(255, 99, 132, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)'],
                borderWidth: 2
            }]},
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 12 } } } } }
        });
        updateChartThemes();
    } catch (error) {
        console.error("Tedarikçi grafiği oluşturulurken hata:", error);
        veriYokMesaji.textContent = 'Grafik yüklenemedi.';
        veriYokMesaji.style.display = 'block';
    }
}
    
async function haftalikGrafigiOlustur() {
    try {
        const response = await fetch('/api/rapor/haftalik_ozet');
        const veri = await response.json();
        if (!response.ok) throw new Error(veri.error || 'Grafik verisi alınamadı.');
        const ctx = document.getElementById('haftalikRaporGrafigi').getContext('2d');
        if(haftalikChart) haftalikChart.destroy();
        haftalikChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: veri.labels, datasets: [{
                label: 'Toplanan Süt (Litre)', data: veri.data,
                borderWidth: 1, borderRadius: 5
            }]},
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true }, x: { grid: { display: false } } },
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` Toplam: ${c.parsed.y} Litre` } } }
            }
        });
        updateChartThemes();
    } catch (error) {
        console.error("Haftalık grafik oluşturulurken hata:", error);
    }
}
    
function getLocalDateString(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function tedarikcileriYukle() {
    if (!tedarikciSecici) return;
    try {
        const response = await fetch('/api/tedarikciler_liste');
        const tedarikciler = await response.json();
        tedarikciSecici.clear();
        tedarikciSecici.clearOptions();
        const options = tedarikciler.map(t => ({ value: t.id, text: t.isim }));
        tedarikciSecici.addOptions(options);
    } catch (error) {
        console.error("Tedarikçiler yüklenirken hata:", error);
        gosterMesaj("Tedarikçiler yüklenemedi.", "danger");
    }
}

async function sutGirdisiEkle() {
    const tedarikciId = tedarikciSecici.getValue(); 
    const litre = document.getElementById('litre-input').value;
    if (!tedarikciId || !litre || isNaN(parseFloat(litre))) {
        gosterMesaj("Lütfen tüm alanları doğru doldurun.", "warning"); return;
    }
    try {
        const response = await fetch('/api/sut_girdisi_ekle', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tedarikci_id: parseInt(tedarikciId), litre: parseFloat(litre) })
        });
        const errorData = await response.json();
        if (response.ok) {
            gosterMesaj("Süt girdisi başarıyla kaydedildi.", "success");
            document.getElementById('litre-input').value = '';
            tedarikciSecici.clear();
            const seciliTarih = tarihFiltreleyici.selectedDates[0];
            const formatliTarih = seciliTarih ? getLocalDateString(seciliTarih) : null;
            await Promise.all([girdileriGoster(mevcutSayfa, formatliTarih), ozetVerileriniYukle(formatliTarih), haftalikGrafigiOlustur(), tedarikciGrafigiOlustur()]);
        } else {
            gosterMesaj(`Süt girdisi eklenemedi: ${errorData.error || 'Bilinmeyen hata.'}`, "danger");
        }
    } catch (error) { console.error("Girdi eklenirken hata:", error); }
}
    
function duzenlemeModaliniAc(girdiId, mevcutLitre) {
    document.getElementById('edit-girdi-id').value = girdiId;
    document.getElementById('edit-litre-input').value = mevcutLitre;
    document.getElementById('edit-sebep-input').value = '';
    duzenleModal.show();
}

async function sutGirdisiDuzenle() {
    const girdiId = document.getElementById('edit-girdi-id').value;
    const yeniLitre = document.getElementById('edit-litre-input').value;
    const duzenlemeSebebi = document.getElementById('edit-sebep-input').value.trim();
    if (!yeniLitre || !duzenlemeSebebi) {
        gosterMesaj("Lütfen yeni litre değerini ve düzenleme sebebini girin.", "warning"); return;
    }
    try {
        const response = await fetch(`/api/sut_girdisi_duzenle/${girdiId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ yeni_litre: parseFloat(yeniLitre), duzenleme_sebebi: duzenlemeSebebi })
        });
        const errorData = await response.json();
        if (response.ok) {
            gosterMesaj("Girdi başarıyla güncellendi.", "success");
            duzenleModal.hide();
            const seciliTarih = tarihFiltreleyici.selectedDates[0];
            const formatliTarih = seciliTarih ? getLocalDateString(seciliTarih) : null;
            await Promise.all([girdileriGoster(mevcutSayfa, formatliTarih), ozetVerileriniYukle(formatliTarih), haftalikGrafigiOlustur(), tedarikciGrafigiOlustur()]);
        } else {
            gosterMesaj(`Girdi düzenlenemedi: ${errorData.error || 'Bilinmeyen hata.'}`, "danger");
        }
    } catch (error) { console.error("Girdi düzenlenirken hata:", error); gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger"); }
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

async function gecmisiGoster(girdiId) {
    const modalBody = document.getElementById('gecmis-modal-body');
    modalBody.innerHTML = '<div class="text-center p-4"><div class="spinner-border"></div></div>';
    gecmisModal.show();
    try {
        const response = await fetch(`/api/girdi_gecmisi/${girdiId}`);
        const gecmisKayitlari = await response.json();
        if (response.ok) {
            if (gecmisKayitlari.length === 0) { modalBody.innerHTML = '<p class="p-3">Bu girdi için düzenleme geçmişi bulunamadı.</p>'; return; }
            let content = '<ul class="list-group">';
            gecmisKayitlari.forEach(kayit => {
                const tarih = new Date(kayit.created_at).toLocaleString('tr-TR');
                content += `<li class="list-group-item"><p class="mb-1 fw-bold">${tarih} - ${kayit.duzenleyen_kullanici_id.kullanici_adi} tarafından düzenlendi.</p><p class="mb-1"><span class="text-warning">Eski Değer:</span> ${kayit.eski_litre_degeri} Litre</p><p class="mb-0"><span class="text-info">Sebep:</span> ${kayit.duzenleme_sebebi}</p></li>`;
            });
            modalBody.innerHTML = content + '</ul>';
        } else { modalBody.innerHTML = `<p class="text-danger p-3">Geçmiş yüklenemedi: ${gecmisKayitlari.error || 'Bilinmeyen hata'}</p>`; }
    } catch(error) { console.error("Geçmiş yüklenirken hata:", error); modalBody.innerHTML = '<p class="text-danger p-3">Geçmiş yüklenirken bir sunucu hatası oluştu.</p>'; }
}

function silmeOnayiAc(girdiId) {
    document.getElementById('silinecek-girdi-id').value = girdiId;
    silmeOnayModal.show();
}

async function sutGirdisiSil() {
    const girdiId = document.getElementById('silinecek-girdi-id').value;
    try {
        const response = await fetch(`/api/sut_girdisi_sil/${girdiId}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            silmeOnayModal.hide();
            const seciliTarih = tarihFiltreleyici.selectedDates[0];
            const formatliTarih = seciliTarih ? getLocalDateString(seciliTarih) : null;
            await Promise.all([girdileriGoster(mevcutSayfa, formatliTarih), ozetVerileriniYukle(formatliTarih), haftalikGrafigiOlustur(), tedarikciGrafigiOlustur()]);
        } else { gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger'); }
    } catch (error) { console.error("Silme sırasında hata:", error); gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger'); }
}

function girdileriFiltrele() {
    const secilenTarih = tarihFiltreleyici.selectedDates[0];
    if (secilenTarih) {
        const formatliTarih = getLocalDateString(secilenTarih);
        const bugun = getLocalDateString();
        const baslik = document.getElementById('girdiler-baslik');
        if(formatliTarih === bugun) { 
            baslik.textContent = 'Bugünkü Girdiler'; 
        } else {
            const [yil, ay, gun] = formatliTarih.split('-');
            baslik.textContent = `${gun}.${ay}.${yil} Tarihli Girdiler`;
        }
        girdileriGoster(1, formatliTarih);
        ozetVerileriniYukle(formatliTarih);
    }
}

function filtreyiTemizle() {
    tarihFiltreleyici.setDate(new Date(), true);
    baslangicVerileriniYukle();
}

function sifreDegistirmeAc() {
    document.getElementById('mevcut-sifre-input').value = '';
    document.getElementById('kullanici-yeni-sifre-input').value = '';
    document.getElementById('kullanici-yeni-sifre-tekrar-input').value = '';
    sifreDegistirModal.show();
}

async function sifreDegistir() {
    const mevcutSifre = document.getElementById('mevcut-sifre-input').value;
    const yeniSifre = document.getElementById('kullanici-yeni-sifre-input').value;
    const yeniSifreTekrar = document.getElementById('kullanici-yeni-sifre-tekrar-input').value;
    if (!mevcutSifre || !yeniSifre || !yeniSifreTekrar) {
        gosterMesaj("Lütfen tüm şifre alanlarını doldurun.", "warning"); return;
    }
    try {
        const response = await fetch('/api/user/change_password', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mevcut_sifre: mevcutSifre, yeni_sifre: yeniSifre, yeni_sifre_tekrar: yeniSifreTekrar })
        });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            sifreDegistirModal.hide();
        } else { gosterMesaj(result.error || "Bir hata oluştu.", 'danger'); }
    } catch (error) { console.error("Şifre değiştirilirken hata oluştu:", error); gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger"); }
}

function verileriDisaAktar() {
    const secilenTarih = tarihFiltreleyici.selectedDates[0];
    const formatliTarih = secilenTarih ? getLocalDateString(seciliTarih) : null;
    let url = `/api/export_csv${formatliTarih ? `?tarih=${formatliTarih}` : ''}`;
    window.open(url, '_blank');
}

async function tedarikciEkle() {
    const yeniTedarikciIsim = document.getElementById('yeni-tedarikci-isim').value.trim();
    if (!yeniTedarikciIsim) {
        gosterMesaj("Lütfen bir tedarikçi adı girin.", "warning");
        return;
    }
    try {
        const response = await fetch('/api/tedarikci_ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isim: yeniTedarikciIsim })
        });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj("Tedarikçi başarıyla eklendi.", "success");
            document.getElementById('yeni-tedarikci-isim').value = '';
            await tedarikcileriYukle(); // Tedarikçi listesini yenile
        } else {
            gosterMesaj(result.error || "Tedarikçi eklenirken bir hata oluştu.", "danger");
        }
    } catch (error) {
        console.error("Tedarikçi eklenirken hata:", error);
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    }
}