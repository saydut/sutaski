// Bu script, firma_yonetimi.html sayfasındaki (çalışan/admin)
// kullanıcı listesini yönetir.
// DİKKAT: Bu dosya 'firma_yonetimi.js' DEĞİLDİR.
// 'firma_yonetimi.js' tedarikçi modalları içindir.
document.addEventListener('DOMContentLoaded', () => {

    // DOM Elementleri
    const tableBody = document.getElementById('user-table-body');
    const addUserModalBtn = document.getElementById('open-add-user-modal-btn');
    const addUserForm = document.getElementById('add-user-form');
    const editUserForm = document.getElementById('edit-user-form');

    /**
     * Kullanıcıları API'den çeker ve tabloyu doldurur
     */
    const loadUsers = async () => {
        tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center"><i class="fas fa-spinner fa-spin mr-2"></i> Yükleniyor...</td></tr>`;
        try {
            const data = await apiCall('/api/kullanicilar');
            renderUserTable(data.kullanicilar);
        } catch (error) {
            showToast(`Kullanıcılar yüklenemedi: ${error.message}`, 'error');
            tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Veri yüklenemedi.</td></tr>`;
        }
    };

    /**
     * Kullanıcı listesini HTML tabloya dönüştürür
     */
    const renderUserTable = (users) => {
        tableBody.innerHTML = '';
        if (!users || users.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center">Firma kullanıcısı bulunamadı.</td></tr>`;
            return;
        }

        users.forEach(user => {
            // 'ciftci' rolünü bu listede göstermiyoruz, onlar tedarikçi detayında
            if (user.rol === 'ciftci') return; 
            
            const durumClass = user.durum === 'aktif' ? 'status-active' : 'status-inactive';
            const row = `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td class="table-cell font-medium">${user.kullanici_adi}</td>
                    <td class="table-cell">${user.eposta}</td>
                    <td class="table-cell">${user.rol}</td>
                    <td class="table-cell"><span class="${durumClass}">${user.durum}</span></td>
                    <td class="table-cell">
                        <button class="btn-warning-sm js-edit-user-btn" data-id="${user.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-danger-sm js-delete-user-btn" data-id="${user.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    };

    // --- Event Listeners ---

    // Yeni Kullanıcı Ekle Modalını Aç
    addUserModalBtn.addEventListener('click', () => {
        addUserForm.reset();
        window.openModal('add-user-modal');
    });

    // Yeni Kullanıcı Ekle Formu Gönderme
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(addUserForm);
        const body = Object.fromEntries(formData.entries());

        try {
            const response = await apiCall('/api/kullanicilar', 'POST', body);
            showToast(response.mesaj, 'success');
            window.closeModal('add-user-modal');
            loadUsers(); // Listeyi yenile
        } catch (error) {
            showToast(`Hata: ${error.message}`, 'error');
        }
    });

    // Kullanıcı Düzenleme Formu Gönderme
    editUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(editUserForm);
        const body = Object.fromEntries(formData.entries());
        const userId = body.user_id;

        // Şifre boşsa, backend'e "null" veya "undefined" gitsin
        if (body.password === '') {
            delete body.password;
        }

        try {
            const response = await apiCall(`/api/kullanici/${userId}`, 'PUT', body);
            showToast(response.mesaj, 'success');
            window.closeModal('edit-user-modal');
            loadUsers(); // Listeyi yenile
        } catch (error) {
            showToast(`Hata: ${error.message}`, 'error');
        }
    });

    // Tablo içi butonlar (Düzenle ve Sil)
    tableBody.addEventListener('click', async (e) => {
        const target = e.target;

        // Düzenle Butonu
        const editButton = target.closest('.js-edit-user-btn');
        if (editButton) {
            e.preventDefault();
            const userId = editButton.dataset.id;
            try {
                // Kullanıcı verisini çek ve modalı doldur
                const user = await apiCall(`/api/kullanici/${userId}`);
                document.getElementById('edit-user-id').value = user.id;
                document.getElementById('edit-kullanici_adi').value = user.kullanici_adi;
                document.getElementById('edit-email').value = user.eposta;
                document.getElementById('edit-rol').value = user.rol;
                document.getElementById('edit-durum').value = user.durum;
                document.getElementById('edit-reset-password').value = ''; // Şifre alanını temizle
                
                window.openModal('edit-user-modal');
            } catch (error) {
                showToast(`Kullanıcı bilgisi alınamadı: ${error.message}`, 'error');
            }
        }

        // Sil Butonu
        const deleteButton = target.closest('.js-delete-user-btn');
        if (deleteButton) {
            e.preventDefault();
            const userId = deleteButton.dataset.id;
            if (confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
                try {
                    const response = await apiCall(`/api/kullanici/${userId}`, 'DELETE');
                    showToast(response.mesaj, 'success');
                    loadUsers(); // Listeyi yenile
                } catch (error) {
                    showToast(`Hata: ${error.message}`, 'error');
                }
            }
        }
    });

    // Sayfa yüklendiğinde kullanıcıları çek
    loadUsers();
});