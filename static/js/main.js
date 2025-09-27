let duzenleModal, gecmisModal, silmeOnayModal, sifreDegistirModal;
let haftalikChart = null;
let tedarikciChart = null;
let tarihFiltreleyici = null;
let tedarikciSecici = null;
let tumTedarikciler = [];
let mevcutSayfa = 1;
const girdilerSayfaBasi = 6;

/**
 * Uygulama kabuğu yüklendiğinde çalışır.
 * Tarayıcıda kayıtlı kullanıcı varsa bilgileri ekrana basar.
 * Yoksa ve internet de yoksa, giriş sayfasına yönlendirir.
 */
function initOfflineState() {
    const offlineUserString = localStorage.getItem('offlineUser');
    
    // Eğer body etiketinde sunucudan gelen bir kullanıcı rolü yoksa 
    // (yani sayfa önbellekten yüklenmişse)
    if (!document.body.dataset.userRole) {
        if (offlineUserString) {
            const user = JSON.parse(offlineUserString);
            
            // Placeholder'ları ve data-* özelliklerini doldur
            document.body.dataset.userRole = user.rol;
            document.body.dataset.lisansBitis = user.lisans_bitis_tarihi;

            const userNameEl = document.getElementById('user-name-placeholder');
            const companyNameEl = document.getElementById('company-name-placeholder');
            const adminLinkContainer = document.getElementById('admin-panel-link-container');
            const veriGirisPaneli = document.getElementById('veri-giris-paneli');
            
            if (userNameEl) userNameEl.textContent = user.kullanici_adi;
            if (companyNameEl) companyNameEl.textContent = user.sirket_adi;

            // Rol bazlı arayüz elemanlarını göster/gizle
            if (user.rol === 'admin' && adminLinkContainer) {
                adminLinkContainer.style.display = 'block';
            } else if (adminLinkContainer) {
                adminLinkContainer.style.display = 'none';
            }
            
            if (user.rol === 'muhasebeci' && veriGirisPaneli) {
                veriGirisPaneli.style.display = 'none';
            } else if (veriGirisPaneli) {
                 veriGirisPaneli.style.display = 'block';
            }

        } else if (!navigator.onLine) {
            // Hem yerel kayıt yok hem de internet yoksa, giriş sayfasına git
            window.location.href = '/login';
        }
    }
}

window.onload = async function() {
    initOfflineState(); // Sayfa yüklenir yüklenmez çevrimdışı durumunu kontrol et

    // --- YENİ EKLENEN GİRİŞ KONTROLÜ ---
    // Kullanıcının giriş yapıp yapmadığını hem sunucudan gelen veriyle (body.dataset) 
    // hem de yerel depolamayla (localStorage) kontrol et.
    const isUserLoggedIn = document.body.dataset.userRole || localStorage.getItem('offlineUser');

    // Eğer internet var AMA kullanıcı giriş yapmamışsa, login sayfasına yönlendir.
    if (navigator.onLine && !isUserLoggedIn) {
        window.location.href = '/login';
        return; // Yönlendirme sonrası scriptin devam etmesini engelle.
    }
    // --- KONTROL SONU ---


    duzenleModal = new bootstrap.Modal(document.getElementById('duzenleModal'));
    gecmisModal = new bootstrap.Modal(document.getElementById('gecmisModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));
    sifreDegistirModal = new bootstrap.Modal(document.getElementById('sifreDegistirModal'));
    
    tarihFiltreleyici = flatpickr("#tarih-filtre", {
        dateFormat: "d.m.Y",
        locale: "tr",
        defaultDate: "today"
    });
    
    if (document.getElementById('veri-giris-paneli').style.display !== 'none' && document.getElementById('tedarikci-sec')) {
        tedarikciSecici = new TomSelect("#tedarikci-sec",{
            create: false,
            sortField: { field: "text", direction: "asc" }
        });
    }

    lisansUyarisiKontrolEt();
    await baslangicVerileriniYukle(); 
};

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

function lisansUyarisiKontrolEt() {
    const lisansBitisStr = document.body.dataset.lisansBitis;
    if (!lisansBitisStr || lisansBitisStr === 'None' || lisansBitisStr === '') return;
    const lisansBitisTarihi = new Date(lisansBitisStr);
    const bugun = new Date();
    const zamanFarki = lisansBitisTarihi.getTime() - bugun.getTime();
    const gunFarki = Math.ceil(zamanFarki / (1000 * 3600 * 24));
    if (gunFarki <= 0) {
        gosterMesaj(`<strong>Dikkat:</strong> Şirketinizin lisans süresi dolmuştur! Lütfen yöneticinizle iletişime geçin.`, 'danger');
    } else if (gunFarki <= 30) {
        gosterMesaj(`<strong>Bilgi:</strong> Şirketinizin lisans süresinin dolmasına ${gunFarki} gün kaldı.`, 'warning');
    }
}

async function baslangicVerileriniYukle() {
    document.getElementById('girdiler-baslik').textContent = 'Bugünkü Girdiler';
    const promises = [
        ozetVerileriniYukle(),
        haftalikGrafigiOlustur(),
        tedarikciGrafigiOlustur()
    ];
    if (document.body.dataset.userRole !== 'muhasebeci') {
        promises.push(tedarikcileriYukle());
    }
    await Promise.all(promises);
    girdileriGoster(1);
}

async function ozetVerileriniYukle(tarih = null) {
    const toplamLitrePanel = document.getElementById('toplam-litre-panel');
    const girdiSayisiPanel = document.getElementById('bugunku-girdi-sayisi');
    const ozetBaslik = document.getElementById('ozet-panel-baslik');
    const girdiSayisiBaslik = document.getElementById('girdi-sayisi-baslik');
    toplamLitrePanel.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
    girdiSayisiPanel.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
    const effectiveDate = tarih || getLocalDateString(new Date());
    let url = `/api/gunluk_ozet?tarih=${effectiveDate}`;
    let girdiSayisiUrl = `/api/sut_girdileri?tarih=${effectiveDate}`;
    const bugun = getLocalDateString();
    if (tarih && tarih !== bugun) {
        const [yil, ay, gun] = tarih.split('-');
        ozetBaslik.textContent = `${gun}.${ay}.${yil} TOPLAMI`;
        girdiSayisiBaslik.textContent = `${gun}.${ay}.${yil} TOPLAM GİRDİ`;
    } else {
        ozetBaslik.textContent = 'BUGÜNKÜ TOPLAM SÜT';
        girdiSayisiBaslik.textContent = 'BUGÜNKÜ TOPLAM GİRDİ';
    }
    try {
        const [toplamLitreResponse, girdiSayisiResponse] = await Promise.all([fetch(url), fetch(girdiSayisiUrl)]);
        const toplamLitreData = await toplamLitreResponse.json();
        const girdiSayisiData = await girdiSayisiResponse.json();
        if (!toplamLitreResponse.ok) throw new Error(toplamLitreData.error || 'Özet verisi alınamadı');
        if (!girdiSayisiResponse.ok) throw new Error(girdiSayisiData.error ||'Girdi sayısı alınamadı');
        toplamLitrePanel.textContent = `${toplamLitreData.toplam_litre} L`;
        girdiSayisiPanel.textContent = girdiSayisiData.toplam_girdi_sayisi;
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
    let sunucuVerisi = { girdiler: [], toplam_girdi_sayisi: 0 };
    let hataMesaji = null;
    if (navigator.onLine) {
        try {
            const url = `/api/sut_girdileri?tarih=${tarih}&sayfa=${sayfa}`;
            const response = await fetch(url);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Girdiler sunucudan yüklenemedi.');
            sunucuVerisi = data;
        } catch (error) {
            console.error("Sunucudan veri çekerken hata:", error);
            hataMesaji = "Sunucuya ulaşılamıyor. Lütfen internet bağlantınızı kontrol edin.";
        }
    }
    let tumGirdiler = sunucuVerisi.girdiler;
    let toplamGirdi = sunucuVerisi.toplam_girdi_sayisi;
    
    // ÇEVRİMDIŞI MANTIĞI GÜNCELLEMESİ:
    // Artık sadece sayfa 1'de değil, her zaman bekleyen girdileri göstermeyi deneriz.
    // Çünkü bekleyen girdiler her zaman "bugün" içindir.
    try {
        const bekleyenGirdiler = await bekleyenGirdileriGetir();
        if (bekleyenGirdiler.length > 0) {
            const islenmisBekleyenler = bekleyenGirdiler.map(girdi => {
                const tedarikci = tumTedarikciler.find(t => t.id === girdi.tedarikci_id);
                const tedarikciAdi = tedarikci ? tedarikci.isim : `Bilinmeyen (ID: ${girdi.tedarikci_id})`;
                return {
                    id: `offline-${girdi.id}`,
                    litre: girdi.litre,
                    fiyat: girdi.fiyat,
                    taplanma_tarihi: girdi.eklendigi_zaman,
                    duzenlendi_mi: false,
                    isOffline: true,
                    kullanicilar: { kullanici_adi: 'Siz (Beklemede)' },
                    tedarikciler: { isim: tedarikciAdi }
                };
            });
            // Eğer o anki görünüm bugüne aitse, bekleyenleri de ekle.
            if (tarih === getLocalDateString(new Date())) {
                tumGirdiler = [...islenmisBekleyenler.reverse(), ...tumGirdiler];
                toplamGirdi += islenmisBekleyenler.length;
            }
        }
    } catch (dbError) {
        console.error("Yerel veritabanından okuma hatası:", dbError);
        hataMesaji = (hataMesaji ? hataMesaji + "\n" : "") + "Yerel veriler okunamadı.";
    }

    listeElementi.innerHTML = '';
    if (tumGirdiler.length === 0) {
        if (!navigator.onLine) {
            listeElementi.innerHTML = '<div class="list-group-item">Çevrimdışısınız. Bu tarih için gösterilecek yerel girdi bulunamadı.</div>';
        } else if (hataMesaji) {
            listeElementi.innerHTML = `<p class="text-danger p-3">${hataMesaji}</p>`;
        } else {
            listeElementi.innerHTML = '<div class="list-group-item">Bu tarih için girdi bulunamadı.</div>';
        }
    } else {
        tumGirdiler.forEach(girdi => {
            const tarihObj = new Date(girdi.taplanma_tarihi);
            const formatliTarih = !isNaN(tarihObj.getTime()) ? `${String(tarihObj.getHours()).padStart(2, '0')}:${String(tarihObj.getMinutes()).padStart(2, '0')}` : 'Geçersiz Saat';
            const duzenlendiEtiketi = girdi.duzenlendi_mi ? `<span class="badge bg-warning text-dark ms-2">Düzenlendi</span>` : '';
            const cevrimdisiEtiketi = girdi.isOffline ? `<span class="badge bg-info text-dark ms-2" title="İnternet geldiğinde gönderilecek"><i class="bi bi-cloud-upload"></i> Beklemede</span>` : '';
            let actionButtons = '';
            if (!girdi.isOffline && document.body.dataset.userRole !== 'muhasebeci') {
                actionButtons = `
                    <button class="btn btn-sm btn-outline-info border-0" title="Düzenle" onclick="duzenlemeModaliniAc(${girdi.id}, ${girdi.litre})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger border-0" title="Sil" onclick="silmeOnayiAc(${girdi.id})"><i class="bi bi-trash"></i></button>`;
            }
            const gecmisButonu = !girdi.isOffline ? `<button class="btn btn-sm btn-outline-secondary border-0" title="Geçmişi Gör" onclick="gecmisiGoster(${girdi.id})"><i class="bi bi-clock-history"></i></button>` : '';
            const fiyatBilgisi = girdi.fiyat ? `<span class="text-success">@ ${parseFloat(girdi.fiyat).toFixed(2)} TL</span>` : '';
            const girdiElementi = `<div class="list-group-item"><div class="d-flex w-100 justify-content-between flex-wrap"><h5 class="mb-1 girdi-baslik">${girdi.tedarikciler.isim} - ${girdi.litre} Litre ${fiyatBilgisi} ${duzenlendiEtiketi} ${cevrimdisiEtiketi}</h5><div class="btn-group">${actionButtons} ${gecmisButonu}</div></div><p class="mb-1 girdi-detay">Toplayan: ${girdi.kullanicilar.kullanici_adi} | Saat: ${formatliTarih}</p></div>`;
            listeElementi.innerHTML += girdiElementi;
        });
    }
    sayfalamaNavOlustur('girdiler-sayfalama', toplamGirdi, sayfa, girdilerSayfaBasi, (yeniSayfa) => girdileriGoster(yeniSayfa, tarih));
}

async function sutGirdisiEkle() {
    const tedarikciId = tedarikciSecici.getValue(); 
    const litre = document.getElementById('litre-input').value;
    const fiyat = document.getElementById('fiyat-input').value;
    if (!tedarikciId || !litre || isNaN(parseFloat(litre)) || !fiyat || isNaN(parseFloat(fiyat))) {
        gosterMesaj("Lütfen tüm alanları doğru doldurun.", "warning"); return;
    }
    const yeniGirdi = {
        tedarikci_id: parseInt(tedarikciId),
        litre: parseFloat(litre),
        fiyat: parseFloat(fiyat)
    };
    if (!navigator.onLine) {
        const offlineUserString = localStorage.getItem('offlineUser');
        if (offlineUserString) {
            const offlineUser = JSON.parse(offlineUserString);
            const lisansBitisStr = offlineUser.lisans_bitis_tarihi;
            if (lisansBitisStr && lisansBitisStr !== 'None') {
                const lisansBitisTarihi = new Date(lisansBitisStr);
                const bugun = new Date();
                bugun.setHours(0, 0, 0, 0);
                if (bugun > lisansBitisTarihi) {
                    gosterMesaj('Lisansınızın süresi dolduğu için çevrimdışı kayıt yapamazsınız.', 'danger');
                    return;
                }
            } else {
                 gosterMesaj('Geçerli bir lisans bulunamadığı için çevrimdışı kayıt yapamazsınız.', 'danger');
                 return;
            }
        } else {
            gosterMesaj('Çevrimdışı kayıt için kullanıcı bilgisi bulunamadı. Lütfen önce online giriş yapın.', 'danger');
            return;
        }
        const basarili = await kaydetCevrimdisi(yeniGirdi);
        if (basarili) {
            document.getElementById('litre-input').value = '';
            document.getElementById('fiyat-input').value = '';
            tedarikciSecici.clear();
            await girdileriGoster();
        }
        return;
    }
    try {
        const response = await fetch('/api/sut_girdisi_ekle', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(yeniGirdi)
        });
        const errorData = await response.json();
        if (response.ok) {
            gosterMesaj("Süt girdisi başarıyla kaydedildi.", "success");
            document.getElementById('litre-input').value = '';
            document.getElementById('fiyat-input').value = '';
            tedarikciSecici.clear();
            const seciliTarih = tarihFiltreleyici.selectedDates[0];
            const formatliTarih = seciliTarih ? getLocalDateString(seciliTarih) : null;
            await Promise.all([girdileriGoster(mevcutSayfa, formatliTarih), ozetVerileriniYukle(formatliTarih), haftalikGrafigiOlustur(), tedarikciGrafigiOlustur()]);
        } else {
            gosterMesaj(`Süt girdisi eklenemedi: ${errorData.error || 'Bilinmeyen hata.'}`, "danger");
        }
    } catch (error) { console.error("Girdi eklenirken hata:", error); }
}

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
        tumTedarikciler = tedarikciler; 
        tedarikciSecici.clear();
        tedarikciSecici.clearOptions();
        const options = tedarikciler.map(t => ({ value: t.id, text: t.isim }));
        tedarikciSecici.addOptions(options);
    } catch (error) {
        console.error("Tedarikçiler yüklenirken hata:", error);
        gosterMesaj("Tedarikçiler yüklenemedi.", "danger");
    }
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
                const eskiFiyatBilgisi = kayit.eski_fiyat_degeri ? ` | <span class="text-warning">Eski Fiyat:</span> ${parseFloat(kayit.eski_fiyat_degeri).toFixed(2)} TL` : '';
                content += `<li class="list-group-item">
                                <p class="mb-1 fw-bold">${tarih} - ${kayit.duzenleyen_kullanici_id.kullanici_adi} tarafından düzenlendi.</p>
                                <p class="mb-1">
                                    <span class="text-warning">Eski Litre:</span> ${kayit.eski_litre_degeri} Litre
                                    ${eskiFiyatBilgisi}
                                </p>
                                <p class="mb-0"><span class="text-info">Sebep:</span> ${kayit.duzenleme_sebebi}</p>
                            </li>`;
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

async function verileriDisaAktar() {
    const secilenTarih = tarihFiltreleyici.selectedDates[0];
    const formatliTarih = secilenTarih ? getLocalDateString(secilenTarih) : null;
    let url = `/api/export_csv${formatliTarih ? `?tarih=${formatliTarih}` : ''}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('CSV dosyası oluşturulurken bir hata oluştu.');
        }
        const disposition = response.headers.get('Content-Disposition');
        let filename = "sut_raporu.csv";
        if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }
        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(objectUrl);
        a.remove();
        gosterMesaj("Veriler başarıyla CSV olarak indirildi.", "success");
    } catch (error) {
        console.error("CSV dışa aktarılırken hata oluştu:", error);
        gosterMesaj(error.message, "danger");
    }
}