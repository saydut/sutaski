// Global değişkenler
let tedarikciSecici;
let tarihSecici;
let duzenleModal, silmeOnayModal;
let allFinancialTransactions = []; // Düzenleme için verileri saklamak üzere

window.onload = function() {
    // Kütüphaneleri ve modalları başlat
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    tarihSecici = flatpickr("#islem-tarihi-input", {
        enableTime: true,
        dateFormat: "Y-m-d H:i:S",
        locale: "tr",
    });
    duzenleModal = new bootstrap.Modal(document.getElementById('duzenleModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    // Sayfa ilk yüklendiğinde verileri çek
    verileriYukle();
};

async function verileriYukle() {
    // Tedarikçi listesini ve finansal işlemleri aynı anda yükle
    await Promise.all([
        tedarikcileriDoldur(),
        finansalIslemleriDoldur()
    ]);
}

async function tedarikcileriDoldur() {
    try {
        const response = await fetch('/api/tedarikciler_liste');
        const tedarikciler = await response.json();
        const options = tedarikciler.map(t => ({ value: t.id, text: t.isim }));
        tedarikciSecici.addOptions(options);
    } catch (error) {
        gosterMesaj('Tedarikçiler yüklenirken bir hata oluştu.', 'danger');
        console.error(error);
    }
}

async function finansalIslemleriDoldur() {
    const tbody = document.getElementById('finansal-islemler-tablosu');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    try {
        const response = await fetch('/finans/api/islemler');
        const islemler = await response.json();

        if (!response.ok) {
            throw new Error(islemler.error || 'İşlemler yüklenemedi.');
        }

        allFinancialTransactions = islemler; // Veriyi globalde sakla

        if (islemler.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center p-4 text-secondary">Kayıtlı finansal işlem bulunamadı.</td></tr>';
            return;
        }

        tbody.innerHTML = ''; // Spinner'ı temizle
        islemler.forEach(islem => {
            const tr = document.createElement('tr');
            const islemTarihi = new Date(islem.islem_tarihi).toLocaleString('tr-TR', {
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const tutar = parseFloat(islem.tutar);
            const islemTipiClass = islem.islem_tipi === 'Ödeme' ? 'text-success' : 'text-danger';
            
            tr.innerHTML = `
                <td>${islemTarihi}</td>
                <td>${islem.tedarikciler ? islem.tedarikciler.isim : 'Bilinmiyor'}</td>
                <td><span class="badge bg-${islem.islem_tipi === 'Ödeme' ? 'success' : 'warning'}">${islem.islem_tipi}</span></td>
                <td class="text-end fw-bold ${islemTipiClass}">${tutar.toFixed(2)} TL</td>
                <td>${islem.aciklama || '-'}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="duzenleModaliniAc(${islem.id})" title="Düzenle"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="silmeOnayiAc(${islem.id})" title="Sil"><i class="bi bi-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
         tbody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-danger">${error.message}</td></tr>`;
         console.error(error);
    }
}

async function finansalIslemKaydet() {
    const veri = {
        islem_tipi: document.getElementById('islem-tipi-sec').value,
        tedarikci_id: tedarikciSecici.getValue(),
        tutar: document.getElementById('tutar-input').value,
        islem_tarihi: tarihSecici.selectedDates[0] ? tarihSecici.selectedDates[0].toISOString().slice(0, 19).replace('T', ' ') : null,
        aciklama: document.getElementById('aciklama-input').value.trim()
    };

    if (!veri.islem_tipi || !veri.tedarikci_id || !veri.tutar) {
        gosterMesaj('Lütfen işlem tipi, tedarikçi ve tutar alanlarını doldurun.', 'warning');
        return;
    }

    try {
        const response = await fetch('/finans/api/islemler', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            // Formu temizle
            document.getElementById('islem-tipi-sec').value = 'Ödeme';
            tedarikciSecici.clear();
            document.getElementById('tutar-input').value = '';
            document.getElementById('aciklama-input').value = '';
            tarihSecici.clear();
            // İşlem listesini yenile
            await finansalIslemleriDoldur();
        } else {
            gosterMesaj(result.error || 'Bir hata oluştu.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
        console.error(error);
    }
}

function duzenleModaliniAc(islemId) {
    const islem = allFinancialTransactions.find(i => i.id === islemId);
    if (islem) {
        document.getElementById('edit-islem-id').value = islem.id;
        document.getElementById('edit-tutar-input').value = parseFloat(islem.tutar);
        document.getElementById('edit-aciklama-input').value = islem.aciklama || '';
        duzenleModal.show();
    }
}

async function finansalIslemGuncelle() {
    const id = document.getElementById('edit-islem-id').value;
    const veri = {
        tutar: document.getElementById('edit-tutar-input').value,
        aciklama: document.getElementById('edit-aciklama-input').value.trim()
    };

    if (!veri.tutar) {
        gosterMesaj('Tutar alanı boş bırakılamaz.', 'warning');
        return;
    }

    try {
        const response = await fetch(`/finans/api/islemler/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            duzenleModal.hide();
            await finansalIslemleriDoldur();
        } else {
            gosterMesaj(result.error || 'Güncelleme başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}

function silmeOnayiAc(islemId) {
    document.getElementById('silinecek-islem-id').value = islemId;
    silmeOnayModal.show();
}

async function finansalIslemSil() {
    const id = document.getElementById('silinecek-islem-id').value;
    try {
        const response = await fetch(`/finans/api/islemler/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            silmeOnayModal.hide();
            await finansalIslemleriDoldur();
        } else {
            gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}
