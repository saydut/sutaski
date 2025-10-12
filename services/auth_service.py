# services/auth_service.py

from extensions import supabase, bcrypt, turkey_tz
from datetime import datetime
from postgrest import APIError

class AuthService:
    """Kullanıcı kimlik doğrulama işlemleri için servis katmanı."""

    def register_user(self, kullanici_adi, sifre, sirket_adi):
        """Yeni bir kullanıcı ve gerekirse yeni bir şirket kaydı yapar."""
        try:
            # Gerekli alanların kontrolü
            if not all([kullanici_adi, sifre, sirket_adi]):
                raise ValueError("Tüm alanların doldurulması zorunludur.")

            # Kullanıcı adının mevcut olup olmadığını kontrol et
            kullanici_var_mi = supabase.table('kullanicilar').select('id', count='exact').eq('kullanici_adi', kullanici_adi).execute()
            if kullanici_var_mi.count > 0:
                raise ValueError("Bu kullanıcı adı zaten mevcut.")

            sirket_id = self._get_or_create_sirket(sirket_adi)

            hashed_sifre = bcrypt.generate_password_hash(sifre).decode('utf-8')
            
            supabase.table('kullanicilar').insert({
                'kullanici_adi': kullanici_adi, 
                'sifre': hashed_sifre,
                'sirket_id': sirket_id
            }).execute()

            return {"message": "Kayıt başarılı!"}

        except ValueError as ve:
            # Kendi oluşturduğumuz hataları doğrudan geri gönder
            raise
        except APIError as e:
            # Veritabanından gelen özel hataları yakala
            if "violates unique constraint" in e.message:
                raise ValueError(f"'{sirket_adi}' adında bir şirket zaten mevcut. Lütfen tam adını doğru yazdığınızdan emin olun.")
            else:
                print(f"Auth Service (register) API Hatası: {e}")
                raise Exception("Kayıt sırasında bir veritabanı hatası oluştu.")
        except Exception as e:
            print(f"Auth Service (register) Genel Hata: {e}")
            raise Exception("Kayıt sırasında beklenmedik bir sunucu hatası oluştu.")

    def _get_or_create_sirket(self, sirket_adi):
        """Verilen isimde bir şirket arar (büyük/küçük harf duyarsız), 
           bulamazsa standart bir formatta yenisini oluşturur."""
        
        formatted_name = sirket_adi.strip().title()

        # DEĞİŞİKLİK 1: .single() komutunu buradan kaldırdık.
        sirket_response = supabase.table('sirketler').select('id').eq('sirket_adi', formatted_name).execute()
        
        # DEĞİŞİKLİK 2: Artık bir liste beklediğimiz için ilk elemanı seçiyoruz.
        if sirket_response.data:
            return sirket_response.data[0]['id']
        
        # Eğer bulunamadıysa, yeni şirketi standart formatta oluştur.
        yeni_sirket_response = supabase.table('sirketler').insert({'sirket_adi': formatted_name}).execute()
        return yeni_sirket_response.data[0]['id']


    def login_user(self, kullanici_adi, sifre):
        """Kullanıcıyı doğrular, lisansını kontrol eder ve oturum verilerini döndürür."""
        try:
            user_response = supabase.table('kullanicilar').select('*, sirketler(sirket_adi, lisans_bitis_tarihi)').eq('kullanici_adi', kullanici_adi).execute()
        
            if not user_response.data:
                raise ValueError("Bu kullanıcı adına sahip bir hesap bulunamadı.")

            user = user_response.data[0]
            
            # Lisans kontrolü
            self._check_license(user)

            # Şifre kontrolü
            if not bcrypt.check_password_hash(user['sifre'], sifre):
                raise ValueError("Yanlış şifre.")

            # Oturum için gerekli verileri hazırla
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
            print(f"Auth Service (login) Hatası: {e}")
            raise Exception("Giriş yapılırken bir sunucu hatası oluştu.")


    def _check_license(self, user):
        """Kullanıcının şirket lisansının geçerli olup olmadığını kontrol eder."""
        if user.get('rol') == 'admin':
            return # Adminler lisans kontrolünden muaftır

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
            # Eğer hata bizim oluşturduğumuz ValueError değilse, bu bir format hatasıdır.
            if "Şirketinizin lisans süresi dolmuştur" not in str(e):
                 print(f"Lisans tarihi format hatası: {e}")
                 raise Exception("Lisans tarihi formatı geçersiz. Yöneticinizle iletişime geçin.")
            else:
                raise e # Lisans süresinin dolması hatasını tekrar fırlat


# Servisten bir örnek (instance) oluşturalım ki blueprint bunu kullanabilsin.
auth_service = AuthService()