// static/js/tedarikciler.js

let tedarikcilerMevcutGorunum = 'tablo'; // YENİ İSİM
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15;
let mevcutSiralamaSutunu = 'isim';
let mevcutSiralamaYonu = 'asc';
let mevcutAramaTerimi = '';
let tedarikciModal, silmeOnayModal;

// Arama için debounce fonksiyonu
function debounce(func, delay = 400) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

window.onload = async () => {
    tedarikciModal = new bootstrap.Modal(document.getElementById('tedarikciModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    // tedarikcilerMevcutGorunum kullanılıyor
    tedarikcilerMevcutGorunum = localStorage.getItem('tedarikciGorunum') || 'tablo';
    gorunumuAyarla(tedarikcilerMevcutGorunum); // Fonksiyona değişkeni ver

    const aramaInput = document.getElementById('arama-input');
    if (aramaInput) { // Elementin varlığını kontrol et
        aramaInput.addEventListener('input', debounce((event) => {
            mevcutAramaTerimi = event.target.value;
            verileriYukle(1); // Arama yapıldığında ilk sayfaya dön
        }));
    }


    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sutun = header.dataset.sort;
            if (mevcutSiralamaSutunu === sutun) {
                mevcutSiralamaYonu = mevcutSiralamaYonu === 'asc' ? 'desc' : 'asc';
            } else {
                mevcutSiralamaSutunu = sutun;
                mevcutSiralamaYonu = 'asc';
            }
            basliklariGuncelle();
            verileriYukle(1);
        });
    });

    basliklariGuncelle();
    await verileriYukle();
};

/**
 * Tedarikçi listesini sunucudan çeker ve arayüzü günceller.
 * @param {number} sayfa - Yüklenecek sayfa numarası.
 */
async function verileriYukle(sayfa = 1) {
    mevcutSayfa = sayfa;
    const url = `/api/tedarikciler_liste?sayfa=${sayfa}&arama=${encodeURIComponent(mevcutAramaTerimi)}&sirala=${mevcutSiralamaSutunu}&yon=${mevcutSiralamaYonu}&limit=${KAYIT_SAYISI}`;

    await genelVeriYukleyici({ // data-loader.js'den
        apiURL: url,
        veriAnahtari: 'tedarikciler',
        tabloBodyId: 'tedarikciler-tablosu',
        kartContainerId: 'tedarikciler-kart-listesi',
        veriYokId: 'veri-yok-mesaji',
        sayfalamaId: 'tedarikci-sayfalama',
        tabloRenderFn: renderTable,
        kartRenderFn: renderCards,
        yukleFn: verileriYukle,
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        // tedarikcilerMevcutGorunum kullanılıyor
        mevcutGorunum: tedarikcilerMevcutGorunum
    });
}

/**
 * Tedarikçi verilerini tablo satırları olarak render eder.
 */
function renderTable(container, suppliers) {
    suppliers.forEach(supplier => {
        container.innerHTML += `
            <tr id="tedarikci-${supplier.id}">
                <td><strong>${utils.sanitizeHTML(supplier.isim)}</strong></td>
                <td>${utils.sanitizeHTML(supplier.telefon_no) || '-'}</td>
                <td class="text-end">${parseFloat(supplier.toplam_litre || 0).toFixed(2)} L</td>
                <td class="text-center">
                    <a href="/tedarikci/${supplier.id}" class="btn btn-sm btn-outline-info" title="Detayları Gör"><i class="bi bi-eye"></i></a>
                    <button class="btn btn-sm btn-outline-primary ms-1" title="Düzenle" onclick="tedarikciDuzenleAc(${supplier.id}, this)"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger ms-1" title="Sil" onclick="silmeOnayiAc(${supplier.id}, '${utils.sanitizeHTML(supplier.isim.replace(/'/g, "\\'"))}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

/**
 * Tedarikçi verilerini kartlar olarak render eder.
 */
function renderCards(container, suppliers) {
    suppliers.forEach(supplier => {
        container.innerHTML += `
            <div class="col-lg-4 col-md-6 col-12" id="tedarikci-${supplier.id}">
                <div class="supplier-card">
                    <div class="supplier-card-header"><h5>${utils.sanitizeHTML(supplier.isim)}</h5></div>
                    <div class="supplier-card-body"><p class="mb-2"><i class="bi bi-telephone-fill me-2"></i>${utils.sanitizeHTML(supplier.telefon_no) || 'Belirtilmemiş'}</p></div>
                    <div class="supplier-card-footer">
                        <a href="/tedarikci/${supplier.id}" class="btn btn-sm btn-outline-info" title="Detayları Gör"><i class="bi bi-eye"></i></a>
                        <button class="btn btn-sm btn-outline-primary ms-1" title="Düzenle" onclick="tedarikciDuzenleAc(${supplier.id}, this)"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger ms-1" title="Sil" onclick="silmeOnayiAc(${supplier.id}, '${utils.sanitizeHTML(supplier.isim.replace(/'/g, "\\'"))}')"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

/**
 * Tablo başlıklarındaki sıralama ikonlarını günceller.
 */
function basliklariGuncelle() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.classList.remove('asc', 'desc');
        if (header.dataset.sort === mevcutSiralamaSutunu) {
            header.classList.add(mevcutSiralamaYonu);
        }
    });
}

/**
 * Yeni tedarikçi ekleme veya mevcut tedarikçiyi güncelleme işlemini yapar.
 */
async function tedarikciKaydet() {
    const kaydetButton = document.querySelector('#kaydet-tedarikci-btn');
    const originalButtonText = kaydetButton.innerHTML;
    const id = document.getElementById('edit-tedarikci-id').value;
    const veri = {
        isim: document.getElementById('tedarikci-isim-input').value.trim(),
        tc_no: document.getElementById('tedarikci-tc-input').value.trim(),
        telefon_no: document.getElementById('tedarikci-tel-input').value.trim(),
        adres: document.getElementById('tedarikci-adres-input').value.trim()
    };
    if (!veri.isim) { gosterMesaj("Tedarikçi ismi zorunludur.", "warning"); return; } // ui.js'den

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    try {
        const result = id
            ? await api.updateTedarikci(id, veri) // api.js'den
            : await api.postTedarikci(veri);    // api.js'den

        let mesaj = result.message;
        if (!id && result.ciftci_kullanici_adi && result.ciftci_sifre) {
            mesaj += `<br><small class="mt-2">Otomatik oluşturulan çiftçi giriş bilgileri:<br>Kullanıcı Adı: <strong>${utils.sanitizeHTML(result.ciftci_kullanici_adi)}</strong><br>Şifre: <strong>${utils.sanitizeHTML(result.ciftci_sifre)}</strong></small>`;
             gosterMesaj(mesaj, "success", 10000); // ui.js'den, 10 saniye
        } else {
             gosterMesaj(mesaj, "success"); // ui.js'den
        }

        tedarikciModal.hide();
        await verileriYukle(id ? mevcutSayfa : 1); // Listeyi güncelle

    } catch (error) {
        gosterMesaj(error.message || "Bir hata oluştu.", "danger"); // ui.js'den
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

/**
 * Tedarikçiyi ve (varsa) bağlı çiftçi hesabını siler.
 */
async function tedarikciSil() {
    const id = document.getElementById('silinecek-tedarikci-id').value;
    silmeOnayModal.hide();

    const silinecekElement = document.getElementById(`tedarikci-${id}`);
    if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    const originalHTML = silinecekElement.outerHTML;

    silinecekElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    silinecekElement.style.opacity = '0';
    silinecekElement.style.transform = 'translateX(-50px)';
    setTimeout(() => {
        if(silinecekElement.parentNode) silinecekElement.remove();
        // tedarikcilerMevcutGorunum kullanılıyor
        if (parent && parent.children.length === 0 && (tedarikcilerMevcutGorunum === 'kart' || document.getElementById('tedarikciler-tablosu').children.length === 0)) {
           document.getElementById('veri-yok-mesaji').style.display = 'block';
        }
    }, 400);

    try {
        const result = await api.deleteTedarikci(id); // api.js'den
        gosterMesaj(result.message, 'success'); // ui.js'den
        await verileriYukle(1); // Sayfalamayı düzeltmek için ilk sayfayı yükle
    } catch (error) {
        gosterMesaj(error.message || 'Silme işlemi başarısız, tedarikçi geri yüklendi.', 'danger'); // ui.js'den
        if (originalHTML && parent) {
             // tedarikcilerMevcutGorunum kullanılıyor
             const tempDiv = document.createElement(tedarikcilerMevcutGorunum === 'kart' ? 'div' : 'tbody');
             tempDiv.innerHTML = originalHTML;
             const restoredElement = tempDiv.firstChild;
             restoredElement.style.opacity = '1';
             restoredElement.style.transform = 'translateX(0)';
             parent.insertBefore(restoredElement, nextSibling);
             document.getElementById('veri-yok-mesaji').style.display = 'none';
        }
    }
}


/**
 * Tedarikçi düzenleme modalını açar ve verileri doldurur.
 */
async function tedarikciDuzenleAc(id, button) {
    if(button) button.disabled = true; // Butonu geçici olarak devre dışı bırak
    try {
        // api.js'den direkt tedarikçi detayını çek, /api/tedarikci/<id> endpoint'i olmalı
        const supplier = await api.request(`/api/tedarikci/${id}`);

        document.getElementById('tedarikciModalLabel').innerText = 'Tedarikçi Bilgilerini Düzenle';
        document.getElementById('edit-tedarikci-id').value = supplier.id;
        document.getElementById('tedarikci-isim-input').value = supplier.isim;
        document.getElementById('tedarikci-tc-input').value = supplier.tc_no || '';
        document.getElementById('tedarikci-tel-input').value = supplier.telefon_no || '';
        document.getElementById('tedarikci-adres-input').value = supplier.adres || '';
        tedarikciModal.show();
    } catch (error) {
        gosterMesaj(error.message || "Tedarikçi detayı bulunamadı.", "danger"); // ui.js'den
    } finally {
        if(button) button.disabled = false; // Butonu tekrar aktif et
    }
}

/**
 * Yeni tedarikçi ekleme modalını açar.
 */
function yeniTedarikciAc() {
    document.getElementById('tedarikciModalLabel').innerText = 'Yeni Tedarikçi Ekle';
    document.getElementById('edit-tedarikci-id').value = '';
    document.getElementById('tedarikci-form').reset();
    tedarikciModal.show();
}

/**
 * Silme onay modalını açar.
 */
function silmeOnayiAc(id, isim) {
    document.getElementById('silinecek-tedarikci-id').value = id;
    document.getElementById('silinecek-tedarikci-adi').innerText = isim;
    silmeOnayModal.show();
}

/**
 * Liste ve Kart görünümleri arasında geçiş yapar.
 */
function gorunumuDegistir(yeniGorunum) {
    // tedarikcilerMevcutGorunum kullanılıyor
    if (tedarikcilerMevcutGorunum === yeniGorunum) return;
    tedarikcilerMevcutGorunum = yeniGorunum;
    localStorage.setItem('tedarikciGorunum', tedarikcilerMevcutGorunum);
    gorunumuAyarla(tedarikcilerMevcutGorunum); // Fonksiyona değişkeni ver
    // Görünüm değişince veriyi tekrar yükle (opsiyonel)
    // await verileriYukle(mevcutSayfa);
}

/**
 * Aktif görünüme göre ilgili div'i gösterir/gizler ve butonları ayarlar.
 */
function gorunumuAyarla(aktifGorunum) { // Parametre eklendi
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    const aktifElement = document.getElementById(`${aktifGorunum}-gorunumu`);
    if(aktifElement) {
       aktifElement.style.display = 'block'; // Hem tablo hem kart için block yeterli
    }
    const tableBtn = document.getElementById('btn-view-table');
    const cardBtn = document.getElementById('btn-view-card');
    if(tableBtn) tableBtn.classList.toggle('active', aktifGorunum === 'tablo');
    if(cardBtn) cardBtn.classList.toggle('active', aktifGorunum === 'kart');
}
