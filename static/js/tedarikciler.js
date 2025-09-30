// static/js/tedarikciler.js (SUNUCU TARAFLI SAYFALAMA, ARAMA VE SIRALAMA)

let tedarikciModal, silmeOnayModal;
let mevcutSayfa = 1;
const KAYIT_SAYISI = 15; // Backend'deki limit ile aynı olmalı

// SIRALAMA VE ARAMA DURUMUNU TUTACAK DEĞİŞKENLER
let mevcutSiralamaSutunu = 'isim';
let mevcutSiralamaYonu = 'asc';
let mevcutAramaTerimi = '';
let mevcutGorunum = 'tablo';

window.onload = async () => {
    tedarikciModal = new bootstrap.Modal(document.getElementById('tedarikciModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    mevcutGorunum = localStorage.getItem('tedarikciGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);

    // Olay dinleyicilerini ayarla
    document.getElementById('arama-input').addEventListener('keyup', (event) => {
        mevcutAramaTerimi = event.target.value;
        // Kullanıcı yazmayı bıraktıktan sonra arama yapmak için küçük bir gecikme
        setTimeout(() => {
            if (mevcutAramaTerimi === document.getElementById('arama-input').value) {
                tedarikcileriYukle(1); // Arama yapıldığında her zaman ilk sayfaya git
            }
        }, 300);
    });

    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            const sutun = header.dataset.sort;
            if (mevcutSiralamaSutunu === sutun) {
                mevcutSiralamaYonu = mevcutSiralamaYonu === 'asc' ? 'desc' : 'asc';
            } else {
                mevcutSiralamaSutunu = sutun;
                mevcutSiralamaYonu = 'asc';
            }
            tedarikcileriYukle(1); // Sıralama değiştiğinde ilk sayfaya git
        });
    });

    // Sayfa ilk yüklendiğinde verileri çek
    await tedarikcileriYukle(1);
};

// API'den verileri çeken ana fonksiyon
async function tedarikcileriYukle(sayfa = 1) {
    mevcutSayfa = sayfa;
    const tbody = document.getElementById('tedarikciler-tablosu');
    const kartListesi = document.getElementById('tedarikciler-kart-listesi');
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    
    tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    kartListesi.innerHTML = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;
    veriYokMesaji.style.display = 'none';

    // Sunucuya gönderilecek URL'i oluştur
    const url = `/api/tedarikciler_liste?sayfa=${sayfa}&arama=${mevcutAramaTerimi}&sirala=${mevcutSiralamaSutunu}&yon=${mevcutSiralamaYonu}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Veriler yüklenemedi');
        
        // Gelen veriyi ekrana bas
        verileriGoster(data.tedarikciler);
        
        // Sayfalama kontrollerini oluştur
        ui.sayfalamaNavOlustur(
            'tedarikci-sayfalama',
            data.toplam_kayit,
            sayfa,
            KAYIT_SAYISI,
            (yeniSayfa) => tedarikcileriYukle(yeniSayfa) // Sayfa değiştirme callback'i
        );
        basliklariGuncelle();

    } catch (error) {
        console.error("Hata:", error);
        tbody.innerHTML = '';
        kartListesi.innerHTML = '';
        veriYokMesaji.innerText = error.message;
        veriYokMesaji.style.display = 'block';
    }
}

function verileriGoster(suppliers) {
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    veriYokMesaji.style.display = suppliers.length === 0 ? 'block' : 'none';
    if (mevcutGorunum === 'tablo') renderTable(suppliers);
    else renderCards(suppliers);
}

function renderTable(suppliers) {
    const tbody = document.getElementById('tedarikciler-tablosu');
    tbody.innerHTML = '';
    suppliers.forEach(supplier => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${supplier.isim}</strong></td>
                <td>${supplier.telefon_no || '-'}</td>
                <td class="text-end">${(supplier.toplam_litre || 0).toFixed(2)} L</td>
                <td class="text-center">
                    <a href="/tedarikci/${supplier.id}" class="btn btn-sm btn-outline-info" title="Detayları Gör"><i class="bi bi-eye"></i></a>
                    <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="tedarikciDuzenleAc(${supplier.id})"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="silmeOnayiAc(${supplier.id}, '${supplier.isim}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

function renderCards(suppliers) {
    const container = document.getElementById('tedarikciler-kart-listesi');
    container.innerHTML = '';
    suppliers.forEach(supplier => {
        container.innerHTML += `
            <div class="col-lg-4 col-md-6 col-12">
                <div class="supplier-card">
                    <div class="supplier-card-header"><h5>${supplier.isim}</h5></div>
                    <div class="supplier-card-body">
                        <p class="mb-2"><i class="bi bi-telephone-fill me-2"></i>${supplier.telefon_no || 'Belirtilmemiş'}</p>
                        <p class="mb-0"><i class="bi bi-droplet-half me-2"></i>Toplam: <strong>${(supplier.toplam_litre || 0).toFixed(2)} L</strong></p>
                    </div>
                    <div class="supplier-card-footer">
                        <a href="/tedarikci/${supplier.id}" class="btn btn-sm btn-outline-info" title="Detayları Gör"><i class="bi bi-eye"></i></a>
                        <button class="btn btn-sm btn-outline-primary" title="Düzenle" onclick="tedarikciDuzenleAc(${supplier.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" title="Sil" onclick="silmeOnayiAc(${supplier.id}, '${supplier.isim}')"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

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
    const url = id ? `/api/tedarikci_duzenle/${id}` : '/api/tedarikci_ekle';
    const method = id ? 'PUT' : 'POST';
    try {
        const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, "success");
            tedarikciModal.hide();
            await tedarikcileriYukle(mevcutSayfa);
        } else {
            gosterMesaj(result.error || "Bir hata oluştu.", "danger");
        }
    } catch (error) {
        gosterMesaj("Sunucuya bağlanırken bir hata oluştu.", "danger");
    } finally {
        kaydetButton.disabled = false;
        kaydetButton.innerHTML = originalButtonText;
    }
}

async function tedarikciSil() {
    const id = document.getElementById('silinecek-tedarikci-id').value;
    try {
        const response = await fetch(`/api/tedarikci_sil/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
            gosterMesaj(result.message, 'success');
            silmeOnayModal.hide();
            await tedarikcileriYukle(1);
        } else {
            gosterMesaj(result.error || 'Silme işlemi başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}

function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('tedarikciGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);
    tedarikcileriYukle(mevcutSayfa);
}

function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    document.getElementById(`${aktifGorunum}-gorunumu`).style.display = 'block';
    document.getElementById('btn-view-table').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}

function basliklariGuncelle() {
    document.querySelectorAll('.sortable').forEach(header => {
        const sutun = header.dataset.sort;
        header.classList.remove('asc', 'desc');
        if (sutun === mevcutSiralamaSutunu) {
            header.classList.add(mevcutSiralamaYonu);
        }
    });
}

function yeniTedarikciAc() {
    document.getElementById('tedarikciModalLabel').innerText = 'Yeni Tedarikçi Ekle';
    document.getElementById('edit-tedarikci-id').value = '';
    document.getElementById('tedarikci-form').reset();
    tedarikciModal.show();
}

async function tedarikciDuzenleAc(id) {
    gosterMesaj("Tedarikçi bilgileri getiriliyor...", "info", 1500);
    try {
        // YENİ: Sadece ilgili tedarikçiyi çeken API'yi çağır
        const response = await fetch(`/api/tedarikci/${id}`);
        const supplier = await response.json();

        if (!response.ok) {
            throw new Error(supplier.error || "Tedarikçi bilgileri alınamadı.");
        }

        // Gelen tekil veriyle modal'ı doldur
        document.getElementById('tedarikciModalLabel').innerText = 'Tedarikçi Bilgilerini Düzenle';
        document.getElementById('edit-tedarikci-id').value = supplier.id;
        document.getElementById('tedarikci-isim-input').value = supplier.isim;
        document.getElementById('tedarikci-tc-input').value = supplier.tc_no || '';
        document.getElementById('tedarikci-tel-input').value = supplier.telefon_no || '';
        document.getElementById('tedarikci-adres-input').value = supplier.adres || '';
        tedarikciModal.show();
    } catch (error) {
        gosterMesaj(error.message, "danger");
    }
}

function silmeOnayiAc(id, isim) {
    document.getElementById('silinecek-tedarikci-id').value = id;
    document.getElementById('silinecek-tedarikci-adi').innerText = isim;
    silmeOnayModal.show();
}