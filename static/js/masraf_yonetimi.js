// Bu script, masraf_yonetimi.html sayfasının mantığını yönetir.
document.addEventListener('DOMContentLoaded', () => {

    // DOM Elementleri
    const tableBody = document.getElementById('masraf-table-body');
    const openModalBtn = document.getElementById('open-add-masraf-modal-btn');
    const modal = document.getElementById('masraf-modal');
    const modalTitle = document.getElementById('masraf-modal-title');
    const masrafForm = document.getElementById('masraf-form');
    const masrafIdInput = document.getElementById('masraf-id');
    
    // Filtreleme elementleri
    const filterBtn = document.getElementById('masraf-filter-btn');
    const startDateInput = document.getElementById('masraf-tarih-baslangic');
    const endDateInput = document.getElementById('masraf-tarih-bitis');
    const tipiFilter = document.getElementById('masraf-tipi-filter');
    
    let currentFilters = {
        start_date: '',
        end_date: '',
        masraf_tipi: ''
    };

    /**
     * Masrafları API'den çeker ve tabloyu doldurur
     */
    const loadMasraflar = async () => {
        tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Yükleniyor...</td></tr>`;
        
        const params = new URLSearchParams(currentFilters);
        
        try {
            const data = await apiCall(`/api/masraflar?${params.toString()}`);
            renderMasrafTable(data.masraflar);
        } catch (error) {
            showToast(`Masraflar yüklenemedi: ${error.message}`, 'error');
            tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Veri yüklenemedi.</td></tr>`;
        }
    };

    /**
     * Masraf listesini HTML tabloya dönüştürür
     */
    const renderMasrafTable = (masraflar) => {
        tableBody.innerHTML = '';
        if (!masraflar || masraflar.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Kayıtlı masraf bulunamadı.</td></tr>`;
            return;
        }

        masraflar.forEach(masraf => {
            const row = `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(masraf.tarih)}</td>
                    <td class="table-cell font-medium">${masraf.masraf_tipi}</td>
                    <td class="table-cell font-semibold text-red-500">${formatCurrency(masraf.tutar)}</td>
                    <td class="table-cell">${masraf.aciklama || '-'}</td>
                    <td class="table-cell">
                        <button class="btn-warning-sm js-edit-masraf-btn" data-id="${masraf.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger-sm js-delete-masraf-btn" data-id="${masraf.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    };
    
    // --- Event Listeners ---

    // Filtrele Butonu
    filterBtn.addEventListener('click', () => {
        currentFilters.start_date = startDateInput.value;
        currentFilters.end_date = endDateInput.value;
        currentFilters.masraf_tipi = tipiFilter.value;
        loadMasraflar();
    });

    // Yeni Masraf Ekle Modalını Aç
    openModalBtn.addEventListener('click', () => {
        masrafForm.reset();
        masrafIdInput.value = '';
        modalTitle.textContent = 'Yeni Masraf Ekle';
        document.getElementById('masraf-tarih').valueAsDate = new Date();
        window.openModal('masraf-modal');
    });

    // Masraf Formu Gönderme (Ekleme ve Düzenleme)
    masrafForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(masrafForm);
        const body = Object.fromEntries(formData.entries());
        
        const masrafId = body.masraf_id;
        const method = masrafId ? 'PUT' : 'POST';
        const endpoint = masrafId ? `/api/masraf/${masrafId}` : '/api/masraflar';

        try {
            const response = await apiCall(endpoint, method, body);
            showToast(response.mesaj, 'success');
            window.closeModal('masraf-modal');
            loadMasraflar(); // Listeyi yenile
        } catch (error) {
            showToast(`Hata: ${error.message}`, 'error');
        }
    });

    // Tablo içi butonlar (Düzenle ve Sil)
    tableBody.addEventListener('click', async (e) => {
        const target = e.target;

        // Düzenle Butonu
        const editButton = target.closest('.js-edit-masraf-btn');
        if (editButton) {
            e.preventDefault();
            const masrafId = editButton.dataset.id;
            try {
                // Masraf verisini çek ve modalı doldur
                const masraf = await apiCall(`/api/masraf/${masrafId}`);
                masrafIdInput.value = masraf.id;
                document.getElementById('masraf-tarih').value = masraf.tarih.split('T')[0];
                document.getElementById('masraf-tipi').value = masraf.masraf_tipi;
                document.getElementById('masraf-tutar').value = masraf.tutar;
                document.getElementById('masraf-aciklama').value = masraf.aciklama || '';
                modalTitle.textContent = 'Masrafı Düzenle';
                window.openModal('masraf-modal');
            } catch (error) {
                showToast(`Masraf bilgisi alınamadı: ${error.message}`, 'error');
            }
        }

        // Sil Butonu
        const deleteButton = target.closest('.js-delete-masraf-btn');
        if (deleteButton) {
            e.preventDefault();
            const masrafId = deleteButton.dataset.id;
            if (confirm('Bu masraf kaydını silmek istediğinizden emin misiniz?')) {
                try {
                    const response = await apiCall(`/api/masraf/${masrafId}`, 'DELETE');
                    showToast(response.mesaj, 'success');
                    loadMasraflar(); // Listeyi yenile
                } catch (error) {
                    showToast(`Hata: ${error.message}`, 'error');
                }
            }
        }
    });

    // Sayfa yüklendiğinde masrafları çek
    loadMasraflar();
});