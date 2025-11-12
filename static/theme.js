// Bu script, Açık/Koyu Mod (Light/Dark Mode) geçişini yönetir.
// base.html ve ciftci_panel.html'e 'defer' ile dahil edilmiştir.

(function() {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    const htmlElement = document.documentElement; // <html> etiketi

    /**
     * Temayı ve ikonları günceller
     * @param {string} theme - 'dark' veya 'light'
     */
    function applyTheme(theme) {
        if (theme === 'dark') {
            htmlElement.classList.add('dark');
            htmlElement.dataset.theme = 'dark';
            if (sunIcon) sunIcon.classList.add('hidden');
            if (moonIcon) moonIcon.classList.remove('hidden');
            localStorage.setItem('theme', 'dark');
        } else {
            htmlElement.classList.remove('dark');
            htmlElement.dataset.theme = 'light';
            if (sunIcon) sunIcon.classList.remove('hidden');
            if (moonIcon) moonIcon.classList.add('hidden');
            localStorage.setItem('theme', 'light');
        }
    }

    /**
     * Sayfa yüklendiğinde kaydedilen veya varsayılan temayı uygular
     */
    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        const osPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        
        // 1. Öncelik: localStorage
        // 2. Öncelik: OS Ayarı
        // 3. Varsayılan: 'dark' (bizim tercihimiz)
        const currentTheme = savedTheme || osPreference || 'dark';
        
        applyTheme(currentTheme);
    }

    // Tema Değiştirme Butonu Dinleyicisi
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const newTheme = htmlElement.classList.contains('dark') ? 'light' : 'dark';
            applyTheme(newTheme);
        });
    }

    // Başlangıç teması
    initializeTheme();

})();