// Bu script, tarife_yonetimi.html sayfasının mantığını yönetir.
document.addEventListener('DOMContentLoaded', () => {

    // --- Süt Tarifesi DOM Elementleri ---
    const sutTableBody = document.getElementById('sut-tarife-table-body');
    const openSutModalBtn = document.getElementById('open-add-sut-tarife-modal-btn');
    const sutModal = document.getElementById('sut-tarife-modal');
    const sutModalTitle = document.getElementById('sut-tarife-modal-title');
    const sutForm = document.getElementById('sut-tarife-form');
    const sutTarifeIdInput = document.getElementById('sut-tarife-id');

    // --- Yem Tarifesi DOM Elementleri ---
    const yemTableBody = document.getElementById('yem-tarife-table-body');
    const openYemModalBtn = document.getElementById('open-add-yem-tarife-modal-btn');
    const yemModal = document.getElementById('yem-tarife-modal');
    const yemModalTitle = document.getElementById('yem-tarife-modal-title');
    const yemForm = document.getElementById('yem-tarife-form');
    const yemTarifeIdInput = document.getElementById('yem-tarife-id');

    // --- SÜT İŞLEMLERİ ---

    const loadSutTarifeleri = async () => {
        sutTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">Yükleniyor...</td></tr>`;
        try {
            const data = await apiCall('/api/tarifeler/sut');
            renderSutTable(data.tarifeler);
        } catch (error) {
            showToast(`Süt tarifeleri yüklenemedi: ${error.message}`, 'error');
        }
    };

    const renderSutTable = (tarifeler) => {
        sutTableBody.innerHTML = '';
        if (!tarifeler || tarifeler.length === 0) {
            sutTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">Kayıt bulunamadı.</td></tr>`;
            return;
        }
        tarifeler.forEach(t => {
            sutTableBody.innerHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${formatDate(t.baslangic_tarihi)}</td>
                    <td class="table-cell">${formatCurrency(t.alis_fiyati)}</td>
                    <td class="table-cell">${formatCurrency(t.satis_fiyati)}</td>
                    <td class="table-cell">
                        <button class="btn-warning-sm js-edit-sut-tarife" data-id="${t.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-danger-sm js-delete-sut-tarife" data-id="${t.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    };

    openSutModalBtn.addEventListener('click', () => {
        sutForm.reset();
        sutTarifeIdInput.value = '';
        sutModalTitle.textContent = 'Yeni Süt Tarifesi';
        window.openModal('sut-tarife-modal');
    });

    sutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(sutForm);
        const body = Object.fromEntries(formData.entries());
        
        const tarifeId = body.tarife_id;
        const method = tarifeId ? 'PUT' : 'POST';
        const endpoint = tarifeId ? `/api/tarife/sut/${tarifeId}` : '/api/tarifeler/sut';

        try {
            const response = await apiCall(endpoint, method, body);
            showToast(response.mesaj, 'success');
            window.closeModal('sut-tarife-modal');
            loadSutTarifeleri();
        } catch (error) {
            showToast(`Hata: ${error.message}`, 'error');
        }
    });

    sutTableBody.addEventListener('click', async (e) => {
        if (e.target.closest('.js-edit-sut-tarife')) {
            const btn = e.target.closest('.js-edit-sut-tarife');
            const tarifeId = btn.dataset.id;
            try {
                const tarife = await apiCall(`/api/tarife/sut/${tarifeId}`);
                sutTarifeIdInput.value = tarife.id;
                document.getElementById('sut-baslangic-tarihi').value = tarife.baslangic_tarihi.split('T')[0];
                document.getElementById('sut-alis-fiyati').value = tarife.alis_fiyati;
                document.getElementById('sut-satis-fiyati').value = tarife.satis_fiyati;
                sutModalTitle.textContent = 'Süt Tarifesini Düzenle';
                window.openModal('sut-tarife-modal');
            } catch (error) { showToast(`Tarife yüklenemedi: ${error.message}`, 'error'); }
        }
        if (e.target.closest('.js-delete-sut-tarife')) {
            const btn = e.target.closest('.js-delete-sut-tarife');
            if (confirm('Bu süt tarifesini silmek istediğinizden emin misiniz?')) {
                try {
                    await apiCall(`/api/tarife/sut/${btn.dataset.id}`, 'DELETE');
                    showToast('Süt tarifesi silindi.', 'success');
                    loadSutTarifeleri();
                } catch (error) { showToast(`Hata: ${error.message}`, 'error'); }
            }
        }
    });

    // --- YEM İŞLEMLERİ ---

    const loadYemTarifeleri = async () => {
        yemTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">Yükleniyor...</td></tr>`;
        try {
            const data = await apiCall('/api/tarifeler/yem');
            renderYemTable(data.tarifeler);
        } catch (error) {
            showToast(`Yem tarifeleri yüklenemedi: ${error.message}`, 'error');
        }
    };

    const renderYemTable = (tarifeler) => {
        yemTableBody.innerHTML = '';
        if (!tarifeler || tarifeler.length === 0) {
            yemTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">Kayıt bulunamadı.</td></tr>`;
            return;
        }
        tarifeler.forEach(t => {
            yemTableBody.innerHTML += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell">${t.yem_tipi}</td>
                    <td class="table-cell">${formatCurrency(t.alis_fiyati)}</td>
                    <td class="table-cell">${formatCurrency(t.satis_fiyati)}</td>
                    <td class="table-cell">
                        <button class="btn-warning-sm js-edit-yem-tarife" data-id="${t.id}"><i class="fas fa-edit"></i></button>
                        <button class="btn-danger-sm js-delete-yem-tarife" data-id="${t.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });
    };

    openYemModalBtn.addEventListener('click', () => {
        yemForm.reset();
        yemTarifeIdInput.value = '';
        yemModalTitle.textContent = 'Yeni Yem Tarifesi';
        window.openModal('yem-tarife-modal');
    });

    yemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(yemForm);
        const body = Object.fromEntries(formData.entries());
        
        const tarifeId = body.tarife_id;
        const method = tarifeId ? 'PUT' : 'POST';
        const endpoint = tarifeId ? `/api/tarife/yem/${tarifeId}` : '/api/tarifeler/yem';

        try {
            const response = await apiCall(endpoint, method, body);
            showToast(response.mesaj, 'success');
            window.closeModal('yem-tarife-modal');
            loadYemTarifeleri();
        } catch (error) {
            showToast(`Hata: ${error.message}`, 'error');
        }
    });

    yemTableBody.addEventListener('click', async (e) => {
        if (e.target.closest('.js-edit-yem-tarife')) {
            const btn = e.target.closest('.js-edit-yem-tarife');
            const tarifeId = btn.dataset.id;
            try {
                const tarife = await apiCall(`/api/tarife/yem/${tarifeId}`);
                yemTarifeIdInput.value = tarife.id;
                document.getElementById('yem-tipi').value = tarife.yem_tipi;
                document.getElementById('yem-alis-fiyati').value = tarife.alis_fiyati;
                document.getElementById('yem-satis-fiyati').value = tarife.satis_fiyati;
                yemModalTitle.textContent = 'Yem Tarifesini Düzenle';
                window.openModal('yem-tarife-modal');
            } catch (error) { showToast(`Tarife yüklenemedi: ${error.message}`, 'error'); }
        }
        if (e.target.closest('.js-delete-yem-tarife')) {
            const btn = e.target.closest('.js-delete-yem-tarife');
            if (confirm('Bu yem tarifesini silmek istediğinizden emin misiniz?')) {
                try {
                    await apiCall(`/api/tarife/yem/${btn.dataset.id}`, 'DELETE');
                    showToast('Yem tarifesi silindi.', 'success');
                    loadYemTarifeleri();
                } catch (error) { showToast(`Hata: ${error.message}`, 'error'); }
            }
        }
    });


    // Sayfa Yüklendiğinde
    loadSutTarifeleri();
    loadYemTarifeleri();
});