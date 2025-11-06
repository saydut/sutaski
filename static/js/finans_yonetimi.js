// static/js/finans_yonetimi.js

let finansSilmeOnayModal, finansEkleModal;
let mevcutSayfa = 1;
let seciliTarih = null;
let seciliIslemTipi = null;
let tedarikciSecici, toplayiciSecici;
let tumTedarikciler = [], tumToplayicilar = []; // Verileri saklamak için

const ISLEMLER_SAYFA_BASI = 15;

window.onload = function() {
    finansSilmeOnayModal = new bootstrap.Modal(document.getElementById('finansSilmeOnayModal'));
    finansEkleModal = new bootstrap.Modal(document.getElementById('finansEkleModal'));

    // TomSelect başlat
    tedarikciSecici = new TomSelect("#islem-tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    toplayiciSecici = new TomSelect("#islem-toplayici-sec", { create: false, sortField: { field: "text", direction: "asc" } });

    // Olay dinleyicileri
    const islemTipiSelect = document.getElementById('islem-tipi-sec');
    if(islemTipiSelect) {
        islemTipiSelect.addEventListener('change', ilgiliKullaniciAlaniniGoster);
    }
    const ekleFormu = document.getElementById('finans-ekle-formu');
    if(ekleFormu) {
        ekleFormu.addEventListener('submit', finansIslemiEkle);
    }
    const tarihFiltreInput = document.getElementById('tarih-filtre');
    if(tarihFiltreInput) {
        flatpickr(tarihFiltreInput, {
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d.m.Y",
            locale: "tr",
            onChange: function(selectedDates, dateStr, instance) {
                seciliTarih = dateStr;
                filtreleVeYukle();
            }
        });
    }
    const islemTipiFiltre = document.getElementById('islem-tipi-filtre');
    if(islemTipiFiltre) {
        islemTipiFiltre.addEventListener('change', (e) => {
            seciliIslemTipi = e.target.value;
            filtreleVeYukle();
        });
    }

    islemleriYukle(1);
    dropdownlariDoldur();
};

function filtreleVeYukle() {
    mevcutSayfa = 1;
    islemleriYukle(mevcutSayfa);
}

function tarihiTemizle() {
    const tarihInput = document.getElementById('tarih-filtre');
    if (tarihInput && tarihInput._flatpickr) {
        tarihInput._flatpickr.clear();
    }
    seciliTarih = null;
    filtreleVeYukle();
}

async function dropdownlariDoldur() {
    try {
        // Verileri store.js'den (veya API'den) çek
        tumTedarikciler = await store.getTedarikciler();
        tumToplayicilar = await store.getToplayicilar(); 
        
        tedarikciSecici.clearOptions();
        tedarikciSecici.addOptions(tumTedarikciler.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.isim) })));
        
        toplayiciSecici.clearOptions();
        toplayiciSecici.addOptions(tumToplayicilar.map(t => ({ value: t.id, text: utils.sanitizeHTML(t.kullanici_adi) })));

    } catch (error) {
        gosterMesaj('Tedarikçi veya toplayıcı listesi yüklenemedi.', 'danger');
    }
}

function ilgiliKullaniciAlaniniGoster() {
    const tip = document.getElementById('islem-tipi-sec').value;
    const tedarikciAlani = document.getElementById('tedarikci-sec-alani');
    const toplayiciAlani = document.getElementById('toplayici-sec-alani');

    // Her şeyi sıfırla
    tedarikciAlani.style.display = 'none';
    toplayiciAlani.style.display = 'none';
    tedarikciSecici.clear();
    toplayiciSecici.clear();

    if (tip === 'Ödeme' || tip === 'Masraf' || tip === 'Diğer Gider') {
        tedarikciAlani.style.display = 'block';
    } else if (tip === 'Prim') {
        toplayiciAlani.style.display = 'block';
    }
}

async function islemleriYukle(sayfa = 1) {
    mevcutSayfa = sayfa;
    const liste = document.getElementById('finans-islemleri-listesi');
    const veriYok = document.getElementById('finans-veri-yok');
    const sayfalama = document.getElementById('finans-sayfalama');
    
    if (!liste || !veriYok || !sayfalama) return;

    liste.innerHTML = '<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm"></div> Yükleniyor...</td></tr>';
    veriYok.style.display = 'none';
    
    try {
        const params = new URLSearchParams({
            sayfa: mevcutSayfa,
            tarih: seciliTarih || '',
            tip: seciliIslemTipi || ''
        });

        const result = await api.request(`/finans/api/listele?${params.toString()}`);

        const islemler = result.data;
        const toplamKayit = result.count;
        
        liste.innerHTML = ''; // Listeyi temizle

        if (!islemler || islemler.length === 0) {
            veriYok.style.display = 'block';
        } else {
            veriYok.style.display = 'none';
            renderIslemler(islemler);
        }
        
        // Sayfalama
        ui.renderPagination(sayfalama, mevcutSayfa, toplamKayit, ISLEMLER_SAYFA_BASI, (yeniSayfa) => {
            islemleriYukle(yeniSayfa);
        });

    } catch (error) {
        liste.innerHTML = '';
        gosterMesaj(error.message, 'danger');
    }
}

function renderIslemler(islemler) {
    const liste = document.getElementById('finans-islemleri-listesi');
    if (!liste) return;

    islemler.forEach(islem => {
        // GÜNCELLENDİ: 'Yem Satışı'nı 'GELİR' olarak ekledik
        const isGelir = islem.islem_tipi === 'Ödeme' || islem.islem_tipi === 'Süt Alımı' || islem.islem_tipi === 'Yem Satışı';
        
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const tutar = parseFloat(islem.tutar).toFixed(2);
        
        const turEtiketi = isGelir 
            ? `<span class="badge text-bg-success">GELİR</span>` 
            : `<span class="badge text-bg-danger">GİDER</span>`;

        let aciklama = utils.sanitizeHTML(islem.aciklama || '');
        let kimdenKime = '';

        if (islem.tedarikci_isim) {
            kimdenKime = `<small class="text-secondary d-block">Tedarikçi: ${utils.sanitizeHTML(islem.tedarikci_isim)}</small>`;
        } else if (islem.kullanici_adi) {
            kimdenKime = `<small class="text-secondary d-block">Personel: ${utils.sanitizeHTML(islem.kullanici_adi)}</small>`;
        }
        
        // Açıklama yoksa, işlem tipini açıklama yap
        if (!aciklama) {
            aciklama = islem.islem_tipi;
        }

        // Silme butonu (sadece manuel eklenenler için)
        const silButonu = (islem.islem_tipi === 'Ödeme' || islem.islem_tipi === 'Masraf' || islem.islem_tipi === 'Prim' || islem.islem_tipi === 'Diğer Gider' || islem.islem_tipi === 'Diğer Gelir')
            ? `<button class="btn btn-sm btn-outline-danger" onclick="finansSilmeOnayiAc(${islem.id})" title="Sil">
                 <i class="bi bi-trash"></i>
               </button>`
            : `<button class="btn btn-sm btn-outline-secondary" disabled title="Otomatik kayıt (Süt/Yem) silinemez">
                 <i class="bi bi-lock-fill"></i>
               </button>`;

        const row = `
            <tr id="finans-islem-${islem.id}">
                <td>
                    ${turEtiketi}
                    <strong class="d-block">${aciklama}</strong>
                    ${kimdenKime}
                </td>
                <td class="text-end fw-bold ${isGelir ? 'text-success' : 'text-danger'}">
                    ${isGelir ? '+' : '-'}${tutar} TL
                </td>
                <td class="text-end text-secondary">${tarih}</td>
                <td class="text-center">
                    ${silButonu}
                </td>
            </tr>
        `;
        liste.innerHTML += row;
    });
}

function yeniFinansIslemiAc() {
    document.getElementById('finans-ekle-formu').reset();
    document.getElementById('edit-islem-id').value = '';
    tedarikciSecici.clear();
    toplayiciSecici.clear();
    ilgiliKullaniciAlaniniGoster();
    finansEkleModal.show();
}

async function finansIslemiEkle(event) {
    event.preventDefault();
    const kaydetButton = document.getElementById('kaydet-finans-btn');
    const originalButtonText = kaydetButton.innerHTML;

    const veri = {
        islem_tipi: document.getElementById('islem-tipi-sec').value,
        tutar: document.getElementById('islem-tutar-input').value,
        aciklama: document.getElementById('islem-aciklama-input').value,
        tedarikci_id: tedarikciSecici.getValue() || null,
        kullanici_id: toplayiciSecici.getValue() || null
    };

    if (!veri.islem_tipi || !veri.tutar || parseFloat(veri.tutar) <= 0) {
        gosterMesaj('Lütfen işlem tipi ve pozitif bir tutar girin.', 'warning');
        return;
    }
    if (veri.islem_tipi === 'Ödeme' && !veri.tedarikci_id) {
        gosterMesaj('Lütfen ödeme yapılacak tedarikçiyi seçin.', 'warning');
        return;
    }
    if (veri.islem_tipi === 'Prim' && !veri.kullanici_id) {
        gosterMesaj('Lütfen prim ödenecek personeli seçin.', 'warning');
        return;
    }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    
    try {
        const result = await api.request('/finans/api/ekle', {
            method: 'POST',
            body: JSON.stringify(veri),
            headers: { 'Content-Type': 'application/json' }
        });
        
        gosterMesaj(result.message, 'success');
        finansEkleModal.hide();
        await islemleriYukle(1); // Listeyi yenile

    } catch (error) {
        gosterMesaj(error.message, 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

function finansSilmeOnayiAc(id) {
    document.getElementById('silinecek-finans-id').value = id;
    finansSilmeOnayModal.show();
}

async function finansIslemiSil() {
    const id = document.getElementById('silinecek-finans-id').value;
    finansSilmeOnayModal.hide();

    // İyimser UI
    const satir = document.getElementById(`finans-islem-${id}`);
    if (satir) satir.style.opacity = '0.5';

    try {
        const result = await api.request(`/finans/api/sil/${id}`, { method: 'DELETE' });
        gosterMesaj(result.message, 'success');
        
        // İyimser UI - Başarılı olunca satırı kaldır
        if (satir) {
            satir.style.transition = 'opacity 0.3s ease';
            satir.style.opacity = '0';
            setTimeout(() => { 
                satir.remove();
                if (document.getElementById('finans-islemleri-listesi').children.length === 0) {
                    document.getElementById('finans-veri-yok').style.display = 'block';
                }
            }, 300);
        } else {
            await islemleriYukle(mevcutSayfa); // Satır bulunamadıysa listeyi yeniden yükle
        }

    } catch (error) {
        gosterMesaj(error.message, 'danger');
        if (satir) satir.style.opacity = '1'; // Hata olursa görünür yap
    }
}