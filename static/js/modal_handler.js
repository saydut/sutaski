/**
 * Belirtilen ID'ye sahip modal'ı açar.
 * Diğer JS dosyaları (örn: tedarikciler.js) bu fonksiyonu çağırır.
 * @param {string} modalId - Açılacak modal'ın ID'si (örn: 'add-supplier-modal')
 */
window.openModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex'); // 'flex' ile ortalamayı sağlıyoruz
        // CSS geçişi (transition) için opaklığı değiştir
        setTimeout(() => modal.classList.add('opacity-100'), 10); 
    }
};

/**
 * Belirtilen ID'ye sahip modal'ı kapatır.
 * @param {string} modalId - Kapatılacak modal'ın ID'si
 */
window.closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('opacity-100'); // Opaklığı kaldır
        // CSS animasyonu bittikten (300ms) sonra 'hidden' yap
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300); // Bu süre style.css'deki transition süresiyle aynı olmalı
    }
};

// Sayfa yüklendiğinde tüm "kapatma" butonlarına ve arkaplanlara dinleyici ekle
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Tüm 'X' butonları ve 'İptal' butonları için dinleyiciler
    // HTML'de bu butonlara 'data-modal-id="modal-adi"' eklemiştik
    document.querySelectorAll('[data-modal-id]').forEach(button => {
        const modalId = button.dataset.modalId;
        
        // Sadece 'kapatma' amaçlı butonlara bu özelliği ekle
        if (button.classList.contains('modal-close-btn') || 
            (button.tagName === 'BUTTON' && button.type === 'button' && button.classList.contains('btn-secondary'))) 
        {
             button.addEventListener('click', (e) => {
                e.preventDefault();
                window.closeModal(modalId);
            });
        }
    });

    // 2. Arkaplana (backdrop) tıklayınca kapatma
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            // Sadece arkaplanın kendisine tıklandıysa kapat (içeriğe değil)
            if (e.target === backdrop) {
                window.closeModal(backdrop.id);
            }
        });
    });
});