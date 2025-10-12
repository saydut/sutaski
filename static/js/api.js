// ====================================================================================
// API İLETİŞİM KATMANI (api.js) - YENİDEN DÜZENLENDİ
// Bu dosya, sunucu ile olan tüm 'fetch' tabanlı iletişimi yönetir.
// Artık projedeki TEK sunucu iletişim noktası burasıdır.
// ====================================================================================

const api = {
    /**
     * Genel bir API isteği yapmak için merkezi fonksiyon.
     * @param {string} url - İstek yapılacak URL.
     * @param {object} options - Fetch için yapılandırma seçenekleri.
     * @returns {Promise<any>} - Başarılı olursa JSON verisi.
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, options);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            return data;
        } catch (error) {
            console.error(`API isteği hatası (${url}):`, error);
            throw error;
        }
    },

    // --- Rapor ve Ana Panel API'ları ---
    fetchGunlukOzet(tarih) { return this.request(`/api/rapor/gunluk_ozet?tarih=${tarih}`); },
    fetchHaftalikOzet() { return this.request('/api/rapor/haftalik_ozet'); },
    fetchTedarikciDagilimi() { return this.request('/api/rapor/tedarikci_dagilimi'); },

    // --- Süt Girdisi API'ları ---
    fetchSutGirdileri(tarih, sayfa) { return this.request(`/api/sut_girdileri?tarih=${tarih}&sayfa=${sayfa}`); },
    postSutGirdisi(veri) { return this.request('/api/sut_girdisi_ekle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateSutGirdisi(id, veri) { return this.request(`/api/sut_girdisi_duzenle/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteSutGirdisi(id) { return this.request(`/api/sut_girdisi_sil/${id}`, { method: 'DELETE' }); },
    fetchGirdiGecmisi(id) { return this.request(`/api/girdi_gecmisi/${id}`); },

    // --- Tedarikçi API'ları ---
    fetchTedarikciler() { return this.request('/api/tedarikciler_dropdown', { cache: 'no-cache' }); },
    fetchTedarikciIstatistikleri(tedarikciId) { return this.request(`/api/tedarikci/${tedarikciId}/stats`); },
    fetchSonFiyat(tedarikciId) { return this.request(`/api/tedarikci/${tedarikciId}/son_fiyat`); },
    postTedarikci(veri) { return this.request('/api/tedarikci_ekle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateTedarikci(id, veri) { return this.request(`/api/tedarikci_duzenle/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteTedarikci(id) { return this.request(`/api/tedarikci_sil/${id}`, { method: 'DELETE' }); },

    // --- Yem Ürünü API'ları ---
    postYemUrunu(veri) { return this.request('/yem/api/urunler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateYemUrunu(id, veri) { return this.request(`/yem/api/urunler/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteYemUrunu(id) { return this.request(`/yem/api/urunler/${id}`, { method: 'DELETE' }); },
    fetchYemUrunleriListe() { return this.request('/yem/api/urunler/liste'); },

    // --- Yem İşlemi API'ları ---
    postYemIslemi(veri) { return this.request('/yem/api/islemler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateYemIslemi(id, veri) { return this.request(`/yem/api/islemler/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteYemIslemi(id) { return this.request(`/yem/api/islemler/${id}`, { method: 'DELETE' }); },

    // --- Finansal İşlem API'ları ---
    postFinansalIslem(veri) { return this.request('/finans/api/islemler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    updateFinansalIslem(id, veri) { return this.request(`/finans/api/islemler/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    deleteFinansalIslem(id) { return this.request(`/finans/api/islemler/${id}`, { method: 'DELETE' }); },

    // --- Kullanıcı ve Profil API'ları ---
    postChangePassword(veri) { return this.request('/api/user/change_password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri) }); },
    
    // --- CSV Dışa Aktarma (Blob döndürdüğü için özel) ---
    async fetchCsvExport(tarih) {
        try {
            const url = `/api/rapor/export_csv${tarih ? `?tarih=${tarih}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('CSV dosyası oluşturulurken bir hata oluştu.');
            
            const disposition = response.headers.get('Content-Disposition');
            let filename = "sut_raporu.csv";
            if (disposition && disposition.includes('attachment')) {
                const filenameMatch = /filename[^;=\n]*=(['"]?)([^'";\n]+)\1?/;
                const matches = filenameMatch.exec(disposition);
                if (matches && matches[2]) filename = matches[2];
            }
            
            const blob = await response.blob();
            return { filename, blob };
        } catch (error) {
            console.error("CSV dışa aktarılırken hata oluştu:", error);
            throw error;
        }
    }
};
