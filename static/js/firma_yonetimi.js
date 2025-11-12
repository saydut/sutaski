// Bu script, _firma_modals.html içindeki Tedarikçi Ekleme ve Düzenleme modallarının
// tüm mantığını yönetir. 
// Hem tedarikciler.html hem de tedarikci_detay.html tarafından kullanılır.
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. YENİ TEDARİKÇİ EKLEME ---
    
    const addSupplierModalBtn = document.getElementById('open-add-supplier-modal-btn');
    const addSupplierForm = document.getElementById('add-supplier-form');

    // "Yeni Tedarikçi Ekle" butonuna basınca modalı aç
    if (addSupplierModalBtn) {
        addSupplierModalBtn.addEventListener('click', () => {
            addSupplierForm.reset(); // Formu temizle
            window.openModal('add-supplier-modal');
        });
    }

    // Yeni tedarikçi formunu gönderme
    if (addSupplierForm) {
        addSupplierForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addSupplierForm);
            const body = Object.fromEntries(formData.entries());

            try {
                const response = await apiCall('/api/tedarikciler', 'POST', body);
                showToast(response.mesaj || 'Tedarikçi başarıyla eklendi.', 'success');
                window.closeModal('add-supplier-modal');
                
                // Eğer tedarikciler.js yüklüyse (liste sayfasındaysak) tabloyu yenile
                if (typeof window.loadSuppliers === 'function') {
                    window.loadSuppliers();
                }
            } catch (error) {
                showToast(`Hata: ${error.message}`, 'error');
            }
        });
    }

    // --- 2. TEDARİKÇİ DÜZENLEME ---

    const editSupplierForm = document.getElementById('edit-supplier-form');
    const supplierIdInput = document.getElementById('edit-supplier-id');
    
    // "Çiftçi Panel Erişimi" bölümü elementleri
    const panelLoading = document.getElementById('ciftci-panel-loading');
    const panelYok = document.getElementById('ciftci-panel-yok');
    const panelVar = document.getElementById('ciftci-panel-var');
    const panelMevcutEmail = document.getElementById('ciftci-mevcut-email');
    const panelErisimKaldirBtn = document.getElementById('ciftci-erisim-kaldir-btn');

    /**
     * Düzenleme modalını açar ve verilerle doldurur
     * @param {string} supplierId - Düzenlenecek tedarikçinin ID'si
     */
    const openEditModal = async (supplierId) => {
        editSupplierForm.reset();
        panelLoading.style.display = 'block';
        panelYok.style.display = 'none';
        panelVar.style.display = 'none';
        window.openModal('edit-supplier-modal');

        try {
            const data = await apiCall(`/api/tedarikci/${supplierId}`);
            
            // Formu doldur
            supplierIdInput.value = supplierId;
            document.getElementById('edit-tedarikci-kodu').value = data.tedarikci_kodu;
            document.getElementById('edit-ad-soyad').value = data.ad_soyad;
            document.getElementById('edit-tc-kimlik').value = data.tc_kimlik || '';
            document.getElementById('edit-telefon').value = data.telefon || '';
            document.getElementById('edit-adres').value = data.adres || '';
            document.getElementById('edit-durum').value = data.durum;

            // Çiftçi Panel Erişimini ayarla
            if (data.kullanici_bilgisi) {
                panelMevcutEmail.value = data.kullanici_bilgisi.email;
                panelVar.style.display = 'block';
            } else {
                panelYok.style.display = 'block';
            }

        } catch (error) {
            showToast(`Tedarikçi bilgileri alınamadı: ${error.message}`, 'error');
            window.closeModal('edit-supplier-modal');
        } finally {
            panelLoading.style.display = 'none';
        }
    };

    // Düzenleme formunu gönderme
    if (editSupplierForm) {
        editSupplierForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(editSupplierForm);
            const body = Object.fromEntries(formData.entries());
            const supplierId = body.supplier_id;

            // Şifre boşsa, 'undefined' yolla ki backend bunu "değiştirme" olarak anlasın
            if (body.ciftci_password === '') {
                delete body.ciftci_password; 
            }
            
            try {
                const response = await apiCall(`/api/tedarikci/${supplierId}`, 'PUT', body);
                showToast(response.mesaj || 'Tedarikçi bilgileri güncellendi.', 'success');
                window.closeModal('edit-supplier-modal');

                // Verileri yenile (hangi sayfada olduğumuza bağlı olarak)
                if (typeof window.loadSuppliers === 'function') {
                    window.loadSuppliers(); // Liste sayfasındayız
                }
                if (typeof window.loadSupplierDetails === 'function') {
                    window.loadSupplierDetails(supplierId); // Detay sayfasındayız
                }
            } catch (error)
            {
                showToast(`Hata: ${error.message}`, 'error');
            }
        });
    }
    
    // Panel Erişimini Kaldır Butonu
    panelErisimKaldirBtn.addEventListener('click', async () => {
        if (!confirm('Çiftçi panel erişimini kaldırmak istediğinizden emin misiniz? Bu işlem kullanıcıyı silmez, sadece tedarikçi ile bağlantısını koparır.')) {
            return;
        }
        
        const supplierId = supplierIdInput.value;
        try {
            await apiCall(`/api/tedarikci/${supplierId}/unlink-user`, 'POST');
            showToast('Panel erişimi başarıyla kaldırıldı.', 'success');
            // Modalı yeniden doldurmak için tekrar aç
            await openEditModal(supplierId);
        } catch (error) {
             showToast(`Hata: ${error.message}`, 'error');
        }
    });

    // --- 3. DÜZENLEME MODALINI AÇAN TETİKLEYİCİLER ---

    // a) Tedarikçi Detay sayfasındaki ana buton:
    const detailPageEditBtn = document.getElementById('open-edit-supplier-modal-btn');
    if (detailPageEditBtn) {
        detailPageEditBtn.addEventListener('click', () => {
            openEditModal(detailPageEditBtn.dataset.supplierId);
        });
    }

    // b) Tedarikçi Listesi sayfasındaki tablo içi butonlar (Event Delegation):
    const supplierTableBody = document.getElementById('supplier-table-body');
    if (supplierTableBody) {
        supplierTableBody.addEventListener('click', (e) => {
            // Tıklanan element veya onun parent'ı 'js-edit-supplier-btn' sınıfına sahip mi?
            const editButton = e.target.closest('.js-edit-supplier-btn');
            if (editButton) {
                e.preventDefault();
                openEditModal(editButton.dataset.id);
            }
        });
    }
});