// Bu script, admin.html (Süper Admin) sayfasının mantığını yönetir.
document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elementleri ---
    const sirketTableBody = document.getElementById('sirket-table-body');
    const editSirketForm = document.getElementById('edit-sirket-form');
    
    // Dashboard Kartları
    const cardSirket = document.getElementById('admin-total-sirket');
    const cardKullanici = document.getElementById('admin-total-kullanici');
    const cardLisans = document.getElementById('admin-total-lisans');

    /**
     * Admin Dashboard kartlarını doldurur
     */
    const loadAdminDashboard = async () => {
        try {
            const data = await apiCall('/api/admin/dashboard');
            cardSirket.textContent = data.toplam_sirket;
            cardKullanici.textContent = data.toplam_kullanici;
            cardLisans.textContent = data.aktif_lisans;
        } catch (error) {
            showToast('Dashboard verileri yüklenemedi.', 'error');
            cardSirket.textContent = 'Hata';
            cardKullanici.textContent = 'Hata';
            cardLisans.textContent = 'Hata';
        }
    };

    /**
     * Tüm firmaları API'den çeker ve tabloyu doldurur
     */
    const loadSirketler = async () => {
        sirketTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Yükleniyor...</td></tr>`;
        try {
            const data = await apiCall('/api/admin/sirketler');
            renderSirketTable(data.sirketler);
        } catch (error) {
            showToast(`Firmalar yüklenemedi: ${error.message}`, 'error');
            sirketTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Veri yüklenemedi.</td></tr>`;
        }
    };

    /**
     * Firma listesini HTML tabloya dönüştürür
     */
    const renderSirketTable = (sirketler) => {
        sirketTableBody.innerHTML = '';
        if (!sirketler || sirketler.length === 0) {
            sirketTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Kayıtlı firma bulunamadı.</td></tr>`;
            return;
        }

        sirketler.forEach(sirket => {
            const durumClass = sirket.durum === 'aktif' ? 'status-active' : 'status-inactive';
            const row = `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell font-medium">${sirket.sirket_adi}</td>
                    <td class="table-cell">${formatDate(sirket.created_at)}</td>
                    <td class="table-cell">${formatDate(sirket.lisans_bitis_tarihi)}</td>
                    <td class="table-cell"><span class="${durumClass}">${sirket.durum}</span></td>
                    <td class="table-cell">
                        <button class="btn-warning-sm js-edit-sirket-btn" data-id="${sirket.id}">
                            <i class="fas fa-edit"></i> Lisans/Durum
                        </button>
                    </td>
                </tr>
            `;
            sirketTableBody.innerHTML += row;
        });
    };

    // --- Event Listeners ---

    // Firma Düzenleme Formu Gönderme
    editSirketForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(editSirketForm);
        const body = Object.fromEntries(formData.entries());
        const sirketId = body.sirket_id;

        try {
            const response = await apiCall(`/api/admin/sirket/${sirketId}`, 'PUT', body);
            showToast(response.mesaj, 'success');
            window.closeModal('edit-sirket-modal');
            loadSirketler(); // Listeyi yenile
        } catch (error) {
            showToast(`Hata: ${error.message}`, 'error');
        }
    });

    // Tablo içi Düzenle butonu
    sirketTableBody.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.js-edit-sirket-btn');
        if (editButton) {
            e.preventDefault();
            const sirketId = editButton.dataset.id;
            try {
                // Firma verisini çek ve modalı doldur
                const sirket = await apiCall(`/api/admin/sirket/${sirketId}`);
                document.getElementById('edit-sirket-id').value = sirket.id;
                document.getElementById('edit-sirket-adi').value = sirket.sirket_adi;
                document.getElementById('edit-lisans-bitis').value = sirket.lisans_bitis_tarihi.split('T')[0];
                document.getElementById('edit-sirket-durum').value = sirket.durum;
                
                window.openModal('edit-sirket-modal');
            } catch (error) {
                showToast(`Firma bilgisi alınamadı: ${error.message}`, 'error');
            }
        }
    });

    // Sayfa yüklendiğinde verileri çek
    loadAdminDashboard();
    loadSirketler();
});