// Bu script, raporlar.html sayfasındaki 'Tedarikçi Hesap Özeti'
// bölümünde yer alan tedarikçi listesini doldurur.
document.addEventListener('DOMContentLoaded', async () => {

    const tedarikciSelect = document.getElementById('ozet-tedarikci-id');
    const bitisTarihiInput = document.getElementById('ozet-bitis-tarihi');
    const karBitisTarihiInput = document.getElementById('kar-bitis-tarihi');

    if (!tedarikciSelect) return; // Rapor sayfası değilse çık

    // Bitiş tarihlerini varsayılan olarak bugüne ayarla
    const today = new Date().toISOString().split('T')[0];
    bitisTarihiInput.value = today;
    karBitisTarihiInput.value = today;

    // Tedarikçi listesini doldur
    try {
        const data = await apiCall('/api/tedarikciler?status=aktif&full=true');
        
        if (data.tedarikciler && data.tedarikciler.length > 0) {
            tedarikciSelect.innerHTML = '<option value="">Tedarikçi Seçiniz...</option>'; // Yükleniyor... yazısını temizle
            data.tedarikciler.forEach(supplier => {
                tedarikciSelect.innerHTML += `
                    <option value="${supplier.id}">${supplier.tedarikci_kodu} - ${supplier.ad_soyad}</option>
                `;
            });
        } else {
            tedarikciSelect.innerHTML = '<option value="">Aktif tedarikçi bulunamadı.</option>';
        }
    } catch (error) {
        showToast('Tedarikçi listesi yüklenemedi.', 'error');
        tedarikciSelect.innerHTML = '<option value="">Hata oluştu.</option>';
    }
});