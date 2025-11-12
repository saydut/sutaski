// Bu script, finans_yonetimi.html sayfasının mantığını yönetir.
// Kayıt ekleme/düzenleme 'islem_yonetimi.js' tarafından yapılır.
// Bu script listeleme, filtreleme, sayfalama ve silme yapar.
document.addEventListener('DOMContentLoaded', () => {
    
    // Sayfa durumu (State)
    let state = {
        currentPage: 1,
        totalPages: 1,
        startDate: '',
        endDate: '',
        search: '',
        islemTipi: ''
    };

    // DOM Elementleri
    const tableBody = document.getElementById('finans-table-body');
    const filterBtn = document.getElementById('finans-filter-btn');
    const startDateInput = document.getElementById('finans-tarih-baslangic');
    const endDateInput = document.getElementById('finans-tarih-bitis');
    const searchInput = document.getElementById('finans-tedarikci-arama');
    const islemTipiSelect = document.getElementById('finans-islem-tipi');
    
    const prevPageBtn = document.getElementById('prev-page-btn-finans');
    const nextPageBtn = document.getElementById('next-page-btn-finans');
    const paginationInfo = document.getElementById('pagination-info-finans');

    /**
     * API'den Finans kayıtlarını çeker ve tabloyu günceller.
     */
    const loadFinansKayitlari = async () => {
        tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Yükleniyor...</td></tr>`;
        
        try {
            const params = new URLSearchParams({
                page: state.currentPage,
                search: state.search,
                start_date: state.startDate,
                end_date: state.endDate,
                islem_tipi: state.islemTipi
            });
            const endpoint = `/api/finans?${params.toString()}`;
            const data = await apiCall(endpoint);
            
            renderFinansTable(data.kayitlar);
            updatePagination(data.pagination);
            
        } catch (error) {
            showToast(`Finans kayıtları yüklenemedi: ${error.message}`, 'error');
            tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Veri yüklenemedi.</td></tr>`;
        }
    };

    /**
     * Gelen finans kayıtlarını HTML tabloya dönüştürür.
     */
    const renderFinansTable = (kayitlar) => {
        tableBody.innerHTML = ''; 
        if (kayitlar.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center">Kayıt bulunamadı.</td></tr>`;
            return;
        }

        kayitlar.forEach(kayit => {
            const tutarClass = kayit.islem_tipi === 'Odeme' ? 'text-green-500' : 'text-red-500';
            const row = `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(kayit.tarih)}</td>
                    <td class="table-cell font-medium">${kayit.tedarikci_ad}</td>
                    <td class="table-cell">${kayit.islem_tipi}</td>
                    <td class="table-cell font-medium ${tutarClass}">${formatCurrency(kayit.tutar)}</td>
                    <td class_ ="table-cell">${kayit.aciklama || '-'}</td>
                    <td class="table-cell">
                        <button class="btn-warning-sm js-edit-finans-btn" data-id="${kayit.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger-sm js-delete-finans-btn" data-id="${kayit.id}">
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
        state.islemTipi = islemTipiSelect.value;
        loadFinansKayitlari();
    });

    // Sayfalama Butonları
    prevPageBtn.addEventListener('click', () => {
        if (state.currentPage > 1) {
            state.currentPage--;
            loadFinansKayitlari();
        }
    });
    nextPageBtn.addEventListener('click', () => {
        if (state.currentPage < state.totalPages) {
            state.currentPage++;
            loadFinansKayitlari();
        }
    });

    // Tablo içi Düzenle ve Sil Butonları (Event Delegation)
    tableBody.addEventListener('click', async (e) => {
        const target = e.target;

        // Düzenle Butonu
        const editButton = target.closest('.js-edit-finans-btn');
        if (editButton) {
            e.preventDefault();
            const kayitId = editButton.dataset.id;
            // Düzenleme fonksiyonunu islem_yonetimi.js'den çağır
            if (typeof window.editOdemeKaydi === 'function') {
                window.editOdemeKaydi(kayitId);
            }
        }

        // Sil Butonu
        const deleteButton = target.closest('.js-delete-finans-btn');
        if (deleteButton) {
            e.preventDefault();
            const kayitId = deleteButton.dataset.id;
            if (confirm('Bu finans kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
                try {
                    const response = await apiCall(`/api/finans/${kayitId}`, 'DELETE');
                    showToast(response.mesaj, 'success');
                    loadFinansKayitlari(); // Listeyi yenile
                } catch (error) {
                    showToast(`Hata: ${error.message}`, 'error');
                }
            }
        }
    });

    // Sayfa ilk yüklendiğinde kayıtları çek
    loadFinansKayitlari();
    
    // Global yenileme fonksiyonu (islem_yonetimi.js tarafından kullanılır)
    window.loadFinansKayitlari = loadFinansKayitlari;
});