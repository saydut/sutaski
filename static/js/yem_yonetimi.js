// static/js/yem_yonetimi.js (SAYFALAMA EKLENMİŞ TAM VERSİYON)
let yemIslemSilmeOnayModal;
let yemIslemDuzenleModal;
let tedarikciSecici, yemUrunSecici;
let yemUrunuModal, yemSilmeOnayModal;
let mevcutGorunum = 'tablo';
const KRITIK_STOK_SEVIYESI = 500;
let mevcutYemSayfasi = 1;
const YEMLER_SAYFA_BASI = 10; // Backend'deki limit ile aynı olmalı
let mevcutIslemSayfasi = 1; // YENİ
const ISLEMLER_SAYFA_BASI = 5; // YENİ

let mevcutIslemGorunumu = 'tablo'; // İşlemler için ayrı görünüm değişkeni


function gorunumuAyarlaIslemler(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri-islemler').forEach(el => el.style.display = 'none');
    document.getElementById(`islemler-${aktifGorunum}-gorunumu`).style.display = 'block';

    document.getElementById('btn-islemler-liste').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-islemler-kart').classList.toggle('active', aktifGorunum === 'kart');
}

function gorunumuDegistirIslemler(yeniGorunum) {
    if (mevcutIslemGorunumu === yeniGorunum) return;
    mevcutIslemGorunumu = yeniGorunum;
    localStorage.setItem('yemIslemGorunum', yeniGorunum);
    gorunumuAyarlaIslemler(yeniGorunum);
    // Mevcut sayfadaki veriyi yeni görünüme göre tekrar render et
    yemIslemleriniGoster(mevcutIslemSayfasi); 
}

window.onload = function() {
    yemUrunuModal = new bootstrap.Modal(document.getElementById('yemUrunuModal'));
    yemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemSilmeOnayModal'));
    yemIslemSilmeOnayModal = new bootstrap.Modal(document.getElementById('yemIslemSilmeOnayModal'));
    yemIslemDuzenleModal = new bootstrap.Modal(document.getElementById('yemIslemDuzenleModal'));

    // BU SATIRLARI EKLE
    mevcutIslemGorunumu = localStorage.getItem('yemIslemGorunum') || 'tablo';
    gorunumuAyarlaIslemler(mevcutIslemGorunumu);
    // EKLENECEK KOD SONU    

    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    yemUrunSecici = new TomSelect("#yem-urun-sec", { create: false, sortField: { field: "text", direction: "asc" } });

    mevcutGorunum = localStorage.getItem('yemGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);

    // Ana veri yükleme fonksiyonlarını çağır
    tedarikcileriDoldur();
    yemSeciciyiDoldur();      // YENİ EKLENDİ: Formdaki dropdown menüyü doldurur
    yemListesiniGoster(1);   // YENİ İSİM: Sağdaki tablo/kart listesini doldurur
    yemIslemleriniGoster(1); // YENİ EKLENDİ
};

async function yemSeciciyiDoldur() {
    try {
        if (!navigator.onLine) {
            // Eğer çevrimdışıysak, yerel veritabanından (IndexedDB) yüklemeyi dene
            const urunler = await getOfflineYemUrunleri();
            if (urunler.length === 0) {
                 gosterMesaj('Yem menüsünü yüklemek için internet bağlantısı veya önbelleklenmiş veri gereklidir.', 'warning');
                 return;
            }
            // Yerel veriden menüyü doldur
            const options = urunler.map(u => ({
                value: u.id,
                text: `${u.yem_adi} (Stok: ${parseFloat(u.stok_miktari_kg).toFixed(2)} kg)`
            }));
            yemUrunSecici.addOptions(options);

        } else {
             // Eğer çevrimiçiysek, API'den çek
            const response = await fetch('/yem/api/urunler/liste');
            const urunler = await response.json();
            if (!response.ok) throw new Error(urunler.error || 'Hata');

            yemUrunSecici.clearOptions();
            const options = urunler.map(u => ({
                value: u.id,
                text: `${u.yem_adi} (Stok: ${parseFloat(u.stok_miktari_kg).toFixed(2)} kg)`
            }));
            yemUrunSecici.addOptions(options);
        }
    } catch (error) {
        gosterMesaj('Yem ürünleri menüsü yüklenemedi.', 'danger');
    }
}

async function yemListesiniGoster(sayfa = 1) {
    mevcutYemSayfasi = sayfa;
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    const tbody = document.getElementById('yem-urunleri-tablosu');
    const kartListesi = document.getElementById('yem-urunleri-kart-listesi');
    const sayfalamaNav = document.getElementById('yem-urunleri-sayfalama');

    if (!navigator.onLine) {
        veriYokMesaji.innerHTML = '<p class="text-warning">Yem ürünlerini listelemek için internet bağlantısı gereklidir.</p>';
        veriYokMesaji.style.display = 'block';
        tbody.innerHTML = '';
        kartListesi.innerHTML = '';
        sayfalamaNav.innerHTML = '';
        return;
    }

    tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    kartListesi.innerHTML = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;
    veriYokMesaji.style.display = 'none';

    try {
        const response = await fetch(`/yem/api/urunler?sayfa=${sayfa}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Ürünler yüklenemedi.');

        store.yemUrunleri = result.urunler;
        verileriGoster(result.urunler);

        ui.sayfalamaNavOlustur(
            'yem-urunleri-sayfalama',
            result.toplam_urun_sayisi,
            sayfa,
            YEMLER_SAYFA_BASI,
            (yeniSayfa) => yemListesiniGoster(yeniSayfa)
        );

    } catch (error) {
        tbody.innerHTML = '';
        kartListesi.innerHTML = '';
        if (!navigator.onLine) {
            veriYokMesaji.innerHTML = '<p class="text-warning">Yem ürünleri listelenirken internet bağlantısı koptu.</p>';
        } else {
            veriYokMesaji.innerHTML = `<p class="text-danger">${error.message}</p>`;
        }
        veriYokMesaji.style.display = 'block';
    }
}


/**
 * Belirtilen sayfa için yem ürünlerini getirir ve gösterir.
 * @param {number} sayfa - Yüklenecek sayfa numarası.
 */
async function yemleriGoster(sayfa = 1) {
    mevcutYemSayfasi = sayfa;
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    const tbody = document.getElementById('yem-urunleri-tablosu');
    const kartListesi = document.getElementById('yem-urunleri-kart-listesi');

    // Yükleniyor animasyonunu göster
    tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    kartListesi.innerHTML = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;
    veriYokMesaji.style.display = 'none';

    try {
        const response = await fetch(`/yem/api/urunler?sayfa=${sayfa}`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Ürünler yüklenemedi.');
        }

        // store objesindeki yem listesini güncelle (diğer fonksiyonların kullanabilmesi için)
        store.yemUrunleri = result.urunler;

        verileriGoster(result.urunler);

        // Sayfalama kontrollerini oluştur
        ui.sayfalamaNavOlustur(
            'yem-urunleri-sayfalama',
            result.toplam_urun_sayisi,
            sayfa,
            YEMLER_SAYFA_BASI,
            (yeniSayfa) => yemleriGoster(yeniSayfa)
        );

    } catch (error) {
        gosterMesaj(error.message, "danger");
        tbody.innerHTML = '';
        kartListesi.innerHTML = '';
        veriYokMesaji.style.display = 'block';
    }
}

function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('yemGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);
    verileriGoster(store.yemUrunleri); // Mevcut sayfadaki veriyi yeni görünüme göre render et
}

function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    const gorunumElementi = document.getElementById(`${aktifGorunum}-gorunumu`);
    if(gorunumElementi) {
        gorunumElementi.style.display = gorunumElementi.id.includes('kart') ? 'flex' : 'block';
        if (gorunumElementi.id.includes('kart')) {
            gorunumElementi.querySelector('.row').style.display = 'flex';
        }
    }
    document.getElementById('btn-view-table').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}

async function tedarikcileriDoldur() {
    try {
        // store.getTedarikciler fonksiyonu zaten online/offline durumunu yönetiyor.
        const tedarikciler = await store.getTedarikciler();
        tedarikciSecici.clearOptions();
        const options = tedarikciler.map(t => ({ value: t.id, text: t.isim }));
        tedarikciSecici.addOptions(options);
    } catch (error) {
        // Eğer store.getTedarikciler çevrimdışı olduğu için hata fırlatırsa,
        // bunu yakalayıp kullanıcıya doğru mesajı gösteriyoruz.
        if (!navigator.onLine) {
            gosterMesaj('Tedarikçi menüsünü yüklemek için internet bağlantısı gereklidir.', 'warning');
        } else {
            gosterMesaj('Tedarikçiler yüklenirken bir hata oluştu.', 'danger');
        }
    }
}

function verileriGoster(urunler) {
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    veriYokMesaji.style.display = urunler.length === 0 ? 'block' : 'none';

    if (mevcutGorunum === 'tablo') {
        renderTable(urunler);
    } else {
        renderCards(urunler);
    }
}

function renderTable(urunler) {
    const tbody = document.getElementById('yem-urunleri-tablosu');
    tbody.innerHTML = '';
    urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        const rowClass = isKritik ? 'table-warning' : '';
        const uyariIconu = isKritik
            ? `<i class="bi bi-exclamation-triangle-fill text-danger me-2" title="Stok kritik seviyede: ${stokMiktari.toFixed(2)} KG"></i>`
            : '';
        
        // --- DEĞİŞİKLİK BURADA ---
        // Her bir tablo satırına (tr) benzersiz bir 'id' ekledik.
        tbody.innerHTML += `
            <tr id="yem-urun-${urun.id}" class="${rowClass}">
                <td>${uyariIconu}<strong>${urun.yem_adi}</strong></td>
                <td class="text-end">${stokMiktari.toFixed(2)} KG</td>
                <td class="text-end">${parseFloat(urun.birim_fiyat).toFixed(2)} TL</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="yemDuzenleAc(${urun.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="yemSilmeOnayiAc(${urun.id}, '${urun.yem_adi}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

function renderCards(urunler) {
    const container = document.getElementById('yem-urunleri-kart-listesi');
    container.innerHTML = '';
    urunler.forEach(urun => {
        const stokMiktari = parseFloat(urun.stok_miktari_kg);
        const isKritik = stokMiktari <= KRITIK_STOK_SEVIYESI;
        const kartSinifi = isKritik ? 'yem-card stok-kritik' : 'yem-card';
        
        // --- DEĞİŞİKLİK BURADA ---
        // Her bir kartın dış sarmalayıcısına (div) benzersiz bir 'id' ekledik.
        container.innerHTML += `
            <div class="col-md-6 col-12" id="yem-urun-${urun.id}">
                <div class="${kartSinifi}">
                    <div class="yem-card-header">
                        <h5>${urun.yem_adi}</h5>
                    </div>
                    <div class="yem-card-body">
                        <p class="mb-1 text-secondary">Mevcut Stok</p>
                        <p class="stok-bilgisi ${isKritik ? 'text-danger' : ''}">${stokMiktari.toFixed(2)} KG</p>
                    </div>
                    <div class="yem-card-footer">
                        <span class="fiyat-bilgisi">${parseFloat(urun.birim_fiyat).toFixed(2)} TL / KG</span>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="yemDuzenleAc(${urun.id})"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="yemSilmeOnayiAc(${urun.id}, '${urun.yem_adi}')"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

async function yemCikisiYap() {
    const kaydetButton = document.getElementById('yem-cikis-btn');
    const originalButtonText = kaydetButton.innerHTML;
    const veri = {
        tedarikci_id: tedarikciSecici.getValue(),
        yem_urun_id: yemUrunSecici.getValue(),
        miktar_kg: document.getElementById('miktar-input').value,
        aciklama: document.getElementById('aciklama-input').value.trim()
    };
    if (!veri.tedarikci_id || !veri.yem_urun_id || !veri.miktar_kg || parseFloat(veri.miktar_kg) <= 0) {
        gosterMesaj('Lütfen tedarikçi, yem ürünü seçin ve geçerli bir miktar girin.', 'warning');
        return;
    }

    // --- İYİMSER GÜNCELLEME ---
    // 1. Geçici elemanı oluştur ve listeye ekle
    const tbody = document.getElementById('yem-islemleri-listesi');
    const geciciId = `gecici-islem-${Date.now()}`;
    const tedarikciAdi = tedarikciSecici.options[veri.tedarikci_id].text;
    const yemAdi = yemUrunSecici.options[veri.yem_urun_id].text.split(' (')[0];

    const geciciSatir = document.createElement('tr');
    geciciSatir.id = geciciId;
    geciciSatir.style.opacity = '0.6';
    geciciSatir.innerHTML = `
        <td>Şimdi</td>
        <td>${tedarikciAdi}</td>
        <td>${yemAdi}</td>
        <td class="text-end">${parseFloat(veri.miktar_kg).toFixed(2)} KG</td>
    `;
    tbody.prepend(geciciSatir);

    // 2. Formu hemen temizle
    const eskiFormVerisi = { ...veri }; // Hata durumunda geri yüklemek için
    document.getElementById('miktar-input').value = '';
    document.getElementById('aciklama-input').value = '';
    tedarikciSecici.clear();
    
    // 3. Arka planda API'yi çağır
    try {
        const result = await fetch('/yem/api/islemler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }).then(res => res.json());

        // 4. BAŞARILI OLURSA: Listeleri ve menüleri sunucudan gelenle yenile
        gosterMesaj(result.message, 'success');
        await yemListesiniGoster(mevcutYemSayfasi); 
        await yemSeciciyiDoldur(); 
        await yemIslemleriniGoster(1); // Bu işlem geçici satırı silip gerçeğini koyacak

    } catch (error) {
        // 5. HATA OLURSA: Geçici elemanı sil, formu geri yükle
        gosterMesaj(error.message || 'İşlem kaydedilemedi.', 'danger');
        document.getElementById(geciciId)?.remove();
        // Formu eski haline getir
        tedarikciSecici.setValue(eskiFormVerisi.tedarikci_id);
        yemUrunSecici.setValue(eskiFormVerisi.yem_urun_id);
        document.getElementById('miktar-input').value = eskiFormVerisi.miktar_kg;
        document.getElementById('aciklama-input').value = eskiFormVerisi.aciklama;
    }
}

function yeniYemModaliniAc() {
    document.getElementById('yemUrunuModalLabel').innerText = 'Yeni Yem Ürünü Ekle';
    document.getElementById('yem-urun-form').reset();
    document.getElementById('edit-yem-id').value = '';
    yemUrunuModal.show();
}

function yemDuzenleAc(id) {
    const urun = store.yemUrunleri.find(y => y.id === id);
    if (urun) {
        document.getElementById('yemUrunuModalLabel').innerText = 'Yem Ürününü Düzenle';
        document.getElementById('edit-yem-id').value = urun.id;
        document.getElementById('yem-adi-input').value = urun.yem_adi;
        document.getElementById('yem-stok-input').value = parseFloat(urun.stok_miktari_kg);
        document.getElementById('yem-fiyat-input').value = parseFloat(urun.birim_fiyat);
        yemUrunuModal.show();
    }
}

async function yemUrunuKaydet() {
    const kaydetButton = document.querySelector('#yemUrunuModal .btn-primary');
    const originalButtonText = kaydetButton.innerHTML;
    const id = document.getElementById('edit-yem-id').value;
    const veri = {
        yem_adi: document.getElementById('yem-adi-input').value.trim(),
        stok_miktari_kg: document.getElementById('yem-stok-input').value,
        birim_fiyat: document.getElementById('yem-fiyat-input').value
    };
    if (!veri.yem_adi || !veri.stok_miktari_kg || !veri.birim_fiyat) {
        gosterMesaj('Lütfen tüm zorunlu alanları doldurun.', 'warning');
        return;
    }
    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    const url = id ? `/yem/api/urunler/${id}` : '/yem/api/urunler';
    const method = id ? 'PUT' : 'POST';
    try {
        const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            yemUrunuModal.hide();
            await yemListesiniGoster(mevcutYemSayfasi);
            await yemSeciciyiDoldur();
        } else {
            gosterMesaj(result.error || 'İşlem sırasında bir hata oluştu.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

function yemSilmeOnayiAc(id, isim) {
    document.getElementById('silinecek-yem-id').value = id;
    document.getElementById('silinecek-yem-adi').innerText = isim;
    yemSilmeOnayModal.show();
}

async function yemUrunuSil() {
    const id = document.getElementById('silinecek-yem-id').value;
    yemSilmeOnayModal.hide();

    const silinecekElement = document.getElementById(`yem-urun-${id}`);
    if (!silinecekElement) return;
    
    // İyimser güncelleme: Önce arayüzden gizle
    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    silinecekElement.style.transition = 'opacity 0.4s';
    silinecekElement.style.opacity = '0';
    setTimeout(() => silinecekElement.remove(), 400);

    try {
        const response = await fetch(`/yem/api/urunler/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        gosterMesaj(result.message, 'success');
        await yemSeciciyiDoldur();
        await db.yem_urunleri.delete(parseInt(id)); // Çevrimdışı veritabanından da sil

    } catch (error) {
        // Hata bir ağ hatası mı diye kontrol et
        if (!navigator.onLine) {
            gosterMesaj('İnternet yok. Silme işlemi kaydedildi, bağlantı kurulunca uygulanacak.', 'info');
            // Silme işlemini çevrimdışı kaydet
            await kaydetSilmeIslemiCevrimdisi('yem_urunu', parseInt(id));
        } else {
            // Sunucu hatası veya başka bir hata varsa arayüzü geri yükle
            gosterMesaj(error.message || 'Silme başarısız, ürün geri yüklendi.', 'danger');
            silinecekElement.style.opacity = '1';
            if (!silinecekElement.parentNode) {
                parent.insertBefore(silinecekElement, nextSibling);
            }
        }
    }
}

// ESKİ yemIslemleriniGoster FONKSİYONUNU SİL, YERİNE AŞAĞIDAKİ 3 FONKSİYONU EKLE

// Bu fonksiyonu dosyanızdaki mevcut fonksiyonla tamamen değiştirin.
async function yemIslemleriniGoster(sayfa = 1) {
    mevcutIslemSayfasi = sayfa;
    const veriYokMesaji = document.getElementById('yem-islemleri-veri-yok');
    const tabloBody = document.getElementById('yem-islemleri-listesi');
    const kartListesi = document.getElementById('yem-islemleri-kart-listesi');
    const sayfalamaNav = document.getElementById('yem-islemleri-sayfalama');

    if (!navigator.onLine) {
        tabloBody.innerHTML = '';
        kartListesi.innerHTML = '';
        sayfalamaNav.innerHTML = '';
        veriYokMesaji.innerHTML = `<p class="text-warning">İşlemleri görmek için internet bağlantısı gereklidir.</p>`;
        veriYokMesaji.style.display = 'block';
        return;
    }

    // Yükleniyor durumunu ayarla
    veriYokMesaji.style.display = 'none';
    if (mevcutIslemGorunumu === 'tablo') {
        tabloBody.innerHTML = `<tr><td colspan="5" class="text-center p-3"><div class="spinner-border spinner-border-sm"></div></td></tr>`;
    } else {
        kartListesi.innerHTML = `<div class="col-12 text-center p-3"><div class="spinner-border spinner-border-sm"></div></div>`;
    }
    sayfalamaNav.innerHTML = ''; // Önceki sayfalamayı temizle

    try {
        const response = await fetch(`/yem/api/islemler/liste?sayfa=${sayfa}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'İşlemler yüklenemedi.');

        if (result.islemler.length === 0) {
            veriYokMesaji.style.display = 'block';
            tabloBody.innerHTML = '';
            kartListesi.innerHTML = '';
        } else {
            veriYokMesaji.style.display = 'none';
            if (mevcutIslemGorunumu === 'tablo') {
                renderIslemlerAsTable(result.islemler);
            } else {
                renderIslemlerAsCards(result.islemler);
            }
        }

        ui.sayfalamaNavOlustur('yem-islemleri-sayfalama', result.toplam_islem_sayisi, sayfa, ISLEMLER_SAYFA_BASI, yemIslemleriniGoster);

    } catch (error) {
        // --- DÜZELTME BURADA ---
        // Hata yakalandığında internetin hala gidip gitmediğini tekrar kontrol et.
        tabloBody.innerHTML = '';
        kartListesi.innerHTML = '';
        if (!navigator.onLine) {
            veriYokMesaji.innerHTML = `<p class="text-warning">Son işlemler listelenirken internet bağlantısı koptu.</p>`;
        } else {
            // İnternet var ama başka bir hata olduysa (sunucu hatası gibi)
            veriYokMesaji.innerHTML = `<p class="text-danger">${error.message}</p>`;
        }
        veriYokMesaji.style.display = 'block';
    }
}

function renderIslemlerAsTable(islemler) {
    const tbody = document.getElementById('yem-islemleri-listesi');
    tbody.innerHTML = '';
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        tbody.innerHTML += `
            <tr id="yem-islem-liste-${islem.id}">
                <td>${tarih}</td>
                <td>${islem.tedarikciler.isim}</td>
                <td>${islem.yem_urunleri.yem_adi}</td>
                <td class="text-end">${miktar} KG</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${islem.aciklama || ''}')"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="İşlemi İptal Et" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button>
                </td>
            </tr>`;
    });
}

function renderIslemlerAsCards(islemler) {
    const container = document.getElementById('yem-islemleri-kart-listesi');
    container.innerHTML = '';
    islemler.forEach(islem => {
        const tarih = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
        const miktar = parseFloat(islem.miktar_kg).toFixed(2);
        container.innerHTML += `
            <div class="col-lg-6 col-12" id="yem-islem-kart-${islem.id}">
                <div class="card p-2 h-100">
                    <div class="card-body p-2 d-flex flex-column">
                        <div>
                            <h6 class="card-title mb-0">${islem.tedarikciler.isim}</h6>
                            <small class="text-secondary">${islem.yem_urunleri.yem_adi}</small>
                        </div>
                        <div class="my-2 flex-grow-1">
                            <span class="fs-4 fw-bold text-primary">${miktar} KG</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                            <small class="text-secondary">${tarih}</small>
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="yemIslemiDuzenleAc(${islem.id}, '${miktar}', '${islem.aciklama || ''}')"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-outline-danger" title="İşlemi İptal Et" onclick="yemIslemiSilmeOnayiAc(${islem.id})"><i class="bi bi-x-circle"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

// BU İKİ YENİ FONKSİYONU dosyanın en sonuna ekleyin
/**
 * Yem çıkış işlemini iptal etmek için onay modalını açar.
 * @param {number} id - İptal edilecek işlemin ID'si.
 */
function yemIslemiSilmeOnayiAc(id) {
    document.getElementById('silinecek-islem-id').value = id;
    yemIslemSilmeOnayModal.show();
}

/**
 * Yem çıkış işlemini siler (iyimser güncelleme ile).
 */
// Bu fonksiyonu da dosyadaki mevcut fonksiyonla değiştirin.
async function yemIslemiSil() {
    const id = document.getElementById('silinecek-islem-id').value;
    yemIslemSilmeOnayModal.hide();

    // --- ÇÖZÜM: İŞLEMDEN ÖNCE İNTERNETİ KONTROL ET ---
    // Bu işlem, stok hesabını karmaşıklaştırdığı için çevrimdışı desteklenmiyor.
    // Bu yüzden en başta interneti kontrol edip kullanıcıya net bir mesaj veriyoruz.
    if (!navigator.onLine) {
        gosterMesaj("Bu işlemi iptal etmek için internet bağlantısı gereklidir.", "warning");
        return; // İnternet yoksa fonksiyonu burada durdur.
    }
    // --- KONTROL SONU ---

    // İnternet varsa, iyimser güncelleme ile devam et
    const silinecekElement = document.getElementById(`yem-islem-liste-${id}`) || document.getElementById(`yem-islem-kart-${id}`);
    if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    silinecekElement.style.opacity = '0';
    setTimeout(() => silinecekElement.remove(), 400);

    try {
        const response = await fetch(`/yem/api/islemler/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        gosterMesaj(result.message, 'success');
        // Stoklar değiştiği için ürün listesini ve seçiciyi yenile
        await yemListesiniGoster(mevcutYemSayfasi);
        await yemSeciciyiDoldur();

    } catch (error) {
        // Hata sadece sunucudan gelirse (internet varken) burası çalışacak
        gosterMesaj(error.message || 'İşlem iptal edilemedi, satır geri yüklendi.', 'danger');
        silinecekElement.style.opacity = '1';
        if (!silinecekElement.parentNode) {
            parent.insertBefore(silinecekElement, nextSibling);
        }
    }
}

/**
 * Yem çıkış işlemini güncelleme isteğini sunucuya gönderir.
 */
async function yemIslemiGuncelle() {
    const id = document.getElementById('edit-islem-id').value;
    const veri = {
        yeni_miktar_kg: document.getElementById('edit-miktar-input').value,
        aciklama: document.getElementById('edit-aciklama-input').value.trim()
    };

    if (!veri.yeni_miktar_kg || parseFloat(veri.yeni_miktar_kg) <= 0) {
        gosterMesaj("Lütfen geçerli bir miktar girin.", "warning");
        return;
    }

    try {
        const response = await fetch(`/yem/api/islemler/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        gosterMesaj(result.message, 'success');
        yemIslemDuzenleModal.hide();
        
        // Tüm listeleri yenile
        await yemIslemleriniGoster(mevcutIslemSayfasi);
        await yemListesiniGoster(mevcutYemSayfasi);
        await yemSeciciyiDoldur();

    } catch (error) {
        gosterMesaj(error.message || "Güncelleme sırasında bir hata oluştu.", "danger");
    }
}

/**
 * Yem çıkış işlemini iptal etmek için onay modalını açar.
 * @param {number} id - İptal edilecek işlemin ID'si.
 */
function yemIslemiSilmeOnayiAc(id) {
    document.getElementById('silinecek-islem-id').value = id;
    yemIslemSilmeOnayModal.show();
}

/**
 * Yem çıkış işlemini düzenleme modalını açar ve verilerle doldurur.
 * @param {number} id - Düzenlenecek işlemin ID'si.
 * @param {string} miktar - Mevcut miktar.
 * @param {string} aciklama - Mevcut açıklama.
 */
function yemIslemiDuzenleAc(id, miktar, aciklama) {
    document.getElementById('edit-islem-id').value = id;
    document.getElementById('edit-miktar-input').value = miktar;
    document.getElementById('edit-aciklama-input').value = aciklama;
    yemIslemDuzenleModal.show();
}