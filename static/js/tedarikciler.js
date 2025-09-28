// static/js/tedarikciler.js (DÜZELTİLMİŞ VERSİYON)

let tedarikciModal, silmeOnayModal;
let mevcutSiralamaSutunu = 'isim';
let mevcutSiralamaYonu = 'asc';

/**
 * Sayfa yüklendiğinde çalışacak ana fonksiyon.
 */
window.onload = async () => {
    tedarikciModal = new bootstrap.Modal(document.getElementById('tedarikciModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    // Modal açıldığında, eğer "Yeni Tedarikçi Ekle" butonuyla açıldıysa formu temizle
    document.getElementById('tedarikciModal').addEventListener('show.bs.modal', (event) => {
        const triggerButton = event.relatedTarget;
        // Eğer modal bir butonla tetiklendiyse VE bu buton "düzenle" butonu DEĞİLSE, formu sıfırla.
        // Bu, sadece "Yeni Tedarikçi Ekle" butonuna basıldığında formun temizlenmesini sağlar.
        if (triggerButton && !triggerButton.classList.contains('btn-outline-primary')) {
            document.getElementById('tedarikciModalLabel').innerText = 'Yeni Tedarikçi Ekle';
            document.getElementById('edit-tedarikci-id').value = '';
            document.getElementById('tedarikci-form').reset();
        }
    });
    
    await tedarikcileriYukle();

    const aramaInput = document.getElementById('arama-input');
    aramaInput.addEventListener('keyup', () => {
        filtreleVeSirala();
    });

    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sutun = header.dataset.sort;
            if (mevcutSiralamaSutunu === sutun) {
                mevcutSiralamaYonu = mevcutSiralamaYonu === 'asc' ? 'desc' : 'asc';
            } else {
                mevcutSiralamaSutunu = sutun;
                mevcutSiralamaYonu = 'asc';
            }
            filtreleVeSirala();
        });
    });
};

function filtreleVeSirala() {
    const aramaInput = document.getElementById('arama-input');
    const searchTerm = aramaInput.value.toLowerCase();
    
    let gosterilecekTedarikciler = store.tedarikciler.filter(supplier => 
        supplier.isim.toLowerCase().includes(searchTerm) ||
        (supplier.telefon_no && supplier.telefon_no.toLowerCase().includes(searchTerm))
    );

    gosterilecekTedarikciler.sort((a, b) => {
        let valA = a[mevcutSiralamaSutunu];
        let valB = b[mevcutSiralamaSutunu];

        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = (valB || '').toLowerCase();
        } else {
            valA = valA || 0;
            valB = valB || 0;
        }

        if (valA < valB) return mevcutSiralamaYonu === 'asc' ? -1 : 1;
        if (valA > valB) return mevcutSiralamaYonu === 'asc' ? 1 : -1;
        return 0;
    });

    renderTable(gosterilecekTedarikciler);
    basliklariGuncelle();
}

function basliklariGuncelle() {
    document.querySelectorAll('.sortable').forEach(header => {
        const sutun = header.dataset.sort;
        header.classList.remove('asc', 'desc');
        if (sutun === mevcutSiralamaSutunu) {
            header.classList.add(mevcutSiralamaYonu);
        }
    });
}

async function tedarikcileriYukle() {
    const tbody = document.getElementById('tedarikciler-tablosu');
    tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    
    try {
        await store.getTedarikciler();
        filtreleVeSirala();
    } catch (error) {
        console.error("Hata:", error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger p-4">${error.message}</td></tr>`;
    }
}

function renderTable(suppliers) {
    const tbody = document.getElementById('tedarikciler-tablosu');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    tbody.innerHTML = '';

    if (suppliers.length === 0) {
        veriYokMesaji.style.display = 'block';
    } else {
        veriYokMesaji.style.display = 'none';
        suppliers.forEach(supplier => {
            const tr = `
                <tr>
                    <td><strong>${supplier.isim}</strong></td>
                    <td>${supplier.telefon_no || '-'}</td>
                    <td class="text-end">${(supplier.toplam_litre || 0).toFixed(2)} L</td>
                    <td class="text-center">
                        <a href="/tedarikci/${supplier.id}" class="btn btn-sm btn-outline-info" title="Detayları Gör"><i class="bi bi-eye"></i></a>
                        <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="tedarikciDuzenleAc(${supplier.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="silmeOnayiAc(${supplier.id}, '${supplier.isim}')"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += tr;
        });
    }
}

async function tedarikciKaydet() {
    const kaydetButton = document.querySelector('#tedarikciModal .btn-primary');
    const originalButtonText = kaydetButton.innerHTML;
    const id = document.getElementById('edit-tedarikci-id').value;
    const veri = {
        isim: document.getElementById('tedarikci-isim-input').value.trim(),
        tc_no: document.getElementById('tedarikci-tc-input').value.trim(),
        telefon_no: document.getElementById('tedarikci-tel-input').value.trim(),
        adres: document.getElementById('tedarikci-adres-input').value.trim()
    };

    if (!veri.isim) {
        gosterMesaj("Tedarikçi ismi zorunludur.", "warning");
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;

    const url = id ? `/api/tedarikci_duzenle/${id}` : '/api/tedarikci_ekle';
    const method = id ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, "success");
            tedarikciModal.hide();
            store.invalidateTedarikciler();
            await tedarikcileriYukle();
        } else {
            gosterMesaj(result.error || "Bir hata oluştu.", "danger");
        }
    } catch (error) {
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

function tedarikciDuzenleAc(id) {
    const supplier = store.tedarikciler.find(s => s.id === id);
    if (supplier) {
        document.getElementById('tedarikciModalLabel').innerText = 'Tedarikçi Bilgilerini Düzenle';
        document.getElementById('edit-tedarikci-id').value = supplier.id;
        document.getElementById('tedarikci-isim-input').value = supplier.isim;
        document.getElementById('tedarikci-tc-input').value = supplier.tc_no || '';
        document.getElementById('tedarikci-tel-input').value = supplier.telefon_no || '';
        document.getElementById('tedarikci-adres-input').value = supplier.adres || '';
        tedarikciModal.show();
    }
}

function silmeOnayiAc(id, isim) {
    document.getElementById('silinecek-tedarikci-id').value = id;
    document.getElementById('silinecek-tedarikci-adi').innerText = isim;
    silmeOnayModal.show();
}

async function tedarikciSil() {
    const id = document.getElementById('silinecek-tedarikci-id').value;
    try {
        const response = await fetch(`/api/tedarikci_sil/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            silmeOnayModal.hide();
            store.invalidateTedarikciler();
            await tedarikcileriYukle();
        } else {
            gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}