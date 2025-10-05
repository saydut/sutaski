// ====================================================================================
// GENEL YARDIMCI FONKSİYONLAR (utils.js)
// Projenin farklı yerlerinde kullanılabilen, arayüzden bağımsız,
// genel amaçlı fonksiyonları içerir.
// ====================================================================================

const utils = {
    /**
     * JavaScript Date nesnesini 'YYYY-MM-DD' formatında bir string'e çevirir.
     * @param {Date} date - Formatlanacak tarih nesnesi. Varsayılan: şimdi.
     * @returns {string}
     */
    getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
};