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
        veriYok.innerHTML = `<p class="text-warning">Bu verileri görüntülemek için internet bağlantısı gereklidir.</p>`;
        veriYok.style.display = 'block';
        if(tabloBody) tabloBody.innerHTML = '';
        if(kartContainer) kartContainer.innerHTML = '';
        if(sayfalamaNav) sayfalamaNav.innerHTML = '';
        return;
    }

    // Yükleniyor animasyonları
    const spinnerHtml = `<tr><td colspan="6" class="text-center p-4"><div class="spinner-border"></div></td></tr>`;
    const kartSpinnerHtml = `<div class="col-12 text-center p-4"><div class="spinner-border"></div></div>`;
    if(tabloBody && config.mevcutGorunum === 'tablo') tabloBody.innerHTML = spinnerHtml;
    if(kartContainer && config.mevcutGorunum === 'kart') kartContainer.innerHTML = kartSpinnerHtml;
    veriYok.style.display = 'none';

    try {
        const response = await fetch(config.apiURL);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Veriler yüklenemedi.');

        if(tabloBody) tabloBody.innerHTML = '';
        if(kartContainer) kartContainer.innerHTML = '';

        const veriler = data[config.veriAnahtari];
        const toplamKayit = data.toplam_kayit || data.toplam_urun_sayisi || data.toplam_islem_sayisi || data.toplam_girdi_sayisi || (veriler ? veriler.length : 0);

        if (!veriler || veriler.length === 0) {
            veriYok.style.display = 'block';
        } else {
            if (config.mevcutGorunum === 'tablo' && tabloBody) {
                config.tabloRenderFn(tabloBody, veriler);
            } else if (config.mevcutGorunum === 'kart' && kartContainer) {
                config.kartRenderFn(kartContainer, veriler);
            }
        }
        
        if (ui && typeof ui.sayfalamaNavOlustur === 'function') {
            ui.sayfalamaNavOlustur(config.sayfalamaId, toplamKayit, config.sayfa, config.kayitSayisi, config.yukleFn);
        }

    } catch (e) {
        const errorHtml = `<tr><td colspan="6" class="text-center p-4 text-danger">${e.message}</td></tr>`;
        const kartErrorHtml = `<div class="col-12 text-center p-4 text-danger">${e.message}</div>`;
        if(tabloBody) tabloBody.innerHTML = errorHtml;
        if(kartContainer) kartContainer.innerHTML = kartErrorHtml;
    }
}
