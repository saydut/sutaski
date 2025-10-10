# services/profil_service.py

import logging
from extensions import supabase, bcrypt
from postgrest import APIError

logger = logging.getLogger(__name__)

class ProfilService:
    """Kullanıcı profili ve şirket bilgileri yönetimi için servis katmanı."""

    def get_profil_bilgileri(self, user_id: int, sirket_id: int):
        """Giriş yapmış kullanıcının ve şirketinin bilgilerini döndürür."""
        try:
            user_res = supabase.table('kullanicilar').select('kullanici_adi, eposta, telefon_no').eq('id', user_id).single().execute()
            sirket_res = supabase.table('sirketler').select('sirket_adi, vergi_kimlik_no, adres').eq('id', sirket_id).single().execute()

            if not user_res.data or not sirket_res.data:
                raise ValueError("Kullanıcı veya şirket bilgileri bulunamadı.")

            return {
                "kullanici": user_res.data,
                "sirket": sirket_res.data
            }
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Hata (get_profil_bilgileri): {e}", exc_info=True)
            raise Exception("Profil bilgileri alınırken bir sunucu hatası oluştu.")

    def update_profil_bilgileri(self, user_id: int, sirket_id: int, data: dict):
        """Kullanıcının profil, şirket ve şifre bilgilerini günceller."""
        try:
            # 1. Kullanıcı verilerini güncelle
            kullanici_data = data.get('kullanici')
            if kullanici_data:
                supabase.table('kullanicilar').update(kullanici_data).eq('id', user_id).execute()

            # 2. Şirket verilerini güncelle
            sirket_data = data.get('sirket')
            if sirket_data:
                supabase.table('sirketler').update(sirket_data).eq('id', sirket_id).execute()

            # 3. Şifre verilerini güncelle (eğer varsa)
            sifre_data = data.get('sifreler')
            if sifre_data and sifre_data.get('yeni_sifre'):
                self._change_password(user_id, sifre_data.get('mevcut_sifre'), sifre_data.get('yeni_sifre'))
        
        except ValueError as ve:
            raise ve
        except APIError as e:
            logger.error(f"Hata (update_profil_bilgileri - API): {e.message}", exc_info=True)
            raise Exception(f"Veritabanı hatası: {e.message}")
        except Exception as e:
            logger.error(f"Hata (update_profil_bilgileri - Genel): {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")


    def _change_password(self, user_id: int, mevcut_sifre: str, yeni_sifre: str):
        """Yardımcı fonksiyon: Kullanıcının şifresini değiştirir."""
        if not mevcut_sifre:
            raise ValueError("Yeni şifre için mevcut şifrenizi girmelisiniz.")
        
        user_res = supabase.table('kullanicilar').select('sifre').eq('id', user_id).single().execute()
        
        if not user_res.data or not bcrypt.check_password_hash(user_res.data['sifre'], mevcut_sifre):
            raise ValueError("Mevcut şifreniz yanlış.")
        
        hashed_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')
        supabase.table('kullanicilar').update({'sifre': hashed_sifre}).eq('id', user_id).execute()


# Servis'ten bir örnek (instance) oluşturalım.
profil_service = ProfilService()