# services/admin_service.py

import logging
from flask import g
from extensions import bcrypt
from constants import UserRole
from postgrest import APIError

logger = logging.getLogger(__name__)

class AdminService:
    """Admin paneli işlemleri için servis katmanı."""

    def get_all_data(self):
        """Admin paneli için gerekli tüm verileri (şirketler, kullanıcılar) çeker."""
        try:
            sirketler = g.supabase.table('sirketler').select('*').execute().data
            kullanicilar = g.supabase.table('kullanicilar').select('*, sirketler(sirket_adi)').execute().data
            return {"sirketler": sirketler, "kullanicilar": kullanicilar}
        except Exception as e:
            logger.error(f"Admin verileri alınırken hata oluştu: {e}", exc_info=True)
            raise Exception("Admin verileri alınırken bir hata oluştu.")

    def update_license(self, sirket_id: int, yeni_tarih: str):
        """Bir şirketin lisans bitiş tarihini günceller."""
        try:
            tarih_degeri = yeni_tarih if yeni_tarih else None
            g.supabase.table('sirketler').update({'lisans_bitis_tarihi': tarih_degeri}).eq('id', sirket_id).execute()
        except Exception as e:
            logger.error(f"Lisans tarihi güncellenirken hata oluştu: {e}", exc_info=True)
            raise Exception("Lisans tarihi güncellenemedi.")

    def update_user_role(self, kullanici_id: int, yeni_rol: str):
        """Bir kullanıcının rolünü günceller."""
        try:
            gecerli_roller = [rol.value for rol in UserRole]
            if yeni_rol not in gecerli_roller:
                raise ValueError("Geçersiz rol belirtildi.")
            g.supabase.table('kullanicilar').update({'rol': yeni_rol}).eq('id', kullanici_id).execute()
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Kullanıcı rolü güncellenirken hata oluştu: {e}", exc_info=True)
            raise Exception("Kullanıcı rolü güncellenemedi.")

    def delete_company(self, sirket_id: int):
        """Bir şirketi ve ona bağlı tüm verileri (kullanıcılar, girdiler vb.) siler."""
        try:
            response = g.supabase.table('sirketler').delete().eq('id', sirket_id).execute()
            if not response.data:
                raise ValueError("Silinecek şirket bulunamadı.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Şirket silinirken hata oluştu: {e}", exc_info=True)
            raise Exception("Şirket silinirken bir hata oluştu.")

    def reset_password(self, kullanici_id: int, yeni_sifre: str):
        """Bir kullanıcının şifresini sıfırlar."""
        try:
            if not yeni_sifre:
                raise ValueError("Yeni şifre boş olamaz.")
            hashed_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')
            g.supabase.table('kullanicilar').update({'sifre': hashed_sifre}).eq('id', kullanici_id).execute()
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Şifre sıfırlanırken hata oluştu: {e}", exc_info=True)
            raise Exception("Şifre sıfırlanırken bir hata oluştu.")

    # ... (Diğer fonksiyonlar aynı kalır, sadece print'ler logger'a çevrilir)
    def _get_setting(self, ayar_adi: str, varsayilan: str) -> str:
        """Veritabanından tek bir ayar değerini çeker."""
        response = g.supabase.table('ayarlar').select('ayar_degeri').eq('ayar_adi', ayar_adi).limit(1).single().execute()
        return response.data.get('ayar_degeri', varsayilan) if response.data else varsayilan

    def _set_setting(self, ayar_adi: str, ayar_degeri: str):
        """Veritabanında tek bir ayar değerini günceller veya oluşturur."""
        g.supabase.table('ayarlar').upsert({
            'ayar_adi': ayar_adi,
            'ayar_degeri': ayar_degeri
        }, on_conflict='ayar_adi').execute()

    def get_cache_version(self) -> str:
        return self._get_setting('cache_version', '1')

    def increment_cache_version(self) -> int:
        current_version = int(self.get_cache_version())
        new_version = current_version + 1
        self._set_setting('cache_version', str(new_version))
        return new_version
        
    def get_maintenance_status(self) -> bool:
        return self._get_setting('maintenance_mode', 'false') == 'true'

    def set_maintenance_status(self, durum: bool):
        self._set_setting('maintenance_mode', 'true' if durum else 'false')

    def get_all_version_notes(self):
        """Tüm sürüm notlarını tarihe göre sıralı getirir."""
        return g.supabase.table('surum_notlari').select('*').order('yayin_tarihi', desc=True).order('id', desc=True).execute().data

    def add_version_note(self, data: dict):
        if not all([data.get('surum_no'), data.get('yayin_tarihi'), data.get('notlar')]):
            raise ValueError("Tüm alanlar zorunludur.")
        g.supabase.table('surum_notlari').insert(data).execute()

    def update_version_note(self, id: int, data: dict):
        if not all([data.get('surum_no'), data.get('yayin_tarihi'), data.get('notlar')]):
            raise ValueError("Tüm alanlar zorunludur.")
        response = g.supabase.table('surum_notlari').update(data).eq('id', id).execute()
        if not response.data:
            raise ValueError("Güncellenecek sürüm notu bulunamadı.")
            
    def delete_version_note(self, id: int):
        response = g.supabase.table('surum_notlari').delete().eq('id', id).execute()
        if not response.data:
            raise ValueError("Silinecek sürüm notu bulunamadı.")


admin_service = AdminService()
