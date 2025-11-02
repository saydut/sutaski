# services/profil_service.py

import logging
from flask import g
from extensions import bcrypt
from postgrest import APIError
from utils import sanitize_input # YENİ: bleach temizleyicisini import et

logger = logging.getLogger(__name__)

class ProfilService:
    """Kullanıcı profili ve şirket bilgileri yönetimi için servis katmanı."""

    def get_profil_bilgileri(self, user_id: int, sirket_id: int):
        """Giriş yapmış kullanıcının ve şirketinin bilgilerini döndürür."""
        try:
            user_res = g.supabase.table('kullanicilar').select('kullanici_adi, eposta, telefon_no').eq('id', user_id).single().execute()
            sirket_res = g.supabase.table('sirketler').select('sirket_adi, vergi_kimlik_no, adres').eq('id', sirket_id).single().execute()

            if not user_res.data or not sirket_res.data:
                raise ValueError("Kullanıcı veya şirket bilgileri bulunamadı.")

            return { "kullanici": user_res.data, "sirket": sirket_res.data }
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Profil bilgileri alınırken hata oluştu: {e}", exc_info=True)
            raise Exception("Profil bilgileri alınırken bir sunucu hatası oluştu.")

    def update_profil_bilgileri(self, user_id: int, sirket_id: int, data: dict):
        """Kullanıcının profil, şirket ve şifre bilgilerini günceller."""
        try:
            kullanici_data = data.get('kullanici')
            if kullanici_data:
                # YENİ: Gelen veriyi sanitize et
                guncel_kullanici_data = {
                    'eposta': sanitize_input(kullanici_data.get('eposta')),
                    'telefon_no': sanitize_input(kullanici_data.get('telefon_no'))
                }
                g.supabase.table('kullanicilar').update(guncel_kullanici_data).eq('id', user_id).execute()

            sirket_data = data.get('sirket')
            if sirket_data:
                # YENİ: Gelen veriyi sanitize et
                guncel_sirket_data = {
                    'vergi_kimlik_no': sanitize_input(sirket_data.get('vergi_kimlik_no')),
                    'adres': sanitize_input(sirket_data.get('adres'))
                }
                g.supabase.table('sirketler').update(guncel_sirket_data).eq('id', sirket_id).execute()

            sifre_data = data.get('sifreler')
            if sifre_data and sifre_data.get('yeni_sifre'):
                self._change_password(user_id, sifre_data.get('mevcut_sifre'), sifre_data.get('yeni_sifre'))
        
        except ValueError as ve:
            raise ve
        except APIError as e:
            logger.error(f"Profil güncellenirken API hatası: {e.message}", exc_info=True)
            raise Exception(f"Veritabanı hatası: {e.message}")
        except Exception as e:
            logger.error(f"Profil güncellenirken genel hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")


    def _change_password(self, user_id: int, mevcut_sifre: str, yeni_sifre: str):
        """Yardımcı fonksiyon: Kullanıcının şifresini değiştirir."""
        if not mevcut_sifre:
            raise ValueError("Yeni şifre için mevcut şifrenizi girmelisiniz.")
        
        user_res = g.supabase.table('kullanicilar').select('sifre').eq('id', user_id).single().execute()
        
        if not user_res.data or not bcrypt.check_password_hash(user_res.data['sifre'], mevcut_sifre):
            raise ValueError("Mevcut şifreniz yanlış.")
        
        hashed_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')
        g.supabase.table('kullanicilar').update({'sifre': hashed_sifre}).eq('id', user_id).execute()

profil_service = ProfilService()