// Bu script, PWA anlık bildirim (Web Push) aboneliğini yönetir.
// profil.html sayfasına dahil edilmiştir.

(function() {
    let swRegistration = null; // Service Worker kaydı
    let isSubscribed = false;   // Abonelik durumu
    let vapidPublicKey = null;  // Sunucudan alınan VAPID key

    // DOM Elementleri
    const subscribeBtn = document.getElementById('push-subscribe-btn');
    const unsubscribeBtn = document.getElementById('push-unsubscribe-btn');
    const pushStatus = document.getElementById('push-status');

    /**
     * URL-safe base64 string'i Uint8Array'e dönüştürür
     */
    function urlB64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    /**
     * VAPID Public Key'i sunucudan alır
     */
    async function getVapidKey() {
        if (vapidPublicKey) return vapidPublicKey;
        try {
            const data = await apiCall('/api/push/vapid_key');
            vapidPublicKey = data.public_key;
            return vapidPublicKey;
        } catch (error) {
            showToast('Bildirim sunucusu anahtarı alınamadı.', 'error');
            throw error;
        }
    }

    /**
     * UI'ı abonelik durumuna göre günceller
     */
    function updateUI() {
        if (!subscribeBtn || !unsubscribeBtn || !pushStatus) return;

        if (Notification.permission === 'denied') {
            pushStatus.textContent = 'Bildirimlere izin vermeyi engellediniz.';
            subscribeBtn.classList.add('hidden');
            unsubscribeBtn.classList.add('hidden');
            return;
        }

        if (isSubscribed) {
            pushStatus.textContent = 'Bu cihazda anlık bildirimler aktif.';
            subscribeBtn.classList.add('hidden');
            unsubscribeBtn.classList.remove('hidden');
        } else {
            pushStatus.textContent = 'Anlık bildirimlere abone değilsiniz.';
            subscribeBtn.classList.remove('hidden');
            unsubscribeBtn.classList.add('hidden');
        }
    }

    /**
     * Mevcut aboneliği kontrol et
     */
    async function checkSubscription() {
        try {
            const subscription = await swRegistration.pushManager.getSubscription();
            isSubscribed = (subscription !== null);
            updateUI();
        } catch (error) {
            console.error('Abonelik kontrol hatası:', error);
        }
    }

    /**
     * Bildirimlere Abone Ol
     */
    async function subscribe() {
        if (!swRegistration) {
            showToast('Service worker bulunamadı.', 'error');
            return;
        }

        try {
            const key = await getVapidKey();
            const applicationServerKey = urlB64ToUint8Array(key);
            
            const subscription = await swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });
            
            // Aboneliği sunucuya gönder
            await apiCall('/api/push/subscribe', 'POST', subscription);
            
            showToast('Başarıyla abone oldunuz!', 'success');
            isSubscribed = true;
            updateUI();

        } catch (error) {
            if (Notification.permission === 'denied') {
                showToast('Bildirim izni engellendi.', 'error');
            } else {
                showToast('Abonelik başarısız oldu.', 'error');
            }
            console.error('Abonelik hatası:', error);
            updateUI();
        }
    }

    /**
     * Abonelikten Çık
     */
    async function unsubscribe() {
        if (!swRegistration) {
            showToast('Service worker bulunamadı.', 'error');
            return;
        }

        try {
            const subscription = await swRegistration.pushManager.getSubscription();
            if (subscription) {
                // Sunucudan aboneliği sil
                await apiCall('/api/push/unsubscribe', 'POST', { 
                    endpoint: subscription.endpoint 
                });
                
                // Cihazdan aboneliği kaldır
                await subscription.unsubscribe();
                
                showToast('Abonelikten çıktınız.', 'info');
                isSubscribed = false;
                updateUI();
            }
        } catch (error) {
            showToast('Abonelikten çıkma başarısız oldu.', 'error');
            console.error('Abonelikten çıkma hatası:', error);
            updateUI();
        }
    }

    // --- Başlangıç ---
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
            swRegistration = registration;
            
            // Butonları şimdi bağla
            if(subscribeBtn) subscribeBtn.addEventListener('click', subscribe);
            if(unsubscribeBtn) unsubscribeBtn.addEventListener('click', unsubscribe);

            // Mevcut durumu kontrol et
            checkSubscription();
        });
    } else {
        if(pushStatus) {
            pushStatus.textContent = 'Anlık bildirimler bu tarayıcıda desteklenmiyor.';
            pushStatus.className = 'text-sm mt-2 text-red-500';
        }
        if(subscribeBtn) subscribeBtn.classList.add('hidden');
        if(unsubscribeBtn) unsubscribeBtn.classList.add('hidden');
    }
    
    // Global'e ekle (opsiyonel, debug için)
    window.PushManager = {
        subscribe,
        unsubscribe
    };

})();