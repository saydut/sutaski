// static/js/api.js - EKSİK FONKSİYONLAR EKLENDİ

const api = {
    async request(url, options = {}) {
        // Varsayılan olarak önbellekleme yapma
        if (!options.cache) { options.cache = 'no-store'; }

        try {
            const response = await fetch(url, options);

            if (response.status === 401) {
                console.warn('Yetkisiz Erişim (401)');
                localStorage.removeItem('offlineUser');
                window.location.href = '/login';
                throw new Error('Oturum süresi doldu.');
            }

            if (!response.ok) {
                let errorMsg = `HTTP Hatası: ${response.status}`;
                try { const data = await response.json(); errorMsg = data.error || errorMsg; } catch(e) {}
                throw new Error(errorMsg);
            }

            return await response.json();
        } catch (error) {
            console.error("API Hatası:", error);
            throw error;
        }
    },

    // --- Süt ve Rapor ---
    fetchGunlukOzet(t) { return this.request(`/api/rapor/gunluk_ozet?tarih=${t}&_t=${Date.now()}`); },
    fetchSutGirdileri(t, p) { return this.request(`/api/sut_girdileri?tarih=${t}&sayfa=${p}&_t=${Date.now()}`); },
    postSutGirdisi(v) { return this.request('/api/sut_girdisi_ekle', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    updateSutGirdisi(id, v) { return this.request(`/api/sut_girdisi_duzenle/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    deleteSutGirdisi(id) { return this.request(`/api/sut_girdisi_sil/${id}`, { method: 'DELETE' }); },
    fetchGirdiGecmisi(id) { return this.request(`/api/girdi_gecmisi/${id}?_t=${Date.now()}`); },

    // --- Tarife ---
    fetchTarifeler() { return this.request(`/tarife/api/listele?_t=${Date.now()}`); }, 
    postTarife(v) { return this.request('/tarife/api/ekle', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    updateTarife(id, v) { return this.request(`/tarife/api/guncelle/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    deleteTarife(id) { return this.request(`/tarife/api/sil/${id}`, { method: 'DELETE' }); },
    fetchTarifeFiyat(tarih) { return this.request(`/tarife/api/get_fiyat?tarih=${tarih}&_t=${Date.now()}`); },

    // --- Masraf ---
    fetchMasrafKategorileri() { return this.request(`/masraf/api/kategori/listele?_t=${Date.now()}`); },
    fetchMasraflar(p, l) { return this.request(`/masraf/api/listele?sayfa=${p}&limit=${l}&_t=${Date.now()}`); }, 
    postMasraf(v) { return this.request('/masraf/api/ekle', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    deleteMasraf(id) { return this.request(`/masraf/api/sil/${id}`, { method: 'DELETE' }); },
    postMasrafKategorisi(v) { return this.request('/masraf/api/kategori/ekle', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    deleteMasrafKategorisi(id) { return this.request(`/masraf/api/kategori/sil/${id}`, { method: 'DELETE' }); },

    // --- Finans ---
    fetchFinansalIslemler(p, l) { return this.request(`/finans/api/islemler?sayfa=${p}&limit=${l}&_t=${Date.now()}`); },
    postFinansalIslem(v) { return this.request('/finans/api/islemler', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    updateFinansalIslem(id, v) { return this.request(`/finans/api/islemler/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    deleteFinansalIslem(id) { return this.request(`/finans/api/islemler/${id}`, { method: 'DELETE' }); },

    // --- Yem ---
    fetchYemUrunleri(p) { return this.request(`/yem/api/urunler?sayfa=${p}&_t=${Date.now()}`); },
    fetchYemUrunleriListe() { return this.request(`/yem/api/urunler/liste?_t=${Date.now()}`); },
    fetchYemIslemleri(p) { return this.request(`/yem/api/islemler/liste?sayfa=${p}&_t=${Date.now()}`); },
    postYemUrunu(v) { return this.request('/yem/api/urunler', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    updateYemUrunu(id, v) { return this.request(`/yem/api/urunler/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    deleteYemUrunu(id) { return this.request(`/yem/api/urunler/${id}`, { method: 'DELETE' }); },
    postYemIslemi(v) { return this.request('/yem/api/islemler', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    updateYemIslemi(id, v) { return this.request(`/yem/api/islemler/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    deleteYemIslemi(id) { return this.request(`/yem/api/islemler/${id}`, { method: 'DELETE' }); },

    // --- Tedarikçi & Firma ---
    fetchTedarikciler() { return this.request('/api/tedarikciler_dropdown'); },
    fetchTedarikcilerListe(p, q, s, d, l) { return this.request(`/api/tedarikciler_liste?sayfa=${p}&arama=${encodeURIComponent(q)}&limit=${l}&_t=${Date.now()}`); },
    fetchTedarikciDetay(id) { return this.request(`/api/tedarikci/${id}`); },
    fetchTedarikciOzet(id) { return this.request(`/api/tedarikci/${id}/ozet?_t=${Date.now()}`); },
    fetchTedarikciSutGirdileri(id, p, l) { return this.request(`/api/tedarikci/${id}/sut_girdileri?sayfa=${p}&limit=${l}&_t=${Date.now()}`); },
    fetchTedarikciYemIslemleri(id, p, l) { return this.request(`/api/tedarikci/${id}/yem_islemleri?sayfa=${p}&limit=${l}&_t=${Date.now()}`); },
    fetchTedarikciFinansIslemleri(id, p, l) { return this.request(`/api/tedarikci/${id}/finansal_islemler?sayfa=${p}&limit=${l}&_t=${Date.now()}`); },
    fetchTedarikciIstatistikleri(id) { return this.request(`/api/tedarikci/${id}/stats`); },
    fetchSonFiyat(id) { return this.request(`/api/tedarikci/${id}/son_fiyat`); },
    postTedarikci(v) { return this.request('/api/tedarikci_ekle', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    updateTedarikci(id, v) { return this.request(`/api/tedarikci_duzenle/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    deleteTedarikci(id) { return this.request(`/api/tedarikci_sil/${id}`, { method: 'DELETE' }); },
    fetchYonetimData() { return this.request(`/firma/api/yonetim_data?_t=${Date.now()}`); },
    postToplayiciEkle(v) { return this.request('/firma/api/toplayici_ekle', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    deleteKullanici(id) { return this.request(`/firma/api/kullanici_sil/${id}`, { method: 'DELETE' }); },
    fetchKullaniciDetay(id) { return this.request(`/firma/api/kullanici_detay/${id}`); },
    updateKullanici(id, v) { return this.request(`/firma/api/kullanici_guncelle/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    postKullaniciSifreSetle(id, v) { return this.request(`/firma/api/kullanici_sifre_setle/${id}`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },

    // --- Rapor & Diğer ---
    // EKSİK OLAN FONKSİYONLAR EKLENDİ:
    fetchHaftalikOzet() { 
        return this.request(`/api/rapor/haftalik_ozet?_t=${Date.now()}`); 
    },
    fetchTedarikciDagilimi(period) { 
        const p = period ? period : 'monthly';
        return this.request(`/api/rapor/tedarikci_dagilimi?period=${p}&_t=${Date.now()}`); 
    },

    fetchDetayliRapor(b, e) { return this.request(`/api/rapor/detayli_rapor?baslangic=${b}&bitis=${e}&_t=${Date.now()}`); },
    fetchKarlilikRaporu(b, e) { return this.request(`/api/rapor/karlilik?baslangic=${b}&bitis=${e}&_t=${Date.now()}`); },
    fetchProfil() { return this.request('/api/profil'); },
    updateProfil(v) { return this.request('/api/profil', { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    postChangePassword(v) { return this.request('/api/user/change_password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(v) }); },
    
    async fetchCsvExport(tarih) {
        const url = `/api/rapor/export_csv${tarih ? `?tarih=${tarih}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('CSV indirilemedi');
        let filename = "rapor.csv";
        const disp = res.headers.get('Content-Disposition');
        if (disp && disp.includes('attachment')) {
            const match = /filename[^;=\n]*=(['"]?)([^'";\n]+)\1?/.exec(disp);
            if (match && match[2]) filename = match[2].replace(/['"]/g, '');
        }
        return { filename, blob: await res.blob() };
    }
};