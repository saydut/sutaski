document.addEventListener('DOMContentLoaded', () => {
    // Tema değiştirme düğmesine olay dinleyicisi ekler
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            // Animasyon için class ekle
            themeToggle.classList.add('rotating');

            const currentTheme = document.documentElement.getAttribute('data-theme');
            setTheme(currentTheme === 'dark' ? 'light' : 'dark');
            
            // Animasyon bittikten sonra class'ı kaldır ki tekrar tetiklenebilsin
            themeToggle.addEventListener('transitionend', () => {
                themeToggle.classList.remove('rotating');
            }, { once: true });
        });
    }

    // Sayfa yüklendiğinde temayı uygular
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
        setTheme(storedTheme);
    } else {
        setTheme('light');
    }
});

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const sunIcon = document.getElementById('sun-icon');
    const moonIcon = document.getElementById('moon-icon');

    if (sunIcon && moonIcon) {
        if (theme === 'dark') {
            sunIcon.style.display = 'inline-block';
            moonIcon.style.display = 'none';
        } else {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'inline-block';
        }
    }
    
    // DEĞİŞİKLİK: Merkezi grafik yöneticisini çağırır
    if (typeof updateAllChartThemes === 'function') {
        updateAllChartThemes();
    }
}
