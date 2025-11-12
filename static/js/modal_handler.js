// static/js/modal-handler.js
// ====================================================================================
// MODAL YÖNETİMİ
// Uygulamadaki tüm Bootstrap modallarının başlatılması, gösterilmesi,
// gizlenmesi ve içindeki form işlemlerinin yönetilmesinden sorumludur.
// ====================================================================================

// ui.js, api.js ve utils.js'in daha önce yüklendiğini varsayıyoruz.
if (typeof ui === 'undefined' || typeof api === 'undefined' || typeof utils === 'undefined') {
    console.error("modal-handler.js: Gerekli olan ui, api veya utils objeleri bulunamadı.");
}
// main.js'deki global değişkenlere erişim (varsayımsal)
// Eğer bu değişkenler global değilse, main.js'den buraya aktarılması veya
// modalHandler'a parametre olarak geçilmesi gerekebilir.
// let anaPanelMevcutSayfa = window.anaPanelMevcutSayfa || 1;
// let anaPanelMevcutGorunum = window.anaPanelMevcutGorunum || 'liste';


const modalHandler = {
    // Modal instance'ları
    duzenleModal: null,
    gecmisModal: null,
    silmeOnayModal: null,
    veriOnayModal: null,
    sifreDegistirModal: null,
    hakkindaModal: null,

    /**
     * Sayfadaki tüm modal instance'larını bulur ve başlatır.
     * Genellikle sayfa yüklendiğinde bir kez çağrılır.
     */
    initModals() {
        console.log("modalHandler.initModals() çağrıldı.");
        const duzenleModalEl = document.getElementById('duzenleModal');
        const gecmisModalEl = document.getElementById('gecmisModal');
        const silmeOnayModalEl = document.getElementById('silmeOnayModal');
        const veriOnayModalEl = document.getElementById('veriOnayModal');
        const sifreDegistirModalEl = document.getElementById('sifreDegistirModal');
        const hakkindaModalEl = document.getElementById('hakkindaModal');

        if (duzenleModalEl) {
            this.duzenleModal = new bootstrap.Modal(duzenleModalEl);
            this._setupDuzenleModalListeners(duzenleModalEl);
            console.log("Duzenle Modal başlatıldı.");
        }
        if (gecmisModalEl) {
            this.gecmisModal = new bootstrap.Modal(gecmisModalEl);
            this._setupGecmisModalListeners(gecmisModalEl);
            console.log("Gecmis Modal başlatıldı.");
        }
        if (silmeOnayModalEl) {
            this.silmeOnayModal = new bootstrap.Modal(silmeOnayModalEl);
            this._setupSilmeOnayModalListeners(silmeOnayModalEl);
            console.log("Silme Onay Modal başlatıldı.");
        }
        if (veriOnayModalEl) {
             if (!window.veriOnayModalInstance) {
                 window.veriOnayModalInstance = new bootstrap.Modal(veriOnayModalEl);
                 console.log("Veri Onay Modal başlatıldı (modalHandler).");
             }
             this.veriOnayModal = window.veriOnayModalInstance;
             this._setupVeriOnayModalListeners(veriOnayModalEl);
        }
        if (sifreDegistirModalEl) {
            this.sifreDegistirModal = new bootstrap.Modal(sifreDegistirModalEl);
            this._setupSifreDegistirModalListeners(sifreDegistirModalEl);
            console.log("Şifre Değiştir Modal başlatıldı.");
        }
        if (hakkindaModalEl) {
            this.hakkindaModal = new bootstrap.Modal(hakkindaModalEl);
            console.log("Hakkında Modal başlatıldı.");
        }
    },

    // --- ÖZEL MODAL AYARLAMA FONKSİYONLARI ---

    _setupDuzenleModalListeners(modalEl) {
        modalEl.addEventListener('shown.bs.modal', (event) => {
            const button = event.relatedTarget;
            const idInput = modalEl.querySelector('#edit-girdi-id');
            const litreInput = modalEl.querySelector('#edit-litre-input');
            const fiyatInput = modalEl.querySelector('#edit-fiyat-input');
            const sebepInput = modalEl.querySelector('#edit-sebep-input');

            if (button && button.dataset.girdiId) {
                if (idInput) idInput.value = button.dataset.girdiId;
                if (litreInput) litreInput.value = button.dataset.litre;
                // Fiyat 0 ise input boş kalsın
                const fiyat = parseFloat(button.dataset.fiyat || 0);
                if (fiyatInput) fiyatInput.value = fiyat > 0 ? fiyat.toFixed(2) : '';
                if (sebepInput) sebepInput.value = '';
                if (litreInput) litreInput.focus();
            } else {
                console.warn("Düzenleme modalı 'relatedTarget' veya data attribute'ları olmadan açıldı.");
                if (idInput) idInput.value = '';
                if (litreInput) litreInput.value = '';
                if (fiyatInput) fiyatInput.value = '';
                if (sebepInput) sebepInput.value = '';
            }
        });
        modalEl.addEventListener('hidden.bs.modal', () => {
             // Form temizleme işlemleri (varsa)
             const form = modalEl.querySelector('form');
             if (form) form.reset(); // Daha genel bir temizleme
             modalEl.querySelector('#edit-girdi-id').value = ''; // ID'yi ayrıca temizle
        });
    },

    _setupGecmisModalListeners(modalEl) {
        modalEl.addEventListener('hidden.bs.modal', () => {
            const modalBody = modalEl.querySelector('.modal-body');
            if (modalBody) modalBody.innerHTML = '<div class="text-center p-4"><div class="spinner-border"></div></div>'; // Spinner'ı geri yükle
        });
        // 'shown.bs.modal' listener'ı burada eklenmiyor, çünkü
        // geçmiş verisi `gecmisiGoster` fonksiyonu çağrıldığında yükleniyor.
    },

    _setupSilmeOnayModalListeners(modalEl) {
        modalEl.addEventListener('shown.bs.modal', (event) => {
            const button = event.relatedTarget;
            const idInput = modalEl.querySelector('#silinecek-girdi-id'); // Genel ID
            const messageElement = modalEl.querySelector('.modal-body p:first-child'); // İlk paragrafı mesaj olarak alalım

            if (idInput) idInput.value = ''; // Her açılışta ID'yi temizle

            if (button && button.dataset.girdiId) {
                 if(idInput) idInput.value = button.dataset.girdiId;
                 if(messageElement) messageElement.innerHTML = "Bu süt girdisini kalıcı olarak silmek istediğinizden emin misiniz?"; // Varsayılan mesaj
            }
            // Başka silme türleri (örn: tedarikçi, yem) için data attribute'ları ve mesajları ayarla
            // else if (button && button.dataset.tedarikciId && button.dataset.tedarikciAdi) {
            //     if(idInput) idInput.value = button.dataset.tedarikciId;
            //     if(messageElement) messageElement.innerHTML = `<strong>${utils.sanitizeHTML(button.dataset.tedarikciAdi)}</strong> adlı tedarikçiyi silmek istediğinize emin misiniz?`;
            // }
             else {
                 console.warn("Silme modalı 'relatedTarget' veya uygun data attribute'u olmadan açıldı.");
                  if(messageElement) messageElement.innerHTML = "Silinecek öğe belirlenemedi.";
             }
        });
         modalEl.addEventListener('hidden.bs.modal', () => {
             const idInput = modalEl.querySelector('#silinecek-girdi-id');
             if(idInput) idInput.value = '';
             // Mesajı varsayılana döndür
             const messageElement = modalEl.querySelector('.modal-body p:first-child');
             if(messageElement) messageElement.innerHTML = "Bu öğeyi silmek istediğinizden emin misiniz?";
         });
    },

     _setupVeriOnayModalListeners(modalEl) {
         modalEl.addEventListener('shown.bs.modal', (event) => {
             const onayBtn = modalEl.querySelector('#onayla-ve-kaydet-btn');
             if(onayBtn) onayBtn.focus();
         });
         // Modal kapandığında özel bir temizleme gerekmiyor. Buton onclick'i her seferinde yeniden atanıyor.
     },


    _setupSifreDegistirModalListeners(modalEl) {
        modalEl.addEventListener('hidden.bs.modal', () => {
             modalEl.querySelector('#mevcut-sifre-input').value = '';
             modalEl.querySelector('#kullanici-yeni-sifre-input').value = '';
             modalEl.querySelector('#kullanici-yeni-sifre-tekrar-input').value = '';
        });
    },

    // --- GENEL MODAL FONKSİYONLARI ---

    /**
     * Şifre değiştirme modalını açar.
     */
    sifreDegistirmeAc() {
        if (!this.sifreDegistirModal) {
             console.error("Şifre Değiştirme Modalı (sifreDegistirModal) başlatılmamış!");
             gosterMesaj("Şifre değiştirme penceresi başlatılamadı.", "danger");
             return;
        }
        this.sifreDegistirModal.show();
    },

    /**
     * Girdi geçmişi modalını açar ve içeriğini yükler.
     * @param {number} girdiId - Geçmişi gösterilecek girdinin ID'si.
     */
    async gecmisiGoster(girdiId) {
        if (!this.gecmisModal) {
            console.error("Geçmiş modalı başlatılmamış!");
            gosterMesaj("Geçmiş penceresi açılamadı.", "danger");
            return;
        }
        this.renderGecmisModalContent(null, true); // Spinner göster
        this.gecmisModal.show();
        try {
            const gecmisKayitlari = await api.fetchGirdiGecmisi(girdiId);
            this.renderGecmisModalContent(gecmisKayitlari); // Veri gelince içeriği doldur
        } catch (error) {
            this.renderGecmisModalContent(null, false, error.message); // Hata göster
        }
    },

    /**
     * Girdi geçmişi modalının içeriğini render eder.
     */
    renderGecmisModalContent(gecmisKayitlari, isLoading = false, error = null) {
        const modalBody = document.getElementById('gecmis-modal-body'); // Bu ID'li elementin modal içinde olduğundan emin olun
        if (!modalBody) return;

        if (isLoading) {
            modalBody.innerHTML = '<div class="text-center p-4"><div class="spinner-border"></div></div>';
            return;
        }
        if (error) {
            modalBody.innerHTML = `<p class="text-danger p-3">Geçmiş yüklenemedi: ${utils.sanitizeHTML(error)}</p>`;
            return;
        }
        if (!gecmisKayitlari || gecmisKayitlari.length === 0) {
            modalBody.innerHTML = '<p class="p-3 text-secondary">Bu girdi için düzenleme geçmişi bulunamadı.</p>';
            return;
        }

        let content = '<ul class="list-group list-group-flush">';
        gecmisKayitlari.forEach(kayit => {
            let tarihStr = "Geçersiz Tarih";
            try {
                 tarihStr = new Date(kayit.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short'});
            } catch(e) {/* Hata olursa varsayılan kalır */}

            const eskiFiyatDegeri = parseFloat(kayit.eski_fiyat_degeri || 0);
            const eskiFiyatBilgisi = eskiFiyatDegeri > 0 ? ` | <span class="text-warning">Eski Fiyat:</span> ${eskiFiyatDegeri.toFixed(2)} TL` : '';
            const duzenleyen = kayit.duzenleyen_kullanici_id?.kullanici_adi ? utils.sanitizeHTML(kayit.duzenleyen_kullanici_id.kullanici_adi) : 'Bilinmiyor';
            const sebep = kayit.duzenleme_sebebi ? utils.sanitizeHTML(kayit.duzenleme_sebebi) : '-';

            content += `<li class="list-group-item">
                            <p class="mb-1 small text-secondary">${tarihStr} - ${duzenleyen}</p>
                            <p class="mb-1"><span class="text-warning">Eski Litre:</span> ${kayit.eski_litre_degeri} Litre ${eskiFiyatBilgisi}</p>
                            <p class="mb-0"><span class="text-info">Sebep:</span> ${sebep}</p>
                        </li>`;
        });
        modalBody.innerHTML = content + '</ul>';
    },


    // --- MODAL SUBMIT FONKSİYONLARI ---

    /**
     * Düzenleme modalındaki "Kaydet" butonuna basıldığında çağrılır.
     */
    async sutGirdisiDuzenle() {
        if (!navigator.onLine) {
            gosterMesaj("Girdileri düzenlemek için internet bağlantısı gereklidir.", "warning");
            return;
        }
        const modalEl = this.duzenleModal?._element;
        if (!modalEl) return;

        const girdiId = modalEl.querySelector('#edit-girdi-id')?.value;
        const yeniLitre = modalEl.querySelector('#edit-litre-input')?.value;
        const yeniFiyat = modalEl.querySelector('#edit-fiyat-input')?.value;
        const duzenlemeSebebi = modalEl.querySelector('#edit-sebep-input')?.value.trim() || '';

        if (!girdiId || !yeniLitre || !yeniFiyat || parseFloat(yeniLitre) <= 0) {
            gosterMesaj("Lütfen yeni litre ve fiyat değerlerini girin (Litre 0'dan büyük olmalı).", "warning");
            return;
        }

        const kaydetButton = modalEl.querySelector('.btn-primary');
        let originalButtonText = '';
        if (kaydetButton) {
            originalButtonText = kaydetButton.innerHTML;
            kaydetButton.disabled = true;
            kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
        }

        try {
            const result = await api.updateSutGirdisi(girdiId, {
                yeni_litre: parseFloat(yeniLitre),
                yeni_fiyat: parseFloat(yeniFiyat),
                duzenleme_sebebi: duzenlemeSebebi
            });
            gosterMesaj("Girdi başarıyla güncellendi.", "success");
            if(this.duzenleModal) this.duzenleModal.hide();

            const guncellenenGirdiTarihi = result.girdi_tarihi_str || utils.getLocalDateString();

            // main.js'deki global fonksiyonları çağır (varsa)
            if (typeof ui !== 'undefined' && typeof ui.updateOzetPanels === 'function') {
                ui.updateOzetPanels(result.yeni_ozet, guncellenenGirdiTarihi);
            }
             if (typeof girdileriGoster === 'function') { // main.js'de olmalı
                await girdileriGoster(window.anaPanelMevcutSayfa || 1, guncellenenGirdiTarihi);
             }

        } catch (error) {
            gosterMesaj(`Girdi düzenlenemedi: ${error.message || 'Bilinmeyen hata.'}`, "danger");
        } finally {
            if (kaydetButton) {
                kaydetButton.disabled = false;
                kaydetButton.innerHTML = originalButtonText || 'Kaydet';
            }
        }
    },

    /**
     * Silme onay modalındaki "Evet, Sil" butonuna basıldığında çağrılır.
     */
    async sutGirdisiSil() {
        if (!navigator.onLine) {
            gosterMesaj("Girdileri silmek için internet bağlantısı gereklidir.", "warning");
            if(this.silmeOnayModal) this.silmeOnayModal.hide();
            return;
        }
        const modalEl = this.silmeOnayModal?._element;
        if (!modalEl) return;

        const girdiId = modalEl.querySelector('#silinecek-girdi-id')?.value;
        if (!girdiId) {
             gosterMesaj("Silinecek girdi ID'si bulunamadı.", "warning");
             if(this.silmeOnayModal) this.silmeOnayModal.hide();
             return;
        }
        if(this.silmeOnayModal) this.silmeOnayModal.hide();

        // İyimser UI
        const mevcutGorunum = window.anaPanelMevcutGorunum || 'liste';
        const silinecekElementId = mevcutGorunum === 'liste' ? `girdi-liste-${girdiId}` : `girdi-kart-${girdiId}`;
        const silinecekElement = document.getElementById(silinecekElementId);
        let parent = null, nextSibling = null, originalHTML = null;

        if (silinecekElement) {
            parent = silinecekElement.parentNode;
            nextSibling = silinecekElement.nextSibling;
            originalHTML = silinecekElement.outerHTML;

            silinecekElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            silinecekElement.style.opacity = '0';
            silinecekElement.style.transform = 'translateX(-50px)';
            setTimeout(() => {
                if(silinecekElement.parentNode) {
                    silinecekElement.remove();
                    // Liste boşaldıysa "veri yok" mesajını göster
                    const listeElementi = document.getElementById('girdiler-listesi');
                    const kartListesi = document.getElementById('girdiler-kart-listesi');
                    const veriYokMesaji = document.getElementById('veri-yok-mesaji');
                     if (listeElementi && kartListesi && listeElementi.children.length === 0 && kartListesi.children.length === 0 && veriYokMesaji) {
                        veriYokMesaji.style.display = 'block';
                    }
                }
            }, 400);
        }

        try {
            const result = await api.deleteSutGirdisi(girdiId);
            gosterMesaj(result.message, 'success');

            const silinenGirdiTarihi = result.girdi_tarihi_str || utils.getLocalDateString();

            // main.js'deki global fonksiyonları çağır (varsa)
            if (typeof ui !== 'undefined' && typeof ui.updateOzetPanels === 'function') {
                ui.updateOzetPanels(result.yeni_ozet, silinenGirdiTarihi);
            }
             if (typeof girdileriGoster === 'function') { // main.js'de olmalı
                 let hedefSayfa = window.anaPanelMevcutSayfa || 1;
                 const listeElementi = document.getElementById('girdiler-listesi');
                 const kartListesi = document.getElementById('girdiler-kart-listesi');
                 // Silme sonrası liste boşaldıysa ve ilk sayfa değilse, bir önceki sayfaya git
                 if(hedefSayfa > 1 && listeElementi && kartListesi && listeElementi.children.length === 0 && kartListesi.children.length === 0) {
                     hedefSayfa--;
                     window.anaPanelMevcutSayfa = hedefSayfa; // Global sayfayı da güncelle
                 }
                 await girdileriGoster(hedefSayfa, silinenGirdiTarihi);
             }

        } catch (error) {
            console.error("İyimser silme başarısız oldu:", error);
            gosterMesaj('Silme işlemi başarısız, girdi geri yüklendi.', 'danger');
            // Hata durumunda öğeyi geri ekle
            if (originalHTML && parent) {
                 const tempDiv = document.createElement(mevcutGorunum === 'kart' ? 'div' : 'tbody');
                 tempDiv.innerHTML = originalHTML;
                 const restoredElement = tempDiv.firstChild;
                 if (restoredElement) {
                     restoredElement.style.opacity = '1';
                     restoredElement.style.transform = 'translateX(0)';
                     parent.insertBefore(restoredElement, nextSibling);
                     const veriYokMesaji = document.getElementById('veri-yok-mesaji');
                     if(veriYokMesaji) veriYokMesaji.style.display = 'none';
                 }
            }
            // Hata durumunda bile listeyi tekrar yüklemek iyi olabilir, tutarsızlıkları önler
             if (typeof girdileriGoster === 'function') {
                 const silinenGirdiTarihi = utils.getLocalDateString(); // Hata olduğu için tarihi varsayılan al
                 await girdileriGoster(window.anaPanelMevcutSayfa || 1, silinenGirdiTarihi);
             }
        }
    },

    /**
     * Şifre değiştirme modalındaki "Kaydet" butonuna basıldığında çağrılır.
     */
    async sifreDegistir() {
        const modalEl = this.sifreDegistirModal?._element;
        if (!modalEl) return;

        const mevcutSifre = modalEl.querySelector('#mevcut-sifre-input')?.value;
        const yeniSifre = modalEl.querySelector('#kullanici-yeni-sifre-input')?.value;
        const yeniSifreTekrar = modalEl.querySelector('#kullanici-yeni-sifre-tekrar-input')?.value;

        if (!mevcutSifre || !yeniSifre || !yeniSifreTekrar) {
            gosterMesaj("Lütfen tüm şifre alanlarını doldurun.", "warning");
            return;
        }
        if (yeniSifre !== yeniSifreTekrar) {
            gosterMesaj("Yeni şifreler eşleşmiyor.", "warning");
            return;
        }

        const kaydetButton = modalEl.querySelector('.btn-primary');
        let originalButtonText = '';
        if (kaydetButton) {
            originalButtonText = kaydetButton.innerHTML;
            kaydetButton.disabled = true;
            kaydetButton.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Kaydediliyor...`;
        }

        try {
            const result = await api.postChangePassword({ mevcut_sifre: mevcutSifre, yeni_sifre: yeniSifre, yeni_sifre_tekrar: yeniSifreTekrar });
            gosterMesaj(result.message, 'success');
            if(this.sifreDegistirModal) this.sifreDegistirModal.hide();
        } catch (error) {
            gosterMesaj(error.message || "Bir hata oluştu.", 'danger');
        } finally {
            if (kaydetButton) {
                kaydetButton.disabled = false;
                kaydetButton.innerHTML = originalButtonText || 'Kaydet';
            }
        }
    },

};

// Global scope'a modalHandler'ı ekleyelim ki HTML'den erişilebilsin
window.modalHandler = modalHandler;

// Sayfa yüklendiğinde modalları başlat
document.addEventListener('DOMContentLoaded', () => {
    modalHandler.initModals();
});

// `gecmisiGoster` fonksiyonunu global scope'a atayalım (HTML'deki onclick için)
// Eğer onclick="modalHandler.gecmisiGoster(...)" kullanacaksak bu satıra gerek yok.
// Ama eski onclick="gecmisiGoster(...)" yapısını korumak istiyorsak bu gerekli.
window.gecmisiGoster = modalHandler.gecmisiGoster.bind(modalHandler);

