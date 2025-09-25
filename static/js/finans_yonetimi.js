let tedarikciSecici;
let tarihSecici;

window.onload = function() {
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    tarihSecici = flatpickr("#islem-tarihi-input", {
        enableTime: true,
        dateFormat: "Y-m-d H:i:S",
        locale: "tr",
    });

    verileriYukle();
};

async function verileriYukle() {
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
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    try {
        // Not: Bu API henüz yazılmadı. Bu fonksiyon şimdilik sadece arayüzü hazırlar.
        // Gerçek veri listeleme bir sonraki adımda yapılacak.
        // Şimdilik boş bir liste gösteriyoruz.
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-secondary">Kayıtlı finansal işlem bulunamadı.</td></tr>';
    } catch (error) {
         tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-danger">İşlemler yüklenemedi.</td></tr>`;
    }
}

async function finansalIslemKaydet() {
    const veri = {
        islem_tipi: document.getElementById('islem-tipi-sec').value,
        tedarikci_id: tedarikciSecici.getValue(),
        tutar: document.getElementById('tutar-input').value,
        islem_tarihi: tarihSecici.selectedDates[0] ? tarihSecici.selectedDates[0].toISOString() : null,
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
            tedarikciSecici.clear();
            document.getElementById('tutar-input').value = '';
            document.getElementById('aciklama-input').value = '';
            tarihSecici.clear();
            // TODO: İşlem listesini yenile
            // await finansalIslemleriDoldur();
        } else {
            gosterMesaj(result.error || 'Bir hata oluştu.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
        console.error(error);
    }
}
