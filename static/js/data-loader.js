/**
 * Veriyi yükler, belirtilen görünüme göre render eder ve sayfalama oluşturur.
 * Bu fonksiyon, projedeki tüm "listeleme" işlemleri için ortak olarak kullanılır.
 * @param {object} config - Yapılandırma objesi.
 * {
 * apiURL: string,            // Veri çekilecek API adresi
 * veriAnahtari: string,      // Gelen JSON'daki veri dizisinin adı (örn: 'urunler', 'islemler')
 * tabloBodyId: string,       // Tablo <tbody> elementinin ID'si
 * kartContainerId: string,   // Kartların render edileceği container div'in ID'si
 * veriYokId: string,         // Veri olmadığında gösterilecek elementin ID'si
 * sayfalamaId: string,       // Sayfalama navigasyonunun render edileceği nav elementinin ID'si
 * tabloRenderFn: function,   // Veriyi tablo satırı olarak işleyen fonksiyon
 * kartRenderFn: function,    // Veriyi kart olarak işleyen fonksiyon
 * yukleFn: function,         // Sayfa değiştirildiğinde çağrılacak ana yükleme fonksiyonu
 * sayfa: number,             // Mevcut sayfa numarası
 * kayitSayisi: number,       // Sayfa başına kayıt sayısı
 * mevcutGorunum: string      // 'tablo' veya 'kart'
 * }
 */
async function genelVeriYukleyici(config) {
    const tabloBody = document.getElementById(config.tabloBodyId);
    const kartContainer = document.getElementById(config.kartContainerId);
    const veriYok = document.getElementById(config.veriYokId);
    const sayfalamaNav = document.getElementById(config.sayfalamaId);

    // Çevrimdışı kontrolü
    if (!navigator.onLine) {
        if(veriYok) {
            veriYok.innerHTML = `<p class="text-warning">Bu verileri görüntülemek için internet bağlantısı gereklidir.</p>`;
            veriYok.style.display = 'block';
        }
        if(tabloBody) tabloBody.innerHTML = '';
        if(kartContainer) kartContainer.innerHTML = '';
        if(sayfalamaNav) sayfalamaNav.innerHTML = '';
        return;
    }

    // Yükleniyor animasyonları
    const spinnerHtml = `<tr><td colspan="10" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    const kartSpinnerHtml = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;
    
    if(tabloBody && config.mevcutGorunum === 'tablo') tabloBody.innerHTML = spinnerHtml;
    if(kartContainer && config.mevcutGorunum === 'kart') kartContainer.innerHTML = kartSpinnerHtml;
    if(veriYok) veriYok.style.display = 'none';

    try {
        // Merkezi api.js'teki request fonksiyonunu kullanarak veriyi çekiyoruz.
        const data = await api.request(config.apiURL);

        if(tabloBody) tabloBody.innerHTML = '';
        if(kartContainer) kartContainer.innerHTML = '';

        const veriler = data[config.veriAnahtari];
        const toplamKayit = data.toplam_kayit || data.toplam_urun_sayisi || data.toplam_islem_sayisi || data.toplam_girdi_sayisi || (veriler ? veriler.length : 0);

        if (!veriler || veriler.length === 0) {
            if(veriYok) veriYok.style.display = 'block';
        } else {
            // Gelen veriyi, o sayfaya özel olan render fonksiyonuna gönderiyoruz.
            if (config.mevcutGorunum === 'tablo' && tabloBody && typeof config.tabloRenderFn === 'function') {
                config.tabloRenderFn(tabloBody, veriler);
            } else if (config.mevcutGorunum === 'kart' && kartContainer && typeof config.kartRenderFn === 'function') {
                config.kartRenderFn(kartContainer, veriler);
            }
        }
        
        // ui.js içerisindeki merkezi sayfalama fonksiyonunu çağırıyoruz.
        if (typeof ui.sayfalamaNavOlustur === 'function' && sayfalamaNav) {
            ui.sayfalamaNavOlustur(config.sayfalamaId, toplamKayit, config.sayfa, config.kayitSayisi, config.yukleFn);
        }

    } catch (e) {
        // Hata durumunda kullanıcıya bilgi ver.
        const errorHtml = `<tr><td colspan="10" class="text-center p-4 text-danger">${e.message}</td></tr>`;
        const kartErrorHtml = `<div class="col-12 text-center p-4 text-danger">${e.message}</div>`;
        if(tabloBody) tabloBody.innerHTML = errorHtml;
        if(kartContainer) kartContainer.innerHTML = kartErrorHtml;
    }
}
