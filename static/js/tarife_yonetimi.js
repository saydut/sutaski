// static/js/tarife_yonetimi.js

let baslangicPicker, bitisPicker, editBaslangicPicker, editBitisPicker;

// --- FONKSİYONLAR ---
async function verileriYukle() {
    const tbody = document.getElementById('tarifeler-tablosu');
    const veriYok = document.getElementById('veri-yok-mesaji');
    
    tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4"><i class="fa-solid fa-circle-notch fa-spin text-gray-400"></i></td></tr>';

    try {
        const data = await api.fetchTarifeler(); 
        tbody.innerHTML = '';
        
        if (!data || data.length === 0) {
            if(veriYok) veriYok.classList.remove('hidden');
            return;
        }
        if(veriYok) veriYok.classList.add('hidden');

        data.forEach(t => {
            const bas = new Date(t.baslangic_tarihi).toLocaleDateString('tr-TR');
            const bit = t.bitis_tarihi ? new Date(t.bitis_tarihi).toLocaleDateString('tr-TR') : 'Süresiz';
            
            // Aktiflik Kontrolü
            const bugun = new Date();
            bugun.setHours(0,0,0,0);
            const basTarih = new Date(t.baslangic_tarihi);
            const bitTarih = t.bitis_tarihi ? new Date(t.bitis_tarihi) : null;
            
            let aktifHtml = '<span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">Geçmiş</span>';
            if (basTarih <= bugun && (!bitTarih || bitTarih >= bugun)) {
                aktifHtml = '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Aktif</span>';
            } else if (basTarih > bugun) {
                aktifHtml = '<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Gelecek</span>';
            }

            // Fiyatları al (Eski 'fiyat' veya yeni 'alis_fiyati' uyumluluğu)
            const alis = parseFloat(t.alis_fiyati || t.fiyat || 0).toFixed(2);
            const satis = parseFloat(t.satis_fiyati || 0).toFixed(2);

            tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-100">
                <td class="px-6 py-4 text-sm text-gray-900">${bas}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${bit}</td>
                <td class="px-6 py-4 text-right font-bold text-red-600 font-mono">${alis} TL</td>
                <td class="px-6 py-4 text-right font-bold text-green-600 font-mono">${satis} TL</td>
                <td class="px-6 py-4 text-center">${aktifHtml}</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="duzenleModaliniAc(${t.id}, '${t.baslangic_tarihi}', '${t.bitis_tarihi || ''}', '${alis}', '${satis}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded mr-1"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="silmeOnayiAc(${t.id})" class="p-1.5 text-red-600 hover:bg-red-50 rounded"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '';
        gosterMesaj('Veriler yüklenemedi.', 'danger');
    }
}

async function tarifeEkle(e) {
    e.preventDefault();
    const btn = document.getElementById('kaydet-btn');
    const original = btn.innerHTML;
    
    const veri = {
        baslangic_tarihi: document.getElementById('baslangic-tarihi').value,
        bitis_tarihi: document.getElementById('bitis-tarihi').value || null,
        alis_fiyati: document.getElementById('alis-fiyat-input').value,
        satis_fiyati: document.getElementById('satis-fiyat-input').value || 0
    };

    if (!veri.baslangic_tarihi || !veri.alis_fiyati) { gosterMesaj('Başlangıç tarihi ve alış fiyatı zorunlu.', 'warning'); return; }

    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    try {
        const res = await api.postTarife(veri);
        gosterMesaj(res.message, 'success');
        document.getElementById('tarife-form').reset();
        baslangicPicker.clear(); bitisPicker.clear();
        verileriYukle();
    } catch(err) { gosterMesaj(err.message, 'danger'); }
    finally { btn.disabled = false; btn.innerHTML = original; }
}

function silmeOnayiAc(id) {
    document.getElementById('silinecek-tarife-id').value = id;
    toggleModal('silmeOnayModal', true);
}

async function tarifeSil() {
    const id = document.getElementById('silinecek-tarife-id').value;
    toggleModal('silmeOnayModal', false);
    
    // UI'dan anında sil (Hızlı tepki için)
    const row = document.querySelector(`button[onclick="silmeOnayiAc(${id})"]`)?.closest('tr');
    if(row) row.remove();

    try {
        const res = await api.deleteTarife(id);
        gosterMesaj(res.message, 'success');
        await verileriYukle(); // Kesin veri senkronizasyonu
    } catch(e) { 
        gosterMesaj(e.message, 'danger'); 
        verileriYukle(); // Hata olursa listeyi geri getir
    }
}

function duzenleModaliniAc(id, bas, bit, alis, satis) {
    document.getElementById('edit-tarife-id').value = id;
    editBaslangicPicker.setDate(bas);
    if(bit) editBitisPicker.setDate(bit); else editBitisPicker.clear();
    
    document.getElementById('edit-alis-fiyat').value = parseFloat(alis);
    document.getElementById('edit-satis-fiyat').value = parseFloat(satis);
    
    toggleModal('duzenleModal', true);
}

async function tarifeGuncelle() {
    const id = document.getElementById('edit-tarife-id').value;
    const veri = {
        baslangic_tarihi: document.getElementById('edit-baslangic').value,
        bitis_tarihi: document.getElementById('edit-bitis').value || null,
        alis_fiyati: document.getElementById('edit-alis-fiyat').value,
        satis_fiyati: document.getElementById('edit-satis-fiyat').value || 0
    };
    
    try {
        const res = await api.updateTarife(id, veri);
        gosterMesaj(res.message, 'success');
        toggleModal('duzenleModal', false);
        verileriYukle();
    } catch(e) { gosterMesaj(e.message, 'danger'); }
}

// --- BAŞLATMA ---
window.onload = function() {
    const form = document.getElementById('tarife-form');
    if(form) form.addEventListener('submit', tarifeEkle);

    const opts = { dateFormat: "Y-m-d", locale: "tr", allowInput: true };
    baslangicPicker = flatpickr("#baslangic-tarihi", opts);
    bitisPicker = flatpickr("#bitis-tarihi", opts);
    editBaslangicPicker = flatpickr("#edit-baslangic", opts);
    editBitisPicker = flatpickr("#edit-bitis", opts);

    verileriYukle();
};