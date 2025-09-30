// ====================================================================================
// MERKEZİ VERİ YÖNETİMİ (store.js)
// Bu dosya, uygulama genelinde paylaşılan verileri (state) yönetir.
// Verileri bir kez API'den çeker ve ihtiyaç duyulduğunda tekrar istek atmadan
// önbellekten (cache) sunar. Bu, API trafiğini azaltır ve performansı artırır.
// ====================================================================================

const store = {
    // Uygulama verilerini saklayacağımız alanlar
    tedarikciler: [],
    yemUrunleri: [],

    /**
     * Tedarikçi listesini getirir.
     * Eğer liste daha önce yüklenmemişse API'den çeker, yüklendiyse önbellekten döndürür.
     * @returns {Promise<Array>} Tedarikçilerin listesini içeren bir Promise döndürür.
     */
    async getTedarikciler() {
        // Eğer tedarikçiler listesi boşsa (yani daha önce çekilmemişse)
        if (this.tedarikciler.length === 0) {
            console.log('Tedarikçiler API\'den çekiliyor...');
            // api.js üzerinden veriyi çek ve store'daki listeye kaydet
            this.tedarikciler = await api.fetchTedarikciler();
        } else {
            console.log('Tedarikçiler önbellekten (store) getirildi.');
        }
        // Her durumda dolu listeyi döndür
        return this.tedarikciler;
    },

    /**
     * Tedarikçi listesi önbelleğini temizler.
     * Bir tedarikçi eklendiğinde, silindiğinde veya güncellendiğinde bu fonksiyon çağrılır.
     * Böylece bir sonraki getTedarikciler() çağrısı güncel veriyi API'den çeker.
     */
    invalidateTedarikciler() {
        console.log('Tedarikçi önbelleği temizlendi.');
        this.tedarikciler = [];
    },

    /**
     * Önbelleğe yeni bir tedarikçi ekler ve listeyi alfabetik olarak sıralar.
     * @param {object} tedarikci - Eklenecek tedarikçi objesi {id, isim}.
     */
    addTedarikci(tedarikci) {
        // Sadece önbellek zaten doluysa (yani daha önce en az bir kez yüklendiyse) işlem yap
        if (this.tedarikciler.length > 0) {
            console.log('Yeni tedarikçi önbelleğe ekleniyor:', tedarikci.isim);
            this.tedarikciler.push({id: tedarikci.id, isim: tedarikci.isim});
            // Ekledikten sonra listeyi yeniden sırala ki dropdown'lar düzgün görünsün
            this.tedarikciler.sort((a, b) => a.isim.localeCompare(b.isim));
        }
    },

    /**
     * Önbellekteki bir tedarikçinin bilgilerini günceller.
     * @param {object} tedarikci - Güncellenmiş tedarikçi objesi {id, isim}.
     */
    updateTedarikci(tedarikci) {
        if (this.tedarikciler.length > 0) {
            const index = this.tedarikciler.findIndex(t => t.id === tedarikci.id);
            if (index !== -1) {
                console.log('Tedarikçi önbellekte güncelleniyor:', tedarikci.isim);
                this.tedarikciler[index].isim = tedarikci.isim;
                this.tedarikciler.sort((a, b) => a.isim.localeCompare(b.isim));
            }
        }
    },

    /**
     * Önbellekten bir tedarikçiyi ID'sine göre siler.
     * @param {number} id - Silinecek tedarikçinin ID'si.
     */
    removeTedarikci(id) {
        if (this.tedarikciler.length > 0) {
            const initialLength = this.tedarikciler.length;
            this.tedarikciler = this.tedarikciler.filter(t => t.id !== id);
            if(this.tedarikciler.length < initialLength){
                console.log(`Tedarikçi (ID: ${id}) önbellekten silindi.`);
            }
        }
    },

    /**
     * Yem ürünleri listesini getirir.
     * Tedarikçilerle aynı mantıkta çalışır: "önce kontrol et, yoksa çek".
     * @returns {Promise<Array>} Yem ürünlerinin listesini içeren bir Promise döndürür.
     */
    async getYemUrunleri() {
        if (this.yemUrunleri.length === 0) {
            console.log('Yem ürünleri API\'den çekiliyor...');
            this.yemUrunleri = await api.fetchYemUrunleri();
        } else {
            console.log('Yem ürünleri önbellekten (store) getirildi.');
        }
        return this.yemUrunleri;
    },
    
    /**
     * Yem ürünleri önbelleğini temizler.
     */
    invalidateYemUrunleri() {
        console.log('Yem ürünleri önbelleği temizlendi.');
        this.yemUrunleri = [];
    }
};

// api.js içinde yem ürünlerini çekecek yeni bir fonksiyona ihtiyacımız var.
// Onu da buraya ekleyelim ki her şey merkezi olsun.
api.fetchYemUrunleri = function() {
    return this.request('/yem/api/urunler');
};
