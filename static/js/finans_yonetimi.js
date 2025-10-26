// static/js/finans_yonetimi.js

let tedarikciSecici, tarihSecici;
let duzenleModal, silmeOnayModal;
let finansMevcutGorunum = 'tablo'; // YENİ İSİM
const KAYIT_SAYISI = 10;

window.onload = function() {
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    tarihSecici = flatpickr("#islem-tarihi-input", { enableTime: true, dateFormat: "Y-m-d H:i:S", locale: "tr" }); // YYYY-MM-DD HH:MM:SS formatı
    duzenleModal = new bootstrap.Modal(document.getElementById('duzenleModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    // finansMevcutGorunum kullanılıyor
    finansMevcutGorunum = localStorage.getItem('finansGorunum') || 'tablo';
    gorunumuAyarla(finansMevcutGorunum); // Fonksiyona değişkeni ver

    tedarikcileriDoldur();
    finansalIslemleriYukle(1);
};

// Liste/Kart görünümünü değiştir
function gorunumuDegistir(yeniGorunum) {
    // finansMevcutGorunum kullanılıyor
    if (finansMevcutGorunum === yeniGorunum) return;
    finansMevcutGorunum = yeniGorunum;
    localStorage.setItem('finansGorunum', finansMevcutGorunum);
    gorunumuAyarla(finansMevcutGorunum); // Fonksiyona değişkeni ver
    finansalIslemleriYukle(1); // Yeniden yükle
}

// Arayüzü ayarlar (div'leri göster/gizle, butonları aktif/pasif yap)
function gorunumuAyarla(aktifGorunum) { // Parametre eklendi
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    const aktifElement = document.getElementById(`${aktifGorunum}-gorunumu`);
     if(aktifElement) aktifElement.style.display = 'block';

    const tableBtn = document.getElementById('btn-view-table');
    const cardBtn = document.getElementById('btn-view-card');
    if(tableBtn) tableBtn.classList.toggle('active', aktifGorunum === 'tablo');
    if(cardBtn) cardBtn.classList.toggle('active', aktifGorunum === 'kart');
}

// Finansal işlemleri yükler
async function finansalIslemleriYukle(sayfa = 1) {
    await genelVeriYukleyici({ // data-loader.js'den
        apiURL: `/finans/api/islemler?sayfa=${sayfa}&limit=${KAYIT_SAYISI}`,
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
        // finansMevcutGorunum kullanılıyor
        mevcutGorunum: finansMevcutGorunum
    });
}

// İşlemleri tablo olarak render et
function renderFinansAsTable(container, islemler) {
    islemler.forEach(islem => {
        const islemTarihi = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const tedarikciAdi = islem.tedarikciler ? utils.sanitizeHTML(islem.tedarikciler.isim) : 'Bilinmiyor';
        container.innerHTML += `
            <tr id="finans-islem-${islem.id}">
                <td>${islemTarihi}</td>
                <td>${tedarikciAdi}</td>
                <td><span class="badge bg-${islem.islem_tipi === 'Ödeme' ? 'success' : 'warning'}">${utils.sanitizeHTML(islem.islem_tipi)}</span></td>
                <td class="text-end fw-bold ${islem.islem_tipi === 'Ödeme' ? 'text-success' : 'text-danger'}">${parseFloat(islem.tutar).toFixed(2)} TL</td>
                <td>${utils.sanitizeHTML(islem.aciklama) || '-'}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="duzenleModaliniAc(${islem.id}, '${islem.tutar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')" title="Düzenle"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="silmeOnayiAc(${islem.id})" title="Sil"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

// İşlemleri kart olarak render et
function renderFinansAsCards(container, islemler) {
    islemler.forEach(islem => {
        const islemTarihi = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const tedarikciAdi = islem.tedarikciler ? utils.sanitizeHTML(islem.tedarikciler.isim) : 'Bilinmiyor';
        container.innerHTML += `
            <div class="col-md-6 col-12" id="finans-islem-${islem.id}">
                <div class="finance-card ${islem.islem_tipi === 'Ödeme' ? 'odeme' : 'avans'}">
                    <div class="finance-card-header">
                        <h5>${tedarikciAdi}</h5>
                        <div class="tarih">${islemTarihi}</div>
                    </div>
                    <div class="finance-card-body">
                        <p class="tutar ${islem.islem_tipi === 'Ödeme' ? 'text-success' : 'text-danger'}">${parseFloat(islem.tutar).toFixed(2)} TL</p>
                        <p class="aciklama">${utils.sanitizeHTML(islem.aciklama) || 'Açıklama yok'}</p>
                    </div>
                    <div class="finance-card-footer">
                        <button class="btn btn-sm btn-outline-primary" onclick="duzenleModaliniAc(${islem.id}, '${islem.tutar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')" title="Düzenle"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="silmeOnayiAc(${islem.id})" title="Sil"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

// Tedarikçi seçicisini doldur
async function tedarikcileriDoldur() {
    try {
        const tedarikciler = await store.getTedarikciler(); // store.js'den
        tedarikciSecici.clearOptions();
        tedarikciSecici.addOptions(tedarikciler.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.isim) }))); // utils.js'den
    } catch (error) {
        gosterMesaj('Tedarikçiler yüklenirken bir hata oluştu.', 'danger'); // ui.js'den
    }
}

// Yeni işlem formu temizleme
function formuTemizle() {
    document.getElementById('islem-tipi-sec').value = 'Ödeme';
    tedarikciSecici.clear();
    document.getElementById('tutar-input').value = '';
    document.getElementById('aciklama-input').value = '';
    tarihSecici.clear();
}

// Yeni finansal işlem kaydet
async function finansalIslemKaydet() {
    const veri = {
        islem_tipi: document.getElementById('islem-tipi-sec').value,
        tedarikci_id: tedarikciSecici.getValue(),
        tutar: document.getElementById('tutar-input').value,
        // Tarih seçilmediyse null gönder (backend varsayılan olarak şimdiki zamanı kullanır)
        islem_tarihi: tarihSecici.selectedDates[0] ? tarihSecici.selectedDates[0].toISOString().slice(0, 19).replace('T', ' ') : null,
        aciklama: document.getElementById('aciklama-input').value.trim()
    };
    if (!veri.islem_tipi || !veri.tedarikci_id || !veri.tutar || parseFloat(veri.tutar) <= 0) {
        gosterMesaj('Lütfen işlem tipi, tedarikçi ve geçerli bir tutar girin.', 'warning');
        return;
    }

    // Çevrimdışı kaydetme
    if (!navigator.onLine) {
        const basarili = await kaydetFinansIslemiCevrimdisi(veri); // offline.js'den
        if (basarili) {
            formuTemizle();
            await finansalIslemleriYukle(1); // Listeyi güncelle
        }
        return;
    }

    // Online kaydetme
    try {
        const result = await api.postFinansalIslem(veri); // api.js'den
        gosterMesaj(result.message, 'success'); // ui.js'den
        formuTemizle();
        await finansalIslemleriYukle(1); // Listeyi yenile
    } catch (error) {
        gosterMesaj(error.message, 'danger'); // ui.js'den
    }
}

// Silme onay modalını aç
function silmeOnayiAc(islemId) {
    document.getElementById('silinecek-islem-id').value = islemId;
    silmeOnayModal.show();
}

// Finansal işlemi sil
async function finansalIslemSil() {
    const id = document.getElementById('silinecek-islem-id').value;
    silmeOnayModal.hide();

    if (!navigator.onLine) {
        gosterMesaj("İşlemi silmek için internet bağlantısı gereklidir.", "warning");
        return;
    }

    // --- İyimser UI ---
    // finansMevcutGorunum kullanılıyor
    const silinecekElementId = `finans-islem-${id}`;
    const silinecekElement = document.getElementById(silinecekElementId);
    if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    const originalHTML = silinecekElement.outerHTML;

    silinecekElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    silinecekElement.style.opacity = '0';
    silinecekElement.style.transform = 'translateX(-50px)';
    setTimeout(() => {
        if (silinecekElement.parentNode) silinecekElement.remove();
        // Eğer silindikten sonra hiç işlem kalmadıysa "veri yok" mesajını göster
        if (parent && parent.children.length === 0 && (finansMevcutGorunum === 'kart' || document.getElementById('finansal-islemler-tablosu').children.length === 0)) {
            document.getElementById('veri-yok-mesaji').style.display = 'block';
        }
    }, 400);

    try {
        const result = await api.deleteFinansalIslem(id); // api.js'den
        gosterMesaj(result.message, 'success'); // ui.js'den
        await finansalIslemleriYukle(1); // Sayfalamayı düzeltmek için ilk sayfayı yükle
    } catch (error) {
        gosterMesaj(error.message || 'Silme işlemi başarısız, işlem geri yüklendi.', 'danger'); // ui.js'den
        // Hata durumunda geri yükle
        if (originalHTML && parent) {
            // finansMevcutGorunum kullanılıyor
            const tempDiv = document.createElement(finansMevcutGorunum === 'kart' ? 'div' : 'tbody');
            tempDiv.innerHTML = originalHTML;
            const restoredElement = tempDiv.firstChild;
            restoredElement.style.opacity = '1';
            restoredElement.style.transform = 'translateX(0)';
            parent.insertBefore(restoredElement, nextSibling);
            document.getElementById('veri-yok-mesaji').style.display = 'none';
        }
    }
}

// Düzenleme modalını aç
function duzenleModaliniAc(islemId, mevcutTutar, mevcutAciklama) {
    document.getElementById('edit-islem-id').value = islemId;
    document.getElementById('edit-tutar-input').value = parseFloat(mevcutTutar);
    document.getElementById('edit-aciklama-input').value = mevcutAciklama;
    duzenleModal.show();
}

// Finansal işlemi güncelle
async function finansalIslemGuncelle() {
    if (!navigator.onLine) {
        gosterMesaj("İşlemleri düzenlemek için internet bağlantısı gereklidir.", "warning");
        return;
    }
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
        const result = await api.updateFinansalIslem(id, veri); // api.js'den
        gosterMesaj(result.message, 'success'); // ui.js'den
        duzenleModal.hide();
        await finansalIslemleriYukle(1); // Listeyi yenile (ilk sayfaya dönerek)
    } catch (error) {
        gosterMesaj(error.message || 'Güncelleme başarısız.', 'danger'); // ui.js'den
    }
}
