// ====================================================================================
// API İLETİŞİM KATMANI (api.js)
// Bu dosya, sunucu ile olan tüm 'fetch' tabanlı iletişimi yönetir.
// Her fonksiyon, bir API endpoint'ine istek yapar ve Promise döndürür.
// Başarılı olursa JSON verisini, başarısız olursa hatayı 'reject' eder.
// ====================================================================================

const api = {
    /**
     * Genel bir API isteği yapmak için yardımcı fonksiyon.
     * @param {string} url - İstek yapılacak URL.
     * @param {object} options - Fetch için yapılandırma seçenekleri (method, headers, body vb.).
     * @returns {Promise<any>} - Başarılı olursa JSON verisi.
     */
async request(url, options = {}) {
    try {
        const response = await fetch(url, options);
        // DİKKAT: response.json() sonucunu doğrudan return etmeden önce bir değişkene atayacağız.
        const data = await response.json(); 
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        // Artık `data` bir objedir, doğrudan onu döndürelim.
        return data;
    } catch (error) {
        console.error(`API isteği hatası (${url}):`, error);
        throw error;
    }
},

    /**
     * Belirli bir tarihin özet verilerini (toplam litre, girdi sayısı) çeker.
     * @param {string} tarih - 'YYYY-MM-DD' formatında tarih.
     * @returns {Promise<{toplam_litre: number, girdi_sayisi: number}>}
     */
    fetchGunlukOzet(tarih) {
        return this.request(`/api/rapor/gunluk_ozet?tarih=${tarih}`);
    },

    /**
     * Belirli bir tarih ve sayfa için süt girdilerini çeker.
     * @param {string} tarih - 'YYYY-MM-DD' formatında tarih.
     * @param {number} sayfa - Getirilecek sayfa numarası.
     * @returns {Promise<{girdiler: Array, toplam_girdi_sayisi: number}>}
     */
    fetchSutGirdileri(tarih, sayfa) {
        return this.request(`/api/sut_girdileri?tarih=${tarih}&sayfa=${sayfa}`);
    },

    /**
     * Son 7 günlük süt toplama verisini grafik için çeker.
     * @returns {Promise<{labels: Array<string>, data: Array<number>}>}
     */
    fetchHaftalikOzet() {
        return this.request('/api/rapor/haftalik_ozet');
    },

    /**
     * Son 30 günlük tedarikçi dağılımını grafik için çeker.
     * @returns {Promise<{labels: Array<string>, data: Array<number>}>}
     */
    fetchTedarikciDagilimi() {
        return this.request('/api/rapor/tedarikci_dagilimi');
    },

// BU FONKSİYONU BUL VE GÜNCELLE
    /**
     * Tüm tedarikçilerin listesini çeker.
     * @returns {Promise<Array<{id: number, isim: string}>>}
     */
fetchTedarikciler() {
    // Bu fonksiyon /api/tedarikciler_liste adresine istek atacak
    return this.request('/api/tedarikciler_liste')
        .then(data => {
            // ve gelen { "tedarikciler": [...] } objesinden
            // sadece "tedarikciler" dizisini döndürecek.
            return data.tedarikciler; 
        });
},

    /**
     * Sunucuya yeni bir süt girdisi gönderir.
     * @param {object} girdiVerisi - {tedarikci_id, litre, fiyat}
     * @returns {Promise<any>}
     */
    postSutGirdisi(girdiVerisi) {
        return this.request('/api/sut_girdisi_ekle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(girdiVerisi)
        });
    },

    /**
     * Mevcut bir süt girdisini günceller.
     * @param {number} girdiId - Güncellenecek girdinin ID'si.
     * @param {object} guncelVeri - {yeni_litre, duzenleme_sebebi}
     * @returns {Promise<any>}
     */
    updateSutGirdisi(girdiId, guncelVeri) {
        return this.request(`/api/sut_girdisi_duzenle/${girdiId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(guncelVeri)
        });
    },

    /**
     * Bir süt girdisini siler.
     * @param {number} girdiId - Silinecek girdinin ID'si.
     * @returns {Promise<any>}
     */
    deleteSutGirdisi(girdiId) {
        return this.request(`/api/sut_girdisi_sil/${girdiId}`, { method: 'DELETE' });
    },

    /**
     * Bir girdinin düzenleme geçmişini çeker.
     * @param {number} girdiId - Geçmişi istenen girdinin ID'si.
     * @returns {Promise<Array<object>>}
     */
    fetchGirdiGecmisi(girdiId) {
        return this.request(`/api/girdi_gecmisi/${girdiId}`);
    },

    /**
     * Kullanıcı şifresini değiştirmek için istek gönderir.
     * @param {object} sifreVerisi - {mevcut_sifre, yeni_sifre, yeni_sifre_tekrar}
     * @returns {Promise<any>}
     */
    postChangePassword(sifreVerisi) {
        return this.request('/api/user/change_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sifreVerisi)
        });
    },
    
    /**
     * Verileri CSV olarak dışa aktarmak için istekte bulunur.
     * @param {string|null} tarih - İsteğe bağlı, dışa aktarılacak tarih.
     * @returns {Promise<{filename: string, blob: Blob}>}
     */
    async fetchCsvExport(tarih) {
        try {
            const url = `/api/export_csv${tarih ? `?tarih=${tarih}` : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('CSV dosyası oluşturulurken bir hata oluştu.');
            }
            
            const disposition = response.headers.get('Content-Disposition');
            let filename = "sut_raporu.csv"; // Varsayılan dosya adı
            if (disposition && disposition.includes('attachment')) {
                const filenameMatch = /filename[^;=\n]*=(['"]?)([^'";\n]+)\1?/;
                const matches = filenameMatch.exec(disposition);
                if (matches && matches[2]) {
                    filename = matches[2];
                }
            }
            
            const blob = await response.blob();
            return { filename, blob };
        } catch (error) {
            console.error("CSV dışa aktarılırken hata oluştu:", error);
            throw error;
        }
    }
};
