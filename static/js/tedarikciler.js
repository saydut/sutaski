// Bu script, tedarikciler.html sayfasının mantığını yönetir.
document.addEventListener('DOMContentLoaded', () => {
    
    // Sayfa durumu (State)
    let currentPage = 1;
    let currentSearch = '';
    let currentStatus = 'aktif'; // Varsayılan olarak aktifleri getir
    let totalPages = 1;
    let debounceTimer;

    // DOM Elementleri
    const tableBody = document.getElementById('supplier-table-body');
    const searchInput = document.getElementById('search-supplier');
    const statusFilter = document.getElementById('filter-supplier-status');
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');
    const paginationInfo = document.getElementById('pagination-info');

    /**
     * API'den tedarikçileri çeker ve tabloyu günceller.
     */
    const loadSuppliers = async () => {
        // Yükleniyor durumunu göster
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="p-4 text-center">
                    <i class="fas fa-spinner fa-spin mr-2"></i> Tedarikçiler yükleniyor...
                </td>
            </tr>
        `;
        
        try {
            const endpoint = `/api/tedarikciler?page=${currentPage}&search=${currentSearch}&status=${currentStatus}`;
            const data = await apiCall(endpoint);
            
            renderSupplierTable(data.tedarikciler);
            updatePagination(data.pagination);
            
        } catch (error) {
            showToast(`Tedarikçiler yüklenemedi: ${error.message}`, 'error');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="p-4 text-center text-red-500">
                        Veri yüklenemedi. Lütfen sayfayı yenileyin.
                    </td>
                </tr>
            `;
        }
    };

    /**
     * Gelen tedarikçi listesini HTML tabloya dönüştürür.
     */
    const renderSupplierTable = (suppliers) => {
        tableBody.innerHTML = ''; // Tabloyu temizle

        if (suppliers.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="p-4 text-center">
                        Aradığınız kriterlere uygun tedarikçi bulunamadı.
                    </td>
                </tr>
            `;
            return;
        }

        suppliers.forEach(supplier => {
            const bakiyeClass = supplier.bakiye > 0 ? 'text-green-500' : (supplier.bakiye < 0 ? 'text-red-500' : '');
            const durumClass = supplier.durum === 'aktif' ? 'status-active' : 'status-inactive';

            const row = `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${supplier.tedarikci_kodu}</td>
                    <td class="table-cell font-medium">${supplier.ad_soyad}</td>
                    <td class="table-cell">${supplier.telefon || '-'}</td>
                    <td class="table-cell font-semibold ${bakiyeClass}">${formatCurrency(supplier.bakiye)}</td>
                    <td class="table-cell">
                        <span class="${durumClass}">${supplier.durum}</span>
                    </td>
                    <td class="table-cell">
                        <a href="/tedarikci/${supplier.id}" class="btn-secondary-sm">
                            <i class="fas fa-eye"></i>
                        </a>
                        <!-- 
                            Bu buton firma_yonetimi.js tarafından dinlenir. 
                            Oradaki 'js-edit-supplier-btn' sınıfını kullanıyoruz.
                        -->
                        <button class="btn-warning-sm js-edit-supplier-btn" data-id="${supplier.id}">
                            <i class="fas fa-edit"></i>
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
        currentPage = pagination.page;
        totalPages = pagination.total_pages;
        paginationInfo.textContent = `Sayfa ${currentPage} / ${totalPages} (${pagination.total_items} kayıt)`;

        prevPageBtn.disabled = !pagination.has_prev;
        nextPageBtn.disabled = !pagination.has_next;
    };

    // --- Event Listeners ---

    // Arama için Debounce (kullanıcı yazmayı bıraktıktan 500ms sonra arar)
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearch = searchInput.value;
            currentPage = 1; // Arama yapınca ilk sayfaya dön
            loadSuppliers();
        }, 500);
    });

    // Durum filtresi değiştiğinde
    statusFilter.addEventListener('change', () => {
        currentStatus = statusFilter.value;
        currentPage = 1; // Filtre değişince ilk sayfaya dön
        loadSuppliers();
    });
    
    // Varsayılan filtreyi 'aktif' olarak ayarla
    statusFilter.value = 'aktif';

    // Önceki sayfa
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadSuppliers();
        }
    });

    // Sonraki sayfa
    nextPageBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadSuppliers();
        }
    });

    // Sayfa ilk yüklendiğinde tedarikçileri çek
    loadSuppliers();

    // Diğer sayfalardan (örn: modal'dan) bu fonksiyonu tetiklemek için global yap
    window.loadSuppliers = loadSuppliers; 
});