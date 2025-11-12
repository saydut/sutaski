/**
 * Backend API'si ile iletişim kurmak için merkezi fonksiyon.
 * @param {string} endpoint - İstek atılacak API endpoint'i (örn: '/api/tedarikciler')
 * @param {string} [method='GET'] - HTTP metodu (GET, POST, PUT, DELETE)
 * @param {object} [body=null] - POST veya PUT istekleri için gönderilecek JSON verisi
 * @returns {Promise<any>} - API'den dönen JSON verisi
 * @throws {Error} - Ağ hatası veya API'den dönen hata mesajı
 */
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method: method,
        headers: {
            'Accept': 'application/json'
            // CSRF token'ı (gerekirse) buraya eklenebilir.
            // 'X-CSRFToken': '...' 
        },
    };

    // Body varsa ve method POST/PUT ise, JSON olarak ayarla
    if (body && (method === 'POST' || method === 'PUT')) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(endpoint, options);
        const data = await response.json(); // Yanıtı her zaman JSON olarak bekliyoruz

        if (!response.ok) {
            // Backend'den 'hata' anahtarıyla bir mesaj gelirse onu kullan
            throw new Error(data.hata || `HTTP hatası! Durum: ${response.status}`);
        }

        // Başarılı yanıtı döndür
        return data;

    } catch (error) {
        console.error('API isteği başarısız oldu:', endpoint, error);
        // Hatayı, onu çağıran fonksiyona (örn: tedarikciler.js) geri fırlat
        throw error;
    }
}