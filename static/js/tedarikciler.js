// static/js/tedarikciler.js (İyimser Arayüz ve ID'ler eklendi, Çiftçi Bilgisi Gösterme Eklendi)

let tedarikciModal, silmeOnayModal;
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15;
let mevcutSiralamaSutunu = 'isim';
let mevcutSiralamaYonu = 'asc';
let mevcutAramaTerimi = '';
let mevcutGorunum = 'tablo';

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

    mevcutGorunum = localStorage.getItem('tedarikciGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);

    const aramaInput = document.getElementById('arama-input');
    aramaInput.addEventListener('input', debounce((event) => {
        mevcutAramaTerimi = event.target.value;
        verileriYukle(1); // Arama yapıldığında ilk sayfaya dön
    }));

    // Sıralama başlıklarına tıklama olaylarını ekle
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sutun = header.dataset.sort;
            if (mevcutSiralamaSutunu === sutun) {
                mevcutSiralamaYonu = mevcutSiralamaYonu === 'asc' ? 'desc' : 'asc';
            } else {
                mevcutSiralamaSutunu = sutun;
                mevcutSiralamaYonu = 'asc'; // Yeni sütuna tıklanınca varsayılan artan sıralama
            }
            basliklariGuncelle();
            verileriYukle(1); // Sıralama değiştiğinde ilk sayfaya dön
        });
    });

    basliklariGuncelle(); // Sayfa ilk yüklendiğinde sıralama ikonlarını ayarla
    await verileriYukle(); // Verileri yükle
};

/**
 * Tedarikçi listesini sunucudan çeker ve arayüzü günceller.
 * @param {number} sayfa - Yüklenecek sayfa numarası.
 */
async function verileriYukle(sayfa = 1) {
    mevcutSayfa = sayfa;
    // API URL'sine arama, sıralama ve sayfa parametrelerini ekle
    const url = `/api/tedarikciler_liste?sayfa=${sayfa}&arama=${encodeURIComponent(mevcutAramaTerimi)}&sirala=${mevcutSiralamaSutunu}&yon=${mevcutSiralamaYonu}&limit=${KAYIT_SAYISI}`; // Limit eklendi

    // Genel veri yükleyiciyi kullan (data-loader.js içinde)
    await genelVeriYukleyici({
        apiURL: url,
        veriAnahtari: 'tedarikciler', // API'dan gelen JSON'daki tedarikçi listesinin adı
        tabloBodyId: 'tedarikciler-tablosu',
        kartContainerId: 'tedarikciler-kart-listesi',
        veriYokId: 'veri-yok-mesaji',
        sayfalamaId: 'tedarikci-sayfalama',
        tabloRenderFn: renderTable, // Tablo satırlarını oluşturan fonksiyon
        kartRenderFn: renderCards,   // Kartları oluşturan fonksiyon
        yukleFn: verileriYukle,      // Sayfa değiştirildiğinde çağrılacak fonksiyon
        sayfa: sayfa,
        kayitSayisi: KAYIT_SAYISI,
        mevcutGorunum: mevcutGorunum
    });
}

/**
 * Tedarikçi verilerini tablo satırları olarak render eder.
 * @param {HTMLElement} container - Tablonun tbody elementi.
 * @param {Array} suppliers - Tedarikçi objeleri dizisi.
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
 * @param {HTMLElement} container - Kartların ekleneceği row elementi.
 * @param {Array} suppliers - Tedarikçi objeleri dizisi.
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
    if (!veri.isim) { gosterMesaj("Tedarikçi ismi zorunludur.", "warning"); return; }

    kaydetButton.disabled = true;
    kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
    try {
        const result = id
            ? await api.updateTedarikci(id, veri) // Güncelleme API çağrısı
            : await api.postTedarikci(veri);    // Ekleme API çağrısı

        // --- YENİ: Çiftçi Giriş Bilgilerini Gösterme ---
        let mesaj = result.message;
        if (!id && result.ciftci_kullanici_adi && result.ciftci_sifre) {
            // Eğer yeni ekleme yapıldıysa ve çiftçi bilgileri döndüyse mesaja ekle
            mesaj += `<br><small class="mt-2">Otomatik oluşturulan çiftçi giriş bilgileri:<br>Kullanıcı Adı: <strong>${utils.sanitizeHTML(result.ciftci_kullanici_adi)}</strong><br>Şifre: <strong>${utils.sanitizeHTML(result.ciftci_sifre)}</strong></small>`;
             // Mesajın daha uzun süre görünmesini sağla
             gosterMesaj(mesaj, "success", 10000); // 10 saniye
        } else {
             gosterMesaj(mesaj, "success"); // Normal mesaj süresi
        }
        // --- GÖSTERME SONU ---

        tedarikciModal.hide();
        await verileriYukle(id ? mevcutSayfa : 1); // Listeyi güncelle

    } catch (error) {
        gosterMesaj(error.message || "Bir hata oluştu.", "danger");
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

    // İyimser UI Mantığı (API cevabını beklemeden arayüzden kaldır)
    const silinecekElement = document.getElementById(`tedarikci-${id}`);
    if (!silinecekElement) return;

    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    const originalHTML = silinecekElement.outerHTML; // Geri yükleme için sakla

    // Animasyonla kaldır
    silinecekElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    silinecekElement.style.opacity = '0';
    silinecekElement.style.transform = 'translateX(-50px)';
    setTimeout(() => {
        if(silinecekElement.parentNode) silinecekElement.remove();
        // Eğer silindikten sonra hiç öğe kalmadıysa "veri yok" mesajını göster
        if (parent && parent.children.length === 0 && (mevcutGorunum === 'kart' || document.getElementById('tedarikciler-tablosu').children.length === 0)) {
           document.getElementById('veri-yok-mesaji').style.display = 'block';
        }
    }, 400);

    try {
        const result = await api.deleteTedarikci(id); // Backend hem tedarikçiyi hem kullanıcıyı siler
        gosterMesaj(result.message, 'success');
        // Sayfalama durumunu düzeltmek ve toplam sayıyı güncellemek için listeyi baştan yükle
        await verileriYukle(1);
    } catch (error) {
        gosterMesaj(error.message || 'Silme işlemi başarısız, tedarikçi geri yüklendi.', 'danger');
        // Hata durumunda öğeyi geri ekle
        if (originalHTML && parent) {
             const tempDiv = document.createElement(mevcutGorunum === 'kart' ? 'div' : 'tbody'); // Uygun geçici element
             tempDiv.innerHTML = originalHTML;
             const restoredElement = tempDiv.firstChild;
             restoredElement.style.opacity = '1'; // Görünür yap
             restoredElement.style.transform = 'translateX(0)';
             parent.insertBefore(restoredElement, nextSibling); // Eski yerine ekle
             document.getElementById('veri-yok-mesaji').style.display = 'none'; // Veri yok mesajını gizle
        }
        // Listeyi tam olarak senkronize etmek için yeniden yükle (opsiyonel)
        // await verileriYukle(mevcutSayfa);
    }
}


/**
 * Tedarikçi düzenleme modalını açar ve verileri doldurur.
 * @param {number} id - Düzenlenecek tedarikçinin ID'si.
 * @param {HTMLElement} button - Tıklanan buton elementi (geçici olarak disable yapmak için).
 */
async function tedarikciDuzenleAc(id, button) {
    button.disabled = true; // Butonu geçici olarak devre dışı bırak
    try {
        const supplier = await api.request(`/api/tedarikci/${id}`); // Tedarikçi detayını API'dan çek

        document.getElementById('tedarikciModalLabel').innerText = 'Tedarikçi Bilgilerini Düzenle';
        document.getElementById('edit-tedarikci-id').value = supplier.id;
        document.getElementById('tedarikci-isim-input').value = supplier.isim;
        document.getElementById('tedarikci-tc-input').value = supplier.tc_no || '';
        document.getElementById('tedarikci-tel-input').value = supplier.telefon_no || '';
        document.getElementById('tedarikci-adres-input').value = supplier.adres || '';
        tedarikciModal.show();
    } catch (error) {
        gosterMesaj(error.message || "Tedarikçi detayı bulunamadı.", "danger");
    } finally {
        button.disabled = false; // Butonu tekrar aktif et
    }
}

/**
 * Yeni tedarikçi ekleme modalını açar.
 */
function yeniTedarikciAc() {
    document.getElementById('tedarikciModalLabel').innerText = 'Yeni Tedarikçi Ekle';
    document.getElementById('edit-tedarikci-id').value = ''; // ID'yi temizle
    document.getElementById('tedarikci-form').reset(); // Formu temizle
    tedarikciModal.show();
}

/**
 * Silme onay modalını açar.
 * @param {number} id - Silinecek tedarikçinin ID'si.
 * @param {string} isim - Silinecek tedarikçinin adı.
 */
function silmeOnayiAc(id, isim) {
    document.getElementById('silinecek-tedarikci-id').value = id;
    document.getElementById('silinecek-tedarikci-adi').innerText = isim;
    silmeOnayModal.show();
}

/**
 * Liste ve Kart görünümleri arasında geçiş yapar.
 * @param {string} yeniGorunum - 'tablo' veya 'kart'.
 */
function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('tedarikciGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);
    // Veriyi tekrar yüklemeye gerek yok, sadece görünümü değiştiriyoruz.
    // Ancak farklı render fonksiyonları farklı veri bekliyorsa yüklemek gerekebilir.
    // Şimdilik sadece görünümü değiştiriyoruz.
    // await verileriYukle(mevcutSayfa);
}

/**
 * Aktif görünüme göre ilgili div'i gösterir/gizler ve butonları ayarlar.
 * @param {string} aktifGorunum - 'tablo' veya 'kart'.
 */
function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    const aktifElement = document.getElementById(`${aktifGorunum}-gorunumu`);
    if(aktifElement) {
       aktifElement.style.display = aktifGorunum === 'kart' ? 'block' : 'block'; // Kartlar için row zaten var, tablo için block
    }
    document.getElementById('btn-view-table').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}
