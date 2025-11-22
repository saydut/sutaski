let tumSurumNotlari = [];
const tarihSeciciler = {};

function formatDateToYYYYMMDD(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

window.onload = function() {
    // Modalları JS objesi olarak başlatmaya gerek yok, HTML class toggle ile yönetiyoruz.

    flatpickr("#yayin-tarihi-input", {
        dateFormat: "Y-m-d", altInput: true, altFormat: "d.m.Y", locale: "tr", defaultDate: "today"
    });

    flatpickr("#edit-yayin-tarihi-input", {
        dateFormat: "Y-m-d", altInput: true, altFormat: "d.m.Y", locale: "tr"
    });
    
    document.getElementById('surum-formu').addEventListener('submit', surumNotuEkle);
    adminVerileriniYukle();
};

async function adminVerileriniYukle() {
    try {
        const [adminDataResponse, surumNotlariResponse] = await Promise.all([
            fetch('/api/admin/data'), fetch('/api/admin/surum_notlari')
        ]);

        const adminData = await adminDataResponse.json();
        const surumNotlari = await surumNotlariResponse.json();

        if (adminDataResponse.ok) {
            sirketleriDoldur(adminData.sirketler);
            kullanicilariDoldur(adminData.kullanicilar);
        } else gosterMesaj(adminData.error || "Veriler yüklenemedi.", "danger");
        
        if(surumNotlariResponse.ok){
            tumSurumNotlari = surumNotlari;
            surumNotlariniDoldur(surumNotlari);
        } else gosterMesaj(surumNotlari.error || "Sürüm notları yüklenemedi.", "danger");
        
        mevcutOnbellekSurumunuYukle();
        mevcutBakimModunuYukle();

    } catch (error) {
        console.error("Admin verileri yüklenirken hata:", error);
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    }
}

async function surumNotuEkle(event) {
    event.preventDefault(); 
    const selectedDate = document.getElementById('yayin-tarihi-input')._flatpickr.selectedDates[0];
    const veri = {
        surum_no: document.getElementById('surum-no-input').value,
        yayin_tarihi: formatDateToYYYYMMDD(selectedDate),
        notlar: document.getElementById('notlar-input').value
    };
    try {
        const response = await fetch('/api/admin/surum_notlari', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            document.getElementById('surum-formu').reset();
            adminVerileriniYukle();
        } else gosterMesaj(result.error || "Ekleme hatası.", "danger");
    } catch (error) { gosterMesaj("Hata oluştu.", "danger"); }
}

function surumNotlariniDoldur(notlar) {
    const tbody = document.getElementById('surumler-tablosu');
    tbody.innerHTML = '';
    if (notlar.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Kayıtlı sürüm notu bulunamadı.</td></tr>'; return; }
    notlar.forEach(not => {
        const notlarHtml = '<ul class="list-disc list-inside space-y-1">' + not.notlar.split('\n').map(line => `<li>${line.replace(/^- /, '')}</li>`).join('') + '</ul>';
        const tr = `
            <tr class="hover:bg-gray-50 border-b border-gray-100">
                <td class="px-4 py-3 font-medium text-gray-900">${not.surum_no}</td>
                <td class="px-4 py-3 text-gray-500">${new Date(not.yayin_tarihi + 'T00:00:00').toLocaleDateString('tr-TR')}</td>
                <td class="px-4 py-3 text-sm text-gray-600">${notlarHtml}</td>
                <td class="px-4 py-3 text-center flex justify-center gap-2">
                    <button class="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" onclick="surumDuzenlemeModaliniAc(${not.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100" onclick="surumNotuSil(${not.id})"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
        tbody.innerHTML += tr;
    });
}

async function surumNotuSil(id) {
    if (!confirm("Silmek istediğinize emin misiniz?")) return;
    try {
        const response = await fetch(`/api/admin/surum_notlari/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) { gosterMesaj(result.message, 'success'); adminVerileriniYukle(); } 
        else gosterMesaj(result.error, 'danger');
    } catch (e) { gosterMesaj('Hata.', 'danger'); }
}

function surumDuzenlemeModaliniAc(id) {
    const not = tumSurumNotlari.find(n => n.id === id);
    if (!not) return;
    document.getElementById('edit-surum-id').value = not.id;
    document.getElementById('edit-surum-no-input').value = not.surum_no;
    document.getElementById('edit-notlar-input').value = not.notlar;
    document.getElementById('edit-yayin-tarihi-input')._flatpickr.setDate(not.yayin_tarihi, true);
    toggleModal('surumDuzenleModal', true);
}

async function surumNotuGuncelle() {
    const id = document.getElementById('edit-surum-id').value;
    const veri = {
        surum_no: document.getElementById('edit-surum-no-input').value,
        yayin_tarihi: formatDateToYYYYMMDD(document.getElementById('edit-yayin-tarihi-input')._flatpickr.selectedDates[0]),
        notlar: document.getElementById('edit-notlar-input').value
    };
    try {
        const res = await fetch(`/api/admin/surum_notlari/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
        const result = await res.json();
        if (res.ok) { gosterMesaj(result.message, 'success'); toggleModal('surumDuzenleModal', false); adminVerileriniYukle(); }
        else gosterMesaj(result.error, 'danger');
    } catch (e) { gosterMesaj('Hata.', 'danger'); }
}

function sirketleriDoldur(sirketler) {
    const tbody = document.getElementById('sirketler-tablosu');
    tbody.innerHTML = '';
    if (sirketler.length === 0) { tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-gray-500">Şirket yok.</td></tr>'; return; }

    sirketler.forEach(sirket => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 border-b border-gray-100 transition-colors";
        tr.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium text-gray-900">${sirket.sirket_adi}</td>
            <td class="px-6 py-4">
                <input type="text" class="block w-full rounded-md border-gray-300 border p-1.5 text-sm shadow-sm focus:ring-brand-500" id="lisans-tarih-${sirket.id}" placeholder="GG.AA.YYYY">
            </td>
            <td class="px-6 py-4 flex justify-center gap-2">
                <button class="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100" onclick="lisansGuncelle(${sirket.id})" title="Kaydet"><i class="fa-solid fa-check"></i></button>
                <button class="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100" onclick="sirketSilmeOnayiAc(${sirket.id}, '${sirket.sirket_adi}')" title="Sil"><i class="fa-solid fa-trash"></i></button>
            </td>`;
        tbody.appendChild(tr);
        
        tarihSeciciler[`lisans-tarih-${sirket.id}`] = flatpickr(document.getElementById(`lisans-tarih-${sirket.id}`), {
            dateFormat: "d.m.Y", locale: "tr", defaultDate: sirket.lisans_bitis_tarihi ? new Date(sirket.lisans_bitis_tarihi) : null
        });
    });
}

function kullanicilariDoldur(kullanicilar) {
    const tbody = document.getElementById('kullanicilar-tablosu');
    tbody.innerHTML = '';
    if (kullanicilar.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">Kullanıcı yok.</td></tr>'; return; }
    kullanicilar.forEach(k => {
        const tr = `
            <tr class="hover:bg-gray-50 border-b border-gray-100">
                <td class="px-6 py-4 text-sm font-medium text-gray-900">${k.kullanici_adi}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${k.sirketler ? k.sirketler.sirket_adi : 'Atanmamış'}</td>
                <td class="px-6 py-4">
                    <select class="block w-full rounded-md border-gray-300 border p-1.5 text-sm" id="rol-secim-${k.id}">
                        <option value="user" ${k.rol === 'user' ? 'selected' : ''}>Kullanıcı</option>
                        <option value="muhasebeci" ${k.rol === 'muhasebeci' ? 'selected' : ''}>Muhasebeci</option>
                        <option value="admin" ${k.rol === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td class="px-6 py-4 flex justify-center gap-2">
                    <button class="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100" onclick="rolGuncelle(${k.id})"><i class="fa-solid fa-check"></i></button>
                    <button class="p-1.5 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100" onclick="sifreSifirlamaAc(${k.id}, '${k.kullanici_adi}')"><i class="fa-solid fa-key"></i></button>
                    <button class="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100" onclick="bildirimModaliniAc(${k.id}, '${k.kullanici_adi}')"><i class="fa-solid fa-bell"></i></button>
                </td>
            </tr>`;
        tbody.innerHTML += tr;
    });
}

async function lisansGuncelle(sirketId) {
    const fpInstance = tarihSeciciler[`lisans-tarih-${sirketId}`];
    const secilenTarih = fpInstance.selectedDates[0];
    const yeniTarih = formatDateToYYYYMMDD(secilenTarih);
    
    try {
         const response = await fetch('/api/admin/update_lisans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sirket_id: sirketId, yeni_tarih: yeniTarih })
        });
        const result = await response.json();
        if (response.ok) { gosterMesaj(result.message, "success"); } 
        else { gosterMesaj(result.error || "Güncelleme hatası.", "danger"); }
    } catch (error) {
        console.error("Lisans güncellenirken hata:", error);
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    }
}

async function rolGuncelle(kullaniciId) {
    const yeniRol = document.getElementById(`rol-secim-${kullaniciId}`).value;
    try {
         const response = await fetch('/api/admin/update_rol', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kullanici_id: kullaniciId, yeni_rol: yeniRol })
        });
        const result = await response.json();
        if (response.ok) { gosterMesaj(result.message, "success"); } 
        else { gosterMesaj(result.error || "Rol güncelleme hatası.", "danger"); }
    } catch (error) {
        console.error("Rol güncellenirken hata:", error);
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    }
}

function sirketSilmeOnayiAc(id, ad) {
    document.getElementById('silinecek-sirket-id').value = id;
    document.getElementById('silinecek-sirket-adi').textContent = ad;
    toggleModal('sirketSilmeOnayModal', true);
}

async function sirketSil() {
    const id = document.getElementById('silinecek-sirket-id').value;
    try {
        const res = await fetch('/api/admin/delete_company', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({sirket_id: parseInt(id)}) });
        const data = await res.json();
        if(res.ok) { gosterMesaj(data.message, 'success'); toggleModal('sirketSilmeOnayModal', false); adminVerileriniYukle(); }
        else gosterMesaj(data.error, 'danger');
    } catch(e) { gosterMesaj('Hata.', 'danger'); }
}

function sifreSifirlamaAc(id, ad) {
    document.getElementById('sifirlanacak-kullanici-id').value = id;
    document.getElementById('sifresi-sifirlanacak-kullanici').textContent = ad;
    document.getElementById('yeni-sifre-input').value = '';
    toggleModal('sifreSifirlaModal', true);
}

async function sifreSifirla() {
    const id = document.getElementById('sifirlanacak-kullanici-id').value;
    const pass = document.getElementById('yeni-sifre-input').value;
    try {
        const res = await fetch('/api/admin/reset_password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({kullanici_id: parseInt(id), yeni_sifre: pass}) });
        if(res.ok) { gosterMesaj('Şifre sıfırlandı.', 'success'); toggleModal('sifreSifirlaModal', false); }
        else gosterMesaj('Hata.', 'danger');
    } catch(e) { gosterMesaj('Hata.', 'danger'); }
}

// --- DİNAMİK ÖNBELLEK YÖNETİMİ FONKSİYONLARI ---

/**
 * Mevcut önbellek sürümünü sunucudan alır ve ekranda gösterir.
 */
async function mevcutOnbellekSurumunuYukle() {
    const displayElement = document.getElementById('cache-version-display');
    try {
        const response = await fetch('/api/admin/cache_version');
        const data = await response.json();
        if (response.ok) {
            displayElement.textContent = `v${data.version}`;
        } else {
            displayElement.textContent = 'Hata';
            gosterMesaj(data.error || 'Sürüm alınamadı.', 'danger');
        }
    } catch (error) {
        displayElement.textContent = 'Hata';
        gosterMesaj('Önbellek sürümü alınırken sunucu hatası.', 'danger');
    }
}

/**
 * Sürüm artırma butonuna tıklandığında çalışır.
 */
async function onbellekSurumunuArtir() {
    if (!confirm("Önbellek sürümünü bir artırmak istediğinizden emin misiniz? Bu işlem, tüm kullanıcıların bir sonraki ziyaretlerinde uygulamayı yeniden indirmesine neden olur.")) {
        return;
    }
    
    try {
        const response = await fetch('/api/admin/increment_cache_version', { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
            gosterMesaj(data.message, 'success');
            document.getElementById('cache-version-display').textContent = `v${data.new_version}`;
        } else {
            gosterMesaj(data.error || 'İşlem başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}


// --- BAKIM MODU FONKSİYONLARI ---

/**
 * Mevcut bakım modu durumunu sunucudan alır ve anahtarı ayarlar.
 */
async function mevcutBakimModunuYukle() {
    const switchInput = document.getElementById('maintenance-switch');
    const statusLabel = document.getElementById('maintenance-status-label');
    try {
        const response = await fetch('/api/admin/maintenance_status');
        const data = await response.json();
        if (response.ok) {
            switchInput.checked = data.is_maintenance_mode;
            statusLabel.textContent = data.is_maintenance_mode ? 'Aktif' : 'Pasif';
        } else {
            statusLabel.textContent = 'Hata';
            gosterMesaj(data.error || 'Bakım modu durumu alınamadı.', 'danger');
        }
    } catch (error) {
        statusLabel.textContent = 'Hata';
        gosterMesaj('Bakım modu durumu alınırken sunucu hatası.', 'danger');
    }
}

/**
 * Bakım modu anahtarı değiştirildiğinde çalışır.
 */
async function toggleMaintenanceMode() {
    const switchInput = document.getElementById('maintenance-switch');
    const statusLabel = document.getElementById('maintenance-status-label');
    const yeniDurum = switchInput.checked;

    const onayMesaji = yeniDurum 
        ? "Uygulamayı bakım moduna almak istediğinizden emin misiniz? Siz hariç kimse siteye erişemeyecek."
        : "Uygulamayı bakım modundan çıkarmak istediğinizden emin misiniz? Site herkesin erişimine açılacak.";

    if (!confirm(onayMesaji)) {
        switchInput.checked = !yeniDurum; // İşlemi iptal et, anahtarı eski haline getir
        return;
    }
    
    statusLabel.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    try {
        const response = await fetch('/api/admin/toggle_maintenance', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'maintenance_mode': yeniDurum })
        });
        const data = await response.json();
        if (response.ok) {
            gosterMesaj(data.message, 'success');
            statusLabel.textContent = yeniDurum ? 'Aktif' : 'Pasif';
        } else {
            gosterMesaj(data.error || 'İşlem başarısız.', 'danger');
            switchInput.checked = !yeniDurum; // Hata olursa anahtarı geri al
            statusLabel.textContent = !yeniDurum ? 'Pasif' : 'Aktif';
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
        switchInput.checked = !yeniDurum; // Hata olursa anahtarı geri al
    }
}

// static/js/admin.js dosyasının en altına ekle

function bildirimModaliniAc(id, ad) {
    document.getElementById('bildirim-gonderilecek-kullanici-id').value = id;
    document.getElementById('bildirim-gonderilecek-kullanici').textContent = ad;
    toggleModal('bildirimGonderModal', true);
}

async function bildirimGonder() {
    const id = document.getElementById('bildirim-gonderilecek-kullanici-id').value;
    const title = document.getElementById('bildirim-baslik-input').value;
    const body = document.getElementById('bildirim-icerik-input').value;
    try {
        const res = await fetch('/api/admin/send_notification', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({user_id: parseInt(id), title, body}) });
        const data = await res.json();
        if(res.ok) { gosterMesaj(data.message, 'success'); toggleModal('bildirimGonderModal', false); }
        else gosterMesaj(data.error, 'danger');
    } catch(e) { gosterMesaj('Hata', 'danger'); }
}