// ====================================================================================
// MERKEZİ VERİ YÖNETİMİ (store.js) - GÜÇLENDİRİLDİ ve ASYNC/AWAIT DÜZELTMESİ YAPILDI
// Bu dosya, uygulama genelinde paylaşılan verileri (state) yönetir.
// Çevrimiçi ise veriyi API'den çeker ve yerel veritabanını (IndexedDB) günceller.
// Çevrimdışı ise veriyi yerel veritabanından okur.
// Ekleme/silme/güncelleme sonrası anında arayüz tepkisi için bellekteki veriyi de yönetir.
//
// HATA DÜZELTMESİ (tanker_yonetimi): Eksik olan getCache ve setCache fonksiyonları eklendi.
// ====================================================================================

const store = {
    // Uygulama verilerini saklayacağımız alanlar (hızlı erişim için bellek önbelleği)
    tedarikciler: [],
    yemUrunleri: [],

    // === YENİ EKLENEN CACHE MEKANİZMASI ===
    _cache: new Map(), // Basit bir bellek içi cache

    /**
     * Bellek içi cache'e veri yazar.
     * @param {string} key - Önbellek anahtarı
     * @param {*} value - Önbelleğe alınacak veri
     */
    setCache(key, value) {
        console.log(`Cache'e yazılıyor: ${key}`);
        this._cache.set(key, value);
    },

    /**
     * Bellek içi cache'ten veri okur.
     * @param {string} key - Önbellek anahtarı
     * @returns {*} - Önbellekteki veri veya null
     */
    getCache(key) {
        const value = this._cache.get(key);
        if (value) {
            console.log(`Cache'ten okundu: ${key}`);
            return value;
        }
        return null;
    },
    // === CACHE MEKANİZMASI SONU ===


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
            // syncTedarikciler fonksiyonunun offline.js içinde olduğunu varsayıyoruz
            fetchedData = await syncTedarikciler();
        } else {
            console.log('Çevrimdışı mod: Tedarikçiler yerel veritabanından (IndexedDB) okunuyor...');
            // getOfflineTedarikciler fonksiyonunun offline.js içinde olduğunu varsayıyoruz
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
            // syncYemUrunleri fonksiyonunun offline.js içinde olduğunu varsayıyoruz
            fetchedData = await syncYemUrunleri();
        } else {
            console.log('Çevrimdışı mod: Yem ürünleri yerel DB\'den okunuyor...');
            // getOfflineYemUrunleri fonksiyonunun offline.js içinde olduğunu varsayıyoruz
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
    async addTedarikci(tedarikci) { // async eklendi
        this.tedarikciler.push(tedarikci);
        this.tedarikciler.sort((a, b) => a.isim.localeCompare(b.isim, 'tr'));
        // db objesinin offline.js içinde global olarak tanımlandığını varsayıyoruz
        await db.tedarikciler.put(tedarikci); // await eklendi
    },

    /**
     * Bellekteki ve yerel veritabanındaki bir tedarikçiyi günceller.
     * @param {object} tedarikci - Güncellenmiş tedarikçi objesi.
     */
    async updateTedarikci(tedarikci) { // async eklendi
        const index = this.tedarikciler.findIndex(t => t.id === tedarikci.id);
        if (index !== -1) {
            this.tedarikciler[index] = { ...this.tedarikciler[index], ...tedarikci };
            this.tedarikciler.sort((a, b) => a.isim.localeCompare(b.isim, 'tr'));
            await db.tedarikciler.put(this.tedarikciler[index]); // await eklendi
        }
    },

    /**
     * Tanker listesini çeker ve cache'ler.
     * HATA DÜZELTMESİ: this.getCache ve this.setCache artık store objesinde tanımlı.
     */
    async getTankers(forceRefresh = false) {
        const cacheKey = 'tankers';
        if (!forceRefresh) {
            const cached = this.getCache(cacheKey); // ARTIK ÇALIŞACAK
            if (cached) return cached;
        }
        // api.js'de fetchTankers yok, o yüzden direkt api.request kullanıyoruz
        // (Bu, Mesaj 66'da oluşturduğumuz API'yi çağırır)
        const tankers = await api.request('/tanker/api/listele'); 
        this.setCache(cacheKey, tankers); // ARTIK ÇALIŞACAK
        return tankers;
    },
    
    /**
     * Bellekten ve yerel veritabanından bir tedarikçiyi siler.
     * @param {number} id - Silinecek tedarikçinin ID'si.
     */
    async removeTedarikci(id) { // async eklendi
        this.tedarikciler = this.tedarikciler.filter(t => t.id !== id);
        await db.tedarikciler.delete(id); // await eklendi
    },

    /**
     * Belleğe ve yerel veritabanına yeni bir yem ürünü ekler.
     * @param {object} urun - Eklenen yeni yem ürünü.
     */
    async addYemUrun(urun) { // async eklendi
        this.yemUrunleri.push(urun);
        this.yemUrunleri.sort((a, b) => a.yem_adi.localeCompare(b.yem_adi, 'tr'));
        await db.yem_urunleri.put(urun); // await eklendi
    },

    /**
     * Bellekteki ve yerel veritabanındaki bir yem ürününü günceller.
     * @param {object} urun - Güncellenmiş yem ürünü.
     */
    async updateYemUrun(urun) { // async eklendi
        const index = this.yemUrunleri.findIndex(y => y.id === urun.id);
        if (index !== -1) {
            this.yemUrunleri[index] = { ...this.yemUrunleri[index], ...urun };
            this.yemUrunleri.sort((a, b) => a.yem_adi.localeCompare(b.yem_adi, 'tr'));
            await db.yem_urunleri.put(this.yemUrunleri[index]); // await eklendi
        }
    },

    /**
     * Bellekten ve yerel veritabanından bir yem ürününü siler.
     * @param {number} id - Silinecek ürünün ID'si.
     */
    async removeYemUrun(id) { // async eklendi
        this.yemUrunleri = this.yemUrunleri.filter(y => y.id !== id);
        await db.yem_urunleri.delete(id); // await eklendi
    }
};



// api.js'in bu fonksiyona erişebilmesi için `api` objesine yeni bir fonksiyon ekliyoruz.
// Bu fonksiyon, yem yönetimi sayfasındaki sol menüyü doldurmak için
// sayfalama olmaksızın TÜM yem ürünlerini liste olarak çeker.
// NOT: Bu satırın çalışması için api.js'nin store.js'den ÖNCE yüklenmesi gerekir.
// Eğer yüklenme sırası farklıysa, bu atamayı api.js dosyasının sonuna taşıyabilirsiniz.
if (typeof api !== 'undefined') {
    api.fetchYemUrunleriListe = function() { // Düzeltme: fetchYemUrunleri -> fetchYemUrunleriListe
        return this.request('/yem/api/urunler/liste');
    };
} else {
    console.warn("api objesi store.js yüklenirken henüz tanımlanmamış. fetchYemUrunleriListe ataması api.js sonuna taşınabilir.");
}