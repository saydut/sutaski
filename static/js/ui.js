// static/js/ui.js

if (typeof renderUtils === 'undefined' || typeof utils === 'undefined') {
    console.error("ui.js: Gerekli kütüphaneler eksik.");
}

// --- TOAST MESAJ SİSTEMİ (Tailwind) ---
function gosterMesaj(mesaj, tip = 'info', sure = 4000, allowHTML = false) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    
    // Renk ve İkonlar
    let icon = '<i class="fa-solid fa-circle-info text-blue-500 text-xl"></i>';
    let borderClass = 'border-l-4 border-blue-500';
    let bgClass = 'bg-blue-50';
    
    if (tip === 'success') { 
        icon = '<i class="fa-solid fa-circle-check text-green-500 text-xl"></i>'; 
        borderClass = 'border-l-4 border-green-500'; 
        bgClass = 'bg-green-50';
    } else if (tip === 'danger') { 
        icon = '<i class="fa-solid fa-circle-xmark text-red-500 text-xl"></i>'; 
        borderClass = 'border-l-4 border-red-500'; 
        bgClass = 'bg-red-50';
    } else if (tip === 'warning') { 
        icon = '<i class="fa-solid fa-triangle-exclamation text-yellow-500 text-xl"></i>'; 
        borderClass = 'border-l-4 border-yellow-500'; 
        bgClass = 'bg-yellow-50';
    }

    toast.className = `pointer-events-auto flex items-center w-full max-w-xs p-4 space-x-3 text-gray-600 bg-white rounded-lg shadow-lg border border-gray-100 transform transition-all duration-300 translate-x-full opacity-0 ${borderClass}`;
    
    const content = allowHTML ? mesaj : utils.sanitizeHTML(mesaj);
    toast.innerHTML = `${icon}<div class="pl-2 text-sm font-medium">${content}</div>`;

    container.appendChild(toast);

    // Animasyon
    requestAnimationFrame(() => { toast.classList.remove('translate-x-full', 'opacity-0'); });
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, sure);
}

// --- SAYI ANİMASYONU ---
function animateCounter(element, finalValue, duration = 1000, suffix = '', decimalPlaces = 0) {
    if (!element) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        let currentValue = progress * finalValue;
        element.textContent = currentValue.toFixed(decimalPlaces) + suffix;
        if (progress < 1) window.requestAnimationFrame(step);
        else element.textContent = finalValue.toFixed(decimalPlaces) + suffix;
    };
    window.requestAnimationFrame(step);
}

const ui = {
    tarihFiltreleyici: null,
    tedarikciSecici: null,
    tumTedarikciler: [],

    init() { console.log("UI Başlatıldı"); },

    // Lisans Kontrolü
    lisansUyarisiKontrolEt() {
        const bitis = document.body.dataset.lisansBitis;
        if (!bitis || bitis === 'None') return;
        const gunFarki = Math.ceil((new Date(bitis) - new Date()) / (1000 * 3600 * 24));
        if (gunFarki < 0) gosterMesaj(`Lisansınız ${Math.abs(gunFarki)} gün önce doldu!`, 'danger', 8000);
        else if (gunFarki <= 15) gosterMesaj(`Lisansın dolmasına ${gunFarki} gün kaldı.`, 'warning', 6000);
    },

    // Özet Panelleri
    toggleOzetPanelsLoading(isLoading) {
        const loader = '<i class="fa-solid fa-circle-notch fa-spin text-brand-500"></i>';
        const p1 = document.getElementById('toplam-litre-panel');
        const p2 = document.getElementById('bugunku-girdi-sayisi');
        if (isLoading && p1 && p2) { p1.innerHTML = loader; p2.innerHTML = loader; }
    },

    updateOzetPanels(data, effectiveDate) {
        const p1 = document.getElementById('toplam-litre-panel');
        const p2 = document.getElementById('bugunku-girdi-sayisi');
        
        // EKSİK OLAN FONKSİYON BURADA ÇAĞRILIYOR:
        this.updateGirdilerBaslik(effectiveDate);

        if (data && p1 && p2) {
            animateCounter(p1, parseFloat(data.toplam_litre) || 0, 1000, ' L', 2);
            animateCounter(p2, parseInt(data.girdi_sayisi) || 0, 800, '', 0);
        }
    },

    // --- EKSİK OLAN FONKSİYON EKLENDİ ---
    updateGirdilerBaslik(formatliTarih) {
        const baslik = document.getElementById('girdiler-baslik');
        const ozetBaslik = document.getElementById('ozet-panel-baslik');
        
        if (!baslik) return;
        
        const bugun = utils.getLocalDateString();
        if (formatliTarih === bugun) {
            baslik.textContent = 'Bugünkü Girdiler';
            if(ozetBaslik) ozetBaslik.textContent = 'GÜNLÜK TOPLAM';
        } else {
            baslik.textContent = `${formatliTarih} Girdileri`;
            if(ozetBaslik) ozetBaslik.textContent = `${formatliTarih} TOPLAMI`;
        }
    },

    // İskelet Yükleme (Skeleton)
    showGirdilerLoadingSkeleton(gorunum) {
        const container = gorunum === 'liste' ? document.getElementById('girdiler-listesi') : document.getElementById('girdiler-kart-listesi');
        if(!container) return;
        container.innerHTML = '';
        
        let html = '';
        for(let i=0; i<4; i++) {
            if (gorunum === 'liste') {
                html += `
                <div class="p-4 border-b border-gray-100 animate-pulse flex justify-between">
                    <div class="w-2/3 space-y-2">
                        <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div class="h-3 bg-gray-100 rounded w-1/2"></div>
                    </div>
                    <div class="h-8 w-8 bg-gray-100 rounded"></div>
                </div>`;
            } else {
                html += `
                <div class="bg-white p-4 rounded-xl border border-gray-200 animate-pulse h-32">
                    <div class="flex justify-between mb-4">
                        <div class="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div class="h-8 bg-gray-200 rounded w-1/3"></div>
                </div>`;
            }
        }
        container.innerHTML = html;
    },

    // Render Yönlendirici
    renderGirdiler(girdiler, gorunum) {
        const veriYok = document.getElementById('veri-yok-mesaji');
        const listeContainer = document.getElementById('girdiler-listesi');
        const kartContainer = document.getElementById('girdiler-kart-listesi');

        if(listeContainer) listeContainer.innerHTML = '';
        if(kartContainer) kartContainer.innerHTML = '';

        if (!girdiler || girdiler.length === 0) {
            if(veriYok) veriYok.classList.remove('hidden');
            return;
        }
        if(veriYok) veriYok.classList.add('hidden');

        if (gorunum === 'liste' && listeContainer) {
            listeContainer.innerHTML = renderUtils.renderSutGirdileriAsList(girdiler);
        } else if (kartContainer) {
            kartContainer.innerHTML = renderUtils.renderSutGirdileriAsCards(girdiler);
        }
    },

    // Offline Veri Birleştirme
    mergeOnlineOfflineGirdiler(sunucuVerisi, bekleyenGirdiler, tarih) {
        let tumGirdiler = sunucuVerisi.girdiler || [];
        let toplamGirdi = sunucuVerisi.toplam_girdi_sayisi || 0;

        if (bekleyenGirdiler && bekleyenGirdiler.length > 0 && tarih === utils.getLocalDateString(new Date())) {
            const islenmisBekleyenler = bekleyenGirdiler.map(girdi => {
                const tedarikci = this.tumTedarikciler.find(t => t.id === girdi.tedarikci_id);
                return {
                    id: `offline-${girdi.id}`, litre: girdi.litre, fiyat: girdi.fiyat,
                    taplanma_tarihi: girdi.eklendigi_zaman, duzenlendi_mi: false, isOffline: true,
                    kullanicilar: { kullanici_adi: 'Siz' },
                    tedarikciler: { isim: tedarikci ? utils.sanitizeHTML(tedarikci.isim) : `ID: ${girdi.tedarikci_id}` }
                };
            });
            tumGirdiler = [...islenmisBekleyenler.reverse(), ...tumGirdiler];
            toplamGirdi += islenmisBekleyenler.length;
        }
        return { tumGirdiler, toplamGirdi };
    },

    // Sayfalama
    sayfalamaNavOlustur(containerId, toplamOge, aktifSayfa, limit, callback) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        
        const toplamSayfa = Math.ceil(toplamOge / limit);
        if (toplamSayfa <= 1) return;

        const nav = document.createElement('div');
        nav.className = 'flex justify-center gap-1';

        const makeBtn = (page, text, active) => {
            const btn = document.createElement('button');
            btn.className = active 
                ? 'px-3 py-1 rounded bg-brand-600 text-white text-sm font-medium' 
                : 'px-3 py-1 rounded bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 text-sm transition-colors';
            btn.innerHTML = text;
            if(!active) btn.onclick = () => callback(page);
            return btn;
        };

        if (aktifSayfa > 1) nav.appendChild(makeBtn(aktifSayfa - 1, '<', false));
        
        if(toplamSayfa <= 5) {
            for(let i=1; i<=toplamSayfa; i++) nav.appendChild(makeBtn(i, i, i===aktifSayfa));
        } else {
             nav.appendChild(makeBtn(aktifSayfa, aktifSayfa, true));
        }
        
        if (aktifSayfa < toplamSayfa) nav.appendChild(makeBtn(aktifSayfa + 1, '>', false));
        container.appendChild(nav);
    },

    // Form İşlemleri
    doldurTedarikciSecici(tedarikciler) {
        this.tumTedarikciler = tedarikciler;
        if (this.tedarikciSecici) {
            this.tedarikciSecici.clearOptions();
            this.tedarikciSecici.addOptions(tedarikciler.map(t => ({value: t.id, text: utils.sanitizeHTML(t.isim)})));
        }
    },

    getGirdiFormVerisi() {
        return {
            tedarikciId: this.tedarikciSecici ? this.tedarikciSecici.getValue() : null,
            litre: document.getElementById('litre-input').value,
            fiyat: document.getElementById('fiyat-input').value
        };
    },

    resetGirdiFormu() {
        document.getElementById('litre-input').value = '';
        if(this.tedarikciSecici) this.tedarikciSecici.clear();
    },

    getDuzenlemeFormVerisi() {
        return {
            girdiId: document.getElementById('edit-girdi-id').value,
            yeniLitre: document.getElementById('edit-litre-input').value,
            yeniFiyat: document.getElementById('edit-fiyat-input').value,
            duzenlemeSebebi: document.getElementById('edit-sebep-input').value
        };
    },
    
    getSilinecekGirdiId() { return document.getElementById('silinecek-girdi-id').value; },
    
    toggleGirdiKaydetButton(loading) {
        const btn = document.getElementById('kaydet-girdi-btn');
        if(btn) {
            btn.disabled = loading;
            btn.innerHTML = loading ? '<i class="fa-solid fa-circle-notch fa-spin"></i>' : 'Kaydet';
        }
    },

    checkOfflineUserLicense() { return true; }
};