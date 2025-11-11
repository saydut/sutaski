# services/firma_service.py

import logging
from flask import g
# Artık bcrypt veya random'a gerek yok
from constants import UserRole
from utils import sanitize_input
# HER İKİ client'ı da import ediyoruz
from extensions import supabase_client, supabase_service
from gotrue.errors import AuthApiError

logger = logging.getLogger(__name__)

# _generate_unique_toplayici_username fonksiyonu artık GEREKLİ DEĞİL,
# çünkü kimlik doğrulama 'email' ile yapılacak ve email zaten benzersiz (unique).

class FirmaService:
    """Firma yönetimi (personel, atamalar) işlemleri için servis katmanı. RLS ile güncellendi."""

    def get_personel_listesi(self):
        """
        Firma admininin kendi personelini (toplayıcıları) RLS kullanarak listeler.
        sirket_id filtresine GEREK YOKTUR.
        """
        try:
            # g.supabase -> supabase_client
            # kullanicilar -> profiller
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('profiller') \
                .select('id, kullanici_adi, rol, eposta, telefon_no, adres, created_at') \
                .neq('rol', UserRole.CIFCI.value) \
                .neq('rol', UserRole.ADMIN.value) \
                .neq('rol', UserRole.FIRMA_YETKILISI.value) \
                .order('created_at', desc=True) \
                .execute()
            return response.data, None
        except Exception as e:
            logger.error(f"Personel listesi alınırken hata: {e}", exc_info=True)
            return None, "Personel listesi alınırken bir hata oluştu."

    def create_personel_user(self, data: dict, rol_tipi: str = UserRole.TOPLAYICI.value):
        """
        Firma admininin yeni bir personel (toplayıcı veya çiftçi) oluşturmasını sağlar.
        1. Auth'ta kullanıcıyı oluşturur (admin istemcisiyle).
        2. 'profiller' tablosuna kayıt atar (admin istemcisiyle).
        """
        try:
            # Gerekli ID'leri 'g' objesinden al
            sirket_id = g.profile['sirket_id']
            
            # Formdan gelen verileri al ve temizle
            kullanici_adi = sanitize_input(data.get('kullanici_adi'))
            email = sanitize_input(data.get('email'))
            password = data.get('password') # Şifreyi sanitize etme
            telefon_no = sanitize_input(data.get('telefon_no')) or None
            adres = sanitize_input(data.get('adres')) or None

            if not all([kullanici_adi, email, password]):
                raise ValueError("Kullanıcı adı, e-posta ve şifre zorunludur.")
            
            if rol_tipi not in [UserRole.TOPLAYICI.value, UserRole.CIFCI.value]:
                raise ValueError("Geçersiz rol tipi.")

            # 1. ADIM: Supabase Auth'ta kullanıcıyı oluştur (Admin/Service istemcisi ile)
            try:
                auth_response = supabase_service.auth.admin.create_user(
                    email=email,
                    password=password,
                    email_confirm=True # veya False
                )
                new_user_id = auth_response.user.id
            except AuthApiError as e:
                if "User already registered" in str(e):
                    raise ValueError("Bu e-posta adresi zaten kayıtlı.")
                raise Exception(f"Auth kullanıcısı oluşturulamadı: {str(e)}")

            # 2. ADIM: 'profiller' tablosuna veriyi ekle (Admin/Service istemcisi ile)
            # RLS'i bypass ederek ekliyoruz, çünkü bu bir admin işlemi.
            # Alternatif olarak (yukarıda SQL'de yaptığımız gibi) RLS politikası ekleyip
            # 'supabase_client' ile de ekleyebilirdik. Admin client'ı daha garantidir.
            profil_data = {
                'id': new_user_id, # UUID
                'sirket_id': sirket_id,
                'rol': rol_tipi,
                'kullanici_adi': kullanici_adi,
                'eposta': email,
                'telefon_no': telefon_no,
                'adres': adres
            }
            
            profil_res = supabase_service.table('profiller').insert(profil_data).execute()
            
            if not profil_res.data:
                # Profil eklenemezse, Auth kullanıcısını geri sil (Rollback)
                supabase_service.auth.admin.delete_user(new_user_id)
                raise Exception("Auth kullanıcısı oluşturuldu ancak profil oluşturulamadı.")

            return profil_res.data[0], None

        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Personel (rol: {rol_tipi}) oluşturulurken hata: {e}", exc_info=True)
            return None, f"Yeni {rol_tipi} hesabı oluşturulurken bir hata oluştu: {str(e)}"

    def delete_personel_user(self, kullanici_id_uuid: str):
        """
        Bir personeli (toplayıcı veya çiftçi) siler.
        Hem 'profiller' hem de 'auth.users' tablosundan siler.
        """
        try:
            # 1. Kullanıcıyı 'profiller' tablosundan al ve rolünü kontrol et (RLS ile)
            # RLS, bu kullanıcının bizim şirketimizde olduğunu zaten doğrular.
            user_res = supabase_client.table('profiller') \
                .select('id, rol') \
                .eq('id', kullanici_id_uuid) \
                .single() \
                .execute()

            if not user_res.data:
                 raise ValueError("Kullanıcı bulunamadı veya bu işlem için yetkiniz yok.")
            
            rol = user_res.data['rol']
            if rol in [UserRole.ADMIN.value, UserRole.FIRMA_YETKILISI.value]:
                 raise ValueError("Admin veya Firma Yetkilisi hesaplarını buradan silemezsiniz.")

            # 2. İlişkili verileri kontrol et (DB Foreign Key'lerine güvenmek yerine)
            # (Bu kısım opsiyoneldir, DB'deki 'ON DELETE RESTRICT' zaten hata verecektir)

            # 3. Kullanıcıyı 'auth.users' tablosundan SİL (Admin/Service istemcisi GEREKLİ)
            # Bu işlem, 'profiller' tablosundaki kaydı da (ON DELETE CASCADE ile)
            # otomatik olarak silecektir.
            supabase_service.auth.admin.delete_user(kullanici_id_uuid)
            
            return True, None
        
        except ValueError as ve:
             return None, str(ve)
        except Exception as e:
            if 'violates foreign key constraint' in str(e).lower():
                return None, "Bu kullanıcıya ait girdiler veya atamalar olduğu için silinemiyor."
            logger.error(f"Personel silinirken hata (ID: {kullanici_id_uuid}): {e}", exc_info=True)
            return None, "Personel silinirken bir hata oluştu."


    # --- Atama Fonksiyonları ---

    def get_toplayici_tedarikci_atamalari(self):
        """
        Şirketteki tüm toplayıcı-tedarikçi atamalarını RLS kullanarak listeler.
        Python filtrelemesine GEREK YOKTUR.
        """
        try:
            # sirket_id parametresi ve tüm Python filtrelemesi KALDIRILDI.
            # RLS (Bölüm 3, Adım 4'te yazdığımız) bunu otomatik filtreler.
            # 'kullanicilar' -> 'profiller'
            response = supabase_client.table('toplayici_tedarikci_atananlari') \
                .select('id, toplayici_id, tedarikci_id, profiller(kullanici_adi), tedarikciler(isim)') \
                .execute()
            
            return response.data, None
        except Exception as e:
            logger.error(f"Toplayıcı-Tedarikçi atamaları alınırken hata: {e}", exc_info=True)
            return None, "Atama listesi alınırken bir hata oluştu."

    def get_atama_icin_veriler(self):
        """Atama modalı için toplayıcıları ve tedarikçileri RLS kullanarak getirir."""
        try:
            # sirket_id parametresi ve filtresi KALDIRILDI
            toplayicilar_res = supabase_client.table('profiller') \
                .select('id, kullanici_adi') \
                .eq('rol', UserRole.TOPLAYICI.value) \
                .order('kullanici_adi') \
                .execute()
            
            tedarikciler_res = supabase_client.table('tedarikciler') \
                .select('id, isim') \
                .order('isim') \
                .execute()
                
            return toplayicilar_res.data, tedarikciler_res.data, None
        except Exception as e:
            logger.error(f"Atama verileri (toplayıcı/tedarikçi) alınırken hata: {e}", exc_info=True)
            return None, None, "Atama için gerekli veriler alınamadı."

    def add_toplayici_tedarikci_atama(self, toplayici_id: str, tedarikci_id: int):
        """Yeni bir toplayıcı-tedarikçi ataması ekler. RLS güvenliği sağlar."""
        try:
            if not toplayici_id or not tedarikci_id:
                raise ValueError("Toplayıcı ve Tedarikçi seçimi zorunludur.")
            
            # Güvenlik Kontrolü (aynı şirketteler mi?) bloğu KALDIRILDI.
            # SQL'de yazdığımız RLS (WITH CHECK) politikası,
            # farklı şirketler arası atamayı otomatik olarak engelleyecektir.

            yeni_atama = {
                "toplayici_id": toplayici_id, # Bu artık bir UUID (string)
                "tedarikci_id": tedarikci_id
            }
            response = supabase_client.table('toplayici_tedarikci_atananlari').insert(yeni_atama).execute()
            
            return response.data[0], None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            if 'unique constraint' in str(e).lower():
                return None, "Bu atama zaten yapılmış."
            logger.error(f"Toplayıcı-Tedarikçi ataması eklenirken hata: {e}", exc_info=True)
            return None, "Atama yapılırken bir sunucu hatası oluştu."

    def delete_toplayici_tedarikci_atama(self, atama_id: int):
        """Bir toplayıcı-tedarikçi atamasını RLS kullanarak siler."""
        try:
            # sirket_id parametresi ve Güvenlik Kontrolü bloğu KALDIRILDI.
            # RLS, bu atama_id'nin bizim şirketimize ait olup olmadığını
            # (ilişkili toplayıcı/tedarikçi üzerinden) otomatik olarak bilir.
            
            response = supabase_client.table('toplayici_tedarikci_atananlari') \
                .delete() \
                .eq('id', atama_id) \
                .execute()
            
            if not response.data:
                 raise ValueError("Atama kaydı bulunamadı veya silme yetkiniz yok.")
            return True, None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Toplayıcı-Tedarikçi ataması silinirken hata (ID: {atama_id}): {e}", exc_info=True)
            return None, "Atama silinirken bir sunucu hatası oluştu."

# Servisin bir örneğini (instance) oluştur
firma_service = FirmaService()