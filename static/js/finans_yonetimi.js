// static/js/finans_yonetimi.js (DİNAMİK GÖRÜNÜM DEĞİŞTİRME ÖZELLİKLİ TAM VERSİYON)

let tedarikciSecici, tarihSecici;
let duzenleModal, silmeOnayModal;
let mevcutGorunum = 'tablo';
const KAYIT_SAYISI = 5; // Backend'deki limit ile aynı olmalı

window.onload = function() {
    tedarikciSecici = new TomSelect("#tedarikci-sec", { create: false, sortField: { field: "text", direction: "asc" } });
    tarihSecici = flatpickr("#islem-tarihi-input", { enableTime: true, dateFormat: "Y-m-d H:i:S", locale: "tr" });
    duzenleModal = new bootstrap.Modal(document.getElementById('duzenleModal'));
    silmeOnayModal = new bootstrap.Modal(document.getElementById('silmeOnayModal'));

    mevcutGorunum = localStorage.getItem('finansGorunum') || 'tablo';
    gorunumuAyarla(mevcutGorunum);

    tedarikcileriDoldur();
    finansalIslemleriYukle(1); // İlk sayfayı yükle
};

function gorunumuDegistir(yeniGorunum) {
    if (mevcutGorunum === yeniGorunum) return;
    mevcutGorunum = yeniGorunum;
    localStorage.setItem('finansGorunum', yeniGorunum);
    gorunumuAyarla(yeniGorunum);
    finansalIslemleriYukle(1); // Görünüm değiştiğinde ilk sayfayı yükle
}

function gorunumuAyarla(aktifGorunum) {
    document.querySelectorAll('.gorunum-konteyneri').forEach(el => el.style.display = 'none');
    document.getElementById(`${aktifGorunum}-gorunumu`).style.display = 'block';
    
    document.getElementById('btn-view-table').classList.toggle('active', aktifGorunum === 'tablo');
    document.getElementById('btn-view-card').classList.toggle('active', aktifGorunum === 'kart');
}

async function tedarikcileriDoldur() {
    try {
        const tedarikciler = await store.getTedarikciler();
        tedarikciSecici.addOptions(tedarikciler.map(t => ({ value: t.id, text: t.isim })));
    } catch (error) {
        gosterMesaj('Tedarikçiler yüklenirken bir hata oluştu.', 'danger');
    }
}

async function finansalIslemleriYukle(sayfa = 1) {
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    const tabloBody = document.getElementById('finansal-islemler-tablosu');
    const kartListesi = document.getElementById('finansal-islemler-kart-listesi');
    const sayfalamaNav = document.getElementById('finans-sayfalama');

    // --- YENİ ÇEVRİMDIŞI KONTROLÜ ---
    if (!navigator.onLine) {
        veriYokMesaji.innerHTML = '<p class="text-warning">Finansal işlemleri listelemek için internet bağlantısı gereklidir.</p>';
        veriYokMesaji.style.display = 'block';
        tabloBody.innerHTML = '';
        kartListesi.innerHTML = '';
        sayfalamaNav.innerHTML = '';
        return;
    }
    // --- KONTROL SONU ---

    veriYokMesaji.innerHTML = `<div class="spinner-border spinner-border-sm"></div> Yükleniyor...`;
    veriYokMesaji.style.display = 'block';

    try {
        const response = await fetch(`/finans/api/islemler?sayfa=${sayfa}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'İşlemler yüklenemedi.');
        
        verileriGoster(data.islemler);
        ui.sayfalamaNavOlustur('finans-sayfalama', data.toplam_kayit, sayfa, KAYIT_SAYISI, finansalIslemleriYukle);

    } catch (error) {
         veriYokMesaji.innerHTML = `<p class="text-danger">${error.message}</p>`;
    }
}

function verileriGoster(islemler) {
    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
    veriYokMesaji.style.display = islemler.length === 0 ? 'block' : 'none';

    document.getElementById('finansal-islemler-tablosu').innerHTML = '';
    document.getElementById('finansal-islemler-kart-listesi').innerHTML = '';

    if (mevcutGorunum === 'tablo') {
        renderTable(islemler);
    } else {
        renderCards(islemler);
    }
}

function renderTable(islemler) {
    const tbody = document.getElementById('finansal-islemler-tablosu');
    islemler.forEach(islem => {
        const islemTarihi = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        // --- DEĞİŞİKLİK BURADA ---
        // Her bir tablo satırına (tr) benzersiz bir 'id' ekledik.
        tbody.innerHTML += `
            <tr id="finans-islem-${islem.id}">
                <td>${islemTarihi}</td>
                <td>${islem.tedarikciler ? islem.tedarikciler.isim : 'Bilinmiyor'}</td>
                <td><span class="badge bg-${islem.islem_tipi === 'Ödeme' ? 'success' : 'warning'}">${islem.islem_tipi}</span></td>
                <td class="text-end fw-bold ${islem.islem_tipi === 'Ödeme' ? 'text-success' : 'text-danger'}">${parseFloat(islem.tutar).toFixed(2)} TL</td>
                <td>${islem.aciklama || '-'}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary" onclick="duzenleModaliniAc(${islem.id}, '${islem.tutar}', '${islem.aciklama || ''}')" title="Düzenle"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="silmeOnayiAc(${islem.id})" title="Sil"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`;
    });
}

function renderCards(islemler) {
    const container = document.getElementById('finansal-islemler-kart-listesi');
    islemler.forEach(islem => {
        const islemTarihi = new Date(islem.islem_tarihi).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        // --- DEĞİŞİKLİK BURADA ---
        // Her bir kartın dış sarmalayıcısına (div) benzersiz bir 'id' ekledik.
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
                        <button class="btn btn-sm btn-outline-primary" onclick="duzenleModaliniAc(${islem.id}, '${islem.tutar}', '${islem.aciklama || ''}')" title="Düzenle"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="silmeOnayiAc(${islem.id})" title="Sil"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
    });
}

// --- İŞLEM VE MODAL FONKSİYONLARI (Değişiklik yok) ---
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

    let islemBasarili = false;
    // 1. ADIM: Sadece KAYDETME işlemini dene ve hatasını yakala.
    try {
        const response = await fetch('/finans/api/islemler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) });
        const result = await response.json();

        if (!response.ok) {
            // Eğer sunucu bilerek bir hata döndürdüyse (örn: "Tutar pozitif olmalı")
            gosterMesaj(result.error || 'İşlem kaydedilemedi.', 'danger');
            return; // Fonksiyonu durdur.
        }

        // Buraya ulaştıysak, kayıt işlemi kesinlikle başarılıdır.
        gosterMesaj(result.message, 'success');
        islemBasarili = true;

    } catch (error) {
        // Eğer sunucuya hiç ulaşılamadıysa bu hata çıkar.
        gosterMesaj('İşlem kaydedilirken sunucuya bağlanılamadı.', 'danger');
        return; // Fonksiyonu durdur.
    }

    // 2. ADIM: Eğer kaydetme başarılı olduysa, formu temizle ve listeyi yenile.
    if (islemBasarili) {
        // Formu temizle
        document.getElementById('islem-tipi-sec').value = 'Ödeme';
        tedarikciSecici.clear();
        document.getElementById('tutar-input').value = '';
        document.getElementById('aciklama-input').value = '';
        tarihSecici.clear();
        
        // Listeyi yenileme işlemini kendi try-catch bloğu içine al.
        try {
            // Not: Fonksiyonun adı `finansalIslemleriYukle(1)` olabilir, kendi koduna göre düzenle.
            await finansalIslemleriYukle(1); 
        } catch (error) {
            // Eğer SADECE liste yenileme başarısız olursa, kullanıcıya durumu izah eden bir uyarı ver.
            console.error("Liste yenilenirken hata oluştu:", error);
            gosterMesaj('İşlem kaydedildi ancak liste yenilenemedi. Lütfen sayfayı yenileyin.', 'warning');
        }
    }
}

function silmeOnayiAc(islemId) {
    document.getElementById('silinecek-islem-id').value = islemId;
    silmeOnayModal.show();
}

async function finansalIslemSil() {
    const id = document.getElementById('silinecek-islem-id').value;
    silmeOnayModal.hide();

    // 1. Öğeyi arayüzden anında kaldır
    const silinecekElement = document.getElementById(`finans-islem-${id}`);
    if (!silinecekElement) return;
    
    const parent = silinecekElement.parentNode;
    const nextSibling = silinecekElement.nextSibling;
    silinecekElement.style.transition = 'opacity 0.4s';
    silinecekElement.style.opacity = '0';
    setTimeout(() => silinecekElement.remove(), 400);

    // 2. Arka planda API isteğini gönder
    try {
        const response = await fetch(`/finans/api/islemler/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error);
        }

        gosterMesaj(result.message, 'success');

    } catch (error) {
        // ---- DÜZELTME BURADA ----
        gosterMesaj(error.message || 'Silme işlemi başarısız, işlem geri yüklendi.', 'danger');
        
        // Hata olursa elemanı eski yerine geri ekle
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
        const response = await fetch(`/finans/api/islemler/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(veri)
        });
        const result = await response.json();

        if (response.ok) {
            gosterMesaj(result.message, 'success');
            duzenleModal.hide();
            await finansalIslemleriYukle(1); // Listeyi yenile
        } else {
            gosterMesaj(result.error || 'Güncelleme başarısız.', 'danger');
        }
    } catch (error) {
        gosterMesaj('Sunucuya bağlanırken bir hata oluştu.', 'danger');
    }
}