# services/firma_service.py

import logging
from flask import g  # <-- Düzeltme: 'g' objesini import ediyoruz
from extensions import bcrypt
from constants import UserRole
from postgrest import APIError  # <-- Düzeltme: PostgrestAPIError yerine APIError
from utils import sanitize_input
# Hatalı importlar kaldırıldı: 'from extensions import supabase'

logger = logging.getLogger(__name__)

# --- Yardımcı Fonksiyon: Benzersiz Çiftçi Kullanıcı Adı Oluştur ---
# Bu fonksiyon zaten 'g.supabase' kullandığı için doğruydu.
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

# --- Ana Servis Fonksiyonları ---

# Bu fonksiyon zaten 'g.supabase' kullandığı için doğruydu.
def add_kullanici(sirket_id, data):
    """Yeni bir çiftçi/toplayıcı/muhasebeci oluşturur ve auth'a kaydeder."""
    try:
        email = sanitize_input(data.get('email'))
        sifre = data.get('sifre') 
        rol = sanitize_input(data.get('rol'))
        isim = sanitize_input(data.get('isim'))
        telefon = sanitize_input(data.get('telefon'))
        
        if not email or not sifre or not rol or not isim:
            raise ValueError("Email, şifre, rol ve isim alanları zorunludur.")
            
        gecerli_roller = [UserRole.CIFCI.value, UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value]
        if rol not in gecerli_roller:
            raise ValueError(f"Geçersiz rol. Rol '{UserRole.CIFCI.value}', '{UserRole.TOPLAYICI.value}' veya '{UserRole.MUHASEBECI.value}' olmalı.")

        try:
            auth_res = g.supabase.auth.admin.create_user({
                "email": email,
                "password": sifre,
                "email_confirm": True
            })
            auth_user = auth_res.user
            
        except APIError as auth_error:
            logger.error(f"Auth kullanıcısı oluşturulurken hata: {auth_error.message}")
            if "already registered" in auth_error.message:
                raise ValueError("Bu e-posta adresi zaten kayıtlı.")
            if "weak password" in auth_error.message:
                raise ValueError("Şifre çok zayıf. Lütfen daha güçlü bir şifre seçin.")
            raise 

        if rol == UserRole.CIFCI.value:
            kullanici_adi = _generate_unique_farmer_username(isim, sirket_id)
        else:
            kullanici_adi = email

        hashed_sifre = bcrypt.generate_password_hash(sifre).decode('utf-8')

        kullanici_data = {
            'user_id': auth_user.id, 
            'sirket_id': sirket_id,
            'rol': rol,
            'kullanici_adi': kullanici_adi,
            'sifre': hashed_sifre, 
            'email': email,
            'isim': isim,
            'telefon_no': telefon
        }
        
        kullanici_res = g.supabase.table('kullanicilar').insert(kullanici_data).execute()
        yeni_kullanici = kullanici_res.data[0]
        
        # 'kullanici_detaylari' tablosu veritabanında bulunmadığı için bu kısım geçici olarak kapatıldı.
        # Eğer bu tabloyu (003 numaralı migration ile) eklerseniz burayı açabilirsiniz.
        # detay_data = {
        #     'id': auth_user.id, 
        #     'sirket_id': sirket_id,
        #     'rol': rol,
        #     'isim': isim,
        #     'kullanici_db_id': yeni_kullanici['id'] 
        # }
        # g.supabase.table('kullanici_detaylari').insert(detay_data).execute()

        logger.info(f"Yeni kullanıcı (Rol: {rol}) başarıyla eklendi. Auth ID: {auth_user.id}, DB ID: {yeni_kullanici['id']}")
        
        yeni_kullanici.pop('sifre', None)
        return yeni_kullanici

    except (ValueError, APIError) as e:
        logger.warning(f"Kullanıcı eklenirken doğrulama hatası: {str(e)}")
        raise e
    except Exception as e:
        logger.error(f"Kullanıcı eklenirken beklenmedik hata: {e}", exc_info=True)
        if 'auth_user' in locals() and auth_user:
            try:
                g.supabase.auth.admin.delete_user(auth_user.id)
                logger.info(f"Rollback: Auth kullanıcısı {auth_user.id} silindi.")
            except Exception as roll_e:
                logger.error(f"Rollback hatası: Auth kullanıcısı {auth_user.id} silinemedi: {roll_e}")
        raise Exception(f"Kullanıcı oluşturulurken sunucu hatası: {str(e)}")

# Bu fonksiyon zaten 'g.supabase' kullandığı için doğruydu.
def update_kullanici(user_id, data):
    """Mevcut bir kullanıcının bilgilerini günceller."""
    try:
        isim = sanitize_input(data.get('isim'))
        email = sanitize_input(data.get('email'))
        telefon = sanitize_input(data.get('telefon'))
        
        # 'kullanici_detaylari' tablosu bulunamadığı için bu kısım kapatıldı.
        # update_data_detay = {}
        # if isim:
        #     update_data_detay['isim'] = isim
        
        update_data_kullanicilar = {}
        if email:
            update_data_kullanicilar['email'] = email
        if isim:
            # 'isim' sütunu 'kullanicilar' tablosunda da var gibi görünüyor.
            update_data_kullanicilar['isim'] = isim
        if telefon:
            update_data_kullanicilar['telefon_no'] = telefon

        # if update_data_detay:
        #     g.supabase.table('kullanici_detaylari').update(update_data_detay).eq('id', user_id).execute()

        if update_data_kullanicilar:
            g.supabase.table('kullanicilar').update(update_data_kullanicilar).eq('user_id', user_id).execute()

        if email:
            try:
                g.supabase.auth.admin.update_user_by_id(user_id, {"email": email})
            except APIError as auth_error:
                logger.warning(f"Auth e-postası güncellenirken hata (ID: {user_id}): {auth_error.message}")
                if "already registered" in auth_error.message:
                    raise ValueError("Bu e-posta adresi zaten başka bir kullanıcı tarafından kullanılıyor.")
        
        logger.info(f"Kullanıcı (ID: {user_id}) bilgileri güncellendi.")
        
        return {"success": True, "message": "Kullanıcı güncellendi."}

    except ValueError as ve:
        raise ve 
    except Exception as e:
        logger.error(f"Kullanıcı (ID: {user_id}) güncellenirken hata: {e}", exc_info=True)
        raise Exception(f"Kullanıcı güncellenirken sunucu hatası: {str(e)}")


# --- BU FONKSİYON GÜNCELLENDİ (delete_kullanici) ---
def delete_kullanici(user_id):
    """
    Bir kullanıcıyı sistemden güvenli bir şekilde siler (Toplayıcı, Çiftçi vb.).
    Bu fonksiyon, 'g.supabase' kullanarak GÜVENLİ RPC'yi çağırır.
    
    Sıralama çok önemlidir:
    1. 'cleanup_user_data' RPC'si çağrılarak tüm ilişkili veriler temizlenir (SET NULL).
    2. 'kullanici_detaylari' tablosundan silinir (Eğer varsa).
    3. 'auth.users' tablosundan (Supabase Auth) silinir.
    """
    try:
        # 1. Adım: 'cleanup_user_data' SQL fonksiyonunu 'g.supabase' üzerinden çağır.
        rpc_result = g.supabase.rpc('cleanup_user_data', {'p_auth_user_id': user_id}).execute()
        
        if rpc_result.data and 'SQL cleanup hatasi' in rpc_result.data:
            logger.error(f"SQL cleanup_user_data hatası (Auth ID: {user_id}): {rpc_result.data}")
            raise Exception(f"SQL fonksiyon hatası: {rpc_result.data}")

        # 2. Adım: 'kullanici_detaylari' tablosundan 'g.supabase' ile sil.
        # Bu tablo olmasa bile hata vermemesi için 'try-except' içine alıyoruz.
        try:
            g.supabase.table('kullanici_detaylari').delete().eq('id', user_id).execute()
        except APIError as e:
            if "PGRST205" in str(e): # 'PGRST205' tablo bulunamadı kodudur
                 logger.warning("kullanici_detaylari tablosu bulunamadi, silme adimi atlandi.")
            else:
                 raise # Başka bir veritabanı hatasıysa fırlat

        # 3. Adım: Supabase Authentication'dan 'g.supabase' ile kullanıcıyı sil.
        g.supabase.auth.admin.delete_user(user_id)

        logger.info(f"Kullanıcı (Auth ID: {user_id}) başarıyla silindi.")
        return {"success": True, "message": "Kullanıcı başarıyla silindi."}

    except APIError as e:
        logging.error(f"Kullanıcı silinirken Postgrest hatası (Auth ID: {user_id}): {e.message}", exc_info=True)
        return {"success": False, "message": f"Veritabanı hatası: {e.message}"}
    except Exception as e:
        logging.error(f"Kullanıcı silinirken genel hata (Auth ID: {user_id}): {e}", exc_info=True)
        
        if "User not found" in str(e):
             logger.warning(f"Auth kullanıcısı {user_id} bulunamadı, muhtemelen daha önce silinmiş.")
             return {"success": True, "message": "Kullanıcı zaten silinmiş veya bulunamadı."}
        
        return {"success": False, "message": "Kullanıcı silinirken beklenmedik bir hata oluştu."}


# --- BU FONKSİYON GÜNCELLENDİ (get_kullanicilar_by_sirket_id) ---
def get_kullanicilar_by_sirket_id(sirket_id):
    """
    Bir şirkete bağlı tüm kullanıcıları (çiftçi, toplayıcı, muhasebeci) listeler.
    DÜZELTME: 'kullanici_detaylari' tablosu bulunamadığı için 'kullanicilar' tablosundan veri çeker.
    """
    try:
        # 'kullanici_detaylari' yerine 'kullanicilar' tablosunu çağır
        response = g.supabase.table('kullanicilar') \
            .select('user_id, rol, kullanici_adi, id') # id (bigint), user_id (uuid), rol, kullanici_adi
            .eq('sirket_id', sirket_id) \
            .neq('rol', UserRole.FIRMA_YETKILISI.value) \
            .neq('rol', UserRole.ADMIN.value) \
            .order('kullanici_adi', desc=False) \
            .execute()
        
        # Arayüz (frontend) 'id' (uuid), 'isim' ve 'kullanici_db_id' (bigint) bekliyordu.
        # Bu beklentiyi karşılamak için veriyi yeniden formatlayalım:
        formatted_data = []
        for user in response.data:
            formatted_data.append({
                'id': user.get('user_id'), # Auth UUID'si (bu 'id' olarak kullanılır)
                'rol': user.get('rol'),
                'isim': user.get('kullanici_adi'), # 'isim' yerine 'kullanici_adi' kullan
                'kullanici_db_id': user.get('id') # 'kullanicilar' tablosunun kendi ID'si (bigint)
            })
        
        return formatted_data
        
    except APIError as e:
        logger.error(f"Şirket kullanıcıları alınırken hata (Sirket ID: {sirket_id}): {e.message}", exc_info=True)
        raise Exception(f"Kullanıcılar alınırken sunucu hatası: {str(e.message)}")
    except Exception as e:
        logger.error(f"Şirket kullanıcıları alınırken hata (Sirket ID: {sirket_id}): {e}", exc_info=True)
        raise Exception(f"Kullanıcılar alınırken sunucu hatası: {str(e)}")


# Bu fonksiyon zaten 'g.supabase' kullandığı için doğruydu.
def reset_kullanici_sifre(kullanici_id_to_reset, yeni_sifre_plain):
    """
    Firma yetkilisinin, kendi şirketindeki bir kullanıcının şifresini sıfırlamasını sağlar.
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