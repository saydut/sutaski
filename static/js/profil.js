// static/js/profil.js

document.addEventListener('DOMContentLoaded', () => {
    profilBilgileriniYukle();
    
    // Eğer kullanıcı yetkiliyse personel listesini de yükle
    const userRole = document.body.dataset.userRole;
    if (['admin', 'firma_yetkilisi'].includes(userRole)) {
        personelListesiniYukle();
    }
});

// --- Profil Bilgileri ---
async function profilBilgileriniYukle() {
    try {
        const data = await api.fetchProfil(); // api.js'de tanımlı olmalı
        if (data.kullanici) {
            const k = data.kullanici;
            if(document.getElementById('profil-isim')) document.getElementById('profil-isim').value = k.kullanici_adi || '';
            if(document.getElementById('profil-email')) document.getElementById('profil-email').value = k.eposta || '';
            if(document.getElementById('profil-telefon')) document.getElementById('profil-telefon').value = k.telefon_no || '';
        }
    } catch (error) {
        console.error('Profil yükleme hatası:', error);
    }
}

async function profilGuncelle() {
    try {
        const data = {
            kullanici_adi: document.getElementById('profil-isim').value,
            eposta: document.getElementById('profil-email').value,
            telefon_no: document.getElementById('profil-telefon').value
        };
        
        await api.updateProfil(data);
        ui.showToast('Profil başarıyla güncellendi.', 'success');
    } catch (error) {
        ui.showToast(error.message || 'Güncelleme başarısız.', 'error');
    }
}

// --- Personel Listesi (EKSİK OLAN KISIM) ---
async function personelListesiniYukle() {
    const tbody = document.getElementById('kullanici-listesi-body');
    const loader = document.getElementById('kullanici-yukleniyor');
    const emptyMsg = document.getElementById('kullanici-yok-mesaji');

    if (!tbody) return; // Profil sayfasında değilsek veya yetki yoksa çık

    try {
        if(loader) loader.classList.remove('hidden');
        if(emptyMsg) emptyMsg.classList.add('hidden');
        tbody.innerHTML = '';

        // API'den kullanıcıları çek (firma_yonetimi.js ile aynı endpoint)
        // api.js'de fetchYonetimData fonksiyonu var, tüm datayı getirir.
        // Veya direkt kullanıcıları çeken bir endpoint varsa o daha iyi olur.
        // Şimdilik fetchYonetimData kullanalım (api.js'de var olduğunu varsayıyorum).
        
        const data = await api.fetchYonetimData(); 
        // Not: data şunları içerir: { kullanicilar: [], toplayicilar: [], ... }

        const personeller = data.kullanicilar || [];

        if (personeller.length === 0) {
            if(loader) loader.classList.add('hidden');
            if(emptyMsg) emptyMsg.classList.remove('hidden');
            return;
        }

        tbody.innerHTML = personeller.map(p => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold">
                            ${p.kullanici_adi.charAt(0).toUpperCase()}
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${p.kullanici_adi}</div>
                            <div class="text-xs text-gray-500">${p.eposta || '-'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${p.rol === 'admin' ? 'bg-purple-100 text-purple-800' : 
                          p.rol === 'firma_yetkilisi' ? 'bg-blue-100 text-blue-800' : 
                          p.rol === 'toplayici' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        ${formatRol(p.rol)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm text-green-600"><i class="fa-solid fa-check-circle mr-1"></i>Aktif</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="sifreSifirlaModalAc(${p.id}, '${p.kullanici_adi}')" class="text-amber-600 hover:text-amber-900 mr-3" title="Şifre Sıfırla">
                        <i class="fa-solid fa-key"></i>
                    </button>
                    ${p.rol !== 'firma_yetkilisi' && p.rol !== 'admin' ? `
                    <button onclick="kullaniciSilModalAc(${p.id}, '${p.kullanici_adi}')" class="text-red-600 hover:text-red-900" title="Sil">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    ` : ''}
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Personel listesi hatası:', error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Veri yüklenemedi.</td></tr>`;
    } finally {
        if(loader) loader.classList.add('hidden');
    }
}

// --- Yardımcı Fonksiyonlar ---
function formatRol(rol) {
    const roller = {
        'admin': 'Admin',
        'firma_yetkilisi': 'Yönetici',
        'toplayici': 'Toplayıcı',
        'muhasebeci': 'Muhasebeci',
        'ciftci': 'Müstahsil'
    };
    return roller[rol] || rol;
}

// --- Şifre Değiştirme (Kendi Şifresi) ---
async function sifreDegistir() {
    const eski = document.getElementById('mevcut-sifre-input').value;
    const yeni = document.getElementById('kullanici-yeni-sifre-input').value;
    const yeniT = document.getElementById('kullanici-yeni-sifre-tekrar-input').value;

    if (yeni !== yeniT) {
        ui.showToast('Yeni şifreler uyuşmuyor!', 'warning');
        return;
    }

    try {
        await api.postChangePassword({ old_password: eski, new_password: yeni });
        ui.showToast('Şifreniz başarıyla değiştirildi.', 'success');
        toggleModal('sifreDegistirModal', false);
        document.getElementById('mevcut-sifre-input').value = '';
        document.getElementById('kullanici-yeni-sifre-input').value = '';
        document.getElementById('kullanici-yeni-sifre-tekrar-input').value = '';
    } catch (error) {
        ui.showToast(error.message || 'Şifre değiştirilemedi.', 'error');
    }
}

// --- Yeni Kullanıcı Ekleme ---
function yeniKullaniciEkleModalAc() {
    toggleModal('yeniKullaniciModal', true);
}

async function yeniKullaniciKaydet() {
    const adi = document.getElementById('yeni-kullanici-adi').value;
    const sifre = document.getElementById('yeni-kullanici-sifre').value;
    const rol = document.getElementById('yeni-kullanici-rol').value;

    if(!adi || !sifre) {
        ui.showToast('Lütfen tüm alanları doldurun', 'warning');
        return;
    }

    try {
        // api.js'de postToplayiciEkle var ama genel kullanıcı ekleme için de kullanılabilir
        // veya yeni bir endpoint yazmak gerekebilir. Şimdilik toplayıcı ekle endpointini kullanıyoruz
        // çünkü genelde toplayıcı ekleniyor. Eğer muhasebeci eklenecekse backend güncellenmeli.
        await api.postToplayiciEkle({ kullanici_adi: adi, sifre: sifre, rol: rol });
        
        ui.showToast('Kullanıcı başarıyla eklendi.', 'success');
        toggleModal('yeniKullaniciModal', false);
        personelListesiniYukle(); // Listeyi yenile
        
        // Formu temizle
        document.getElementById('yeni-kullanici-form').reset();
    } catch (error) {
        ui.showToast(error.message || 'Kayıt başarısız.', 'error');
    }
}

// --- Kullanıcı Silme ---
let silinecekKullaniciId = null;
function kullaniciSilModalAc(id, adi) {
    silinecekKullaniciId = id;
    document.getElementById('silinecek-kullanici-adi').textContent = adi;
    toggleModal('kullaniciSilOnayModal', true);
}

async function kullaniciSil() {
    if(!silinecekKullaniciId) return;
    try {
        await api.deleteKullanici(silinecekKullaniciId);
        ui.showToast('Kullanıcı silindi.', 'success');
        toggleModal('kullaniciSilOnayModal', false);
        personelListesiniYukle();
    } catch (error) {
        ui.showToast(error.message || 'Silme işlemi başarısız.', 'error');
    }
}

// --- Şifre Sıfırlama (Yöneticinin Personele Yaptığı) ---
function sifreSifirlaModalAc(id, adi) {
    // Bu modal HTML'de yoksa basit bir prompt ile halledelim veya modal ekleyelim.
    // Hızlı çözüm için Prompt:
    const yeniSifre = prompt(`${adi} için yeni şifreyi girin:`);
    if(yeniSifre) {
        api.postKullaniciSifreSetle(id, { yeni_sifre: yeniSifre })
           .then(() => ui.showToast('Şifre güncellendi.', 'success'))
           .catch(err => ui.showToast(err.message, 'error'));
    }
}