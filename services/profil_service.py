# services/profil_service.py

import logging
from flask import g
# Artık bcrypt'e gerek yok
# extensions'dan SADECE 'anon' client'ı (supabase_client) alıyoruz
from extensions import supabase_client
from postgrest import APIError
from gotrue.errors import AuthApiError
from utils import sanitize_input

logger = logging.getLogger(__name__)

class ProfilService:
    """
    Kullanıcı profili (profiller tablosu) ve kimlik bilgileri (auth.users)
    yönetimi için RLS'e uyumlu servis katmanı.
    """

    def get_profil_bilgileri(self):
        """
        Giriş yapmış kullanıcının (g objesinden) profil ve şirket
        bilgilerini RLS kullanarak döndürür.
        """
        try:
            # ID'ler 'g' objesinden (decorator'dan) geliyor
            user_id_uuid = g.profile['id']
            sirket_id = g.profile['sirket_id']

            # RLS, kullanıcının sadece kendi profilini çekmesine izin verir
            # 'eposta'yı da seçiyoruz (şifre değişikliği için gerekli olabilir)
            user_res = supabase_client.table('profiller') \
                .select('kullanici_adi, eposta, telefon_no, adres') \
                .eq('id', user_id_uuid) \
                .single() \
                .execute()
            
            # RLS, kullanıcının sadece kendi şirketini çekmesine izin verir
            sirket_res = supabase_client.table('sirketler') \
                .select('sirket_adi, vergi_kimlik_no, adres') \
                .eq('id', sirket_id) \
                .single() \
                .execute()

            if not user_res.data or not sirket_res.data:
                raise ValueError("Kullanıcı veya şirket bilgileri bulunamadı.")

            return { "kullanici": user_res.data, "sirket": sirket_res.data }, None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Profil bilgileri alınırken hata oluştu: {e}", exc_info=True)
            return None, "Profil bilgileri alınırken bir sunucu hatası oluştu."

    def update_profil_bilgileri(self, data: dict):
        """
        Kullanıcının profilini, şirket bilgilerini ve (isteğe bağlı) şifresini günceller.
        Şifre değişirse yeni session (token) bilgisini döndürür.
        """
        try:
            user_id_uuid = g.profile['id']
            sirket_id = g.profile['sirket_id']
            yeni_session = None # Şifre değişirse bu dolacak

            # 1. Kullanıcı Profili (profiller tablosu) Güncelleme
            kullanici_data = data.get('kullanici')
            if kullanici_data:
                guncel_kullanici_data = {
                    "kullanici_adi": sanitize_input(kullanici_data.get('kullanici_adi')),
                    "telefon_no": sanitize_input(kullanici_data.get('telefon_no')) or None,
                    "adres": sanitize_input(kullanici_data.get('adres')) or None
                }
                # RLS, sadece kendi profilini güncellemesine izin verir
                supabase_client.table('profiller') \
                    .update(guncel_kullanici_data) \
                    .eq('id', user_id_uuid) \
                    .execute()

            # 2. Şirket Bilgileri (sirketler tablosu) Güncelleme (Sadece 'firma_admin' ise)
            sirket_data = data.get('sirket')
            if sirket_data and g.profile['rol'] == 'firma_admin':
                guncel_sirket_data = {
                    "sirket_adi": sanitize_input(sirket_data.get('sirket_adi')),
                    "vergi_kimlik_no": sanitize_input(sirket_data.get('vergi_kimlik_no')) or None,
                    "adres": sanitize_input(sirket_data.get('adres')) or None
                }
                # RLS, sadece kendi şirketini güncellemesine izin verir
                supabase_client.table('sirketler') \
                    .update(guncel_sirket_data) \
                    .eq('id', sirket_id) \
                    .execute()

            # 3. Şifre Güncelleme (auth.users tablosu)
            sifre_data = data.get('sifreler')
            if sifre_data and sifre_data.get('yeni_sifre'):
                mevcut_sifre = sifre_data.get('mevcut_sifre')
                yeni_sifre = sifre_data.get('yeni_sifre')
                
                # Yeni şifre değiştirme servisini çağır
                yeni_session, error = self._change_password(mevcut_sifre, yeni_sifre)
                if error:
                    # Hata varsa, önceki işlemleri geri almayız ama hatayı fırlatırız
                    raise ValueError(error)

            # Şifre değiştiyse yeni token'ları, değişmediyse None döndür
            return yeni_session, None
        
        except ValueError as ve:
            return None, str(ve)
        except APIError as e:
            logger.error(f"Profil güncellenirken API hatası: {e.message}", exc_info=True)
            if 'unique constraint "sirketler_sirket_adi_key"' in str(e):
                 return None, "Bu şirket adı zaten alınmış."
            return None, f"Veritabanı hatası: {e.message}"
        except Exception as e:
            logger.error(f"Profil güncellenirken genel hata: {e}", exc_info=True)
            return None, "Güncelleme sırasında bir sunucu hatası oluştu."


    def _change_password(self, mevcut_sifre: str, yeni_sifre: str):
        """
        Yardımcı fonksiyon: Supabase Auth kullanarak kullanıcının şifresini değiştirir.
        Önce mevcut şifreyi doğrular.
        """
        if not mevcut_sifre:
            return None, "Yeni şifre belirlemek için mevcut şifrenizi girmelisiniz."
        if not yeni_sifre or len(yeni_sifre) < 6:
             return None, "Yeni şifre en az 6 karakter olmalıdır."

        try:
            # 1. Mevcut şifreyi doğrula (Kullanıcının e-postası ile tekrar giriş yapmayı dene)
            # E-postayı g.profile'dan (decorator'ın yüklediği) alıyoruz.
            email = g.profile['eposta']
            if not email:
                # Normalde bu olmamalı, çünkü profiller.eposta'yı dolduruyoruz
                raise Exception("Kullanıcı e-posta adresi profilde bulunamadı.")

            auth_response = supabase_client.auth.sign_in_with_password({
                "email": email, 
                "password": mevcut_sifre
            })
            
            # 2. Başarılıysa, GİRİŞ YAPILAN YENİ OTURUM (token) ile şifreyi güncelle
            
            # Client'ın token'ını GÜNCEL (az önce alınan) token ile ayarla
            supabase_client.auth.set_session(
                auth_response.session.access_token, 
                auth_response.session.refresh_token
            )
            
            # Auth'taki kullanıcı kaydını güncelle
            supabase_client.auth.update_user(attributes={"password": yeni_sifre})

            # 3. Yeni token'ları rota katmanına (blueprint) döndür ki Flask session'ı güncellensin
            return auth_response.session, None

        except AuthApiError:
            return None, "Mevcut şifreniz yanlış."
        except Exception as e:
            logger.error(f"Auth şifre değiştirme hatası: {e}", exc_info=True)
            return None, f"Şifre değiştirilirken bir hata oluştu: {str(e)}"

# Servisin bir örneğini (instance) oluştur
profil_service = ProfilService()