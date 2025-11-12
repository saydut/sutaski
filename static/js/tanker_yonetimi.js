// Bu script, tanker_yonetimi.html sayfasının mantığını yönetir.
document.addEventListener('DOMContentLoaded', () => {

    // DOM Elementleri
    const tableBody = document.getElementById('tanker-table-body');
    const openModalBtn = document.getElementById('open-add-tanker-modal-btn');
    const modal = document.getElementById('tanker-modal');
    const modalTitle = document.getElementById('tanker-modal-title');
    const tankerForm = document.getElementById('tanker-form');
    const tankerIdInput = document.getElementById('tanker-id');

    /**
     * Tankerleri API'den çeker ve tabloyu doldurur
     */
    const loadTankerler = async () => {
        tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Yükleniyor...</td></tr>`;
        try {
            const data = await apiCall('/api/tankerler');
            renderTankerTable(data.tankerler);
        } catch (error) {
            showToast(`Tankerler yüklenemedi: ${error.message}`, 'error');
            tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Veri yüklenemedi.</td></tr>`;
        }
    };

    /**
     * Tanker listesini HTML tabloya dönüştürür
     */
    const renderTankerTable = (tankerler) => {
        tableBody.innerHTML = '';
        if (!tankerler || tankerler.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">Kayıtlı tanker bulunamadı.</td></tr>`;
            return;
        }

        tankerler.forEach(tanker => {
            const durumClass = tanker.durum === 'aktif' ? 'status-active' : 'status-inactive';
            const row = `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell font-medium">${tanker.plaka}</td>
                    <td class="table-cell">${tanker.kapasite} Litre</td>
                    <td class="table-cell"><span class="${durumClass}">${tanker.durum}</span></td>
                    <td class="table-cell">
                        <button class="btn-warning-sm js-edit-tanker-btn" data-id="${tanker.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger-sm js-delete-tanker-btn" data-id="${tanker.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    };

    // --- Event Listeners ---

    // Yeni Tanker Ekle Modalını Aç
    openModalBtn.addEventListener('click', () => {
        tankerForm.reset();
        tankerIdInput.value = '';
        modalTitle.textContent = 'Yeni Tanker Ekle';
        window.openModal('tanker-modal');
    });

    // Tanker Formu Gönderme (Ekleme ve Düzenleme)
    tankerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(tankerForm);
        const body = Object.fromEntries(formData.entries());
        
        const tankerId = body.tanker_id;
        const method = tankerId ? 'PUT' : 'POST';
        const endpoint = tankerId ? `/api/tanker/${tankerId}` : '/api/tankerler';

        try {
            const response = await apiCall(endpoint, method, body);
            showToast(response.mesaj, 'success');
            window.closeModal('tanker-modal');
            loadTankerler(); // Listeyi yenile
        } catch (error) {
            showToast(`Hata: ${error.message}`, 'error');
        }
    });

    // Tablo içi butonlar (Düzenle ve Sil)
    tableBody.addEventListener('click', async (e) => {
        const target = e.target;

        // Düzenle Butonu
        const editButton = target.closest('.js-edit-tanker-btn');
        if (editButton) {
            e.preventDefault();
            const tankerId = editButton.dataset.id;
            try {
                // Tanker verisini çek ve modalı doldur
                const tanker = await apiCall(`/api/tanker/${tankerId}`);
                tankerIdInput.value = tanker.id;
                document.getElementById('tanker-plaka').value = tanker.plaka;
                document.getElementById('tanker-kapasite').value = tanker.kapasite;
                document.getElementById('tanker-durum').value = tanker.durum;
                modalTitle.textContent = 'Tankeri Düzenle';
                window.openModal('tanker-modal');
            } catch (error) {
                showToast(`Tanker bilgisi alınamadı: ${error.message}`, 'error');
            }
        }

        // Sil Butonu
        const deleteButton = target.closest('.js-delete-tanker-btn');
        if (deleteButton) {
            e.preventDefault();
            const tankerId = deleteButton.dataset.id;
            if (confirm('Bu tankeri silmek istediğinizden emin misiniz?')) {
                try {
                    const response = await apiCall(`/api/tanker/${tankerId}`, 'DELETE');
                    showToast(response.mesaj, 'success');
                    loadTankerler(); // Listeyi yenile
                } catch (error) {
                    showToast(`Hata: ${error.message}`, 'error');
                }
            }
        }
    });

    // Sayfa yüklendiğinde tankerleri çek
    loadTankerler();
});