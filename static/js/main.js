// ====================================================================================
// ANA UYGULAMA MANTIĞI (main.js) - RLS/AUTH GÜNCELLENDİ
// Ana panelin genel işleyişini, veri akışını ve ana olayları yönetir.
// ====================================================================================

// --- Global Değişkenler ---
window.anaPanelMevcutGorunum = localStorage.getItem('anaPanelGorunum') || 'liste';
window.anaPanelMevcutSayfa = 1;
const girdilerSayfaBasi = 6;
let mevcutTedarikciIstatistikleri = null;
let kullaniciRolu = null; // initUserRole içinde ayarlanır

/**
 * Kullanıcının rolünü HTML body'deki 'data-user-role' attribute'undan okur.
 * Bu 'data-user-role' attribute'u, 'base.html' içinde Python (app.py context_processor)
 * tarafından 'user_profile.rol' kullanılarak ayarlanmalıdır.
 */
function initUserRole() {
    // Bu fonksiyon global `kullaniciRolu` değişkenini set eder.
    kullaniciRolu = document.body.dataset.userRole || null; 
    
    if (!kullaniciRolu) {
        console.warn("Kullanıcı rolü 'data-user-role' attribute'unda bulunamadı. (Giriş yapılmamış olabilir)");
        // Eğer 'login' sayfasında değilsek, bir sorun olabilir
        if (!window.location.pathname.endsWith('/login') && !window.location.pathname.endsWith('/register')) {
             // window.location.href = '/login'; // Token geçersizse @login_required zaten yönlendirir.
        }
    }
    // Eski 'localStorage.getItem('offlineUser')' mantığı
    // yeni Auth (cookie tabanlı) sisteminde tamamen kaldırıldı.
}

/**
 * Ana paneldeki (index.html) Süt Girdileri listesi ve Kart görünümü
 * arasındaki geçişi yönetir.
 */
function anaPanelGorunumuAyarla(aktifGorunum) {
    localStorage.setItem('anaPanelGorunum', aktifGorunum);
    window.anaPanelMevcutGorunum = aktifGorunum;
    
    const listeDiv = document.getElementById('sut-girdi-listesi');
    const kartDiv = document.getElementById('sut-girdi-kartlari');
    const listeBtn = document.getElementById('btn-view-list');
    const kartBtn = document.getElementById('btn-view-card');
    
    if (aktifGorunum === 'liste') {
        if(listeDiv) listeDiv.style.display = 'block';
        if(kartDiv) kartDiv.style.display = 'none';
        if(listeBtn) listeBtn.classList.add('active');
        if(kartBtn) kartBtn.classList.remove('active');
    } else {
        if(listeDiv) listeDiv.style.display = 'none';
        if(kartDiv) kartDiv.style.display = 'block';
        if(listeBtn) listeBtn.classList.remove('active');
        if(kartBtn) kartBtn.classList.add('active');
    }
}

/**
 * Service Worker'ı başlatır ve güncelleme olaylarını dinler.
 */
async function initializeSW() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker kaydedildi:', registration);
            
            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                console.log('Yeni Service Worker aktifleşti. Sayfa yenileniyor...');
                // gosterMesaj 'ui.js' içinde tanımlı olmalı
                if(typeof gosterMesaj === 'function') {
                    gosterMesaj('Uygulama güncellendi, sayfa yenileniyor...', 'info', 3000);
                }
                refreshing = true;
                window.location.reload(true); // Önbelleği zorla
            });

            if (registration.active) {
                console.log('Mevcut Service Worker için güncelleme kontrol ediliyor...');
                registration.update();
            }
        } catch (error) {
            console.error('Service Worker başlatılırken veya güncellenirken hata:', error);
        }
    } else {
        console.warn('Service Worker bu tarayıcıda desteklenmiyor.');
    }
}

// Global scope'da olması gereken fonksiyonlar (HTML'den çağrılanlar)
window.anaPanelGorunumuAyarla = anaPanelGorunumuAyarla;

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
    initUserRole();
    
    // Eğer ana paneldeysek (index.html), görünümü ayarla
    if (window.location.pathname === '/panel' || window.location.pathname === '/') {
        if(document.getElementById('sut-girdi-listesi')) {
             anaPanelGorunumuAyarla(window.anaPanelMevcutGorunum);
        }
    }
    
    // Service Worker'ı başlat
    initializeSW();
});