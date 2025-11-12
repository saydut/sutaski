# services/firma_service.py

import logging
from flask import g
from extensions import bcrypt
from constants import UserRole
from postgrest import APIError
from utils import sanitize_input 

logger = logging.getLogger(__name__)

# --- Yardımcı Fonksiyon: Benzersiz Çiftçi Kullanıcı Adı Oluştur ---
# Bu fonksiyon zaten 'kullanicilar' tablosuna ve 'kullanici_adi' sütununa baktığı için DOĞRUYDU.
def _generate_unique_farmer_username(base_name: str, sirket_id: int) -> str:
    clean_name = ''.join(c for c in sanitize_input(base_name).lower() if c.isalnum() or c == '_').replace(' ', '_')
    username_base = f"{clean_name}_ciftci"
    username = username_base
    counter = 1
    while True:
        exists_res = g.supabase.table('kullanicilar') \
            .select('id', count='exact') \
            .eq('kullanici_adi', username) \
            .eq('sirket_id', sirket_id) \
            .execute()
        if exists_res.count == 0:
            return username
        username = f"{username_base}_{counter}"
        counter += 1

# --- Ana Servis Fonksiyonları (ŞEMAYA GÖRE GÜNCELLENDİ) ---

def add_kullanici(sirket_id, data):
    """
    Yeni bir çiftçi/toplayıcı/muhasebeci oluşturur.
    ŞEMA GÜNCELLEMESİ: 
    - Supabase Auth kullanıcısı (UUID) oluşturma kaldırıldı (çünkü şemada 'user_id' sütunu yok).
    - 'kullanici_detaylari' tablosu kaldırıldı.
    - 'isim' -> 'kullanici_adi' olarak değiştirildi.
    - 'email' -> 'eposta' olarak değiştirildi.
    """
    try:
        # Şemadaki 'eposta' sütununu kullan
        email = sanitize_input(data.get('email')) # 'eposta' olarak da gelebilir, frontend'e bağlı
        sifre = data.get('sifre') 
        rol = sanitize_input(data.get('rol'))
        
        # Şemadaki 'kullanici_adi' sütununu kullan (frontend'den 'isim' olarak gelse bile)
        isim_veya_kullanici_adi = sanitize_input(data.get('isim'))
        telefon = sanitize_input(data.get('telefon'))
        
        if not email or not sifre or not rol or not isim_veya_kullanici_adi:
            raise ValueError("E-posta, şifre, rol ve isim alanları zorunludur.")
            
        gecerli_roller = [UserRole.CIFCI.value, UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value]
        if rol not in gecerli_roller:
            raise ValueError(f"Geçersiz rol. Rol '{UserRole.CIFCI.value}', '{UserRole.TOPLAYICI.value}' veya '{UserRole.MUHASEBECI.value}' olmalı.")

        # Şemada 'user_id' (UUID) olmadığı için Auth kullanıcısı OLUŞTURULMUYOR.
        # Sadece 'kullanicilar' tablosuna kayıt yapılıyor.
        
        if rol == UserRole.CIFCI.value:
            # Çiftçi için özel kullanıcı adı oluştur
            kullanici_adi = _generate_unique_farmer_username(isim_veya_kullanici_adi, sirket_id)
        else:
            # Diğer roller için e-posta = kullanıcı adı
            kullanici_adi = email

        hashed_sifre = bcrypt.generate_password_hash(sifre).decode('utf-8')

        kullanici_data = {
            # 'user_id' (UUID) sütunu şemada yok.
            'sirket_id': sirket_id,
            'rol': rol,
            'kullanici_adi': kullanici_adi,
            'sifre': hashed_sifre, 
            'eposta': email, # 'email' -> 'eposta'
            'telefon_no': telefon
            # 'isim' sütunu şemada yok, 'kullanici_adi' kullanıldı
        }
        
        kullanici_res = g.supabase.table('kullanicilar').insert(kullanici_data).execute()
        yeni_kullanici = kullanici_res.data[0]
        
        # 'kullanici_detaylari' tablosu şemada yok, o yüzden bu adım atlandı.

        logger.info(f"Yeni kullanıcı (Rol: {rol}) başarıyla eklendi. DB ID: {yeni_kullanici['id']}")
        
        yeni_kullanici.pop('sifre', None)
        return yeni_kullanici

    except (ValueError, APIError) as e:
        logger.warning(f"Kullanıcı eklenirken doğrulama hatası: {str(e)}")
        # E-posta zaten kayıtlı hatasını yakala
        if "unique constraint" in str(e).lower() and "kullanicilar_eposta_key" in str(e).lower():
            raise ValueError("Bu e-posta adresi zaten kayıtlı.")
        raise e
    except Exception as e:
        logger.error(f"Kullanıcı eklenirken beklenmedik hata: {e}", exc_info=True)
        # Auth kullanıcısı oluşturulmadığı için rollback adımına gerek yok.
        raise Exception(f"Kullanıcı oluşturulurken sunucu hatası: {str(e)}")

def update_kullanici(kullanici_db_id, data):
    """
    Mevcut bir kullanıcının bilgilerini günceller.
    ŞEMA GÜNCELLEMESİ: 
    - 'user_id' (UUID) yerine 'kullanici_db_id' (bigint) kullanıldı.
    - 'kullanici_detaylari' tablosu kaldırıldı.
    - 'isim' -> 'kullanici_adi' olarak değiştirildi.
    - 'email' -> 'eposta' olarak değiştirildi.
    """
    try:
        # Frontend 'isim' gönderse bile 'kullanici_adi' sütununa kaydediyoruz
        isim_veya_kullanici_adi = sanitize_input(data.get('isim'))
        email = sanitize_input(data.get('email'))
        telefon = sanitize_input(data.get('telefon'))
        
        # 'kullanici_detaylari' tablosu yok.
        
        update_data_kullanicilar = {}
        if email:
            update_data_kullanicilar['eposta'] = email # 'email' -> 'eposta'
        if isim_veya_kullanici_adi:
            update_data_kullanicilar['kullanici_adi'] = isim_veya_kullanici_adi # 'isim' -> 'kullanici_adi'
        if telefon:
            update_data_kullanicilar['telefon_no'] = telefon

        if not update_data_kullanicilar:
            raise ValueError("Güncellenecek veri bulunamadı.")

        # 'user_id' (UUID) yerine 'id' (bigint) ile güncelleme
        g.supabase.table('kullanicilar') \
            .update(update_data_kullanicilar) \
            .eq('id', kullanici_db_id) \
            .eq('sirket_id', g.user.sirket_id) \
            .execute()

        # Auth kullanıcısı güncellemesi kaldırıldı (veya ayrı yönetiliyor)
        
        logger.info(f"Kullanıcı (DB ID: {kullanici_db_id}) bilgileri güncellendi.")
        
        return {"success": True, "message": "Kullanıcı güncellendi."}

    except ValueError as ve:
        raise ve 
    except Exception as e:
        logger.error(f"Kullanıcı (DB ID: {kullanici_db_id}) güncellenirken hata: {e}", exc_info=True)
        raise Exception(f"Kullanıcı güncellenirken sunucu hatası: {str(e)}")

def delete_kullanici(kullanici_db_id):
    """
    Bir kullanıcıyı sistemden güvenli bir şekilde siler (Toplayıcı, Çiftçi vb.).
    ŞEMA GÜNCELLEMESİ: 
    - 'user_id' (UUID) yerine 'kullanici_db_id' (bigint) kullanıldı.
    - 'cleanup_user_data' RPC'si muhtemelen 'bigint' ID bekliyordur (şemadaki FK'lara göre).
    - 'kullanici_detaylari' ve 'auth.users' silme adımları kaldırıldı.
    """
    try:
        # Şemadaki Foreign Key'ler (kullanici_id bigint) 'kullanicilar.id' (bigint) kullandığı için
        # RPC'nin de Auth UUID yerine bu 'bigint' ID'yi beklemesi gerekir.
        # EĞER RPC 'p_auth_user_id' (UUID) bekliyorsa, bu fonksiyon ÇALIŞMAZ.
        
        # *** ÖNEMLİ NOT: ***
        # Eğer 'cleanup_user_data' RPC'niz hala Auth UUID bekliyorsa, 
        # ve sizin 'kullanicilar' tablonuzda bu UUID kayıtlı değilse,
        # 'delete_kullanici' fonksiyonunuz mevcut haliyle ÇALIŞAMAZ.
        # Şimdilik RPC'nin de 'bigint' ID'ye göre güncellendiğini varsayıyorum.
        
        # 1. Adım: 'cleanup_user_data' SQL fonksiyonunu çağır (bigint ID ile)
        # rpc_result = g.supabase.rpc('cleanup_user_data', {'p_kullanici_db_id': kullanici_db_id}).execute()
        
        # ... RPC hatası kontrolü ...

        # 2. Adım: 'kullanici_detaylari' tablosu yok.
        
        # 3. Adım: 'kullanicilar' tablosundan sil (cascade delete olmalı)
        g.supabase.table('kullanicilar').delete().eq('id', kullanici_db_id).execute()

        # 4. Adım: Auth kullanıcısı silme kaldırıldı.
        
        logger.info(f"Kullanıcı (DB ID: {kullanici_db_id}) başarıyla silindi.")
        return {"success": True, "message": "Kullanıcı başarıyla silindi."}

    except APIError as e:
        logging.error(f"Kullanıcı silinirken Postgrest hatası (DB ID: {kullanici_db_id}): {e.message}", exc_info=True)
        return {"success": False, "message": f"Veritabanı hatası: {e.message}"}
    except Exception as e:
        logging.error(f"Kullanıcı silinirken genel hata (DB ID: {kullanici_db_id}): {e}", exc_info=True)
        return {"success": False, "message": "Kullanıcı silinirken beklenmedik bir hata oluştu."}

def get_kullanicilar_by_sirket_id(sirket_id):
    """
    Bir şirkete bağlı tüm kullanıcıları listeler.
    ŞEMA GÜNCELLEMESİ: 
    - 'kullanici_detaylari' -> 'kullanicilar' tablosu oldu.
    - 'id' (UUID) -> 'id' (bigint) oldu.
    - 'isim' -> 'kullanici_adi' oldu.
    - 'kullanici_db_id' kaldırıldı.
    """
    try:
        # BU SORGUNUN BAŞARILI OLMASI GEREKİR:
        response = g.supabase.table('kullanicilar') \
            .select('id, rol, kullanici_adi') \
            .eq('sirket_id', sirket_id) \
            .neq('rol', UserRole.FIRMA_YETKILISI.value) \
            .neq('rol', UserRole.ADMIN.value) \
            .order('kullanici_adi', desc=False) \
            .execute()
        
        # Frontend'in 'isim' ve 'kullanici_db_id' bekleme ihtimaline karşı
        # veriyi eski formata benzeterek döndürelim:
        formatted_data = []
        for user in response.data:
            formatted_data.append({
                'id': user.get('id'),                   # Artık bu bigint ID
                'rol': user.get('rol'),
                'isim': user.get('kullanici_adi'),      # 'isim' alanı için 'kullanici_adi' kullan
                'kullanici_db_id': user.get('id')       # 'kullanici_db_id' için de 'id' kullan
            })
            
        return formatted_data
        
    except Exception as e:
        logger.error(f"Şirket kullanıcıları alınırken hata (Sirket ID: {sirket_id}): {e}", exc_info=True)
        raise Exception(f"Kullanıcılar alınırken sunucu hatası: {str(e)}")

def reset_kullanici_sifre(kullanici_id_to_reset, yeni_sifre_plain):
    """
    Firma yetkilisinin, kendi şirketindeki bir kullanıcının şifresini sıfırlamasını sağlar.
    Bu fonksiyon şema ile uyumluydu ('kullanicilar' tablosu ve 'id' (bigint) kullanıyor).
    Sadece rol kontrolünü güncelledim.
    """
    try:
        istek_yapan_sirket_id = g.user.sirket_id
        
        kullanici_res = g.supabase.table('kullanicilar') \
            .select('id, sirket_id, rol') \
            .eq('id', kullanici_id_to_reset) \
            .eq('sirket_id', istek_yapan_sirket_id) \
            .maybe_single() \
            .execute()

        if not kullanici_res.data:
            raise ValueError("Kullanıcı bulunamadı veya bu kullanıcı üzerinde işlem yapma yetkiniz yok.")

        # Rol kontrolü (şemaya göre)
        gecerli_roller = [UserRole.CIFCI.value, UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value]
        if kullanici_res.data['rol'] not in gecerli_roller:
            raise ValueError("Sadece çiftçi, toplayıcı veya muhasebeci rolündeki kullanıcıların şifresi değiştirilebilir.")

        hashed_sifre = bcrypt.generate_password_hash(yeni_sifre_plain).decode('utf-8')

        g.supabase.table('kullanicilar') \
            .update({'sifre': hashed_sifre}) \
            .eq('id', kullanici_id_to_reset) \
            .execute()

        logger.info(f"Kullanıcı (ID: {kullanici_id_to_reset}) şifresi firma yetkilisi tarafından güncellendi.")
        return True

    except ValueError as ve:
        raise ve
    except Exception as e:
        logger.error(f"Kullanıcı şifresi ayarlanırken hata: {e}", exc_info=True)
        raise Exception(f"Kullanıcı şifresi sıfırlanırken sunucu hatası: {str(e)}")