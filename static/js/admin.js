let sirketSilmeOnayModal, sifreSifirlaModal;

// Tarih seçicileri için global bir obje
const tarihSeciciler = {};

window.onload = function() {
    sirketSilmeOnayModal = new bootstrap.Modal(document.getElementById('sirketSilmeOnayModal'));
    sifreSifirlaModal = new bootstrap.Modal(document.getElementById('sifreSifirlaModal'));
    adminVerileriniYukle();
};

async function adminVerileriniYukle() {
    try {
        const response = await fetch('/api/admin/data');
        const data = await response.json();
        if (response.ok) {
            sirketleriDoldur(data.sirketler);
            kullanicilariDoldur(data.kullanicilar);
        } else {
            gosterMesaj(data.error || "Veriler yüklenemedi.", "danger");
        }
    } catch (error) {
        console.error("Admin verileri yüklenirken hata:", error);
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    }
}

function sirketleriDoldur(sirketler) {
    const tbody = document.getElementById('sirketler-tablosu');
    tbody.innerHTML = '';

    // Önceki tarih seçicileri temizle
    for (const key in tarihSeciciler) {
        if (tarihSeciciler[key]) {
            tarihSeciciler[key].destroy();
        }
    }

    if (sirketler.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Kayıtlı şirket bulunamadı.</td></tr>';
        return;
    }

    sirketler.forEach(sirket => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${sirket.sirket_adi}</td>
            <td>
                <!-- Input türünü text olarak değiştiriyoruz -->
                <input type="text" class="form-control form-control-sm flatpickr-input" id="lisans-tarih-${sirket.id}" placeholder="GG.AA.YYYY">
            </td>
            <td class="d-flex gap-1">
                <button class="btn btn-sm btn-success" onclick="lisansGuncelle(${sirket.id})" title="Lisansı Kaydet"><i class="bi bi-check-lg"></i></button>
                <button class="btn btn-sm btn-danger" onclick="sirketSilmeOnayiAc(${sirket.id}, '${sirket.sirket_adi}')" title="Şirketi Sil"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);

        // Her bir tarih inputu için Flatpickr'ı başlat
        const inputId = `lisans-tarih-${sirket.id}`;
        const inputElement = document.getElementById(inputId);
        tarihSeciciler[inputId] = flatpickr(inputElement, {
            dateFormat: "d.m.Y", // GG.AA.YYYY formatı
            locale: "tr", // Türkçe dil
            defaultDate: sirket.lisans_bitis_tarihi ? new Date(sirket.lisans_bitis_tarihi) : null
        });
    });
}

function kullanicilariDoldur(kullanicilar) {
    const tbody = document.getElementById('kullanicilar-tablosu');
    tbody.innerHTML = '';
    if (kullanicilar.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Kayıtlı kullanıcı bulunamadı.</td></tr>';
        return;
    }
    kullanicilar.forEach(kullanici => {
        const sirketAdi = kullanici.sirketler ? kullanici.sirketler.sirket_adi : '<span class="text-muted">Atanmamış</span>';
        const rol = kullanici.rol || 'user';
        const tr = `
            <tr>
                <td>${kullanici.kullanici_adi}</td>
                <td>${sirketAdi}</td>
                <td>
                    <select class="form-select form-select-sm" id="rol-secim-${kullanici.id}">
                        <option value="user" ${rol === 'user' ? 'selected' : ''}>Kullanıcı</option>
                        <option value="muhasebeci" ${rol === 'muhasebeci' ? 'selected' : ''}>Muhasebeci</option>
                        <option value="admin" ${rol === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td class="text-center d-flex gap-1 justify-content-center">
                    <button class="btn btn-sm btn-success" onclick="rolGuncelle(${kullanici.id})" title="Rolü Kaydet"><i class="bi bi-check-lg"></i></button>
                    <button class="btn btn-sm btn-warning" onclick="sifreSifirlamaAc(${kullanici.id}, '${kullanici.kullanici_adi}')" title="Şifre Sıfırla"><i class="bi bi-key"></i></button>
                </td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });
}

async function lisansGuncelle(sirketId) {
    const fpInstance = tarihSeciciler[`lisans-tarih-${sirketId}`];
    // Flatpickr'dan seçilen tarihi alıp YYYY-MM-DD formatına çeviriyoruz
    const secilenTarih = fpInstance.selectedDates[0];
    const yeniTarih = secilenTarih ? `${secilenTarih.getFullYear()}-${String(secilenTarih.getMonth() + 1).padStart(2, '0')}-${String(secilenTarih.getDate()).padStart(2, '0')}` : null;
    
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

function sirketSilmeOnayiAc(sirketId, sirketAdi) {
    document.getElementById('silinecek-sirket-id').value = sirketId;
    document.getElementById('silinecek-sirket-adi').textContent = sirketAdi;
    sirketSilmeOnayModal.show();
}

async function sirketSil() {
    const sirketId = document.getElementById('silinecek-sirket-id').value;
    try {
        const response = await fetch('/api/admin/delete_company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sirket_id: parseInt(sirketId) })
        });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            sirketSilmeOnayModal.hide();
            await adminVerileriniYukle();
        } else {
            gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger');
        }
    } catch (error) {
        console.error("Şirket silinirken hata:", error);
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}

function sifreSifirlamaAc(kullaniciId, kullaniciAdi) {
    document.getElementById('sifirlanacak-kullanici-id').value = kullaniciId;
    document.getElementById('sifresi-sifirlanacak-kullanici').textContent = kullaniciAdi;
    document.getElementById('yeni-sifre-input').value = '';
    sifreSifirlaModal.show();
}

async function sifreSifirla() {
    const kullaniciId = document.getElementById('sifirlanacak-kullanici-id').value;
    const yeniSifre = document.getElementById('yeni-sifre-input').value;

    if (!yeniSifre) {
        gosterMesaj("Lütfen yeni bir şifre girin.", "warning");
        return;
    }
    try {
        const response = await fetch('/api/admin/reset_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kullanici_id: parseInt(kullaniciId), yeni_sifre: yeniSifre })
        });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            sifreSifirlaModal.hide();
        } else {
            gosterMesaj(result.error || 'Şifre sıfırlama işlemi başarısız.', 'danger');
        }
    } catch (error) {
        console.error("Şifre sıfırlanırken hata:", error);
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    }
}

