// static/js/tedarikciler.js (TAILWIND UYUMLU)

let tedarikcilerMevcutGorunum = 'tablo';
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15;
let mevcutAramaTerimi = '';

// Sayfa Yüklendiğinde
window.onload = async () => {
    // Görünüm Ayarları
    tedarikcilerMevcutGorunum = localStorage.getItem('tedarikciGorunum') || 'tablo';
    gorunumuAyarla(tedarikcilerMevcutGorunum);

    // Arama Dinleyicisi
    const arama = document.getElementById('arama-input');
    if(arama) arama.addEventListener('input', (e) => {
        mevcutAramaTerimi = e.target.value;
        verileriYukle(1);
    });

    await verileriYukle();
};

// --- MODAL YÖNETİMİ (BASİT) ---
function toggleModal(id, show) {
    const el = document.getElementById(id);
    if(show) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

// --- VERİ YÜKLEME ---
async function verileriYukle(sayfa = 1) {
    mevcutSayfa = sayfa;
    // Data Loader kullanarak veriyi çek ve render et
    await genelVeriYukleyici({
        apiURL: `/api/tedarikciler_liste?sayfa=${sayfa}&arama=${encodeURIComponent(mevcutAramaTerimi)}&limit=${KAYIT_SAYISI}`,
        veriAnahtari: 'tedarikciler',
        tabloBodyId: 'tedarikciler-tablosu',
        kartContainerId: 'tedarikciler-kart-listesi',
        veriYokId: 'veri-yok-mesaji',
        sayfalamaId: 'tedarikci-sayfalama',
        tabloRenderFn: renderTable,
        kartRenderFn: renderCards,
        yukleFn: verileriYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: tedarikcilerMevcutGorunum
    });
}

// Tablo Oluşturucu
function renderTable(container, suppliers) {
    container.innerHTML = '';
    suppliers.forEach(s => {
        container.innerHTML += `
        <tr class="border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${utils.sanitizeHTML(s.isim)}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${utils.sanitizeHTML(s.telefon_no) || '-'}</td>
            <td class="px-6 py-4 text-sm text-right font-mono text-brand-600 font-bold">${parseFloat(s.toplam_litre||0).toFixed(2)} L</td>
            <td class="px-6 py-4 text-center flex justify-center gap-2">
                <a href="/tedarikci/${s.id}" class="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><i class="fa-solid fa-eye"></i></a>
                <button onclick="tedarikciDuzenleAc(${s.id})" class="p-1.5 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100"><i class="fa-solid fa-pen"></i></button>
                <button onclick="silmeOnayiAc(${s.id}, '${s.isim.replace(/'/g, "\\'")}')" class="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`;
    });
}

// Kart Oluşturucu
function renderCards(container, suppliers) {
    container.innerHTML = '';
    suppliers.forEach(s => {
        container.innerHTML += `
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start mb-3">
                <h3 class="font-bold text-gray-900">${utils.sanitizeHTML(s.isim)}</h3>
                <a href="/tedarikci/${s.id}" class="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded hover:bg-blue-100">Detay</a>
            </div>
            <p class="text-sm text-gray-500 mb-2"><i class="fa-solid fa-phone mr-2"></i>${s.telefon_no || '-'}</p>
            <div class="flex justify-between items-center border-t border-gray-50 pt-2">
                <span class="font-bold text-brand-600 text-lg">${parseFloat(s.toplam_litre||0).toFixed(2)} L</span>
                <div class="flex gap-1">
                    <button onclick="tedarikciDuzenleAc(${s.id})" class="p-1 text-yellow-600 hover:bg-yellow-50 rounded"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="silmeOnayiAc(${s.id}, '${s.isim.replace(/'/g, "\\'")}')" class="p-1 text-red-600 hover:bg-red-50 rounded"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    });
}

// --- İŞLEMLER ---

// Yeni Ekle
function yeniTedarikciAc() {
    document.getElementById('tedarikciModalLabel').innerText = 'Yeni Tedarikçi Ekle';
    document.getElementById('edit-tedarikci-id').value = '';
    document.getElementById('tedarikci-form').reset();
    toggleModal('tedarikciModal', true);
}

// Düzenle
async function tedarikciDuzenleAc(id) {
    try {
        const s = await api.request(`/api/tedarikci/${id}`);
        document.getElementById('tedarikciModalLabel').innerText = 'Tedarikçi Düzenle';
        document.getElementById('edit-tedarikci-id').value = s.id;
        document.getElementById('tedarikci-isim-input').value = s.isim;
        document.getElementById('tedarikci-tc-input').value = s.tc_no || '';
        document.getElementById('tedarikci-tel-input').value = s.telefon_no || '';
        document.getElementById('tedarikci-adres-input').value = s.adres || '';
        toggleModal('tedarikciModal', true);
    } catch(e) { gosterMesaj('Bilgi alınamadı.', 'danger'); }
}

// Kaydet (Hem Yeni Hem Düzenleme)
async function tedarikciKaydet() {
    const id = document.getElementById('edit-tedarikci-id').value;
    const veri = {
        isim: document.getElementById('tedarikci-isim-input').value,
        tc_no: document.getElementById('tedarikci-tc-input').value,
        telefon_no: document.getElementById('tedarikci-tel-input').value,
        adres: document.getElementById('tedarikci-adres-input').value
    };

    if(!veri.isim) { gosterMesaj('İsim zorunlu.', 'warning'); return; }

    try {
        const res = id ? await api.updateTedarikci(id, veri) : await api.postTedarikci(veri);
        gosterMesaj(res.message, 'success');
        toggleModal('tedarikciModal', false);
        verileriYukle(id ? mevcutSayfa : 1);
    } catch(e) { gosterMesaj(e.message, 'danger'); }
}

// Silme
function silmeOnayiAc(id, isim) {
    document.getElementById('silinecek-tedarikci-id').value = id;
    document.getElementById('silinecek-tedarikci-adi').innerText = isim;
    toggleModal('silmeOnayModal', true);
}

async function tedarikciSil() {
    const id = document.getElementById('silinecek-tedarikci-id').value;
    toggleModal('silmeOnayModal', false);
    try {
        const res = await api.deleteTedarikci(id);
        gosterMesaj(res.message, 'success');
        verileriYukle(1);
    } catch(e) { gosterMesaj(e.message, 'danger'); }
}

// Görünüm Değiştir
function gorunumuDegistir(v) {
    tedarikcilerMevcutGorunum = v;
    localStorage.setItem('tedarikciGorunum', v);
    gorunumuAyarla(v);
    verileriYukle(mevcutSayfa);
}

function gorunumuAyarla(v) {
    document.getElementById('tablo-gorunumu').classList.add('hidden');
    document.getElementById('kart-gorunumu').classList.add('hidden');
    document.getElementById(v + '-gorunumu').classList.remove('hidden');
    
    const btnT = document.getElementById('btn-view-table');
    const btnC = document.getElementById('btn-view-card');
    
    if(v==='tablo') {
        btnT.classList.add('bg-white', 'shadow-sm', 'text-brand-600');
        btnC.classList.remove('bg-white', 'shadow-sm', 'text-brand-600');
    } else {
        btnC.classList.add('bg-white', 'shadow-sm', 'text-brand-600');
        btnT.classList.remove('bg-white', 'shadow-sm', 'text-brand-600');
    }
}