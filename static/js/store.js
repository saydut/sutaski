// ====================================================================================
// MERKEZİ VERİ YÖNETİMİ (store.js) - GÜÇLENDİRİLDİ
// Bu dosya, uygulama genelinde paylaşılan verileri (state) yönetir.
// Çevrimiçi ise veriyi API'den çeker ve yerel veritabanını (IndexedDB) günceller.
// Çevrimdışı ise veriyi yerel veritabanından okur.
// Ekleme/silme/güncelleme sonrası anında arayüz tepkisi için bellekteki veriyi de yönetir.
// ====================================================================================

const store = {
    // Uygulama verilerini saklayacağımız alanlar (hızlı erişim için bellek önbelleği)
    tedarikciler: [],
    yemUrunleri: [],

    /**
     * Tedarikçi listesini getirir.
     * Online ise API'den çeker ve yerel veritabanını günceller.
     * Offline ise yerel veritabanından çeker.
     * @returns {Promise<Array>} Tedarikçilerin listesini içeren bir Promise döndürür.
     */
    async getTedarikciler() {
        let fetchedData = [];
        if (navigator.onLine) {
            console.log('Çevrimiçi mod: Tedarikçiler sunucudan çekiliyor ve yerel DB güncelleniyor...');
            fetchedData = await syncTedarikciler();
        } else {
            console.log('Çevrimdışı mod: Tedarikçiler yerel veritabanından (IndexedDB) okunuyor...');
            fetchedData = await getOfflineTedarikciler();
        }

        if (fetchedData && fetchedData.length > 0) {
            this.tedarikciler = fetchedData;
        }
        
        // Bellekteki listeyi alfabetik olarak sırala
        this.tedarikciler.sort((a, b) => a.isim.localeCompare(b.isim, 'tr'));
        return this.tedarikciler;
    },

    /**
     * Yem ürünleri listesini getirir.
     */
    async getYemUrunleri() {
        let fetchedData = [];
        if (navigator.onLine) {
            console.log('Çevrimiçi mod: Yem ürünleri sunucudan çekiliyor...');
            fetchedData = await syncYemUrunleri();
        } else {
            console.log('Çevrimdışı mod: Yem ürünleri yerel DB\'den okunuyor...');
            fetchedData = await getOfflineYemUrunleri();
        }

        if (fetchedData && fetchedData.length > 0) {
            this.yemUrunleri = fetchedData;
        }

        this.yemUrunleri.sort((a, b) => a.yem_adi.localeCompare(b.yem_adi, 'tr'));
        return this.yemUrunleri;
    },

    // --- ANINDA GÜNCELLEME İÇİN MUTATION FONKSİYONLARI ---

    /**
     * Belleğe ve yerel veritabanına yeni bir tedarikçi ekler.
     * @param {object} tedarikci - Eklenen yeni tedarikçi objesi.
     */
    addTedarikci(tedarikci) {
        this.tedarikciler.push(tedarikci);
        this.tedarikciler.sort((a, b) => a.isim.localeCompare(b.isim, 'tr'));
        db.tedarikciler.put(tedarikci); // IndexedDB'yi de güncelle
    },

    /**
     * Bellekteki ve yerel veritabanındaki bir tedarikçiyi günceller.
     * @param {object} tedarikci - Güncellenmiş tedarikçi objesi.
     */
    updateTedarikci(tedarikci) {
        const index = this.tedarikciler.findIndex(t => t.id === tedarikci.id);
        if (index !== -1) {
            this.tedarikciler[index] = { ...this.tedarikciler[index], ...tedarikci };
            this.tedarikciler.sort((a, b) => a.isim.localeCompare(b.isim, 'tr'));
            db.tedarikciler.put(this.tedarikciler[index]);
        }
    },

    /**
     * Bellekten ve yerel veritabanından bir tedarikçiyi siler.
     * @param {number} id - Silinecek tedarikçinin ID'si.
     */
    removeTedarikci(id) {
        this.tedarikciler = this.tedarikciler.filter(t => t.id !== id);
        db.tedarikciler.delete(id);
    },

    /**
     * Belleğe ve yerel veritabanına yeni bir yem ürünü ekler.
     * @param {object} urun - Eklenen yeni yem ürünü.
     */
    addYemUrun(urun) {
        this.yemUrunleri.push(urun);
        this.yemUrunleri.sort((a, b) => a.yem_adi.localeCompare(b.yem_adi, 'tr'));
        db.yem_urunleri.put(urun);
    },

    /**
     * Bellekteki ve yerel veritabanındaki bir yem ürününü günceller.
     * @param {object} urun - Güncellenmiş yem ürünü.
     */
    updateYemUrun(urun) {
        const index = this.yemUrunleri.findIndex(y => y.id === urun.id);
        if (index !== -1) {
            this.yemUrunleri[index] = { ...this.yemUrunleri[index], ...urun };
            this.yemUrunleri.sort((a, b) => a.yem_adi.localeCompare(b.yem_adi, 'tr'));
            db.yem_urunleri.put(this.yemUrunleri[index]);
        }
    },

    /**
     * Bellekten ve yerel veritabanından bir yem ürününü siler.
     * @param {number} id - Silinecek ürünün ID'si.
     */
    removeYemUrun(id) {
        this.yemUrunleri = this.yemUrunleri.filter(y => y.id !== id);
        db.yem_urunleri.delete(id);
    }
};

// api.js'in bu fonksiyona erişebilmesi için `api` objesine yeni bir fonksiyon ekliyoruz.
// Bu fonksiyon, yem yönetimi sayfasındaki sol menüyü doldurmak için
// sayfalama olmaksızın TÜM yem ürünlerini liste olarak çeker.
api.fetchYemUrunleri = function() {
    return this.request('/yem/api/urunler/liste');
};
