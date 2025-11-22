// static/js/tedarikci_detay.js

let tedarikciDetayMevcutGorunum = 'tablo';
const yuklenenSekmeler = { sut: false, yem: false, finans: false };
const KAYIT_SAYISI = 10;

// Sayfa Yüklendiğinde
window.onload = () => {
    tedarikciDetayMevcutGorunum = localStorage.getItem('tedarikciDetayGorunum') || 'tablo';
    gorunumuAyarla(tedarikciDetayMevcutGorunum);

    if(typeof ayYilSecicileriniDoldur === 'function') ayYilSecicileriniDoldur('rapor-ay', 'rapor-yil');
    
    loadInitialDetayData(); // İlk verileri (Özet + Süt Girdileri) çek
};

// HTML'den çağrılan Tab Değişim Fonksiyonu (base.html veya inline script'ten tetiklenir)
window.onTabChanged = function(tabName) {
    if (tabName === 'sut' && !yuklenenSekmeler.sut) sutGirdileriniYukle(1);
    else if (tabName === 'yem' && !yuklenenSekmeler.yem) yemIslemleriniYukle(1);
    else if (tabName === 'finans' && !yuklenenSekmeler.finans) finansalIslemleriYukle(1);
};

// Görünüm Ayarları (Tablo/Kart Geçişi)
function gorunumuAyarla(aktifGorunum) {
    const elements = ['sut', 'yem', 'finans'];
    elements.forEach(prefix => {
        const tbl = document.getElementById(prefix + '-tablo-gorunumu');
        const crd = document.getElementById(prefix + '-kart-gorunumu');
        if(tbl && crd) {
            if (aktifGorunum === 'tablo') { 
                tbl.classList.remove('hidden'); 
                crd.classList.add('hidden'); 
            } else { 
                tbl.classList.add('hidden'); 
                crd.classList.remove('hidden'); 
            }
        }
    });

    const btnT = document.getElementById('btn-view-table');
    const btnC = document.getElementById('btn-view-card');
    const act = "p-1.5 rounded text-brand-600 bg-white shadow-sm ring-1 ring-gray-200";
    const inact = "p-1.5 rounded text-gray-500 hover:text-brand-600 hover:bg-gray-50";
    
    if (btnT && btnC) {
        if (aktifGorunum === 'tablo') { btnT.className = act; btnC.className = inact; }
        else { btnC.className = act; btnT.className = inact; }
    }
}

function gorunumuDegistir(yeniGorunum) {
    if (tedarikciDetayMevcutGorunum === yeniGorunum) return;
    tedarikciDetayMevcutGorunum = yeniGorunum;
    localStorage.setItem('tedarikciDetayGorunum', tedarikciDetayMevcutGorunum);
    gorunumuAyarla(tedarikciDetayMevcutGorunum);
    
    // Görünüm değişince verileri yeniden render etmemiz gerekebilir
    // Basit çözüm: Yüklenmiş işaretini kaldırıp aktif sekmeyi tetiklemek
    yuklenenSekmeler.sut = false;
    yuklenenSekmeler.yem = false;
    yuklenenSekmeler.finans = false;
    
    // Aktif sekmeyi bul
    if (!document.getElementById('tab-content-sut').classList.contains('hidden')) sutGirdileriniYukle(1);
    else if (!document.getElementById('tab-content-yem').classList.contains('hidden')) yemIslemleriniYukle(1);
    else if (!document.getElementById('tab-content-finans').classList.contains('hidden')) finansalIslemleriYukle(1);
}

// --- VERİ YÜKLEME FONKSİYONLARI ---

async function loadInitialDetayData() {
    const ozetKartlariContainer = document.getElementById('ozet-kartlari');
    const baslikElementi = document.getElementById('tedarikci-adi-baslik');
    
    try {
        // Tek seferde Özet + Süt Girdileri (Sayfa 1) verisini çek
        const data = await api.fetchTedarikciDetayPageData(TEDARIKCI_ID, 1, KAYIT_SAYISI);

        if(baslikElementi) baslikElementi.innerText = data.isim;
        ozetKartlariniDoldur(data.ozet);

        // Süt Girdilerini Render Et
        const girdiler = data.girdiler;
        const toplamKayit = data.toplam_kayit;
        
        renderSutAsTable(document.getElementById('sut-girdileri-tablosu'), girdiler);
        renderSutAsCards(document.getElementById('sut-kart-gorunumu'), girdiler);
        
        const veriYok = document.getElementById('sut-veri-yok');
        if(veriYok) veriYok.classList.toggle('hidden', girdiler.length > 0);

        ui.sayfalamaNavOlustur('sut-sayfalama', toplamKayit, 1, KAYIT_SAYISI, sutGirdileriniYukle);
        yuklenenSekmeler.sut = true;

    } catch (error) {
        gosterMesaj("Veriler yüklenirken hata oluştu: " + error.message, "danger");
    }
}

async function sutGirdileriniYukle(sayfa = 1) {
    yuklenenSekmeler.sut = true;
    await genelVeriYukleyici({
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/sut_girdileri?sayfa=${sayfa}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'girdiler',
        tabloBodyId: 'sut-girdileri-tablosu',
        kartContainerId: 'sut-kart-gorunumu',
        veriYokId: 'sut-veri-yok',
        sayfalamaId: 'sut-sayfalama',
        tabloRenderFn: renderSutAsTable,
        kartRenderFn: renderSutAsCards,
        yukleFn: sutGirdileriniYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: tedarikciDetayMevcutGorunum
    });
}

async function yemIslemleriniYukle(sayfa = 1) {
    yuklenenSekmeler.yem = true;
    await genelVeriYukleyici({
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/yem_islemleri?sayfa=${sayfa}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'yem-islemleri-tablosu',
        kartContainerId: 'yem-kart-gorunumu',
        veriYokId: 'yem-veri-yok',
        sayfalamaId: 'yem-sayfalama',
        tabloRenderFn: renderYemAsTable,
        kartRenderFn: renderYemAsCards,
        yukleFn: yemIslemleriniYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: tedarikciDetayMevcutGorunum
    });
}

async function finansalIslemleriYukle(sayfa = 1) {
    yuklenenSekmeler.finans = true;
    await genelVeriYukleyici({
        apiURL: `/api/tedarikci/${TEDARIKCI_ID}/finansal_islemler?sayfa=${sayfa}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'finansal-islemler-tablosu',
        kartContainerId: 'finans-kart-gorunumu',
        veriYokId: 'finans-veri-yok',
        sayfalamaId: 'finans-sayfalama',
        tabloRenderFn: renderFinansAsTable,
        kartRenderFn: renderFinansAsCards,
        yukleFn: finansalIslemleriYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: tedarikciDetayMevcutGorunum
    });
}

// --- RENDER (GÖRSELLEŞTİRME) FONKSİYONLARI ---

// 1. Özet Kartları
function ozetKartlariniDoldur(ozet) {
    const container = document.getElementById('ozet-kartlari');
    if (!container) return;
    
    const items = [
        { title: 'Toplam Süt Alacağı', val: ozet.toplam_sut_alacagi, color: 'green' },
        { title: 'Toplam Yem Borcu', val: ozet.toplam_yem_borcu, color: 'red' },
        { title: 'Şirketten Ödeme', val: ozet.toplam_sirket_odemesi, color: 'yellow' },
        { title: 'Tahsilat', val: ozet.toplam_tahsilat, color: 'blue' },
        { title: 'Net Bakiye', val: ozet.net_bakiye, color: 'indigo' } 
    ];

    container.innerHTML = '';
    items.forEach(item => {
        const valStr = parseFloat(item.val || 0).toFixed(2) + ' TL';
        // Renk sınıfları (Tailwind safe-list'te olmalı veya tam yazılmalı)
        let colors = {
            green: 'bg-green-50 border-green-200 text-green-700',
            red: 'bg-red-50 border-red-200 text-red-700',
            yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            blue: 'bg-blue-50 border-blue-200 text-blue-700',
            indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700'
        };
        
        container.innerHTML += `
        <div class="${colors[item.color]} rounded-xl p-4 border text-center shadow-sm transition hover:shadow-md">
            <p class="text-xs font-semibold uppercase mb-1 opacity-80">${item.title}</p>
            <h3 class="text-xl font-bold">${valStr}</h3>
        </div>`;
    });
}

// 2. Süt Tablosu ve Kartları
function renderSutAsTable(container, veriler) {
    container.innerHTML = '';
    veriler.forEach(g => {
        const tarih = new Date(g.taplanma_tarihi).toLocaleDateString('tr-TR');
        const tutar = (g.litre * g.fiyat).toFixed(2);
        const kullanici = utils.sanitizeHTML(g.kullanici_adi || '-');
        
        container.innerHTML += `
        <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${tarih}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono font-medium">${parseFloat(g.litre).toFixed(2)} L</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">${parseFloat(g.fiyat).toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-bold text-right">${tutar} TL</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${kullanici}</td>
        </tr>`;
    });
}

function renderSutAsCards(container, veriler) {
    container.innerHTML = '';
    veriler.forEach(g => {
        const tarih = new Date(g.taplanma_tarihi).toLocaleDateString('tr-TR');
        const tutar = (g.litre * g.fiyat).toFixed(2);
        const kullanici = utils.sanitizeHTML(g.kullanici_adi || '-');

        container.innerHTML += `
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex justify-between items-center mb-3">
                <span class="text-lg font-bold text-brand-600">${parseFloat(g.litre).toFixed(2)} L</span>
                <span class="text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded">${tutar} TL</span>
            </div>
            <div class="flex justify-between items-center text-xs text-gray-500 border-t border-gray-100 pt-3">
                <div class="flex items-center gap-1"><i class="fa-solid fa-tag"></i> ${parseFloat(g.fiyat).toFixed(2)} TL</div>
                <div class="flex items-center gap-1"><i class="fa-regular fa-calendar"></i> ${tarih}</div>
            </div>
            <div class="mt-2 text-xs text-gray-400 text-right">Giren: ${kullanici}</div>
        </div>`;
    });
}

// 3. Yem Tablosu ve Kartları
function renderYemAsTable(container, veriler) {
    container.innerHTML = '';
    veriler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleDateString('tr-TR');
        const yemAdi = islem.yem_urunleri ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Silinmiş Ürün';
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        const fiyat = parseFloat(islem.islem_anindaki_birim_fiyat).toFixed(2);
        const toplam = parseFloat(islem.toplam_tutar).toFixed(2);
        const kullanici = islem.kullanicilar ? utils.sanitizeHTML(islem.kullanicilar.kullanici_adi) : '-';

        container.innerHTML += `
        <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${tarih}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${yemAdi}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">${miktar} KG</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${fiyat}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-bold">${toplam} TL</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">${kullanici}</span>
            </td>
        </tr>`;
    });
}

function renderYemAsCards(container, veriler) {
    container.innerHTML = '';
    veriler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleDateString('tr-TR');
        const yemAdi = islem.yem_urunleri ? utils.sanitizeHTML(islem.yem_urunleri.yem_adi) : 'Silinmiş Ürün';
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        const toplam = parseFloat(islem.toplam_tutar).toFixed(2);

        container.innerHTML += `
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start mb-2">
                <h5 class="font-bold text-gray-900 truncate pr-2">${yemAdi}</h5>
                <span class="text-xs text-gray-400 whitespace-nowrap">${tarih}</span>
            </div>
            <div class="flex justify-between items-center mt-3">
                <span class="text-sm font-medium text-gray-600">${miktar} KG</span>
                <span class="text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded">${toplam} TL</span>
            </div>
        </div>`;
    });
}

// 4. Finans Tablosu ve Kartları
function renderFinansAsTable(container, veriler) {
    container.innerHTML = '';
    veriler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleDateString('tr-TR');
        const tutar = parseFloat(islem.tutar).toFixed(2);
        const aciklama = utils.sanitizeHTML(islem.aciklama || '-');
        const kullanici = islem.kullanicilar ? utils.sanitizeHTML(islem.kullanicilar.kullanici_adi) : '-';
        
        let badgeClass = 'bg-gray-100 text-gray-800';
        let tutarClass = 'text-gray-900';
        
        if (islem.islem_tipi === 'Ödeme') { badgeClass = 'bg-green-100 text-green-800'; tutarClass = 'text-green-600'; }
        else if (islem.islem_tipi === 'Avans') { badgeClass = 'bg-yellow-100 text-yellow-800'; tutarClass = 'text-yellow-600'; }
        else if (islem.islem_tipi === 'Tahsilat') { badgeClass = 'bg-blue-100 text-blue-800'; tutarClass = 'text-blue-600'; }

        container.innerHTML += `
        <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${tarih}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${islem.islem_tipi}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${tutarClass}">${tutar} TL</td>
            <td class="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">${aciklama}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">${kullanici}</td>
        </tr>`;
    });
}

function renderFinansAsCards(container, veriler) {
    container.innerHTML = '';
    veriler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleDateString('tr-TR');
        const tutar = parseFloat(islem.tutar).toFixed(2);
        const aciklama = utils.sanitizeHTML(islem.aciklama || '-');
        
        let borderClass = 'border-gray-200';
        let textClass = 'text-gray-800';
        let badgeClass = 'bg-gray-100 text-gray-800';

        if (islem.islem_tipi === 'Ödeme') { borderClass = 'border-l-4 border-l-green-500'; textClass = 'text-green-700'; badgeClass = 'bg-green-100 text-green-800'; }
        else if (islem.islem_tipi === 'Avans') { borderClass = 'border-l-4 border-l-yellow-500'; textClass = 'text-yellow-700'; badgeClass = 'bg-yellow-100 text-yellow-800'; }
        else if (islem.islem_tipi === 'Tahsilat') { borderClass = 'border-l-4 border-l-blue-500'; textClass = 'text-blue-700'; badgeClass = 'bg-blue-100 text-blue-800'; }

        container.innerHTML += `
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow ${borderClass}">
            <div class="flex justify-between items-center mb-2">
                <span class="text-xs font-medium px-2 py-1 rounded-full ${badgeClass}">${islem.islem_tipi}</span>
                <span class="text-xs text-gray-400">${tarih}</span>
            </div>
            <div class="text-lg font-bold ${textClass} mb-2">${tutar} TL</div>
            <p class="text-sm text-gray-600 line-clamp-2">${aciklama}</p>
        </div>`;
    });
}

// --- PDF FONKSİYONLARI ---

function hesapOzetiIndir() {
    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const url = `/api/tedarikci/${TEDARIKCI_ID}/hesap_ozeti_pdf?ay=${ay}&yil=${yil}`;
    
    if (typeof indirVeAc === 'function') {
        indirVeAc(url, 'pdf-indir-btn', { success: 'İndirildi.', error: 'Hata.' });
    } else {
        window.open(url, '_blank');
    }
}

function mustahsilMakbuzuIndir() {
    const ay = document.getElementById('rapor-ay').value;
    const yil = document.getElementById('rapor-yil').value;
    const url = `/api/tedarikci/${TEDARIKCI_ID}/mustahsil_makbuzu_pdf?ay=${ay}&yil=${yil}`;
    
    if (typeof indirVeAc === 'function') {
        indirVeAc(url, 'mustahsil-indir-btn', { success: 'İndirildi.', error: 'Hata.' });
    } else {
        window.open(url, '_blank');
    }
}