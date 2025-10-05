// static/js/subscription.js

// URL safe base64 decode/encode fonksiyonu
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

// Abone olma işlemini başlatan ana fonksiyon
async function subscribeUser() {
    try {
        const registration = await navigator.serviceWorker.ready;
        // VAPID_PUBLIC_KEY değişkeni base.html'den geliyor
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        // Abonelik bilgisini YENİ endpoint'e gönder
        await fetch('/api/subscription/save', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: { 'Content-Type': 'application/json' }
        });

        gosterMesaj('Bildirimlere başarıyla abone oldunuz!', 'success');
        document.getElementById('subscribe-button').style.display = 'none';

    } catch (error) {
        console.error('Abonelik sırasında hata:', error);
        gosterMesaj('Bildirimlere abone olunamadı. Tarayıcı ayarlarını kontrol edin.', 'danger');
    }
}

// Bildirim ve abonelik durumunu yöneten ana fonksiyon
async function initializePushNotifications() {
    const subscribeButton = document.getElementById('subscribe-button');
    if (!subscribeButton) {
        console.error('Abone ol butonu HTML içinde bulunamadı.');
        return;
    }

    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
        console.warn('Bu tarayıcı anlık bildirimleri desteklemiyor.');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();
        const permission = await Notification.requestPermission();

        if (existingSubscription) {
            console.log('Kullanıcı zaten abone.');
            // Abone butonu gizli kalsın
            subscribeButton.style.display = 'none';
        } else {
            if (permission === 'granted') {
                console.log('İzin verilmiş ama abonelik yok. Yeni abonelik oluşturuluyor...');
                await subscribeUser();
            } else if (permission === 'default') {
                console.log('Bildirim izni henüz verilmemiş. Buton gösteriliyor.');
                subscribeButton.style.display = 'block';
                subscribeButton.onclick = async () => {
                    const newPermission = await Notification.requestPermission();
                    if (newPermission === 'granted') {
                        await subscribeUser();
                    }
                };
            } else {
                console.log('Bildirimler kullanıcı tarafından engellenmiş.');
                subscribeButton.style.display = 'none';
            }
        }
    } catch (error) {
        console.error("Push notification başlatılırken hata:", error);
    }
}