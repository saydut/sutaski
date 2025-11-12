// Bu dosya, base.html içindeki genel UI elemanlarını (navbar, sidebar) yönetir.
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Kullanıcı Menüsü (Sağ Üst Köşe) ---
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userMenuDropdown = document.getElementById('user-menu-dropdown');
    
    if (userMenuBtn && userMenuDropdown) {
        userMenuBtn.addEventListener('click', () => {
            userMenuDropdown.classList.toggle('hidden');
        });
        
        // Dışarıya tıklandığında kullanıcı menüsünü kapat
        document.addEventListener('click', (event) => {
            if (!userMenuBtn.contains(event.target) && !userMenuDropdown.classList.contains('hidden')) {
                userMenuDropdown.classList.add('hidden');
            }
        });
    }

    // --- 2. Mobil Sidebar (Soldan Açılan) ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('aside');
    
    if (mobileMenuBtn && sidebar) {
        // Mobil menü açıldığında arkaplanı karartmak için bir backdrop oluşturalım
        let backdrop = document.createElement('div');
        backdrop.className = 'fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden hidden';
        document.body.appendChild(backdrop);
        
        const toggleMobileMenu = () => {
            // Sidebar'ı 'hidden' (gizli) durumundan çıkarıp 'fixed' (sabit) hale getir
            sidebar.classList.toggle('hidden'); 
            sidebar.classList.toggle('fixed');
            sidebar.classList.toggle('inset-y-0');
            sidebar.classList.toggle('left-0');
            sidebar.classList.toggle('z-40');
            
            // Arkaplanı (backdrop) göster/gizle
            backdrop.classList.toggle('hidden');
        }
        
        mobileMenuBtn.addEventListener('click', toggleMobileMenu);
        backdrop.addEventListener('click', toggleMobileMenu); // Arkaplana tıklayınca da kapat
    }

    // --- 3. Hızlı İşlem Modallarını Tetikleme ---
    // (Masaüstü Header'daki ve Mobil Alt Bar'daki '+' butonu)
    const quickActionsBtn = document.getElementById('quick-actions-btn');
    const mobileQuickActionsBtn = document.getElementById('mobile-quick-actions-btn');
    
    // Hızlı İşlem menüsünü açan fonksiyon
    const openQuickActions = (e) => {
        e.preventDefault();
        if(window.openModal) {
            window.openModal('hizli-islemler-modal');
        }
    };

    if (quickActionsBtn) quickActionsBtn.addEventListener('click', openQuickActions);
    if (mobileQuickActionsBtn) mobileQuickActionsBtn.addEventListener('click', openQuickActions);
    
    // Hızlı İşlem *içindeki* menü butonları (Süt, Yem, Ödeme)
    // Bu butonlar ana menüyü kapatıp ilgili modalı açmalı.
    const openSutModalBtn = document.getElementById('open-hizli-sut-ekle-modal-btn');
    const openYemModalBtn = document.getElementById('open-hizli-yem-ekle-modal-btn');
    const openOdemeModalBtn = document.getElementById('open-hizli-odeme-ekle-modal-btn');

    if (openSutModalBtn) {
        openSutModalBtn.addEventListener('click', () => {
            window.closeModal('hizli-islemler-modal');
            // Modalların çakışmaması için küçük bir gecikme ekliyoruz
            setTimeout(() => window.openModal('hizli-sut-ekle-modal'), 350);
        });
    }
    if (openYemModalBtn) {
        openYemModalBtn.addEventListener('click', () => {
            window.closeModal('hizli-islemler-modal');
            setTimeout(() => window.openModal('hizli-yem-ekle-modal'), 350);
        });
    }
    if (openOdemeModalBtn) {
        openOdemeModalBtn.addEventListener('click', () => {
            window.closeModal('hizli-islemler-modal');
            setTimeout(() => window.openModal('hizli-odeme-ekle-modal'), 350);
        });
    }
});