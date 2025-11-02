// ====================================================================================
// API İLETİŞİM KATMANI (api.js) - HATA YÖNETİMİ GÜÇLENDİRİLDİ
// Bu dosya, sunucu ile olan tüm 'fetch' tabanlı iletişimi yönetir.
// 401 Unauthorized hatası alındığında login sayfasına yönlendirme eklendi.
// ====================================================================================

const api = {
    /**
     * Genel bir API isteği yapmak için merkezi fonksiyon.
     * 401 hatası alındığında kullanıcıyı login sayfasına yönlendirir.
     * @param {string} url - İstek yapılacak URL.
     * @param {object} options - Fetch için yapılandırma seçenekleri.
     * @returns {Promise<any>} - Başarılı olursa JSON verisi.
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, options);

// --- YENİ: 401 Hata Kontrolü ---
            if (response.status === 401) {
                let errorData = {};
                try {
                    errorData = await response.json(); // JSON hatasını almayı dene
                } catch(e) { /* JSON yoksa boş obje kalır */ }

                console.warn('API isteği yetkisiz (401). Oturum zaman aşımına uğramış olabilir.');

                // --- BAYRAK KONTROLÜ ---
                if (errorData.redirect_to_login === true) {
                    localStorage.removeItem('offlineUser');
                    if (typeof gosterMesaj === 'function') {
                        gosterMesaj(errorData.error || 'Oturumunuz zaman aşımına uğradı. Lütfen tekrar giriş yapın.', 'warning', 7000);
                    }
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 1500);
                } else {
                    // Eğer bayrak yoksa veya farklı bir 401 hatasıysa, sadece mesaj gösterilebilir
                    // veya farklı bir işlem yapılabilir. Şimdilik yine login'e yönlendirelim.
                    localStorage.removeItem('offlineUser');
                     if (typeof gosterMesaj === 'function') {
                         gosterMesaj(errorData.error || 'Yetkisiz işlem. Giriş sayfasına yönlendiriliyorsunuz.', 'danger', 7000);
                     }
                     setTimeout(() => {
                         window.location.href = '/login';
                     }, 1500);
                }
                // --- /BAYRAK KONTROLÜ ---

                throw new Error(errorData.error || 'Yetkisiz Erişim (401)');
            }

            // Yanıt JSON değilse (örn: CSV export) farklı işlem gerekebilir
            // Şimdilik tüm yanıtların JSON olduğunu varsayıyoruz, CSV için özel fetch yapısı var.
            // Eğer response.ok değilse ve 401 de değilse, hatayı JSON'dan almaya çalış
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    // JSON parse edilemiyorsa genel bir hata ver
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            // Yanıt başarılıysa JSON verisini döndür
            return await response.json();

        } catch (error) {
            // 401 dışındaki hataları logla ve tekrar fırlat
            if (error.message !== 'Yetkisiz Erişim (401)') {
                console.error(`API isteği hatası (${url}):`, error);
            }
            throw error; // Hatayı çağıran fonksiyona ilet
        }
    },

    // --- Rapor ve Ana Panel API'ları ---
    fetchGunlukOzet(tarih) { return this.request(`/api/rapor/gunluk_ozet?tarih=${tarih}`); },
    fetchHaftalikOzet() { return this.request('/api/rapor/haftalik_ozet'); },
    fetchTedarikciDagilimi() { return this.request('/api/rapor/tedarikci_dagilimi'); },
    fetchDetayliRapor(baslangic, bitis) { return this.request(`/api/rapor/detayli_rapor?baslangic=${baslangic}&bitis=${bitis}`); },
    // YENİ: Kârlılık Raporu API'si
    fetchKarlilikRaporu(baslangic, bitis) { return this.request(`/api/rapor/karlilik?baslangic=${baslangic}&bitis=${bitis}`); },

    // --- Süt Girdisi API'ları ---
    fetchSutGirdileri(tarih, sayfa) { return this.request(`/api/sut_girdileri?tarih=${tarih}&sayfa=${sayfa}`); },
    postSutGirdisi(veri) { return this.request('/api/sut_girdisi_ekle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateSutGirdisi(id, veri) { return this.request(`/api/sut_girdisi_duzenle/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteSutGirdisi(id) { return this.request(`/api/sut_girdisi_sil/${id}`, { method: 'DELETE' }); },
    fetchGirdiGecmisi(id) { return this.request(`/api/girdi_gecmisi/${id}`); },

    // --- Tedarikçi API'ları ---
    fetchTedarikciler() { return this.request('/api/tedarikciler_dropdown', { cache: 'no-cache' }); },
    fetchTedarikcilerListe(sayfa, arama, sirala, yon, limit) { // Tedarikçiler sayfası için
        return this.request(`/api/tedarikciler_liste?sayfa=${sayfa}&arama=${encodeURIComponent(arama)}&sirala=${sirala}&yon=${yon}&limit=${limit}`);
    },
    fetchTedarikciDetay(id) { return this.request(`/api/tedarikci/${id}`); }, // Tedarikçiler düzenleme için
    fetchTedarikciOzet(id) { return this.request(`/api/tedarikci/${id}/ozet`); }, // Tedarikçi detay sayfası için
    fetchTedarikciIstatistikleri(tedarikciId) { return this.request(`/api/tedarikci/${tedarikciId}/stats`); },
    fetchSonFiyat(tedarikciId) { return this.request(`/api/tedarikci/${tedarikciId}/son_fiyat`); },
    postTedarikci(veri) { return this.request('/api/tedarikci_ekle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateTedarikci(id, veri) { return this.request(`/api/tedarikci_duzenle/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteTedarikci(id) { return this.request(`/api/tedarikci_sil/${id}`, { method: 'DELETE' }); },
    // Tedarikçi detay sayfası için sayfalama endpoint'leri
    fetchTedarikciSutGirdileri(id, sayfa, limit) { return this.request(`/api/tedarikci/${id}/sut_girdileri?sayfa=${sayfa}&limit=${limit}`); },
    fetchTedarikciYemIslemleri(id, sayfa, limit) { return this.request(`/api/tedarikci/${id}/yem_islemleri?sayfa=${sayfa}&limit=${limit}`); },
    fetchTedarikciFinansIslemleri(id, sayfa, limit) { return this.request(`/api/tedarikci/${id}/finansal_islemler?sayfa=${sayfa}&limit=${limit}`); },

    // --- Fiyat Tarifesi API'ları ---
    fetchTarifeFiyat(tarih) { return this.request(`/tarife/api/get_fiyat?tarih=${tarih}`); },
    fetchTarifeler() { return this.request('/tarife/api/listele'); },
    postTarife(veri) { return this.request('/tarife/api/ekle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateTarife(id, veri) { return this.request(`/tarife/api/guncelle/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteTarife(id) { return this.request(`/tarife/api/sil/${id}`, { method: 'DELETE' }); },

    // --- Genel Masraf API'ları ---
    // Kategori API'ları
    fetchMasrafKategorileri() { return this.request('/masraf/api/kategori/listele'); },
    postMasrafKategorisi(veri) { return this.request('/masraf/api/kategori/ekle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateMasrafKategorisi(id, veri) { return this.request(`/masraf/api/kategori/guncelle/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteMasrafKategorisi(id) { return this.request(`/masraf/api/kategori/sil/${id}`, { method: 'DELETE' }); },
    // Masraf API'ları
    fetchMasraflar(sayfa, limit) { return this.request(`/masraf/api/listele?sayfa=${sayfa}&limit=${limit}`); },
    postMasraf(veri) { return this.request('/masraf/api/ekle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateMasraf(id, veri) { return this.request(`/masraf/api/guncelle/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteMasraf(id) { return this.request(`/masraf/api/sil/${id}`, { method: 'DELETE' }); },

    // --- Yem Ürünü API'ları ---
    fetchYemUrunleri(sayfa) { return this.request(`/yem/api/urunler?sayfa=${sayfa}`); }, // Yem yönetimi için
    fetchYemUrunleriListe() { return this.request('/yem/api/urunler/liste'); }, // Dropdown için
    postYemUrunu(veri) { return this.request('/yem/api/urunler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateYemUrunu(id, veri) { return this.request(`/yem/api/urunler/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteYemUrunu(id) { return this.request(`/yem/api/urunler/${id}`, { method: 'DELETE' }); },

    // --- Yem İşlemi API'ları ---
    fetchYemIslemleri(sayfa) { return this.request(`/yem/api/islemler/liste?sayfa=${sayfa}`); }, // Yem yönetimi için
    postYemIslemi(veri) { return this.request('/yem/api/islemler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateYemIslemi(id, veri) { return this.request(`/yem/api/islemler/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteYemIslemi(id) { return this.request(`/yem/api/islemler/${id}`, { method: 'DELETE' }); },

    // --- Finansal İşlem API'ları ---
    fetchFinansalIslemler(sayfa, limit) { return this.request(`/finans/api/islemler?sayfa=${sayfa}&limit=${limit}`); }, // Finans yönetimi için
    postFinansalIslem(veri) { return this.request('/finans/api/islemler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateFinansalIslem(id, veri) { return this.request(`/finans/api/islemler/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteFinansalIslem(id) { return this.request(`/finans/api/islemler/${id}`, { method: 'DELETE' }); },

    // --- Kullanıcı ve Profil API'ları ---
    fetchProfil() { return this.request('/api/profil'); }, // Profil sayfası için
    updateProfil(veri) { return this.request('/api/profil', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); }, // Profil sayfası için
    postChangePassword(veri) { return this.request('/api/user/change_password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); }, // base.html modal için

    // --- Firma Yönetimi API'ları ---
    fetchYonetimData() { return this.request('/firma/api/yonetim_data'); },
    postToplayiciEkle(veri) { return this.request('/firma/api/toplayici_ekle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteKullanici(id) { return this.request(`/firma/api/kullanici_sil/${id}`, { method: 'DELETE' }); },
    fetchKullaniciDetay(id) { return this.request(`/firma/api/kullanici_detay/${id}`); },
    updateKullanici(id, veri) { return this.request(`/firma/api/kullanici_guncelle/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    postKullaniciSifreSetle(id, veri) { return this.request(`/firma/api/kullanici_sifre_setle/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },


    // --- Çiftçi API'ları ---
    fetchCiftciOzet() { return this.request('/api/ciftci/ozet'); },
    fetchCiftciSutGirdileri(sayfa, limit) { return this.request(`/api/ciftci/sut_girdileri?sayfa=${sayfa}&limit=${limit}`); },
    fetchCiftciYemAlimlari(sayfa, limit) { return this.request(`/api/ciftci/yem_alimlarim?sayfa=${sayfa}&limit=${limit}`); },
    fetchCiftciFinansIslemleri(sayfa, limit) { return this.request(`/api/ciftci/finans_islemleri?sayfa=${sayfa}&limit=${limit}`); },

    // --- Push Bildirim API'ları ---
    fetchVapidPublicKey() { return this.request('/api/push/vapid_public_key'); },
    postSaveSubscription(sub) { return this.request('/api/push/save_subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) }); },

    // --- CSV Dışa Aktarma (Blob döndürdüğü için özel) ---
    async fetchCsvExport(tarih) {
        try {
            const url = `/api/rapor/export_csv${tarih ? `?tarih=${tarih}` : ''}`;
            const response = await fetch(url); // Doğrudan fetch kullanıyoruz, çünkü JSON beklemiyoruz

            // --- YENİ: 401 Kontrolü CSV için de eklendi ---
            if (response.status === 401) {
                console.warn('CSV export yetkisiz (401). Oturum zaman aşımına uğramış olabilir. Giriş sayfasına yönlendiriliyor.');
                localStorage.removeItem('offlineUser');
                if (typeof gosterMesaj === 'function') {
                    gosterMesaj('Oturumunuz zaman aşımına uğradı veya geçersiz. Lütfen tekrar giriş yapın.', 'warning', 7000);
                }
                setTimeout(() => { window.location.href = '/login'; }, 1500);
                throw new Error('Yetkisiz Erişim (401)');
            }
            // --- 401 KONTROLÜ SONU ---

            if (!response.ok) {
                 // Hata mesajını response'dan almaya çalışalım (eğer varsa)
                 let errorMsg = 'CSV dosyası oluşturulurken bir hata oluştu.';
                 try {
                     const errorData = await response.json(); // Belki backend JSON hata döndürür
                     errorMsg = errorData.error || errorMsg;
                 } catch(e) { /* JSON yoksa varsayılan mesaj kalır */ }
                 throw new Error(errorMsg);
            }

            const disposition = response.headers.get('Content-Disposition');
            let filename = "sut_raporu.csv";
            if (disposition && disposition.includes('attachment')) {
                const filenameMatch = /filename[^;=\n]*=(['"]?)([^'";\n]+)\1?/;
                const matches = filenameMatch.exec(disposition);
                if (matches && matches[2]) filename = matches[2].replace(/['"]/g, ''); // Tırnakları temizle
            }

            const blob = await response.blob();
            return { filename, blob };
        } catch (error) {
             if (error.message !== 'Yetkisiz Erişim (401)') { // 401 ise zaten loglandı/mesaj verildi
                 console.error("CSV dışa aktarılırken hata oluştu:", error);
             }
            throw error; // Hatayı tekrar fırlat ki çağıran fonksiyon bilsin
        }
    }
};