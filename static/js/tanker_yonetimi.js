// static/js/tanker_yonetimi.js

// === GLOBAL DEĞİŞKENLER ===
let tankerAtamaSecici;
let tumTankerler = []; 
let tumToplayicilar = []; 
let tankerMap = new Map(); 
let seciliToplayiciId = null; 

// === SAYFA YÜKLENİNCE ===
document.addEventListener('DOMContentLoaded', function() {
    
    // TomSelect Başlat
    tankerAtamaSecici = new TomSelect("#tanker-atama-secici", {
        create: false,
        sortField: { field: "text", direction: "asc" },
        placeholder: "Tanker seçin..."
    });
    
    // Arama Dinleyicisi
    const aramaInput = document.getElementById('toplayici-arama-input');
    if (aramaInput) {
        aramaInput.addEventListener('input', (e) => {
            renderToplayiciListesi(tumToplayicilar, e.target.value);
        });
    }

    // Form Dinleyicisi
    const form = document.getElementById('yeni-tanker-form');
    if(form) {
        form.addEventListener('submit', (e) => { e.preventDefault(); tankerEkle(); });
    }

    // İlk Yükleme
    tankerleriYukle();
});

// HTML'den çağrılan Tab Değişim Tetikleyicisi
window.onTabChanged = function(tabName) {
    if (tabName === 'durum') {
        tankerleriYukle();
    } else if (tabName === 'atama') {
        // Veri yoksa veya bayatsa yükle
        if (tumToplayicilar.length === 0) {
            loadAtamaSekmesi();
        }
    }
};

// --- TANKER LİSTELEME ---

async function tankerleriYukle() {
    const container = document.getElementById('tanker-listesi-container');
    const veriYokMesaji = document.getElementById('tanker-veri-yok');
    
    if (!container) return;

    // Yükleniyor göstergesi (Tailwind)
    container.innerHTML = '<div class="col-span-full text-center py-8 text-gray-500"><i class="fa-solid fa-circle-notch fa-spin text-brand-500 mr-2"></i> Yükleniyor...</div>';
    veriYokMesaji.classList.add('hidden');

    try {
        // forceRefresh = true ile taze veri çek
        tumTankerler = await store.getTankers(true); 

        if (!tumTankerler || tumTankerler.length === 0) {
            container.innerHTML = '';
            veriYokMesaji.classList.remove('hidden');
            return;
        }

        renderTankerListesi(tumTankerler);

    } catch (error) {
        container.innerHTML = `<div class="col-span-full text-center text-red-500 py-4">Hata: ${error.message}</div>`;
    }
}

function renderTankerListesi(tankerler) {
    const container = document.getElementById('tanker-listesi-container');
    container.innerHTML = ''; 

    tankerler.forEach(tanker => {
        const kapasite = parseFloat(tanker.kapasite_litre);
        const doluluk = parseFloat(tanker.mevcut_doluluk);
        const yuzde = Math.min(100, Math.max(0, parseInt(tanker.doluluk_yuzdesi || 0, 10)));
        const safeTankerAdi = utils.sanitizeHTML(tanker.tanker_adi);

        // Renk belirleme (Tailwind)
        let colorClass = 'bg-green-500';
        let textClass = 'text-green-600';
        if (yuzde > 75) { colorClass = 'bg-yellow-500'; textClass = 'text-yellow-600'; }
        if (yuzde > 95) { colorClass = 'bg-red-500'; textClass = 'text-red-600'; }

        const cardHtml = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow" id="tanker-kart-${tanker.id}">
                <div class="p-5">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h5 class="font-bold text-gray-900 text-lg">${safeTankerAdi}</h5>
                            <p class="text-xs text-gray-500 mt-1">Kapasite: ${kapasite} L</p>
                        </div>
                        <div class="flex gap-1">
                            <button class="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50" 
                                    onclick="tankerSilmeyiOnayla(${tanker.id}, '${safeTankerAdi.replace(/'/g, "\\'")}')" title="Sil">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="mb-2 flex justify-between items-end">
                        <span class="text-sm font-medium text-gray-600">Doluluk</span>
                        <span class="text-sm font-bold ${textClass}">${doluluk.toFixed(0)} L (${yuzde}%)</span>
                    </div>
                    
                    <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div class="${colorClass} h-3 rounded-full transition-all duration-500" style="width: ${yuzde}%"></div>
                    </div>
                    
                    <div class="mt-5 pt-4 border-t border-gray-100">
                        <button class="w-full py-2 px-3 bg-gray-50 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed flex justify-center items-center" disabled>
                            <i class="fa-solid fa-lock mr-2"></i> Satış/Boşaltma (Yakında)
                        </button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += cardHtml;
    });
}

// --- YENİ TANKER EKLEME ---

function yeniTankerModaliniAc() {
    document.getElementById('yeni-tanker-form').reset();
    toggleModal('yeniTankerModal', true);
}

async function tankerEkle() {
    const btn = document.getElementById('kaydet-tanker-btn');
    const originalText = btn.innerText;

    const veri = {
        tanker_adi: document.getElementById('tanker-adi-input').value.trim(),
        kapasite: document.getElementById('tanker-kapasite-input').value
    };

    if (!veri.tanker_adi || !veri.kapasite || parseFloat(veri.kapasite) <= 0) {
        gosterMesaj('Lütfen geçerli bir ad ve kapasite girin.', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    try {
        const result = await api.request('/tanker/api/ekle', {
            method: 'POST',
            body: JSON.stringify(veri),
            headers: { 'Content-Type': 'application/json' }
        });
        
        gosterMesaj(result.message, 'success');
        toggleModal('yeniTankerModal', false);
        
        await store.getTankers(true); 
        await tankerleriYukle(); 
        tumToplayicilar = []; // Atama listesini yenilemek için cache boz

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// --- ATAMA İŞLEMLERİ ---

async function loadAtamaSekmesi() {
    const listeContainer = document.getElementById('toplayici-atama-listesi');
    const veriYokMesaji = document.getElementById('toplayici-veri-yok');
    
    listeContainer.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Yükleniyor...</div>';
    veriYokMesaji.classList.add('hidden');

    try {
        const [toplayicilar, tankerler] = await Promise.all([
            api.request('/tanker/api/atamalar').then(res => res.toplayicilar), // API yapısı biraz farklı olabilir, kontrol edilmeli
            store.getTankers(true)
        ]);
        
        // Not: Backend'de '/tanker/api/atamalar' endpointi hem atamaları hem toplayıcıları dönüyor (msg 66).
        // Ama biz burada basitleştirmek için toplayıcıları ayrı, atamaları ayrı işleyebiliriz.
        // Şimdilik var olan API yapısına sadık kalalım:
        // '/tanker/api/atamalar' -> { atamalar: [...], toplayicilar: [...] }
        
        const response = await api.request('/tanker/api/atamalar');
        const atamalar = response.atamalar || [];
        const rawToplayicilar = response.toplayicilar || [];
        tumTankerler = tankerler || []; 

        // Toplayıcı listesi ile atamaları birleştir
        tumToplayicilar = rawToplayicilar.map(t => {
            const atama = atamalar.find(a => a.toplayici_user_id === t.id);
            return {
                ...t,
                atanan_tanker_id: atama ? atama.tanker_id : null,
                atanan_tanker_adi: atama && atama.tankerler ? atama.tankerler.tanker_adi : null
            };
        });

        if (tumToplayicilar.length === 0) {
            listeContainer.innerHTML = '';
            veriYokMesaji.classList.remove('hidden');
        } else {
            renderToplayiciListesi(tumToplayicilar);
        }
        
        renderTankerSecici(tumTankerler);

    } catch (error) {
        listeContainer.innerHTML = '';
        gosterMesaj(`Hata: ${error.message}`, 'danger');
    }
}

function renderToplayiciListesi(toplayicilar, filtre = '') {
    const container = document.getElementById('toplayici-atama-listesi');
    container.innerHTML = '';
    
    const arama = filtre.toLowerCase().trim();
    let count = 0;

    toplayicilar.forEach(t => {
        if (arama && !t.kullanici_adi.toLowerCase().includes(arama)) return;
        count++;

        const tankerAdi = t.atanan_tanker_adi || 'Atanmamış';
        const tankerId = t.atanan_tanker_id || 0;
        const badgeColor = t.atanan_tanker_id ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200';
        
        // Aktif seçim kontrolü
        const isActive = seciliToplayiciId == t.id ? 'bg-brand-50 border-brand-200 ring-1 ring-brand-200' : 'hover:bg-gray-50 border-transparent';

        container.innerHTML += `
            <div class="cursor-pointer p-3 rounded-lg border transition-all mb-1 ${isActive}"
                 onclick="atamaIcinToplayiciSec(this, ${t.id}, '${utils.sanitizeHTML(t.kullanici_adi)}', ${tankerId})">
                <div class="flex justify-between items-center">
                    <h6 class="font-medium text-gray-900">${utils.sanitizeHTML(t.kullanici_adi)}</h6>
                    <span class="text-xs px-2 py-1 rounded-full border ${badgeColor} font-medium">${tankerAdi}</span>
                </div>
            </div>
        `;
    });

    if (count === 0) container.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">Sonuç bulunamadı.</div>';
}

function renderTankerSecici(tankerler) {
    tankerAtamaSecici.clear();
    tankerAtamaSecici.clearOptions();
    tankerAtamaSecici.addOption({ value: 0, text: "--- Tanker Atanmamış ---" });
    
    tankerler.forEach(t => {
        tankerAtamaSecici.addOption({
            value: t.id,
            text: `${utils.sanitizeHTML(t.tanker_adi)} (${t.kapasite_litre} L)`
        });
    });
}

function atamaIcinToplayiciSec(el, id, ad, tankerId) {
    seciliToplayiciId = id;
    
    // Görsel güncelleme
    const list = document.getElementById('toplayici-atama-listesi');
    Array.from(list.children).forEach(child => {
        child.classList.remove('bg-brand-50', 'border-brand-200', 'ring-1', 'ring-brand-200');
        child.classList.add('border-transparent');
    });
    el.classList.remove('border-transparent');
    el.classList.add('bg-brand-50', 'border-brand-200', 'ring-1', 'ring-brand-200');

    // Sağ paneli güncelle
    document.getElementById('atama-paneli-secim-bekliyor').style.display = 'none';
    document.getElementById('atama-paneli-sag').style.display = 'block';
    
    document.getElementById('atama-toplayici-adi').innerText = ad;
    document.getElementById('atanacak-toplayici-id').value = id;
    tankerAtamaSecici.setValue(tankerId || 0);
}

async function tankerAta() {
    const toplayiciId = document.getElementById('atanacak-toplayici-id').value;
    const tankerId = tankerAtamaSecici.getValue();
    const btn = document.getElementById('atama-kaydet-btn');
    const original = btn.innerText;

    if (!toplayiciId) return;

    btn.disabled = true; btn.innerText = 'Kaydediliyor...';

    try {
        // API endpoint'i (daha önce oluşturduğumuz)
        await api.request('/tanker/api/ata', {
            method: 'POST',
            body: JSON.stringify({ toplayici_id: parseInt(toplayiciId), tanker_id: parseInt(tankerId) }),
            headers: { 'Content-Type': 'application/json' }
        });

        gosterMesaj('Atama başarıyla güncellendi.', 'success');
        
        // Listeyi yerel olarak güncelle (Tekrar API çağrısı yapmadan)
        const index = tumToplayicilar.findIndex(t => t.id == toplayiciId);
        if (index !== -1) {
            tumToplayicilar[index].atanan_tanker_id = parseInt(tankerId) || null;
            const tnk = tumTankerler.find(t => t.id == tankerId);
            tumToplayicilar[index].atanan_tanker_adi = tnk ? tnk.tanker_adi : 'Atanmamış';
        }
        
        renderToplayiciListesi(tumToplayicilar, document.getElementById('toplayici-arama-input').value);
        
        // Paneli sıfırla
        document.getElementById('atama-paneli-secim-bekliyor').style.display = 'block';
        document.getElementById('atama-paneli-sag').style.display = 'none';
        seciliToplayiciId = null;

    } catch (e) {
        gosterMesaj(e.message, 'danger');
    } finally {
        btn.disabled = false; btn.innerText = original;
    }
}

function atamaKaldir() {
    tankerAtamaSecici.setValue(0);
    tankerAta();
}

// --- SİLME ---

function tankerSilmeyiOnayla(id, ad) {
    if(confirm(`'${ad}' tankerini silmek istediğinize emin misiniz?`)) {
        tankerSil(id);
    }
}

async function tankerSil(id) {
    try {
        await api.request(`/tanker/api/sil/${id}`, { method: 'DELETE' });
        gosterMesaj('Tanker silindi.', 'success');
        
        // Cache temizle ve yenile
        await store.getTankers(true);
        tankerleriYukle();
        
        // Atama listesini de yenile (eğer o tanker birine atanmışsa bozulmasın diye)
        tumToplayicilar = []; 

    } catch (e) {
        gosterMesaj(e.message, 'danger');
    }
}