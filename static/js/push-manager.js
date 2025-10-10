// static/js/push-manager.js

// VAPID public key'i Base64'ten Uint8Array'e çeviren yardımcı fonksiyon
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

async function initializePushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push bildirimleri bu tarayıcıda desteklenmiyor.');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (subscription === null) {
            // Henüz abonelik yok, yeni bir tane oluştur
            console.log('Push aboneliği bulunamadı. Yeni abonelik oluşturuluyor...');
            
            // 1. Sunucudan VAPID public key'i al
            const response = await fetch('/api/push/vapid_public_key');
            const data = await response.json();
            const applicationServerKey = urlBase64ToUint8Array(data.public_key);

            // 2. Kullanıcı izniyle abonelik oluştur
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });

            // 3. Aboneliği sunucuya kaydet
            await fetch('/api/push/save_subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });

            gosterMesaj('Bildirimler için başarıyla abone olundu!', 'success');
        } else {
            console.log('Mevcut bir push aboneliği bulundu.');
        }

    } catch (error) {
        console.error('Push aboneliği sırasında hata:', error);
        gosterMesaj('Bildirimlere abone olunurken bir hata oluştu.', 'danger');
    }
}

function askForNotificationPermission() {
    Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
            console.log('Bildirim izni verildi.');
            initializePushNotifications();
        } else {
            console.warn('Bildirim izni verilmedi.');
            gosterMesaj('Bildirimlere izin vermediğiniz için bu özelliği kullanamazsınız.', 'warning');
        }
    });
}