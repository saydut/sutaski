// static/js/render-utils.js
// ====================================================================================
// ARAYÜZ OLUŞTURMA YARDIMCILARI (render-utils.js)
// Farklı veri türleri için liste ve kart HTML'i oluşturan fonksiyonları içerir.
// ====================================================================================

// utils objesinin utils.js'den geldiğini varsayıyoruz
if (typeof utils === 'undefined') {
    console.error("render-utils.js: utils objesi bulunamadı. utils.js yüklendi mi?");
}

const renderUtils = {

    /**
     * Ana paneldeki süt girdilerini liste formatında (list-group) HTML olarak oluşturur.
     * @param {Array} girdiler - Gösterilecek girdi objeleri dizisi.
     * @returns {string} - Oluşturulan HTML string'i.
     */
    renderSutGirdileriAsList(girdiler) {
        let listHTML = '';
        girdiler.forEach(girdi => {
            let formatliTarih = 'Geçersiz Saat';
            try {
                 const tarihObj = new Date(girdi.taplanma_tarihi);
                 if (!isNaN(tarihObj.getTime())) {
                     formatliTarih = `${String(tarihObj.getHours()).padStart(2, '0')}:${String(tarihObj.getMinutes()).padStart(2, '0')}`;
                 }
            } catch(e) { console.error("Tarih formatlama hatası:", girdi.taplanma_tarihi, e); }

            const duzenlendiEtiketi = girdi.duzenlendi_mi ? `<span class="badge bg-warning text-dark ms-2">Düzenlendi</span>` : '';
            const cevrimdisiEtiketi = girdi.isOffline ? `<span class="badge bg-info text-dark ms-2" title="İnternet geldiğinde gönderilecek"><i class="bi bi-cloud-upload"></i> Beklemede</span>` : '';

            const currentUserRole = document.body.dataset.userRole;
            let currentUserId = null;
            try { currentUserId = JSON.parse(localStorage.getItem('offlineUser'))?.id; } catch(e) { console.error("Kullanıcı ID alınamadı:", e); }

            const girdiSahibiId = girdi.kullanici_id;
            const canModify = !girdi.isOffline && typeof currentUserId === 'number' && typeof girdiSahibiId === 'number' &&
                              (currentUserRole === 'firma_yetkilisi' || (currentUserRole === 'toplayici' && girdiSahibiId === currentUserId));

            let actionButtons = canModify ? `
                <button class="btn btn-sm btn-outline-info border-0" title="Düzenle"
                        data-bs-toggle="modal" data-bs-target="#duzenleModal"
                        data-girdi-id="${girdi.id}" data-litre="${girdi.litre}" data-fiyat="${girdi.fiyat}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger border-0" title="Sil"
                        data-bs-toggle="modal" data-bs-target="#silmeOnayModal"
                        data-girdi-id="${girdi.id}">
                    <i class="bi bi-trash"></i>
                </button>` : '';

            // onclick içinde global fonksiyonu çağırıyoruz (ui.js veya modal-handler.js içinde olabilir)
            const gecmisButonu = !girdi.isOffline && girdi.id && !String(girdi.id).startsWith('offline-')
                ? `<button class="btn btn-sm btn-outline-secondary border-0" title="Geçmişi Gör" onclick="gecmisiGoster(${girdi.id})"><i class="bi bi-clock-history"></i></button>`
                : '';

            const fiyat = parseFloat(girdi.fiyat || 0); // Fiyat null ise 0 kabul et
            const fiyatBilgisi = fiyat > 0 ? `<span class="text-success">@ ${fiyat.toFixed(2)} TL</span>` : '';
            // utils objesinin global olduğunu varsayıyoruz (utils.js'den)
            const kullaniciAdi = girdi.kullanicilar?.kullanici_adi ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : (girdi.isOffline ? 'Siz (Beklemede)' : 'Bilinmiyor');
            const tedarikciAdi = girdi.tedarikciler ? utils.sanitizeHTML(girdi.tedarikciler.isim) : 'Bilinmeyen Tedarikçi';


            listHTML += `
                <div class="list-group-item" id="girdi-liste-${girdi.id}">
                    <div class="d-flex w-100 justify-content-between flex-wrap">
                        <h5 class="mb-1 girdi-baslik">${tedarikciAdi} - ${girdi.litre} Litre ${fiyatBilgisi} ${duzenlendiEtiketi} ${cevrimdisiEtiketi}</h5>
                        <div class="btn-group">${actionButtons} ${gecmisButonu}</div>
                    </div>
                    <p class="mb-1 girdi-detay">Toplayan: ${kullaniciAdi} | Saat: ${formatliTarih}</p>
                </div>`;
        });
        return listHTML;
    },

    /**
     * Ana paneldeki süt girdilerini kart formatında (grid) HTML olarak oluşturur.
     * @param {Array} girdiler - Gösterilecek girdi objeleri dizisi.
     * @returns {string} - Oluşturulan HTML string'i.
     */
    renderSutGirdileriAsCards(girdiler) {
        let cardsHTML = '';
        girdiler.forEach(girdi => {
            let formatliTarih = 'Geçersiz Saat';
             try {
                  const tarihObj = new Date(girdi.taplanma_tarihi);
                  if (!isNaN(tarihObj.getTime())) {
                      formatliTarih = `${String(tarihObj.getHours()).padStart(2, '0')}:${String(tarihObj.getMinutes()).padStart(2, '0')}`;
                  }
             } catch(e) { console.error("Tarih formatlama hatası:", girdi.taplanma_tarihi, e); }

            const duzenlendiEtiketi = girdi.duzenlendi_mi ? `<span class="badge bg-warning text-dark">Düzenlendi</span>` : '';
            const cevrimdisiEtiketi = girdi.isOffline ? `<span class="badge bg-info text-dark" title="Beklemede"><i class="bi bi-cloud-upload"></i></span>` : '';

            const currentUserRole = document.body.dataset.userRole;
            let currentUserId = null;
            try { currentUserId = JSON.parse(localStorage.getItem('offlineUser'))?.id; } catch(e) { console.error("Kullanıcı ID alınamadı:", e); }

            const girdiSahibiId = girdi.kullanici_id;
            const canModify = !girdi.isOffline && typeof currentUserId === 'number' && typeof girdiSahibiId === 'number' &&
                               (currentUserRole === 'firma_yetkilisi' || (currentUserRole === 'toplayici' && girdiSahibiId === currentUserId));

            let actionButtons = canModify ? `
                <button class="btn btn-sm btn-outline-primary" title="Düzenle"
                        data-bs-toggle="modal" data-bs-target="#duzenleModal"
                        data-girdi-id="${girdi.id}" data-litre="${girdi.litre}" data-fiyat="${girdi.fiyat}">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" title="Sil"
                        data-bs-toggle="modal" data-bs-target="#silmeOnayModal"
                        data-girdi-id="${girdi.id}">
                    <i class="bi bi-trash"></i>
                </button>` : '';

             // onclick içinde global fonksiyonu çağırıyoruz (ui.js veya modal-handler.js içinde olabilir)
            const gecmisButonu = !girdi.isOffline && girdi.id && !String(girdi.id).startsWith('offline-')
                ? `<button class="btn btn-sm btn-outline-secondary" title="Geçmişi Gör" onclick="gecmisiGoster(${girdi.id})"><i class="bi bi-clock-history"></i></button>`
                : '';

            const litre = parseFloat(girdi.litre || 0);
            const fiyat = parseFloat(girdi.fiyat || 0);
            const tutar = litre * fiyat;
            const kullaniciAdi = girdi.kullanicilar?.kullanici_adi ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : (girdi.isOffline ? 'Siz (Beklemede)' : 'Bilinmiyor');
            const tedarikciAdi = girdi.tedarikciler ? utils.sanitizeHTML(girdi.tedarikciler.isim) : 'Bilinmeyen Tedarikçi';

            cardsHTML += `
            <div class="col-xl-6 col-12" id="girdi-kart-${girdi.id}">
                <div class="card p-2 h-100">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="card-title mb-0">${tedarikciAdi}</h6>
                                <small class="text-secondary">Toplayan: ${kullaniciAdi}</small>
                            </div>
                            <div class="d-flex gap-2">${cevrimdisiEtiketi} ${duzenlendiEtiketi}</div>
                        </div>
                        <div class="d-flex justify-content-between align-items-center my-2">
                            <span class="fs-4 fw-bold text-primary">${litre.toFixed(2)} L</span> {# Litre düzeltildi #}
                            <span class="fs-5 fw-bold text-success">${tutar.toFixed(2)} TL</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center">
                             <small class="text-secondary">Saat: ${formatliTarih}</small>
                             <div class="btn-group btn-group-sm">${actionButtons} ${gecmisButonu}</div>
                        </div>
                    </div>
                </div>
            </div>`;
        });
        return cardsHTML;
    }

    // Gelecekte diğer sayfaların render fonksiyonları da buraya eklenebilir.
    // Örnek:
    /*
    renderTedarikcilerAsTable(tedarikciler) {
        let tableHTML = '';
        tedarikciler.forEach(supplier => {
            // ... (tedarikciler.js içindeki renderTable mantığı buraya) ...
            tableHTML += `<tr> ... </tr>`;
        });
        return tableHTML;
    },
    renderTedarikcilerAsCards(tedarikciler) {
         let cardsHTML = '';
        tedarikciler.forEach(supplier => {
            // ... (tedarikciler.js içindeki renderCards mantığı buraya) ...
            cardsHTML += `<div class="col..."> ... </div>`;
        });
        return cardsHTML;
    }
    */
    // ... Yem, Finans vb. için de benzer fonksiyonlar eklenebilir.
};
