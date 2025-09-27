let sirketSilmeOnayModal, sifreSifirlaModal;

// Tarih seçicileri için global bir obje
const tarihSeciciler = {};

// --- YENİ EKLENEN YARDIMCI FONKSİYON ---
/**
 * JavaScript Date objesini 'YYYY-MM-DD' formatına çevirir.
 * Timezone dönüşümü yapmaz, böylece saat farkı sorununu çözer.
 * @param {Date} date - Formatlanacak tarih objesi.
 * @returns {string} - 'YYYY-MM-DD' formatında tarih metni.
 */
function formatDateToYYYYMMDD(date) {
    if (!date) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // aylar 0'dan başladığı için +1
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
// --- YENİ FONKSİYON SONU ---

window.onload = function() {
    sirketSilmeOnayModal = new bootstrap.Modal(document.getElementById('sirketSilmeOnayModal'));
    sifreSifirlaModal = new bootstrap.Modal(document.getElementById('sifreSifirlaModal'));
    
    // Yeni sürüm notu için tarih seçiciyi başlat
    flatpickr("#yayin-tarihi-input", {
        dateFormat: "Y-m-d", // Veritabanına uygun format
        altInput: true,     // Kullanıcıya gösterilecek format
        altFormat: "d.m.Y", // GG.AA.YYYY
        locale: "tr",
        defaultDate: "today"
    });
    
    // Sürüm formu için olay dinleyicisi ekle
    document.getElementById('surum-formu').addEventListener('submit', surumNotuEkle);
    
    adminVerileriniYukle();
};

async function adminVerileriniYukle() {
    try {
        // Artık iki farklı API'den veri çekeceğiz
        const [adminDataResponse, surumNotlariResponse] = await Promise.all([
            fetch('/api/admin/data'),
            fetch('/api/admin/surum_notlari')
        ]);

        const adminData = await adminDataResponse.json();
        const surumNotlari = await surumNotlariResponse.json();

        if (adminDataResponse.ok) {
            sirketleriDoldur(adminData.sirketler);
            kullanicilariDoldur(adminData.kullanicilar);
        } else {
            gosterMesaj(adminData.error || "Veriler yüklenemedi.", "danger");
        }
        
        if(surumNotlariResponse.ok){
            surumNotlariniDoldur(surumNotlari);
        } else {
            gosterMesaj(surumNotlari.error || "Sürüm notları yüklenemedi.", "danger");
        }

    } catch (error) {
        console.error("Admin verileri yüklenirken hata:", error);
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    }
}

// --- SÜRÜM YÖNETİMİ FONKSİYONLARI ---

async function surumNotuEkle(event) {
    event.preventDefault(); // Formun sayfa yenilemesini engelle
    
    const selectedDate = document.getElementById('yayin-tarihi-input')._flatpickr.selectedDates[0];
    
    const veri = {
        surum_no: document.getElementById('surum-no-input').value,
        // --- DEĞİŞİKLİK BURADA: Artık yeni yardımcı fonksiyonumuzu kullanıyoruz ---
        yayin_tarihi: formatDateToYYYYMMDD(selectedDate),
        notlar: document.getElementById('notlar-input').value
    };

    try {
        const response = await fetch('/api/admin/surum_notlari', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            document.getElementById('surum-formu').reset();
            document.getElementById('yayin-tarihi-input')._flatpickr.setDate(new Date());
            adminVerileriniYukle(); // Listeyi yenile
        } else {
            gosterMesaj(result.error || "Ekleme hatası.", "danger");
        }
    } catch (error) {
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    }
}

function surumNotlariniDoldur(notlar) {
    const tbody = document.getElementById('surumler-tablosu');
    tbody.innerHTML = '';
    if (notlar.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Kayıtlı sürüm notu bulunamadı.</td></tr>';
        return;
    }
    notlar.forEach(not => {
        // Notları HTML liste elemanlarına çevir
        const notlarHtml = '<ul>' + not.notlar.split('\n').map(line => `<li>${line.replace(/^- /, '')}</li>`).join('') + '</ul>';
        const tr = `
            <tr>
                <td><strong>${not.surum_no}</strong></td>
                <td>${new Date(not.yayin_tarihi + 'T00:00:00').toLocaleDateString('tr-TR')}</td>
                <td>${notlarHtml}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-danger" onclick="surumNotuSil(${not.id})" title="Bu sürüm notunu sil"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `;
        tbody.innerHTML += tr;
    });
}

async function surumNotuSil(id) {
    if (!confirm("Bu sürüm notunu silmek istediğinizden emin misiniz?")) return;

    try {
        const response = await fetch(`/api/admin/surum_notlari/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            adminVerileriniYukle(); // Listeyi yenile
        } else {
            gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}

// --- ŞİRKET VE KULLANICI YÖNETİMİ FONKSİYONLARI (DEĞİŞİKLİK YOK) ---

function sirketleriDoldur(sirketler) {
    const tbody = document.getElementById('sirketler-tablosu');
    tbody.innerHTML = '';

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
                <input type="text" class="form-control form-control-sm flatpickr-input" id="lisans-tarih-${sirket.id}" placeholder="GG.AA.YYYY">
            </td>
            <td class="d-flex gap-1">
                <button class="btn btn-sm btn-success" onclick="lisansGuncelle(${sirket.id})" title="Lisansı Kaydet"><i class="bi bi-check-lg"></i></button>
                <button class="btn btn-sm btn-danger" onclick="sirketSilmeOnayiAc(${sirket.id}, '${sirket.sirket_adi}')" title="Şirketi Sil"><i class="bi bi-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);

        const inputId = `lisans-tarih-${sirket.id}`;
        const inputElement = document.getElementById(inputId);
        tarihSeciciler[inputId] = flatpickr(inputElement, {
            dateFormat: "d.m.Y",
            locale: "tr",
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