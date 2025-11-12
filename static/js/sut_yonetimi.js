// Bu script, sut_yonetimi.html sayfasının mantığını yönetir.
// Kayıt ekleme/düzenleme 'islem_yonetimi.js' tarafından yapılır.
// Bu script listeleme, filtreleme, sayfalama ve silme yapar.
document.addEventListener('DOMContentLoaded', () => {
    
    // Sayfa durumu (State)
    let state = {
        currentPage: 1,
        totalPages: 1,
        startDate: '',
        endDate: '',
        search: ''
    };

    // DOM Elementleri
    const tableBody = document.getElementById('sut-table-body');
    const filterBtn = document.getElementById('sut-filter-btn');
    const startDateInput = document.getElementById('sut-tarih-baslangic');
    const endDateInput = document.getElementById('sut-tarih-bitis');
    const searchInput = document.getElementById('sut-tedarikci-arama');
    
    const prevPageBtn = document.getElementById('prev-page-btn-sut');
    const nextPageBtn = document.getElementById('next-page-btn-sut');
    const paginationInfo = document.getElementById('pagination-info-sut');

    /**
     * API'den Süt kayıtlarını çeker ve tabloyu günceller.
     */
    const loadSutKayitlari = async () => {
        tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Yükleniyor...</td></tr>`;
        
        try {
            const params = new URLSearchParams({
                page: state.currentPage,
                search: state.search,
                start_date: state.startDate,
                end_date: state.endDate
            });
            const endpoint = `/api/sut?${params.toString()}`;
            const data = await apiCall(endpoint);
            
            renderSutTable(data.kayitlar);
            updatePagination(data.pagination);
            
        } catch (error) {
            showToast(`Süt kayıtları yüklenemedi: ${error.message}`, 'error');
            tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Veri yüklenemedi.</td></tr>`;
        }
    };

    /**
     * Gelen süt kayıtlarını HTML tabloya dönüştürür.
     */
    const renderSutTable = (kayitlar) => {
        tableBody.innerHTML = ''; 
        if (kayitlar.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center">Kayıt bulunamadı.</td></tr>`;
            return;
        }

        kayitlar.forEach(kayit => {
            const row = `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(kayit.tarih)}</td>
                    <td class="table-cell font-medium">${kayit.tedarikci_ad}</td>
                    <td class="table-cell">${kayit.litre} Litre</td>
                    <td class="table-cell">${formatCurrency(kayit.birim_fiyat)}</td>
                    <td class="table-cell font-medium text-red-500">${formatCurrency(kayit.toplam_tutar)}</td>
                    <td class="table-cell">
                        <button class="btn-warning-sm js-edit-sut-btn" data-id="${kayit.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger-sm js-delete-sut-btn" data-id="${kayit.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    };

    /**
     * Sayfalama bilgilerini ve butonlarını günceller.
     */
    const updatePagination = (pagination) => {
        state.currentPage = pagination.page;
        state.totalPages = pagination.total_pages;
        paginationInfo.textContent = `Sayfa ${pagination.page} / ${pagination.total_pages} (${pagination.total_items} kayıt)`;
        prevPageBtn.disabled = !pagination.has_prev;
        nextPageBtn.disabled = !pagination.has_next;
    };

    // --- Event Listeners ---

    // Filtrele Butonu
    filterBtn.addEventListener('click', () => {
        state.currentPage = 1;
        state.search = searchInput.value;
        state.startDate = startDateInput.value;
        state.endDate = endDateInput.value;
        loadSutKayitlari();
    });

    // Sayfalama Butonları
    prevPageBtn.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            loadSutKayitlari();
        }
    });
    nextPageBtn.addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            state.currentPage++;
            loadSutKayitlari();
        }
    });

    // Tablo içi Düzenle ve Sil Butonları (Event Delegation)
    tableBody.addEventListener('click', async (e) => {
        const target = e.target;

        // Düzenle Butonu
        const editButton = target.closest('.js-edit-sut-btn');
        if (editButton) {
            e.preventDefault();
            const kayitId = editButton.dataset.id;
            // Düzenleme fonksiyonunu islem_yonetimi.js'den çağır
            if (typeof window.editSutKaydi === 'function') {
                window.editSutKaydi(kayitId);
            }
        }

        // Sil Butonu
        const deleteButton = target.closest('.js-delete-sut-btn');
        if (deleteButton) {
            e.preventDefault();
            const kayitId = deleteButton.dataset.id;
            // 'confirm' yerine daha güzel bir modal yapılabilir, şimdilik bu yeterli
            if (confirm('Bu süt kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
                try {
                    const response = await apiCall(`/api/sut/${kayitId}`, 'DELETE');
                    showToast(response.mesaj, 'success');
                    loadSutKayitlari(); // Listeyi yenile
                } catch (error) {
                    showToast(`Hata: ${error.message}`, 'error');
                }
            }
        }
    });

    // Sayfa ilk yüklendiğinde kayıtları çek
    loadSutKayitlari();
    
    // Global yenileme fonksiyonu (islem_yonetimi.js tarafından kullanılır)
    window.loadSutKayitlari = loadSutKayitlari;
});