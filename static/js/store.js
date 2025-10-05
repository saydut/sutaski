// ====================================================================================
// MERKEZİ VERİ YÖNETİMİ (store.js)
// Bu dosya, uygulama genelinde paylaşılan verileri (state) yönetir.
// Çevrimiçi ise veriyi API'den çeker ve yerel veritabanını (IndexedDB) günceller.
// Çevrimdışı ise veriyi yerel veritabanından okur.
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
            // `syncTedarikciler` fonksiyonu hem API'den çeker hem de IndexedDB'ye yazar.
            fetchedData = await syncTedarikciler();
        } else {
            console.log('Çevrimdışı mod: Tedarikçiler yerel veritabanından (IndexedDB) okunuyor...');
            fetchedData = await getOfflineTedarikciler();
        }

        // Eğer yeni veri (online veya offline) başarılı bir şekilde çekildiyse,
        // bellekteki önbelleği (bu objenin içindeki `tedarikciler` dizisini) güncelle.
        if (fetchedData && fetchedData.length > 0) {
            this.tedarikciler = fetchedData;
        }

        // Her durumda, bellekteki listenin en güncel halini döndür.
        // Bu, veri çekme başarısız olsa bile uygulamanın eski veriyle çalışmaya devam etmesini sağlar.
        return this.tedarikciler;
    },

    /**
     * Yem ürünleri listesini getirir.
     * Online ise API'den çeker ve yerel veritabanını günceller.
     * Offline ise yerel veritabanından çeker.
     * @returns {Promise<Array>} Yem ürünlerinin listesini içeren bir Promise döndürür.
     */
    async getYemUrunleri() {
        let fetchedData = [];
        if (navigator.onLine) {
            console.log('Çevrimiçi mod: Yem ürünleri sunucudan çekiliyor ve yerel DB güncelleniyor...');
            fetchedData = await syncYemUrunleri();
        } else {
            console.log('Çevrimdışı mod: Yem ürünleri yerel veritabanından (IndexedDB) okunuyor...');
            fetchedData = await getOfflineYemUrunleri();
        }

        // Eğer yeni veri çekildiyse, bellek önbelleğini güncelle.
        if (fetchedData && fetchedData.length > 0) {
            this.yemUrunleri = fetchedData;
        }

        // Her durumda güncel veya önbellekteki veriyi döndür.
        return this.yemUrunleri;
    },

    // Aşağıdaki fonksiyonlar, online iken bir ekleme/silme/güncelleme yapıldığında,
    // arayüzün anında güncellenmesi için hem bellekteki listeyi hem de IndexedDB'yi
    // senkronize olarak günceller. Bu, sayfa yenilemeden arayüzün tutarlı kalmasını sağlar.

    /**
     * Belleğe ve yerel veritabanına yeni bir tedarikçi ekler.
     * @param {object} tedarikci - Eklenen yeni tedarikçi objesi.
     */
    addTedarikci(tedarikci) {
        // Bellekteki listeye ekle
        this.tedarikciler.push({ id: tedarikci.id, isim: tedarikci.isim, telefon_no: tedarikci.telefon_no, tc_no: tedarikci.tc_no, adres: tedarikci.adres });
        // Alfabetik sırayı koru
        this.tedarikciler.sort((a, b) => a.isim.localeCompare(b.isim, 'tr'));
        // Yerel veritabanını da (IndexedDB) güncelle
        db.tedarikciler.put(tedarikci);
    },

    /**
     * Bellekteki ve yerel veritabanındaki bir tedarikçiyi günceller.
     * @param {object} tedarikci - Güncellenmiş tedarikçi objesi.
     */
    updateTedarikci(tedarikci) {
        const index = this.tedarikciler.findIndex(t => t.id === tedarikci.id);
        if (index !== -1) {
            // Bellekteki objeyi güncelle
            this.tedarikciler[index] = { ...this.tedarikciler[index], ...tedarikci };
            this.tedarikciler.sort((a, b) => a.isim.localeCompare(b.isim, 'tr'));
            // Yerel veritabanını güncelle
            db.tedarikciler.put(tedarikci);
        }
    },

    /**
     * Bellekten ve yerel veritabanından bir tedarikçiyi siler.
     * @param {number} id - Silinecek tedarikçinin ID'si.
     */
    removeTedarikci(id) {
        this.tedarikciler = this.tedarikciler.filter(t => t.id !== id);
        db.tedarikciler.delete(id);
    }
};

// api.js'in bu fonksiyona erişebilmesi için `api` objesine yeni bir fonksiyon ekliyoruz.
// Bu fonksiyon, yem yönetimi sayfasındaki sol menüyü doldurmak için
// sayfalama olmaksızın TÜM yem ürünlerini liste olarak çeker.
api.fetchYemUrunleri = function() {
    return this.request('/yem/api/urunler/liste');
};