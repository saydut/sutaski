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
        if (navigator.onLine) {
            console.log('Çevrimiçi mod: Tedarikçiler sunucudan çekiliyor ve yerel DB güncelleniyor...');
            // `syncTedarikciler` fonksiyonu hem API'den çeker hem de IndexedDB'ye yazar.
            this.tedarikciler = await syncTedarikciler();
        } else {
            console.log('Çevrimdışı mod: Tedarikçiler yerel veritabanından (IndexedDB) okunuyor...');
            this.tedarikciler = await getOfflineTedarikciler();
        }
        
        // Eğer her iki denemede de liste boşsa ve bellekte hala eski veri varsa onu kullan
        if (this.tedarikciler.length === 0 && store.tedarikciler.length > 0) {
            return store.tedarikciler;
        }

        return this.tedarikciler;
    },

    /**
     * Yem ürünleri listesini getirir.
     * Online ise API'den çeker ve yerel veritabanını günceller.
     * Offline ise yerel veritabanından çeker.
     * @returns {Promise<Array>} Yem ürünlerinin listesini içeren bir Promise döndürür.
     */
    async getYemUrunleri() {
        if (navigator.onLine) {
            console.log('Çevrimiçi mod: Yem ürünleri sunucudan çekiliyor ve yerel DB güncelleniyor...');
            this.yemUrunleri = await syncYemUrunleri();
        } else {
            console.log('Çevrimdışı mod: Yem ürünleri yerel veritabanından (IndexedDB) okunuyor...');
            this.yemUrunleri = await getOfflineYemUrunleri();
        }

        if (this.yemUrunleri.length === 0 && store.yemUrunleri.length > 0) {
            return store.yemUrunleri;
        }
        
        return this.yemUrunleri;
    },
    
    // invalidate, add, update, remove fonksiyonları artık doğrudan veritabanını
    // güncellemek yerine bir sonraki yüklemede verinin yeniden çekilmesini tetiklemelidir.
    // Şimdilik en basit yöntem, listeyi yeniden yüklemektir.
    // Bu fonksiyonlar, online iken bir ekleme/silme/güncelleme yapıldığında çağrılır.
    
    addTedarikci(tedarikci) {
        if (this.tedarikciler.length > 0) {
            this.tedarikciler.push({id: tedarikci.id, isim: tedarikci.isim});
            this.tedarikciler.sort((a, b) => a.isim.localeCompare(b.isim));
            // Yerel veritabanını da güncelle
            db.tedarikciler.put(tedarikci);
        }
    },

    updateTedarikci(tedarikci) {
        if (this.tedarikciler.length > 0) {
            const index = this.tedarikciler.findIndex(t => t.id === tedarikci.id);
            if (index !== -1) {
                this.tedarikciler[index].isim = tedarikci.isim;
                this.tedarikciler.sort((a, b) => a.isim.localeCompare(b.isim));
                db.tedarikciler.put(tedarikci);
            }
        }
    },

    removeTedarikci(id) {
        if (this.tedarikciler.length > 0) {
            this.tedarikciler = this.tedarikciler.filter(t => t.id !== id);
            db.tedarikciler.delete(id);
        }
    }
};

// api.js'in bu fonksiyonlara erişebilmesi için global'de tanımlıyoruz.
api.fetchYemUrunleri = function() {
    // Bu endpoint tüm yemleri sayfalama olmadan liste olarak döner
    return this.request('/yem/api/urunler/liste');
};