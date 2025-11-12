/**
 * ISO formatındaki tarihi 'dd.MM.yyyy' formatına çevirir.
 * @param {string} isoDate - Veritabanından gelen tarih (örn: 2023-10-27T10:00:00)
 * @returns {string} - Formatlanmış tarih (örn: 27.10.2023)
 */
function formatDate(isoDate) {
    if (!isoDate) return 'N/A'; // Eğer tarih yoksa 'N/A' (Yok) döndür
    try {
        const date = new Date(isoDate);
        // Geçersiz tarih kontrolü
        if (isNaN(date.getTime())) {
            return 'Geçersiz Tarih';
        }
        // Türkiye formatına (gün.ay.yıl) çevir
        return date.toLocaleDateString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        console.error("Tarih formatlama hatası:", e);
        return isoDate; // Hata olursa orijinal veriyi bozma
    }
}

/**
 * Sayısal bir değeri Türk Lirası formatına çevirir.
 * @param {number} amount - Para miktarı (örn: 1234.5)
 * @returns {string} - Formatlanmış para (örn: 1.234,50 TL)
 */
function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '...'; // Veri yükleniyor veya yok
    
    const formatter = new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY'
    });
    
    return formatter.format(amount);
}

/**
 * Ekranda 'alert()' yerine geçici bir bildirim (toast) gösterir.
 * @param {string} message - Gösterilecek mesaj
 * @param {string} [type='info'] - Bildirim tipi (info, success, error)
 */
function showToast(message, type = 'info') {
    let bgColor = 'bg-blue-600'; // info
    if (type === 'success') bgColor = 'bg-green-600';
    if (type === 'error') bgColor = 'bg-red-600';

    // Toast elementini oluştur
    const toast = document.createElement('div');
    toast.className = `fixed top-5 right-5 ${bgColor} text-white py-3 px-5 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300 ease-out`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Ekrana kaydırarak getir
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 100); // 100ms sonra animasyonu başlat

    // 3 saniye sonra kaldır
    setTimeout(() => {
        toast.classList.add('translate-x-full'); // Geri kaydır
        // Animasyon bittikten sonra DOM'dan kaldır
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300); // 300ms (animasyon süresi)
    }, 3000); // 3 saniye
}