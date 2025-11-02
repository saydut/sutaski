# services/auth_service.py

from flask import g
from extensions import bcrypt, turkey_tz
from datetime import datetime
from postgrest import APIError
import logging
# Bu import satırı çok önemli:
from constants import UserRole

logger = logging.getLogger(__name__)

class AuthService:
    """Kullanıcı kimlik doğrulama işlemleri için servis katmanı."""

    def register_user(self, kullanici_adi, sifre, sirket_adi):
        """Yeni bir kullanıcı ve YENİ bir şirket kaydı yapar."""
        try:
            if not all([kullanici_adi, sifre, sirket_adi]):
                raise ValueError("Tüm alanların doldurulması zorunludur.")

            # 1. Kullanıcı adı benzersiz mi?
            kullanici_var_mi = g.supabase.table('kullanicilar').select('id', count='exact').eq('kullanici_adi', kullanici_adi).execute()
            if kullanici_var_mi.count > 0:
                raise ValueError("Bu kullanıcı adı zaten mevcut.")

            # 2. Şirket adı benzersiz mi? (YENİ KURAL)
            formatted_name = sirket_adi.strip().title()
            sirket_response = g.supabase.table('sirketler').select('id').eq('sirket_adi', formatted_name).execute()

            if sirket_response.data:
                # Şirket zaten varsa, kayıt olmasını engelle
                raise ValueError(f"'{formatted_name}' adında bir şirket zaten kayıtlı. Lütfen giriş yapın veya yöneticinizle iletişime geçin.")

            # 3. Şirket ve Kullanıcıyı oluştur (Çünkü ikisi de yeni)
            
            # Yeni şirketi oluştur
            yeni_sirket_response = g.supabase.table('sirketler').insert({'sirket_adi': formatted_name}).execute()
            sirket_id = yeni_sirket_response.data[0]['id']
            
            # Yeni kullanıcıyı 'firma_yetkilisi' rolüyle oluştur
            rol = UserRole.FIRMA_YETKILISI.value 
            
            hashed_sifre = bcrypt.generate_password_hash(sifre).decode('utf-8')
            
            g.supabase.table('kullanicilar').insert({
                'kullanici_adi': kullanici_adi, 
                'sifre': hashed_sifre,
                'sirket_id': sirket_id,
                'rol': rol
            }).execute()

            # Mesajı daha açıklayıcı hale getirdim
            return {"message": "Şirketiniz ve yönetici hesabınız başarıyla oluşturuldu! Giriş yapabilirsiniz."}

        except ValueError as ve:
            raise
        except APIError as e:
            logger.error(f"Kayıt sırasında API hatası: {e}", exc_info=True)
            raise Exception("Kayıt sırasında bir veritabanı hatası oluştu.")
        except Exception as e:
            logger.error(f"Kayıt sırasında genel hata: {e}", exc_info=True)
            raise Exception("Kayıt sırasında beklenmedik bir sunucu hatası oluştu.")

    def _get_or_create_sirket(self, sirket_adi):
        """
        Verilen isimde bir şirket arar, bulamazsa yenisini oluşturur.
        Dönüş değeri olarak (sirket_id, is_yeni_sirket_mi) şeklinde bir tuple döndürür.
        (Bu fonksiyon artık register_user tarafından kullanılmıyor ancak başka bir yerde
         kullanılma ihtimaline karşı yerinde bırakılabilir.)
        """
        formatted_name = sirket_adi.strip().title()
        sirket_response = g.supabase.table('sirketler').select('id').eq('sirket_adi', formatted_name).execute()
        
        if sirket_response.data:
            # Şirket zaten varsa, ID'sini ve 'yeni değil' (False) bilgisini döndür.
            return sirket_response.data[0]['id'], False
        
        # Şirket yoksa, yeni bir tane oluştur.
        yeni_sirket_response = g.supabase.table('sirketler').insert({'sirket_adi': formatted_name}).execute()
        # Yeni şirketin ID'sini ve 'yeni' (True) bilgisini döndür.
        return yeni_sirket_response.data[0]['id'], True


    def login_user(self, kullanici_adi, sifre):
        """Kullanıcıyı doğrular, lisansını kontrol eder ve oturum verilerini döndürür."""
        try:
            user_response = g.supabase.table('kullanicilar').select('*, sirketler(sirket_adi, lisans_bitis_tarihi)').eq('kullanici_adi', kullanici_adi).execute()
        
            if not user_response.data:
                raise ValueError("Bu kullanıcı adına sahip bir hesap bulunamadı.")

            user = user_response.data[0]
            self._check_license(user)

            if not bcrypt.check_password_hash(user['sifre'], sifre):
                raise ValueError("Yanlış şifre.")

            session_data = {
                'id': user['id'],
                'kullanici_adi': user['kullanici_adi'],
                'sirket_id': user['sirket_id'],
                'rol': user['rol'],
                'sirket_adi': user['sirketler']['sirket_adi'] if user.get('sirketler') else 'Atanmamış',
                'lisans_bitis_tarihi': user['sirketler']['lisans_bitis_tarihi'] if user.get('sirketler') else None
            }
            return session_data

        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Giriş yapılırken hata oluştu: {e}", exc_info=True)
            raise Exception("Giriş yapılırken bir sunucu hatası oluştu.")


    def _check_license(self, user):
        """Kullanıcının şirket lisansının geçerli olup olmadığını kontrol eder."""
        if user.get('rol') == 'admin':
            return

        lisans_bilgisi = user.get('sirketler')
        if not lisans_bilgisi or not lisans_bilgisi.get('lisans_bitis_tarihi'):
            raise ValueError("Şirketiniz için bir lisans tanımlanmamıştır.")
        
        try:
            lisans_bitis_tarihi_str = lisans_bilgisi['lisans_bitis_tarihi']
            lisans_bitis_tarihi_obj = datetime.strptime(lisans_bitis_tarihi_str, '%Y-%m-%d').date()
            bugun_tr = datetime.now(turkey_tz).date()
            
            if bugun_tr >= lisans_bitis_tarihi_obj:
                raise ValueError("Şirketinizin lisans süresi dolmuştur.")
        except (ValueError, TypeError) as e:
            if "Şirketinizin lisans süresi dolmuştur" not in str(e):
                 logger.error(f"Lisans tarihi format hatası: {e}", exc_info=True)
                 raise Exception("Lisans tarihi formatı geçersiz. Yöneticinizle iletişime geçin.")
            else:
                raise e

auth_service = AuthService()