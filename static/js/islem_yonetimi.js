// Bu script, _hizli_islemler.html içindeki Süt, Yem ve Ödeme modallarının
// tüm mantığını (form doldurma, gönderme, düzenleme) yönetir.
// Bu dosya 'base.html'e dahil edilmeli ki her sayfadan erişilebilsin.

document.addEventListener('DOMContentLoaded', () => {

    // --- Form Elementleri ---
    const sutForm = document.getElementById('hizli-sut-form');
    const yemForm = document.getElementById('hizli-yem-form');
    const odemeForm = document.getElementById('hizli-odeme-form');

    // --- Select (Dropdown) Listeleri ---
    const sutTedarikciSelect = document.getElementById('hizli-sut-tedarikci');
    const yemTedarikciSelect = document.getElementById('hizli-yem-tedarikci');
    const odemeTedarikciSelect = document.getElementById('hizli-odeme-tedarikci');
    const yemTipiSelect = document.getElementById('hizli-yem-tipi');

    // --- Global Depolama ---
    // Tedarikçi ve yem tiplerini tekrar tekrar çekmemek için burada sakla
    let allSuppliers = [];
    let allFeedTypes = [];

    /**
     * Tüm aktif tedarikçileri API'den çeker ve tüm modal'lardaki
     * <select> listelerini doldurur.
     */
    const loadAllSuppliers = async () => {
        try {
            // 'full=true' parametresi tüm tedarikçileri (sayfalama olmadan) çeker
            const data = await apiCall('/api/tedarikciler?status=aktif&full=true');
            allSuppliers = data.tedarikciler || []; 
            
            // Tüm <select> listelerini temizle (ilk "Yükleniyor" seçeneği hariç)
            [sutTedarikciSelect, yemTedarikciSelect, odemeTedarikciSelect].forEach(select => {
                if (select) select.innerHTML = '<option value="">Tedarikçi Seçiniz...</option>';
            });

            // Listeleri doldur
            allSuppliers.forEach(supplier => {
                const option = `<option value="${supplier.id}">${supplier.tedarikci_kodu} - ${supplier.ad_soyad}</option>`;
                if (sutTedarikciSelect) sutTedarikciSelect.innerHTML += option;
                if (yemTedarikciSelect) yemTedarikciSelect.innerHTML += option;
                if (odemeTedarikciSelect) odemeTedarikciSelect.innerHTML += option;
            });

        } catch (error) {
            console.error("Tedarikçiler yüklenemedi:", error);
            showToast("Tedarikçi listesi yüklenemedi.", 'error');
        }
    };

    /**
     * Tüm yem tiplerini (tarifelerini) çeker ve Yem Modalı'ndaki listeyi doldurur.
     */
    const loadAllFeedTypes = async () => {
        try {
            const data = await apiCall('/api/tarifeler/yem');
            allFeedTypes = data.tarifeler || [];
            
            if (yemTipiSelect) yemTipiSelect.innerHTML = '<option value="">Yem Tipi Seçiniz...</option>';
            
            allFeedTypes.forEach(feed => {
                const option = `<option value="${feed.id}">${feed.yem_tipi} (${formatCurrency(feed.satis_fiyati)})</option>`;
                if (yemTipiSelect) yemTipiSelect.innerHTML += option;
            });

        } catch (error) {
            console.error("Yem tipleri yüklenemedi:", error);
            showToast("Yem tipleri yüklenemedi.", 'error');
        }
    };

    /**
     * Bir modal açıldığında, eğer 'tedarikci_detay.html' sayfasındaysak,
     * tedarikçi <select> listesini otomatik olarak doldurur ve kilitler.
     */
    const prefillSupplierIfOnDetailPage = () => {
        // 'tedarikci_detay.html' bu global değişkenleri tanımlar
        if (typeof CURRENT_SUPPLIER_ID !== 'undefined' && CURRENT_SUPPLIER_ID) {
            [sutTedarikciSelect, yemTedarikciSelect, odemeTedarikciSelect].forEach(select => {
                if (select) {
                    select.value = CURRENT_SUPPLIER_ID;
                    select.disabled = true; // Kilitli, çünkü detay sayfasındayız
                }
            });
        } else {
             [sutTedarikciSelect, yemTedarikciSelect, odemeTedarikciSelect].forEach(select => {
                if (select) {
                    select.disabled = false; // Kilitli değil
                }
            });
        }
    };

    // --- Modal Açma Tetikleyicileri (Global) ---
    // 'ui.js' 'hizli-islemler-modal'ı açar.
    // 'ui.js' veya 'tedarikci_detay.js' Süt/Yem/Ödeme modallarını açar.
    // Bu açma butonları 'data-modal-id' yerine 'id' kullandığı için
    // 'modal_handler.js' bunları yakalamaz, biz burada yakalıyoruz.
    
    // 1. Süt Modalını Açan Butonlar
    ['open-hizli-sut-ekle-modal-btn', 'open-milk-modal'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', (e) => {
            e.preventDefault();
            sutForm.reset();
            document.getElementById('hizli-sut-kayit-id').value = '';
            document.getElementById('hizli-sut-modal-title').textContent = 'Süt Girdisi Ekle';
            // Tarihi bugünün tarihi yap
            document.getElementById('hizli-sut-tarih').valueAsDate = new Date();
            prefillSupplierIfOnDetailPage();
            window.openModal('hizli-sut-ekle-modal');
        });
    });

    // 2. Yem Modalını Açan Butonlar
    ['open-hizli-yem-ekle-modal-btn', 'open-feed-modal'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', (e) => {
            e.preventDefault();
            yemForm.reset();
            document.getElementById('hizli-yem-kayit-id').value = '';
            document.getElementById('hizli-yem-modal-title').textContent = 'Yem Girdisi Ekle';
            document.getElementById('hizli-yem-tarih').valueAsDate = new Date();
            prefillSupplierIfOnDetailPage();
            window.openModal('hizli-yem-ekle-modal');
        });
    });

    // 3. Ödeme Modalını Açan Butonlar
    ['open-hizli-odeme-ekle-modal-btn', 'open-payment-modal'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', (e) => {
            e.preventDefault();
            odemeForm.reset();
            document.getElementById('hizli-odeme-kayit-id').value = '';
            document.getElementById('hizli-odeme-modal-title').textContent = 'Ödeme Girdisi Ekle';
            document.getElementById('hizli-odeme-tarih').valueAsDate = new Date();
            prefillSupplierIfOnDetailPage();
            window.openModal('hizli-odeme-ekle-modal');
        });
    });
    

    /**
     * Form gönderimi başarılı olduktan sonra hangi sayfada olduğumuzu
     * kontrol edip o sayfanın verisini yenileyen fonksiyon.
     */
    const refreshCurrentPageData = () => {
        if (typeof window.loadSuppliers === 'function') window.loadSuppliers();
        if (typeof window.loadSupplierDetails === 'function') window.loadSupplierDetails(CURRENT_SUPPLIER_ID);
        if (typeof window.loadSutKayitlari === 'function') window.loadSutKayitlari();
        if (typeof window.loadYemKayitlari === 'function') window.loadYemKayitlari();
        if (typeof window.loadFinansKayitlari === 'function') window.loadFinansKayitlari();
        // Anasayfa (main.js) henüz dinamik yenilemeyi desteklemiyor,
        // ama desteklese buraya eklenebilirdi:
        // if (typeof window.loadDashboardData === 'function') window.loadDashboardData();
    };


    // --- FORM GÖNDERME (SUBMIT) DİNLEYİCİLERİ ---

    // 1. Süt Formu Gönderme
    if (sutForm) {
        sutForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(sutForm);
            const body = Object.fromEntries(formData.entries());
            
            // Eğer tedarikçi <select> kilitliyse, 'disabled' olduğu için
            // FormData'ya eklenmez. Manuel eklememiz gerekir.
            if (sutTedarikciSelect.disabled) {
                body.tedarikci_id = sutTedarikciSelect.value;
            }

            const kayitId = body.kayit_id;
            const method = kayitId ? 'PUT' : 'POST';
            const endpoint = kayitId ? `/api/sut/${kayitId}` : '/api/sut';
            
            try {
                const response = await apiCall(endpoint, method, body);
                showToast(response.mesaj, 'success');
                window.closeModal('hizli-sut-ekle-modal');
                refreshCurrentPageData();
            } catch (error) {
                showToast(`Hata: ${error.message}`, 'error');
            }
        });
    }

    // 2. Yem Formu Gönderme
    if (yemForm) {
        yemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(yemForm);
            const body = Object.fromEntries(formData.entries());

            if (yemTedarikciSelect.disabled) {
                body.tedarikci_id = yemTedarikciSelect.value;
            }
            
            const kayitId = body.kayit_id;
            const method = kayitId ? 'PUT' : 'POST';
            const endpoint = kayitId ? `/api/yem/${kayitId}` : '/api/yem';
            
            try {
                const response = await apiCall(endpoint, method, body);
                showToast(response.mesaj, 'success');
                window.closeModal('hizli-yem-ekle-modal');
                refreshCurrentPageData();
            } catch (error) {
                showToast(`Hata: ${error.message}`, 'error');
            }
        });
    }

    // 3. Ödeme Formu Gönderme
    if (odemeForm) {
        odemeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(odemeForm);
            const body = Object.fromEntries(formData.entries());
            
            if (odemeTedarikciSelect.disabled) {
                body.tedarikci_id = odemeTedarikciSelect.value;
            }

            const kayitId = body.kayit_id;
            const method = kayitId ? 'PUT' : 'POST';
            const endpoint = kayitId ? `/api/finans/${kayitId}` : '/api/finans';
            
            try {
                const response = await apiCall(endpoint, method, body);
                showToast(response.mesaj, 'success');
                window.closeModal('hizli-odeme-ekle-modal');
                refreshCurrentPageData();
            } catch (error) {
                showToast(`Hata: ${error.message}`, 'error');
            }
        });
    }

    // --- DÜZENLEME (EDIT) FONKSİYONLARI ---
    // (Bu fonksiyonlar sut_yonetimi.js gibi diğer dosyalardan çağrılır)

    // Süt Kaydı Düzenleme
    window.editSutKaydi = async (kayitId) => {
        try {
            const data = await apiCall(`/api/sut/${kayitId}`);
            sutForm.reset();
            document.getElementById('hizli-sut-kayit-id').value = kayitId;
            document.getElementById('hizli-sut-modal-title').textContent = 'Süt Girdisini Düzenle';
            
            // Formu doldur
            sutTedarikciSelect.value = data.tedarikci_id;
            document.getElementById('hizli-sut-tarih').value = data.tarih.split('T')[0]; // Tarihi YYYY-MM-DD yap
            document.getElementById('hizli-sut-litre').value = data.litre;
            
            prefillSupplierIfOnDetailPage(); // Select'i kilitle/kilitleme
            window.openModal('hizli-sut-ekle-modal');
        } catch (error) {
            showToast(`Kayıt yüklenemedi: ${error.message}`, 'error');
        }
    };
    
    // Yem Kaydı Düzenleme
    window.editYemKaydi = async (kayitId) => {
         try {
            const data = await apiCall(`/api/yem/${kayitId}`);
            yemForm.reset();
            document.getElementById('hizli-yem-kayit-id').value = kayitId;
            document.getElementById('hizli-yem-modal-title').textContent = 'Yem Girdisini Düzenle';
            
            // Formu doldur
            yemTedarikciSelect.value = data.tedarikci_id;
            yemTipiSelect.value = data.yem_tipi_id;
            document.getElementById('hizli-yem-tarih').value = data.tarih.split('T')[0];
            document.getElementById('hizli-yem-miktar').value = data.miktar;
            
            prefillSupplierIfOnDetailPage();
            window.openModal('hizli-yem-ekle-modal');
        } catch (error) {
            showToast(`Kayıt yüklenemedi: ${error.message}`, 'error');
        }
    };
    
    // Ödeme Kaydı Düzenleme
    window.editOdemeKaydi = async (kayitId) => {
         try {
            const data = await apiCall(`/api/finans/${kayitId}`);
            odemeForm.reset();
            document.getElementById('hizli-odeme-kayit-id').value = kayitId;
            document.getElementById('hizli-odeme-modal-title').textContent = 'Ödeme Girdisini Düzenle';
            
            // Formu doldur
            odemeTedarikciSelect.value = data.tedarikci_id;
            document.getElementById('hizli-odeme-tarih').value = data.tarih.split('T')[0];
            document.getElementById('hizli-odeme-tutar').value = data.tutar;
            document.getElementById('hizli-odeme-aciklama').value = data.aciklama || '';
            
            prefillSupplierIfOnDetailPage();
            window.openModal('hizli-odeme-ekle-modal');
        } catch (error) {
            showToast(`Kayıt yüklenemedi: ${error.message}`, 'error');
        }
    };


    // --- BAŞLANGIÇ ---
    // Sayfa yüklendiğinde gerekli listeleri (tedarikçi ve yem) çek.
    // Bu fonksiyonları aynı anda (paralel) çalıştır.
    Promise.all([
        loadAllSuppliers(),
        loadAllFeedTypes()
    ]).catch(err => {
        console.error("Modal ön yüklemesi başarısız oldu:", err);
    });
});