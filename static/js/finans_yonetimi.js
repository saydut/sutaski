// static/js/finans_yonetimi.js

let tedarikciSecici, tarihSecici;
let duzenleModal, silmeOnayModal;
let finansMevcutGorunum = 'tablo';
const KAYIT_SAYISI = 10;

window.onload = function() {
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    tarihSecici = flatpickr("#islem-tarihi-input", { enableTime: true, dateFormat: "Y-m-d H:i:S", locale: "tr" }); // YYYY-MM-DD HH:MM:SS formatı
    duzenleModal = new bootstrap.Modal(document.getElementById('duzenleModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    finansMevcutGorunum = localStorage.getItem('finansGorunum') || 'tablo';
    gorunumuAyarla(finansMevcutGorunum);

    // Formdaki İşlem Tipi select menüsüne "Tahsilat"ı ekleyelim (eğer HTML'de yoksa)
    const islemTipiSelect = document.getElementById('islem-tipi-sec');
    if (islemTipiSelect && !islemTipiSelect.querySelector('option[value="Tahsilat"]')) {
        const tahsilatOption = new Option('Tahsilat', 'Tahsilat');
        islemTipiSelect.add(tahsilatOption);
    }

    tedarikcileriDoldur();
    finansalIslemleriYukle(1);
};

// Liste/Kart görünümünü değiştir
function gorunumuDegistir(yeniGorunum) {
    if (finansMevcutGorunum === yeniGorunum) return;
    finansMevcutGorunum = yeniGorunum;
    localStorage.setItem('finansGorunum', finansMevcutGorunum);
    gorunumuAyarla(finansMevcutGorunum);
    finansalIslemleriYukle(1);
}

// Arayüzü ayarlar (div'leri göster/gizle, butonları aktif/pasif yap)
function gorunumuAyarla(aktifGorunum) {
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
    await genelVeriYukleyici({
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
        mevcutGorunum: finansMevcutGorunum
    });
}


// --- DÜZELTME: Render Fonksiyonları (Yorumlar Kaldırıldı) ---

// İşlemleri tablo olarak render et
function renderFinansAsTable(container, islemler) {
    container.innerHTML = ''; // Önce temizle
    islemler.forEach(islem => {
        const islemTarihi = islem.islem_tarihi ? new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Bilinmeyen Tarih';
        const tedarikciAdi = islem.tedarikciler ? utils.sanitizeHTML(islem.tedarikciler.isim) : 'Bilinmiyor';
        const kullaniciAdi = islem.kullanicilar ? utils.sanitizeHTML(islem.kullanicilar.kullanici_adi) : '-';

        let tipBadgeClass = 'bg-secondary';
        let tutarRenkClass = '';
        if (islem.islem_tipi === 'Ödeme' || islem.islem_tipi === 'Avans') {
            tipBadgeClass = islem.islem_tipi === 'Ödeme' ? 'bg-success' : 'bg-warning';
            tutarRenkClass = 'text-danger'; // Şirketten çıkış kırmızı
        } else if (islem.islem_tipi === 'Tahsilat') {
            tipBadgeClass = 'bg-info';
            tutarRenkClass = 'text-success'; // Şirkete giriş yeşil
        }

        container.innerHTML += `
            <tr id="finans-islem-${islem.id}">
                <td>${islemTarihi}</td>
                <td>${tedarikciAdi}</td>
                <td><span class="badge ${tipBadgeClass}">${utils.sanitizeHTML(islem.islem_tipi)}</span></td>
                <td class="text-end fw-bold ${tutarRenkClass}">${parseFloat(islem.tutar).toFixed(2)} TL</td>
                <td>${utils.sanitizeHTML(islem.aciklama) || '-'}</td>
                <td>${kullaniciAdi}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="duzenleModaliniAc(${islem.id}, '${islem.tutar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')" title="Düzenle"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="silmeOnayiAc(${islem.id})" title="Sil"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

// İşlemleri kart olarak render et
function renderFinansAsCards(container, islemler) {
    container.innerHTML = ''; // Önce temizle
    islemler.forEach(islem => {
        const islemTarihi = islem.islem_tarihi ? new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Bilinmeyen Tarih';
        const tedarikciAdi = islem.tedarikciler ? utils.sanitizeHTML(islem.tedarikciler.isim) : 'Bilinmiyor';
        const kullaniciAdi = islem.kullanicilar ? utils.sanitizeHTML(islem.kullanicilar.kullanici_adi) : '-';

        let cardBorderClass = '';
        let tutarRenkClass = '';
        if (islem.islem_tipi === 'Ödeme' || islem.islem_tipi === 'Avans') {
            cardBorderClass = islem.islem_tipi === 'Ödeme' ? 'odeme' : 'avans';
            tutarRenkClass = 'text-danger';
        } else if (islem.islem_tipi === 'Tahsilat') {
            cardBorderClass = 'tahsilat';
            tutarRenkClass = 'text-success';
        }

        container.innerHTML += `
            <div class="col-md-6 col-12" id="finans-islem-${islem.id}">
                <div class="finance-card ${cardBorderClass}">
                    <div class="finance-card-header">
                        <h5>${tedarikciAdi}</h5>
                        <div class="tarih">${islemTarihi}</div>
                    </div>
                    <div class="finance-card-body">
                        <p class="tutar ${tutarRenkClass}">${parseFloat(islem.tutar).toFixed(2)} TL</p>
                        <p class="aciklama">${utils.sanitizeHTML(islem.aciklama) || 'Açıklama yok'}</p>
                        <small class="text-secondary d-block mt-2">İşlemi Yapan: ${kullaniciAdi}</small>
                    </div>
                    <div class="finance-card-footer">
                        <button class="btn btn-sm btn-outline-primary" onclick="duzenleModaliniAc(${islem.id}, '${islem.tutar}', '${utils.sanitizeHTML((islem.aciklama || '').replace(/'/g, "\\'"))}')" title="Düzenle"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="silmeOnayiAc(${islem.id})" title="Sil"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

// --- /DÜZELTME SONU ---


// Tedarikçi seçicisini doldur
async function tedarikcileriDoldur() {
    try {
        const tedarikciler = await store.getTedarikciler();
        tedarikciSecici.clearOptions();
        tedarikciSecici.addOptions(tedarikciler.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.isim) })));
    } catch (error) {
        gosterMesaj('Tedarikçiler yüklenirken bir hata oluştu.', 'danger');
    }
}

// Yeni işlem formu temizleme
function formuTemizle() {
    document.getElementById('islem-tipi-sec').value = 'Ödeme';
    tedarikciSecici.clear();
    document.getElementById('tutar-input').value = '';
    document.getElementById('aciklama-input').value = '';
    if (tarihSecici) tarihSecici.clear();
}

// Yeni finansal işlem kaydet
async function finansalIslemKaydet() {
    const veri = {
        islem_tipi: document.getElementById('islem-tipi-sec').value,
        tedarikci_id: tedarikciSecici.getValue(),
        tutar: document.getElementById('tutar-input').value,
        islem_tarihi: tarihSecici && tarihSecici.selectedDates[0] ? tarihSecici.selectedDates[0].toISOString().slice(0, 19).replace('T', ' ') : null,
        aciklama: document.getElementById('aciklama-input').value.trim()
    };
    if (!veri.islem_tipi || !veri.tedarikci_id || !veri.tutar || parseFloat(veri.tutar) <= 0) {
        gosterMesaj('Lütfen işlem tipi, tedarikçi ve geçerli bir tutar girin.', 'warning');
        return;
    }

    if (!navigator.onLine) {
        const basarili = await kaydetFinansIslemiCevrimdisi(veri);
        if (basarili) {
            formuTemizle();
            await finansalIslemleriYukle(1);
        }
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

// Silme onay modalını aç
function silmeOnayiAc(islemId) {
    const idInput = document.getElementById('silinecek-islem-id');
    if(idInput) idInput.value = islemId;
    if(silmeOnayModal) silmeOnayModal.show();
}

// Finansal işlemi sil
async function finansalIslemSil() {
    const idInput = document.getElementById('silinecek-islem-id');
    if (!idInput) return;
    const id = idInput.value;
    if(silmeOnayModal) silmeOnayModal.hide();

    if (!navigator.onLine) {
        gosterMesaj("İşlemi silmek için internet bağlantısı gereklidir.", "warning");
        return;
    }

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
        const veriYokMesaji = document.getElementById('veri-yok-mesaji');
        const tabloBody = document.getElementById('finansal-islemler-tablosu');
        const kartContainer = document.getElementById('finansal-islemler-kart-listesi');
        if (veriYokMesaji && tabloBody && kartContainer && tabloBody.children.length === 0 && kartContainer.children.length === 0) {
            veriYokMesaji.style.display = 'block';
        }
    }, 400);

    try {
        const result = await api.deleteFinansalIslem(id);
        gosterMesaj(result.message, 'success');
        await finansalIslemleriYukle(1);
    } catch (error) {
        gosterMesaj(error.message || 'Silme işlemi başarısız, işlem geri yüklendi.', 'danger');
        if (originalHTML && parent) {
            const tempDiv = document.createElement(finansMevcutGorunum === 'kart' ? 'div' : 'tbody');
            tempDiv.innerHTML = originalHTML;
            const restoredElement = tempDiv.firstChild;
            if (restoredElement) {
                restoredElement.style.opacity = '1';
                restoredElement.style.transform = 'translateX(0)';
                parent.insertBefore(restoredElement, nextSibling);
                const veriYokMesaji = document.getElementById('veri-yok-mesaji');
                if(veriYokMesaji) veriYokMesaji.style.display = 'none';
            }
        }
    }
}

// Düzenleme modalını aç
function duzenleModaliniAc(islemId, mevcutTutar, mevcutAciklama) {
    const idInput = document.getElementById('edit-islem-id');
    const tutarInput = document.getElementById('edit-tutar-input');
    const aciklamaInput = document.getElementById('edit-aciklama-input');
    if(idInput) idInput.value = islemId;
    if(tutarInput) tutarInput.value = parseFloat(mevcutTutar);
    if(aciklamaInput) aciklamaInput.value = mevcutAciklama;
    if(duzenleModal) duzenleModal.show();
}

// Finansal işlemi güncelle
async function finansalIslemGuncelle() {
    if (!navigator.onLine) {
        gosterMesaj("İşlemleri düzenlemek için internet bağlantısı gereklidir.", "warning");
        return;
    }
    const idInput = document.getElementById('edit-islem-id');
    const tutarInput = document.getElementById('edit-tutar-input');
    const aciklamaInput = document.getElementById('edit-aciklama-input');
    if(!idInput || !tutarInput || !aciklamaInput) return;

    const id = idInput.value;
    const veri = {
        tutar: tutarInput.value,
        aciklama: aciklamaInput.value.trim()
    };
    if (!veri.tutar || parseFloat(veri.tutar) <= 0) {
        gosterMesaj("Lütfen geçerli bir tutar girin.", "warning");
        return;
    }
    try {
        const result = await api.updateFinansalIslem(id, veri);
        gosterMesaj(result.message, 'success');
        if(duzenleModal) duzenleModal.hide();
        await finansalIslemleriYukle(1);
    } catch (error) {
        gosterMesaj(error.message || 'Güncelleme başarısız.', 'danger');
    }
}

