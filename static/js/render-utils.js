// static/js/render-utils.js
// ====================================================================================
// ARAYÜZ OLUŞTURMA YARDIMCILARI (HTML GENERATOR)
// Bu dosya, ham veriyi alır ve Tailwind CSS sınıflarıyla süslenmiş HTML'e çevirir.
// ====================================================================================

// Bağımlılık Kontrolü
if (typeof utils === 'undefined') {
    console.error("render-utils.js HATASI: 'utils' kütüphanesi bulunamadı. Lütfen utils.js dosyasının bu dosyadan önce yüklendiğinden emin olun.");
}

const renderUtils = {

    /**
     * Süt girdilerini LİSTE (Satır) formatında HTML'e çevirir.
     * @param {Array} girdiler - API'den gelen süt girdisi objeleri.
     * @returns {string} - Oluşturulan HTML string'i.
     */
    renderSutGirdileriAsList(girdiler) {
        let listHTML = '';
        
        // Eğer veri yoksa boş string dön (UI tarafı "veri yok" mesajını halleder)
        if (!girdiler || girdiler.length === 0) {
            return '';
        }

        girdiler.forEach(girdi => {
            // 1. Tarih/Saat Formatlama
            let formatliSaat = '??:??';
            try {
                 const tarihObj = new Date(girdi.taplanma_tarihi);
                 if (!isNaN(tarihObj.getTime())) {
                     // Sadece saati ve dakikayı alıyoruz (Liste görünümü için)
                     formatliSaat = tarihObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                 }
            } catch(e) { 
                console.error("Tarih hatası:", girdi.taplanma_tarihi, e); 
            }

            // 2. Etiketler (Badge) - Tailwind
            let etiketlerHTML = '';
            
            // Düzenlendi Etiketi
            if (girdi.duzenlendi_mi) {
                etiketlerHTML += `<span class="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20 ms-2" title="Bu kayıt daha önce düzenlenmiş">Düzenlendi</span>`;
            }
            
            // Çevrimdışı (Offline) Etiketi
            if (girdi.isOffline) {
                etiketlerHTML += `<span class="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 ms-2" title="İnternet bağlantısı bekleniyor"><i class="fa-solid fa-cloud-arrow-up mr-1"></i> Bekliyor</span>`;
            }

            // 3. Yetki Kontrolü (Düzenle/Sil butonları kime görünecek?)
            // Mevcut kullanıcının ID'sini ve rolünü alıyoruz
            let currentUserId = null;
            const currentUserRole = document.body.dataset.userRole; // HTML'den gelir
            try { 
                const offlineUser = JSON.parse(localStorage.getItem('offlineUser'));
                if (offlineUser) currentUserId = offlineUser.id;
            } catch(e) {}

            const girdiSahibiId = girdi.kullanici_id;
            
            // Kural: Admin ve Firma Yetkilisi herkesinkini, Toplayıcı sadece kendisininkini silebilir.
            // Çevrimdışı kayıtlar henüz sunucuda olmadığı için düzenlenemez (senkronizasyon beklenir).
            const yetkiVar = !girdi.isOffline && (
                currentUserRole === 'admin' || 
                currentUserRole === 'firma_yetkilisi' || 
                (currentUserRole === 'toplayici' && girdiSahibiId === currentUserId)
            );

            // 4. Buton Grubu Oluşturma
            let actionButtons = '';
            if (yetkiVar) {
                actionButtons = `
                    <div class="flex items-center gap-1">
                        <button onclick="modalHandler.acDuzenleModal(${girdi.id}, '${girdi.litre}', '${girdi.fiyat}')" 
                                class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200" 
                                title="Girdiyi Düzenle">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="modalHandler.acSilmeModal(${girdi.id})" 
                                class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200" 
                                title="Girdiyi Sil">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>`;
            }

            // Geçmiş Butonu (Offline değilse ve ID geçerliyse)
            let gecmisButonu = '';
            if (!girdi.isOffline && girdi.id && !String(girdi.id).startsWith('offline-')) {
                 gecmisButonu = `
                    <button onclick="modalHandler.acGecmisModal(${girdi.id})" 
                            class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200" 
                            title="Düzenleme Geçmişini Gör">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </button>`;
            }

            // 5. Veri Hazırlığı
            const litre = parseFloat(girdi.litre).toFixed(1); // Örn: 25.5
            const fiyat = parseFloat(girdi.fiyat || 0);
            
            // Fiyat varsa yeşil renkte göster, yoksa boş geç
            const fiyatHTML = fiyat > 0 
                ? `<span class="text-green-600 font-medium text-xs ml-1 bg-green-50 px-1.5 py-0.5 rounded">@${fiyat.toFixed(2)} TL</span>` 
                : '';
            
            // İsimleri güvenli hale getir (XSS koruması)
            const kullaniciAdi = girdi.kullanicilar?.kullanici_adi ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : (girdi.isOffline ? 'Siz (Cihaz)' : '-');
            const tedarikciAdi = girdi.tedarikciler ? utils.sanitizeHTML(girdi.tedarikciler.isim) : 'Bilinmeyen Tedarikçi';

            // 6. HTML Şablonu (Tailwind)
            listHTML += `
                <div class="group flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors duration-200 border-b border-gray-100 last:border-0" id="girdi-liste-${girdi.id}">
                    
                    <div class="flex-1 min-w-0 pr-4">
                        <div class="flex items-center flex-wrap gap-2 mb-1">
                            <h5 class="text-sm font-bold text-gray-900 truncate">${tedarikciAdi}</h5>
                            ${etiketlerHTML}
                        </div>
                        
                        <div class="flex items-center text-xs text-gray-500 flex-wrap gap-y-1">
                            <span class="font-bold text-gray-800 text-sm mr-1">${litre} L</span>
                            ${fiyatHTML}
                            
                            <span class="mx-2 text-gray-300 hidden sm:inline">|</span>
                            <span class="flex items-center mr-3 sm:mr-0">
                                <i class="fa-regular fa-user mr-1 text-gray-400"></i>${kullaniciAdi}
                            </span>
                            
                            <span class="mx-2 text-gray-300">|</span>
                            <span class="flex items-center font-mono">
                                <i class="fa-regular fa-clock mr-1 text-gray-400"></i>${formatliSaat}
                            </span>
                        </div>
                    </div>

                    <div class="flex items-center opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                        ${actionButtons}
                        ${gecmisButonu}
                    </div>
                </div>`;
        });

        return listHTML;
    },

    /**
     * Süt girdilerini KART (Grid) formatında HTML'e çevirir.
     * @param {Array} girdiler - API'den gelen süt girdisi objeleri.
     * @returns {string} - Oluşturulan HTML string'i.
     */
    renderSutGirdileriAsCards(girdiler) {
        let cardsHTML = '';

        if (!girdiler || girdiler.length === 0) {
            return '';
        }

        girdiler.forEach(girdi => {
            // 1. Tarih Formatlama
            let formatliSaat = '??:??';
            try {
                const tarihObj = new Date(girdi.taplanma_tarihi);
                if (!isNaN(tarihObj.getTime())) {
                    formatliSaat = tarihObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                }
            } catch(e) {}

            // 2. Etiketler (Badge) - Sağ üst köşe için absolut pozisyon
            let badgeler = '';
            if (girdi.duzenlendi_mi) {
                badgeler += `<span class="h-2.5 w-2.5 rounded-full bg-yellow-400 ring-2 ring-white" title="Düzenlendi"></span>`;
            }
            if (girdi.isOffline) {
                badgeler += `<span class="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white ml-1" title="Çevrimdışı Kayıt"></span>`;
            }
            const badgeContainer = badgeler ? `<div class="absolute top-3 right-3 flex">${badgeler}</div>` : '';

            // 3. Yetki Kontrolü
            let currentUserId = null;
            const currentUserRole = document.body.dataset.userRole;
            try { 
                const offlineUser = JSON.parse(localStorage.getItem('offlineUser'));
                if(offlineUser) currentUserId = offlineUser.id; 
            } catch(e) {}
            
            const girdiSahibiId = girdi.kullanici_id;
            const yetkiVar = !girdi.isOffline && (
                currentUserRole === 'admin' || 
                currentUserRole === 'firma_yetkilisi' || 
                (currentUserRole === 'toplayici' && girdiSahibiId === currentUserId)
            );

            // 4. Butonlar
            let actionButtons = '';
            if (yetkiVar) {
                actionButtons = `
                <button onclick="modalHandler.acDuzenleModal(${girdi.id}, '${girdi.litre}', '${girdi.fiyat}')" 
                        class="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors">
                    Düzenle
                </button>
                <button onclick="modalHandler.acSilmeModal(${girdi.id})" 
                        class="text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-md transition-colors ml-2">
                    Sil
                </button>`;
            } else if (girdi.isOffline) {
                actionButtons = `<span class="text-xs text-gray-400 italic">Senkronizasyon bekleniyor...</span>`;
            }

            // 5. Veri Hazırlığı
            const litre = parseFloat(girdi.litre).toFixed(1); // Örn: 50.0
            const fiyat = parseFloat(girdi.fiyat || 0);
            const toplamTutar = (parseFloat(girdi.litre) * fiyat).toFixed(2);
            
            const tedarikciAdi = girdi.tedarikciler ? utils.sanitizeHTML(girdi.tedarikciler.isim) : 'Bilinmeyen';
            const toplayan = girdi.kullanicilar?.kullanici_adi ? utils.sanitizeHTML(girdi.kullanicilar.kullanici_adi) : '-';

            // 6. HTML Şablonu (Tailwind Card)
            cardsHTML += `
            <div class="col-span-1 relative bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-all duration-200 group" id="girdi-kart-${girdi.id}">
                ${badgeContainer}
                
                <div class="mb-3 pr-6">
                    <h3 class="text-base font-bold text-gray-900 truncate" title="${tedarikciAdi}">${tedarikciAdi}</h3>
                    <div class="flex items-center text-xs text-gray-400 mt-1">
                        <i class="fa-regular fa-clock mr-1"></i> ${formatliSaat}
                        <span class="mx-1">•</span>
                        <span>${toplayan}</span>
                    </div>
                </div>
                
                <div class="flex items-baseline gap-1 mb-4">
                    <span class="text-3xl font-extrabold text-brand-600 tracking-tight">${litre}</span>
                    <span class="text-sm font-medium text-gray-500">Litre</span>
                </div>
                
                <div class="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div class="flex flex-col">
                        <span class="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Tutar</span>
                        <span class="text-sm font-bold text-green-600">${fiyat > 0 ? toplamTutar + ' TL' : '-'}</span>
                    </div>
                    
                    <div class="flex items-center">
                        ${actionButtons}
                    </div>
                </div>
            </div>`;
        });

        return cardsHTML;
    }
};