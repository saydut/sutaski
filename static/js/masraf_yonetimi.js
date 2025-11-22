// static/js/masraf_yonetimi.js (KATEGORİ DÜZELTMESİ)

let tarihPicker;

async function verileriYukle() {
    const tbody = document.getElementById('masraflar-tablosu');
    const veriYok = document.getElementById('veri-yok-mesaji');
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><i class="fa-solid fa-circle-notch fa-spin text-gray-400"></i></td></tr>';

    try {
        await kategorileriDoldur();
        const data = await api.fetchMasraflar(1, 50);
        tbody.innerHTML = '';
        
        if (!data || !data.masraflar || data.masraflar.length === 0) {
            if(veriYok) veriYok.classList.remove('hidden');
            return;
        }
        if(veriYok) veriYok.classList.add('hidden');

        data.masraflar.forEach(m => {
            const tarih = new Date(m.tarih).toLocaleDateString('tr-TR');
            // DÜZELTME: Hem ad hem kategori_adi kontrolü
            const kat = m.kategori ? utils.sanitizeHTML(m.kategori.ad || m.kategori.kategori_adi) : '-';
            
            tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
                <td class="px-6 py-4 text-sm text-gray-900">${tarih}</td>
                <td class="px-6 py-4 text-sm"><span class="bg-gray-100 px-2 py-1 rounded text-xs text-gray-700">${kat}</span></td>
                <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">${utils.sanitizeHTML(m.aciklama)}</td>
                <td class="px-6 py-4 text-right font-bold text-red-600 font-mono">-${parseFloat(m.tutar).toFixed(2)} TL</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="silmeOnayiAc(${m.id})" class="p-1.5 text-red-600 hover:bg-red-50 rounded"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        });
    } catch (e) {
        tbody.innerHTML = '';
        gosterMesaj('Veriler yüklenemedi.', 'danger');
    }
}

async function kategorileriDoldur() {
    const select = document.getElementById('masraf-kategori-sec');
    const list = document.getElementById('kategori-listesi');
    try {
        const data = await api.fetchMasrafKategorileri();
        select.innerHTML = '';
        list.innerHTML = '';
        
        data.forEach(k => {
            // DÜZELTME: İsim kontrolü
            const isim = utils.sanitizeHTML(k.ad || k.kategori_adi);
            
            const opt = document.createElement('option');
            opt.value = k.id;
            opt.innerText = isim;
            select.appendChild(opt);

            list.innerHTML += `
                <li class="flex justify-between items-center py-2 px-1 hover:bg-gray-50">
                    <span>${isim}</span>
                    <button onclick="kategoriSil(${k.id})" class="text-red-500 hover:text-red-700 text-xs"><i class="fa-solid fa-trash"></i></button>
                </li>`;
        });
    } catch(e) {}
}

async function kategoriEkle() {
    const ad = document.getElementById('yeni-kategori-ad').value.trim();
    if(!ad) return;
    try {
        // DÜZELTME: Backend'e garanti olsun diye iki türlü de gönderiyoruz
        await api.postMasrafKategorisi({ ad: ad, kategori_adi: ad });
        document.getElementById('yeni-kategori-ad').value = '';
        kategorileriDoldur(); 
        gosterMesaj('Kategori eklendi.', 'success');
    } catch(e) { gosterMesaj(e.message, 'danger'); }
}

// ... (Diğer fonksiyonlar aynı kalabilir: masrafEkle, silmeOnayiAc, masrafSil, kategoriSil)

async function masrafEkle(e) {
    e.preventDefault();
    const btn = document.getElementById('kaydet-btn');
    const original = btn.innerHTML;
    const veri = {
        kategori_id: document.getElementById('masraf-kategori-sec').value,
        tutar: document.getElementById('masraf-tutar').value,
        tarih: document.getElementById('masraf-tarih').value,
        aciklama: document.getElementById('masraf-aciklama').value.trim()
    };
    if (!veri.kategori_id || !veri.tutar) { gosterMesaj('Kategori ve Tutar zorunlu.', 'warning'); return; }
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    try {
        await api.postMasraf(veri);
        gosterMesaj('Masraf kaydedildi.', 'success');
        document.getElementById('masraf-form').reset();
        if(tarihPicker) tarihPicker.setDate(new Date());
        verileriYukle();
    } catch(err) { gosterMesaj(err.message, 'danger'); }
    finally { btn.disabled = false; btn.innerHTML = original; }
}

function silmeOnayiAc(id) { document.getElementById('silinecek-masraf-id').value = id; toggleModal('silmeOnayModal', true); }
async function masrafSil() {
    const id = document.getElementById('silinecek-masraf-id').value;
    toggleModal('silmeOnayModal', false);
    try { await api.deleteMasraf(id); gosterMesaj('Masraf silindi.', 'success'); verileriYukle(); } 
    catch(e) { gosterMesaj(e.message, 'danger'); }
}
function kategoriModalAc() { toggleModal('kategoriModal', true); }
async function kategoriSil(id) { if(!confirm("Kategori silinsin mi?")) return; try { await api.deleteMasrafKategorisi(id); kategorileriDoldur(); } catch(e) { gosterMesaj('Bu kategori kullanımda olabilir.', 'danger'); } }

window.onload = function() {
    const form = document.getElementById('masraf-form');
    if(form) form.addEventListener('submit', masrafEkle);
    tarihPicker = flatpickr("#masraf-tarih", { dateFormat: "Y-m-d", locale: "tr", defaultDate: "today", allowInput: true });
    verileriYukle();
};