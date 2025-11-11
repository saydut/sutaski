# services/auth_service.py

from extensions import supabase_client, supabase_service
from gotrue.errors import AuthApiError
import logging

def register_admin_and_firma(email, password, sirket_adi, kullanici_adi):
    """
    Yeni bir firma ve admin kullanıcısını atomik olarak kaydeder.
    Bu işlem admin (service_role) client'ı ile yapılır.
    1. Auth'ta kullanıcıyı oluşturur.
    2. RPC çağırarak 'sirketler' ve 'profiller' tablolarına kayıt yapar.
    3. Hata olursa Auth kullanıcısını geri siler (rollback).
    """
    new_user_id = None
    try:
        # 1. ADIM: Supabase Auth'ta kullanıcıyı oluştur
        # (service_role anahtarı ile)
        auth_response = supabase_service.auth.admin.create_user(
            email=email,
            password=password,
            email_confirm=True  # E-posta doğrulaması isteyebilirsiniz (opsiyonel)
        )
        new_user_id = auth_response.user.id

    except AuthApiError as e:
        # "User already exists" hatasını yakala
        if "User already registered" in str(e) or "already exists" in str(e):
            return None, "Bu e-posta adresi zaten kayıtlı."
        logging.error(f"Auth kullanıcısı oluşturulamadı: {str(e)}")
        return None, f"Kimlik doğrulama hatası: {str(e)}"
    except Exception as e:
        logging.error(f"Bilinmeyen bir hata oluştu (Auth): {str(e)}")
        return None, "Bilinmeyen bir hata oluştu (Auth)."

    try:
        # 2. ADIM: Firmayı ve profili oluşturmak için RPC'yi çağır
        # Bu fonksiyonu (setup_new_firma_and_admin) SQL Editor'de oluşturmuştuk.
        rpc_params = {
            'p_admin_user_id': new_user_id, # Oluşturulan kullanıcının UUID'si
            'p_admin_email': email,
            'p_kullanici_adi': kullanici_adi,
            'p_sirket_adi': sirket_adi
        }
        rpc_response = supabase_service.rpc('setup_new_firma_and_admin', rpc_params).execute()
        
        if rpc_response.data:
            return rpc_response.data, None # Başarılı, yeni sirket_id'yi döndür
        else:
            # RPC'den bir hata geldi veya veri dönmedi
            raise Exception("Veritabanı fonksiyonu (RPC) beklenen yanıtı vermedi.")

    except Exception as e:
        # 3. ADIM (ROLLBACK): Profil/Şirket oluşturma başarısız olursa, 
        # 1. adımda oluşturulan Auth kullanıcısını SİL.
        try:
            if new_user_id:
                supabase_service.auth.admin.delete_user(new_user_id)
                logging.warning(f"ROLLBACK: Auth kullanıcısı silindi: {new_user_id}")
        except Exception as delete_e:
            # Bu çok kritik bir hata, manuel müdahale gerektirebilir
            logging.error(f"KRİTİK HATA: Profil oluşturulamadı ({str(e)}) VE auth kullanıcısı silinemedi ({str(delete_e)}).")
            return None, "Kritik kayıt hatası. Lütfen yöneticiye başvurun."
        
        # Hata mesajını kullanıcıya daha anlaşılır ver
        if 'duplicate key value violates unique constraint "sirketler_sirket_adi_key"' in str(e):
             return None, "Bu şirket adı zaten alınmış."
        
        logging.error(f"Firma profili oluşturulamadı, kayıt geri alındı: {str(e)}")
        return None, "Firma profili oluşturulamadı, kayıt geri alındı."


def login_user(email, password):
    """
    Kullanıcıyı anon client ile giriş yaptırır ve session bilgisini döndürür.
    """
    try:
        # RLS'e tabi olan 'anon' client'ı kullanarak giriş yap
        auth_response = supabase_client.auth.sign_in_with_password(
            {"email": email, "password": password}
        )
        return auth_response.session, None
    except AuthApiError as e:
        if "Invalid login credentials" in str(e):
            return None, "Geçersiz e-posta veya şifre."
        if "Email not confirmed" in str(e):
             return None, "E-posta adresiniz henüz doğrulanmamış."
        logging.error(f"Giriş hatası (AuthApiError): {str(e)}")
        return None, "Giriş sırasında bir hata oluştu."
    except Exception as e:
        logging.error(f"Bilinmeyen giriş hatası: {str(e)}")
        return None, "Bilinmeyen bir hata oluştu."

def logout_user():
    """
    Mevcut kullanıcının oturumunu (token'ını) geçersiz kılar.
    Decorator zaten client'ı (supabase_client) yetkilendirdiği için
    token'lara burada ihtiyacımız yok.
    """
    try:
        supabase_client.auth.sign_out()
        return True, None
    except Exception as e:
        logging.error(f"Çıkış hatası: {str(e)}")
        return False, "Çıkış yapılırken bir hata oluştu."