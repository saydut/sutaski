// static/js/modal_handler.js - TAILWIND UYUMLU SÜRÜM

const modalHandler = {
    
    // --- YARDIMCI: Modalı Aç/Kapat (Tailwind class manipülasyonu) ---
    toggleModal(modalId, show) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        
        if (show) {
            modal.classList.remove('hidden');
            // Animasyon için opsiyonel: İçeriği yukarıdan kaydır vs.
        } else {
            modal.classList.add('hidden');
        }
    },

    // --- 1. DÜZENLEME ---
    acDuzenleModal(id, litre, fiyat) {
        document.getElementById('edit-girdi-id').value = id;
        document.getElementById('edit-litre-input').value = litre;
        document.getElementById('edit-fiyat-input').value = fiyat;
        document.getElementById('edit-sebep-input').value = ''; // Temizle
        
        this.toggleModal('duzenleModal', true);
    },

    async sutGirdisiDuzenle() {
        const veri = ui.getDuzenlemeFormVerisi();
        if (!veri.yeniLitre || !veri.girdiId) {
            gosterMesaj('Lütfen geçerli bir litre girin.', 'warning');
            return;
        }

        try {
            const result = await api.putSutGirdisi(veri.girdiId, {
                litre: parseFloat(veri.yeniLitre),
                fiyat: parseFloat(veri.yeniFiyat || 0),
                sebep: veri.duzenlemeSebebi
            });
            
            gosterMesaj('Girdi başarıyla güncellendi.', 'success');
            this.toggleModal('duzenleModal', false); // Kapat
            
            // Listeyi yenile
            ui.updateOzetPanels(result.yeni_ozet, utils.getLocalDateString()); 
            girdileriFiltrele(); // main.js'den gelir

        } catch (error) {
            gosterMesaj(error.message || 'Güncelleme başarısız.', 'danger');
        }
    },

    // --- 2. SİLME ---
    acSilmeModal(id) {
        document.getElementById('silinecek-girdi-id').value = id;
        this.toggleModal('silmeOnayModal', true);
    },

    async sutGirdisiSil() {
        const id = ui.getSilinecekGirdiId();
        if (!id) return;

        try {
            const result = await api.deleteSutGirdisi(id);
            gosterMesaj('Girdi başarıyla silindi.', 'success');
            this.toggleModal('silmeOnayModal', false); // Kapat
            
            // Listeyi yenile
            ui.updateOzetPanels(result.yeni_ozet, utils.getLocalDateString());
            girdileriFiltrele();

        } catch (error) {
            gosterMesaj(error.message || 'Silme işlemi başarısız.', 'danger');
        }
    },

    // --- 3. GEÇMİŞ ---
    async acGecmisModal(id) {
        this.toggleModal('gecmisModal', true);
        const body = document.getElementById('gecmis-modal-body');
        body.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-circle-notch fa-spin text-brand-500"></i> Yükleniyor...</div>';

        try {
            const data = await api.fetchGirdiGecmisi(id);
            if (!data || data.length === 0) {
                body.innerHTML = '<div class="text-center text-gray-500 py-4">Düzenleme geçmişi bulunamadı.</div>';
                return;
            }
            
            let html = '<div class="space-y-4">';
            data.forEach(item => {
                const tarih = new Date(item.islem_tarihi).toLocaleString('tr-TR');
                html += `
                    <div class="border-l-4 border-gray-300 pl-3 py-1">
                        <div class="text-xs text-gray-400 mb-1">${tarih} - ${item.kullanici_adi}</div>
                        <div class="text-sm text-gray-800">
                            <span class="font-mono bg-gray-100 px-1 rounded">${item.eski_litre}L</span> 
                            <i class="fa-solid fa-arrow-right text-gray-400 text-xs mx-1"></i> 
                            <span class="font-mono bg-brand-50 text-brand-700 px-1 rounded">${item.yeni_litre}L</span>
                        </div>
                        ${item.aciklama ? `<div class="text-xs text-gray-500 italic mt-1">"${item.aciklama}"</div>` : ''}
                    </div>`;
            });
            html += '</div>';
            body.innerHTML = html;

        } catch (error) {
            body.innerHTML = '<div class="text-center text-red-500 py-4">Geçmiş yüklenirken hata oluştu.</div>';
        }
    },

    // --- 4. VERİ ONAYI ---
    showVeriOnayModal(mesaj, onConfirm) {
        document.getElementById('onay-mesaji').innerHTML = mesaj;
        this.toggleModal('veriOnayModal', true);
        
        // Onay butonunun davranışını dinamik olarak değiştir
        const btn = document.getElementById('onayla-ve-kaydet-btn');
        // Eski event listener'ları temizlemek için klonlayıp değiştirme tekniği
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.onclick = async () => {
            this.toggleModal('veriOnayModal', false);
            if (typeof onConfirm === 'function') onConfirm();
        };
    }
};