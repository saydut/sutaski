// static/js/firma_yonetimi.js

// --- Global Değişkenler ---
let kullanicilarCache = [];
let tedarikcilerCache = [];

let yeniKullaniciModal, kullaniciDuzenleModal, kullaniciSifreAyarlaModal, silmeOnayModal;
let yeniKullaniciForm, editKullaniciForm, sifreAyarlaForm;
let yeniKullaniciTedarikciSelect, editKullaniciTedarikciSelect;
let yeniKullaniciRolSelect, editKullaniciRolSelect;
let yeniTedarikciAlani, editTedarikciAlani;

const API_ENDPOINTS = {
    data: '/firma/api/data',
    ekle: '/firma/api/kullanici_ekle',
    detay: '/firma/api/kullanici_detay/', // +id
    guncelle: '/firma/api/kullanici_guncelle/', // +id
    sil: '/firma/api/kullanici_sil/', // +id
    sifreSetle: '/firma/api/kullanici_sifre_setle/' // +id
};

// --- Başlatma ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Modal ve Form Elementlerini Bul
    initModalsAndForms();
    
    // 2. TomSelect (Tedarikçi Seçiciler) Başlat
    initTomSelects();

    // 3. Olay Dinleyicilerini (Event Listeners) Başlat
    initEventListeners();

    // 4. Sayfa Verilerini (Kullanıcılar ve Tedarikçiler) Yükle
    loadPageData();
});

/**
 * Gerekli tüm Modal ve Form nesnelerini başlatır.
 */
function initModalsAndForms() {
    yeniKullaniciModal = new bootstrap.Modal(document.getElementById('yeniKullaniciModal'));
    kullaniciDuzenleModal = new bootstrap.Modal(document.getElementById('kullaniciDuzenleModal'));
    kullaniciSifreAyarlaModal = new bootstrap.Modal(document.getElementById('kullaniciSifreAyarlaModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    yeniKullaniciForm = document.getElementById('yeni-kullanici-form');
    editKullaniciForm = document.getElementById('edit-kullanici-form');
    sifreAyarlaForm = document.getElementById('sifre-ayarla-form');

    yeniKullaniciRolSelect = document.getElementById('yeni-kullanici-rol');
    editKullaniciRolSelect = document.getElementById('edit-kullanici-rol');

    yeniTedarikciAlani = document.getElementById('yeni-kullanici-tedarikci-alan');
    editTedarikciAlani = document.getElementById('edit-kullanici-tedarikci-alan');
}

/**
 * Tedarikçi seçimi için TomSelect kütüphanesini başlatır.
 */
function initTomSelects() {
    const tomSelectAyarlari = (maxItems = 1000) => ({
        plugins: ['remove_button'],
        valueField: 'id',
        labelField: 'ad_soyad',
        searchField: ['ad_soyad', 'kod'],
        create: false,
        maxItems: maxItems,
        render: {
            item: function(data, escape) {
                return `<div class="item">${escape(data.kod ? `[${data.kod}]` : '')} ${escape(data.ad_soyad)}</div>`;
            },
            option: function(data, escape) {
                return `<div class="option">${escape(data.kod ? `[${data.kod}]` : '')} ${escape(data.ad_soyad)}</div>`;
            }
        }
    });

    yeniKullaniciTedarikciSelect = new TomSelect('#yeni-kullanici-tedarikciler', tomSelectAyarlari());
    editKullaniciTedarikciSelect = new TomSelect('#edit-kullanici-tedarikciler', tomSelectAyarlari());
}

/**
 * Tüm form gönderimlerini ve buton tıklamalarını yönetir.
 */
function initEventListeners() {
    // Form Gönderimleri
    yeniKullaniciForm.addEventListener('submit', handleYeniKullaniciSubmit);
    editKullaniciForm.addEventListener('submit', handleEditKullaniciSubmit);
    sifreAyarlaForm.addEventListener('submit', handleSifreKaydetSubmit);

    // Rol Değişimi (Tedarikçi alanını göster/gizle)
    yeniKullaniciRolSelect.addEventListener('change', (e) => {
        handleRolChange(e.target, yeniTedarikciAlani, yeniKullaniciTedarikciSelect, '#yeni-kullanici-tedarikci-yardim');
    });
    editKullaniciRolSelect.addEventListener('change', (e) => {
        handleRolChange(e.target, editTedarikciAlani, editKullaniciTedarikciSelect, '#edit-kullanici-tedarikci-yardim');
    });

    // Modal Açılma Olayları (Veri doldurmak için)
    const kullaniciDuzenleModalEl = document.getElementById('kullaniciDuzenleModal');
    kullaniciDuzenleModalEl.addEventListener('show.bs.modal', handleEditModalOpen);

    const kullaniciSifreModalEl = document.getElementById('kullaniciSifreAyarlaModal');
    kullaniciSifreModalEl.addEventListener('show.bs.modal', handleSifreModalOpen);

    const silmeOnayModalEl = document.getElementById('silmeOnayModal');
    silmeOnayModalEl.addEventListener('show.bs.modal', handleSilModalOpen);

    // Dinamik olarak oluşturulan butonlar için olay delegasyonu (Tablo gövdesine)
    const tabloBody = document.getElementById('kullanici-listesi-body');
    tabloBody.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;
        
        if (action === 'edit') {
            // 'show.bs.modal' olayı tetiklenmeden önce butona tıklandığını belirtmek için
            // modal elementine veriyi aktar.
            kullaniciDuzenleModalEl.dataset.kullaniciId = id;
            kullaniciDuzenleModal.show();
        } else if (action === 'password') {
            kullaniciSifreModalEl.dataset.kullaniciId = id;
            kullaniciSifreModalEl.dataset.kullaniciAd = button.dataset.name;
            kullaniciSifreAyarlaModal.show();
        } else if (action === 'delete') {
            silmeOnayModalEl.dataset.kullaniciId = id;
            silmeOnayModalEl.dataset.authId = button.dataset.authId;
            silmeOnayModalEl.dataset.kullaniciAd = button.dataset.name;
            silmeOnayModal.show();
        }
    });

    // Silmeyi Onayla Butonu
    document.getElementById('onayla-sil-btn').addEventListener('click', handleSilOnaylaClick);
}

// --- Veri Yükleme ve Render ---

/**
 * API'den kullanıcıları ve tedarikçileri çeker.
 */
async function loadPageData() {
    try {
        const response = await api.request(API_ENDPOINTS.data);
        kullanicilarCache = response.kullanicilar || [];
        tedarikcilerCache = response.tedarikciler || [];

        // Tedarikçileri TomSelect'lere doldur
        yeniKullaniciTedarikciSelect.clearOptions();
        yeniKullaniciTedarikciSelect.addOptions(tedarikcilerCache);
        editKullaniciTedarikciSelect.clearOptions();
        editKullaniciTedarikciSelect.addOptions(tedarikcilerCache);
        
        // Kullanıcı tablosunu render et
        renderKullaniciTablosu(kullanicilarCache);

    } catch (error) {
        gosterMesaj(`Veriler yüklenirken hata oluştu: ${error.message}`, 'danger');
        document.getElementById('kullanici-listesi-body').innerHTML = 
            `<tr><td colspan="6" class="text-center text-danger">Veriler yüklenemedi.</td></tr>`;
    }
}

/**
 * Kullanıcı listesini HTML tablosuna dönüştürür.
 * @param {Array} kullanicilar - Kullanıcı verisi dizisi
 */
function renderKullaniciTablosu(kullanicilar) {
    const tabloBody = document.getElementById('kullanici-listesi-body');
    if (kullanicilar.length === 0) {
        tabloBody.innerHTML = '<tr><td colspan="6" class="text-center">Kayıtlı kullanıcı bulunamadı.</td></tr>';
        return;
    }

    tabloBody.innerHTML = kullanicilar.map(kullanici => {
        const rolText = cevirRol(kullanici.rol);
        const durumBadge = kullanici.aktif 
            ? `<span class="badge bg-success">Aktif</span>`
            : `<span class="badge bg-danger">Pasif</span>`;
        
        // Butonlara hem 'id' (int, PK) hem de 'auth_id' (uuid) ekliyoruz
        return `
            <tr>
                <td>${sanitizeHTML(kullanici.ad_soyad)}</td>
                <td>${rolText}</td>
                <td>${sanitizeHTML(kullanici.email)}</td>
                <td>${sanitizeHTML(kullanici.telefon || '-')}</td>
                <td>${durumBadge}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary me-1" 
                            data-action="edit" 
                            data-id="${kullanici.id}" 
                            title="Düzenle">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-warning me-1" 
                            data-action="password" 
                            data-id="${kullanici.id}" 
                            data-name="${sanitizeHTML(kullanici.ad_soyad)}"
                            title="Şifre Ayarla">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" 
                            data-action="delete" 
                            data-id="${kullanici.id}" 
                            data-auth-id="${kullanici.auth_id}" 
                            data-name="${sanitizeHTML(kullanici.ad_soyad)}"
                            title="Sil">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}


// --- Olay Yöneticileri (Event Handlers) ---

/**
 * "Yeni Kullanıcı Ekle" formu gönderildiğinde çalışır.
 */
async function handleYeniKullaniciSubmit(e) {
    e.preventDefault();
    const submitButton = document.getElementById('yeni-kullanici-kaydet-btn');
    toggleSpinner(submitButton, true);

    const rol = yeniKullaniciRolSelect.value;
    let atanan_tedarikciler = yeniKullaniciTedarikciSelect.getValue();
    
    // Çiftçi ise sadece 1 tedarikçi alabilir
    if (rol === 'CIFCI' && Array.isArray(atanan_tedarikciler) && atanan_tedarikciler.length > 1) {
        gosterMesaj("'Çiftçi' rolü için sadece 1 tedarikçi seçilebilir.", 'warning');
        toggleSpinner(submitButton, false);
        return;
    }

    const data = {
        ad_soyad: document.getElementById('yeni-kullanici-ad').value,
        email: document.getElementById('yeni-kullanici-email').value,
        telefon: document.getElementById('yeni-kullanici-telefon').value,
        rol: rol,
        sifre: document.getElementById('yeni-kullanici-sifre').value,
        sifre_tekrar: document.getElementById('yeni-kullanici-sifre-tekrar').value,
        atanan_tedarikciler: Array.isArray(atanan_tedarikciler) ? atanan_tedarikciler : (atanan_tedarikciler ? [atanan_tedarikciler] : [])
    };

    try {
        const result = await api.request(API_ENDPOINTS.ekle, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        gosterMesaj(result.message, 'success');
        yeniKullaniciModal.hide();
        yeniKullaniciForm.reset();
        yeniKullaniciTedarikciSelect.clear();
        loadPageData(); // Tabloyu yenile

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        toggleSpinner(submitButton, false);
    }
}

/**
 * "Düzenle" modalı açıldığında çalışır, verileri çeker ve formu doldurur.
 */
async function handleEditModalOpen(event) {
    // Tıklanan butondan (veya modalın kendisinden) ID'yi al
    const kullaniciId = event.currentTarget.dataset.kullaniciId;
    if (!kullaniciId) return;

    // Formu temizle ve yükleniyor durumu göster
    editKullaniciForm.reset();
    editKullaniciTedarikciSelect.clear();
    setModalLoading(true);

    try {
        const kullanici = await api.request(API_ENDPOINTS.detay + kullaniciId);
        
        // Formu doldur
        document.getElementById('edit-kullanici-id').value = kullanici.id;
        document.getElementById('edit-kullanici-auth-id').value = kullanici.auth_id;
        document.getElementById('edit-kullanici-ad').value = kullanici.ad_soyad;
        document.getElementById('edit-kullanici-email').value = kullanici.email;
        document.getElementById('edit-kullanici-telefon').value = kullanici.telefon || '';
        document.getElementById('edit-kullanici-rol').value = kullanici.rol;
        document.getElementById('edit-kullanici-aktif').checked = kullanici.aktif;

        // Tedarikçi alanını rol'e göre ayarla
        handleRolChange(editKullaniciRolSelect, editTedarikciAlani, editKullaniciTedarikciSelect, '#edit-kullanici-tedarikci-yardim');
        
        // TomSelect'i doldur
        if (kullanici.atanan_tedarikciler && kullanici.atanan_tedarikciler.length > 0) {
            editKullaniciTedarikciSelect.setValue(kullanici.atanan_tedarikciler);
        }
        
        setModalLoading(false);

    } catch (error) {
        gosterMesaj(`Kullanıcı detayları getirilemedi: ${error.message}`, 'danger');
        kullaniciDuzenleModal.hide();
    }
}

/**
 * Düzenleme modalında "Yükleniyor" overlay'ini yönetir.
 */
function setModalLoading(isLoading) {
    // Bu fonksiyonu, modal içeriğini gizleyip bir spinner göstererek
    // veya sadece kaydet butonunu devre dışı bırakarak implemente edebilirsiniz.
    // Şimdilik sadece butonu yönetelim:
    const submitButton = document.getElementById('edit-kullanici-kaydet-btn');
    toggleSpinner(submitButton, isLoading);
}

/**
 * "Kullanıcı Düzenle" formu gönderildiğinde çalışır.
 */
async function handleEditKullaniciSubmit(e) {
    e.preventDefault();
    const submitButton = document.getElementById('edit-kullanici-kaydet-btn');
    toggleSpinner(submitButton, true);

    const id = document.getElementById('edit-kullanici-id').value;
    const rol = editKullaniciRolSelect.value;
    let atanan_tedarikciler = editKullaniciTedarikciSelect.getValue();

    // Çiftçi ise sadece 1 tedarikçi alabilir
    if (rol === 'CIFCI' && Array.isArray(atanan_tedarikciler) && atanan_tedarikciler.length > 1) {
        gosterMesaj("'Çiftçi' rolü için sadece 1 tedarikçi seçilebilir.", 'warning');
        toggleSpinner(submitButton, false);
        return;
    }

    const data = {
        ad_soyad: document.getElementById('edit-kullanici-ad').value,
        email: document.getElementById('edit-kullanici-email').value,
        telefon: document.getElementById('edit-kullanici-telefon').value,
        rol: rol,
        aktif: document.getElementById('edit-kullanici-aktif').checked,
        atanan_tedarikciler: Array.isArray(atanan_tedarikciler) ? atanan_tedarikciler : (atanan_tedarikciler ? [atanan_tedarikciler] : [])
    };

    try {
        const result = await api.request(API_ENDPOINTS.guncelle + id, {
            method: 'PUT', // veya 'POST' (blueprint'e bağlı)
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });

        gosterMesaj(result.message, 'success');
        kullaniciDuzenleModal.hide();
        loadPageData(); // Tabloyu yenile

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        toggleSpinner(submitButton, false);
    }
}

/**
 * "Şifre Ayarla" modalı açıldığında çalışır, formu hazırlar.
 */
function handleSifreModalOpen(event) {
    const kullaniciId = event.currentTarget.dataset.kullaniciId;
    const kullaniciAd = event.currentTarget.dataset.kullaniciAd;

    sifreAyarlaForm.reset();
    document.getElementById('sifre-kullanici-id').value = kullaniciId;
    document.getElementById('sifre-modal-baslik').textContent = sanitizeHTML(kullaniciAd);
}

/**
 * "Şifre Ayarla" formu gönderildiğinde çalışır.
 */
async function handleSifreKaydetSubmit(e) {
    e.preventDefault();
    const submitButton = document.getElementById('sifre-kaydet-btn');
    toggleSpinner(submitButton, true);

    const id = document.getElementById('sifre-kullanici-id').value;
    const yeniSifre = document.getElementById('yeni-sifre').value;
    const yeniSifreTekrar = document.getElementById('yeni-sifre-tekrar').value;

    if (yeniSifre !== yeniSifreTekrar) {
        gosterMesaj('Şifreler eşleşmiyor.', 'warning');
        toggleSpinner(submitButton, false);
        return;
    }
    if (yeniSifre.length < 6) {
        gosterMesaj('Şifre en az 6 karakter olmalıdır.', 'warning');
        toggleSpinner(submitButton, false);
        return;
    }

    const data = {
        yeni_sifre: yeniSifre,
        yeni_sifre_tekrar: yeniSifreTekrar
    };

    try {
        const result = await api.request(API_ENDPOINTS.sifreSetle + id, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' }
        });
        
        gosterMesaj(result.message, 'success');
        kullaniciSifreAyarlaModal.hide();

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        toggleSpinner(submitButton, false);
    }
}


/**
 * "Sil" modalı açıldığında çalışır, onay mesajını hazırlar.
 */
function handleSilModalOpen(event) {
    const kullaniciId = event.currentTarget.dataset.kullaniciId;
    const authId = event.currentTarget.dataset.authId;
    const kullaniciAd = event.currentTarget.dataset.kullaniciAd;

    document.getElementById('silinecek-oge-adi').textContent = sanitizeHTML(kullaniciAd);
    
    // Silme butonuna ID'leri ata
    const onaylaBtn = document.getElementById('onayla-sil-btn');
    onaylaBtn.dataset.silId = kullaniciId;
    onaylaBtn.dataset.silAuthId = authId;
}

/**
 * Silme işlemini onaylayan butona tıklandığında çalışır.
 */
async function handleSilOnaylaClick(e) {
    const submitButton = e.currentTarget;
    toggleSpinner(submitButton, true);

    const id = submitButton.dataset.silId;
    const authId = submitButton.dataset.silAuthId;

    try {
        const result = await api.request(API_ENDPOINTS.sil + id, {
            method: 'DELETE',
            body: JSON.stringify({ auth_id: authId }), // auth_id'yi gövdede gönderiyoruz
            headers: { 'Content-Type': 'application/json' }
        });
        
        gosterMesaj(result.message, 'success');
        silmeOnayModal.hide();
        loadPageData(); // Tabloyu yenile

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        toggleSpinner(submitButton, false);
    }
}


// --- Yardımcı UI Fonksiyonları ---

/**
 * Rol seçimine göre tedarikçi seçme alanını gösterir/gizler ve ayarlar.
 * @param {Element} rolSelect - Rol <select> elementi
 * @param {Element} tedarikciAlan - Tedarikçi seçiciyi içeren <div>
 * @param {TomSelect} tomSelectInstance - İlgili TomSelect nesnesi
 * @param {string} yardimMetniSelector - Yardım metni elementinin CSS seçicisi
 */
function handleRolChange(rolSelect, tedarikciAlan, tomSelectInstance, yardimMetniSelector) {
    const secilenRol = rolSelect.value;
    const yardimMetniEl = document.querySelector(yardimMetniSelector);

    if (secilenRol === 'TOPLAYICI') {
        tedarikciAlan.style.display = 'block';
        tomSelectInstance.setMaxItems(1000); // Toplayıcı için çoklu seçim
        if(yardimMetniEl) yardimMetniEl.textContent = "Bu toplayıcının hangi tedarikçilerden süt alacağını seçin (Çoklu seçim).";
    } else if (secilenRol === 'CIFCI') {
        tedarikciAlan.style.display = 'block';
        tomSelectInstance.setMaxItems(1); // Çiftçi için tek seçim
        if(yardimMetniEl) yardimMetniEl.textContent = "Bu kullanıcının hangi tedarikçi hesabına bağlanacağını seçin (Sadece 1 adet).";
    } else { // Muhasebeci veya diğer
        tedarikciAlan.style.display = 'none';
        tomSelectInstance.clear();
    }
}

/**
 * Buton içindeki spinner'ı açar veya kapatır.
 * @param {Element} button - İşlem yapılan buton
 * @param {boolean} isLoading - Yükleniyor durumu
 */
function toggleSpinner(button, isLoading) {
    if (!button) return;
    const spinner = button.querySelector('.spinner-border');
    
    if (isLoading) {
        button.disabled = true;
        if (spinner) spinner.classList.remove('d-none');
    } else {
        button.disabled = false;
        if (spinner) spinner.classList.add('d-none');
    }
}

/**
 * Gelen rol değerini okunabilir metne çevirir.
 * @param {string} rol - Veritabanından gelen rol (örn: 'TOPLAYICI')
 * @returns {string} Okunabilir rol adı (örn: 'Toplayıcı')
 */
function cevirRol(rol) {
    const roller = {
        'TOPLAYICI': 'Toplayıcı',
        'MUHASEBECI': 'Muhasebeci',
        'CIFCI': 'Çiftçi',
        'FIRMA_YETKILISI': 'Firma Yetkilisi',
        'ADMIN': 'Admin'
    };
    return roller[rol] || rol;
}

/**
* Basit HTML temizleme (XSS önlemi)
*/
function sanitizeHTML(str) {
    if (!str) return "";
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}