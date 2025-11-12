// Bu script, profil.html sayfasının mantığını yönetir.
// (Şifre değiştirme ve anlık bildirim aboneliği)
document.addEventListener('DOMContentLoaded', () => {

    // --- Şifre Değiştirme ---
    const passwordForm = document.getElementById('update-password-form');
    
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newPassword = document.getElementById('new_password').value;
            const confirmPassword = document.getElementById('confirm_password').value;

            if (newPassword.length < 6) {
                showToast('Yeni şifre en az 6 karakter olmalıdır.', 'error');
                return;
            }

            if (newPassword !== confirmPassword) {
                showToast('Şifreler uyuşmuyor.', 'error');
                return;
            }

            try {
                const response = await apiCall('/api/profil/sifre-guncelle', 'POST', {
                    new_password: newPassword
                });
                showToast(response.mesaj, 'success');
                passwordForm.reset();
            } catch (error) {
                showToast(`Hata: ${error.message}`, 'error');
            }
        });
    }

    // --- Anlık Bildirim ---
    // 'push-manager.js' bu butonları ve 'push-status' p etiketini
    // zaten dinliyor ve yönetiyor. Bu yüzden burada ekstra bir şey
    // yapmamıza gerek yok, o dosya 'profil.html'e dahil edildiği
    // için otomatik olarak çalışacaktır.
    
    // (push-manager.js yüklendiğinden emin olmak için bir kontrol eklenebilir)
    if (typeof window.PushManager === 'undefined') {
        console.warn('push-manager.js yüklenemedi veya bulunamadı.');
        const pushStatus = document.getElementById('push-status');
        if (pushStatus) {
            pushStatus.textContent = 'Bildirim modülü yüklenemedi.';
            pushStatus.className = 'text-sm mt-2 text-red-500';
        }
    }
});