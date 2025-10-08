// static/js/finans_yonetimi.js (MERKEZİ API KULLANAN YENİ VERSİYON)

let tedarikciSecici, tarihSecici;
let duzenleModal, silmeOnayModal;
let mevcutGorunum = 'tablo';
const KAYIT_SAYISI = 5;

window.onload = function() {
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    tarihSecici = flatpickr("#islem-tarihi-input", { enableTime: true, dateFormat: "Y-m-d H:i:S", locale: "tr" });
    duzenleModal = new bootstrap.Modal(document.getElementById('duzenleModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    mevcutGorunum = localStorage.getItem('finansGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);

    tedarikcileriDoldur();
    finansalIslemleriYukle(1);
};

function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('finansGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);
    finansalIslemleriYukle(1);
}

function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    document.getElementById(`${aktifGorunum}-gorunumu`).style.display = 'block';
    
    document.getElementById('btn-view-table').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}

async function finansalIslemleriYukle(sayfa = 1) {
    await genelVeriYukleyici({
        apiURL: `/finans/api/islemler?sayfa=${sayfa}`,
        veriAnahtari: 'islemler',
        tabloBodyId: 'finansal-islemler-tablosu',
        kartContainerId: 'finansal-islemler-kart-listesi',
        veriYokId: 'veri-yok-mesaji',
        sayfalamaId: 'finans-sayfalama',
        tabloRenderFn: renderFinansAsTable,
        kartRenderFn: renderFinansAsCards,
        yukleFn: finansalIslemleriYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: mevcutGorunum
    });
}

function renderFinansAsTable(container, islemler) {
    islemler.forEach(islem => {
        const islemTarihi = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        container.innerHTML += `
            <tr id="finans-islem-${islem.id}">
                <td>${islemTarihi}</td>
                <td>${islem.tedarikciler ? islem.tedarikciler.isim : 'Bilinmiyor'}</td>
                <td><span class="badge bg-${islem.islem_tipi === 'Ödeme' ? 'success' : 'warning'}">${islem.islem_tipi}</span></td>
                <td class="text-end fw-bold ${islem.islem_tipi === 'Ödeme' ? 'text-success' : 'text-danger'}">${parseFloat(islem.tutar).toFixed(2)} TL</td>
                <td>${islem.aciklama || '-'}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="duzenleModaliniAc(${islem.id}, '${islem.tutar}', '${(islem.aciklama || '').replace(/'/g, "\\'")}')" title="Düzenle"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="silmeOnayiAc(${islem.id})" title="Sil"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

function renderFinansAsCards(container, islemler) {
    islemler.forEach(islem => {
        const islemTarihi = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        container.innerHTML += `
            <div class="col-md-6 col-12" id="finans-islem-${islem.id}">
                <div class="finance-card ${islem.islem_tipi === 'Ödeme' ? 'odeme' : 'avans'}">
                    <div class="finance-card-header">
                        <h5>${islem.tedarikciler ? islem.tedarikciler.isim : 'Bilinmiyor'}</h5>
                        <div class="tarih">${islemTarihi}</div>
                    </div>
                    <div class="finance-card-body">
                        <p class="tutar ${islem.islem_tipi === 'Ödeme' ? 'text-success' : 'text-danger'}">${parseFloat(islem.tutar).toFixed(2)} TL</p>
                        <p class="aciklama">${islem.aciklama || 'Açıklama yok'}</p>
                    </div>
                    <div class="finance-card-footer">
                        <button class="btn btn-sm btn-outline-primary" onclick="duzenleModaliniAc(${islem.id}, '${islem.tutar}', '${(islem.aciklama || '').replace(/'/g, "\\'")}')" title="Düzenle"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="silmeOnayiAc(${islem.id})" title="Sil"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

async function tedarikcileriDoldur() {
    try {
        const tedarikciler = await store.getTedarikciler();
        tedarikciSecici.addOptions(tedarikciler.map(t => ({ value: t.id, text: t.isim })));
    } catch (error) {
        gosterMesaj('Tedarikçiler yüklenirken bir hata oluştu.', 'danger');
    }
}

function formuTemizle() {
    document.getElementById('islem-tipi-sec').value = 'Ödeme';
    tedarikciSecici.clear();
    document.getElementById('tutar-input').value = '';
    document.getElementById('aciklama-input').value = '';
    tarihSecici.clear();
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
    if (!navigator.onLine) {
        const basarili = await kaydetFinansIslemiCevrimdisi(veri);
        if (basarili) formuTemizle();
        return;
    }
    try {
        const result = await api.postFinansalIslem(veri);
        gosterMesaj(result.message, 'success');
        formuTemizle();
        await finansalIslemleriYukle(1); 
    } catch (error) {
        gosterMesaj(error.message, 'danger');
    }
}

function silmeOnayiAc(islemId) {
    document.getElementById('silinecek-islem-id').value = islemId;
    silmeOnayModal.show();
}

async function finansalIslemSil() {
    const id = document.getElementById('silinecek-islem-id').value;
    silmeOnayModal.hide();
    
    if (!navigator.onLine) {
        gosterMesaj("İşlemi silmek için internet bağlantısı gereklidir.", "warning");
        return;
    }

    const silinecekElement = document.getElementById(`finans-islem-${id}`);
    if (!silinecekElement) return;
    
    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    silinecekElement.style.transition = 'opacity 0.4s';
    silinecekElement.style.opacity = '0';
    setTimeout(() => silinecekElement.remove(), 400);

    try {
        const result = await api.deleteFinansalIslem(id);
        gosterMesaj(result.message, 'success');
    } catch (error) {
        gosterMesaj(error.message || 'Silme işlemi başarısız, işlem geri yüklendi.', 'danger');
        silinecekElement.style.opacity = '1';
        if (!silinecekElement.parentNode) {
            parent.insertBefore(silinecekElement, nextSibling);
        }
    }
}

function duzenleModaliniAc(islemId, mevcutTutar, mevcutAciklama) {
    document.getElementById('edit-islem-id').value = islemId;
    document.getElementById('edit-tutar-input').value = parseFloat(mevcutTutar);
    document.getElementById('edit-aciklama-input').value = mevcutAciklama;
    duzenleModal.show();
}

async function finansalIslemGuncelle() {
    const id = document.getElementById('edit-islem-id').value;
    const veri = {
        tutar: document.getElementById('edit-tutar-input').value,
        aciklama: document.getElementById('edit-aciklama-input').value.trim()
    };
    if (!veri.tutar || parseFloat(veri.tutar) <= 0) {
        gosterMesaj("Lütfen geçerli bir tutar girin.", "warning");
        return;
    }
    try {
        const result = await api.updateFinansalIslem(id, veri);
        gosterMesaj(result.message, 'success');
        duzenleModal.hide();
        await finansalIslemleriYukle(1);
    } catch (error) {
        gosterMesaj(error.message || 'Güncelleme başarısız.', 'danger');
    }
}
