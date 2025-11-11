# services/admin_service.py
# Süper Admin (admin rolü) için güncellendi.
# TÜM sorgular RLS'i bypass etmek için 'supabase_service' istemcisini kullanır.

import logging
from flask import g
from decimal import Decimal, InvalidOperation
from utils import sanitize_input
from datetime import datetime
# 'supabase_client' (anon) YERİNE 'supabase_service' (admin) import edildi
from extensions import supabase_service 

logger = logging.getLogger(__name__)

class AdminService:
    """Süper Admin işlemleri için servis katmanı."""

    def get_admin_dashboard_data(self):
        """Admin paneli için temel istatistikleri çeker (RLS bypass)."""
        try:
            # g.supabase -> supabase_service
            response = supabase_service.rpc('get_admin_dashboard_stats').execute()
            
            if not response.data:
                logger.warning("get_admin_dashboard_stats RPC'si veri döndürmedi.")
                return {}, None
                
            return response.data[0], None # RPC tek bir JSON objesi döndürmeli
        except Exception as e:
            logger.error(f"Admin dashboard verileri (RPC) alınırken hata: {e}", exc_info=True)
            return None, "Admin dashboard verileri alınamadı."

    def get_all_sirketler(self, sayfa: int, limit: int = 10):
        """Tüm şirketleri sayfalayarak listeler (RLS bypass)."""
        try:
            offset = (sayfa - 1) * limit
            # g.supabase -> supabase_service
            response = supabase_service.table('sirketler') \
                .select('*', count='exact') \
                .order('created_at', desc=True) \
                .range(offset, offset + limit - 1) \
                .execute()
            
            return response.data, response.count, None
        except Exception as e:
            logger.error(f"Tüm şirketler listelenirken hata: {e}", exc_info=True)
            return [], 0, f"Şirketler listelenirken bir hata oluştu: {str(e)}" # (data, count, error)

    def update_sirket_lisans(self, sirket_id: int, data: dict):
        """Bir şirketin lisans bitiş tarihini günceller (RLS bypass)."""
        try:
            lisans_bitis_tarihi = data.get('lisans_bitis_tarihi')
            if not lisans_bitis_tarihi:
                raise ValueError("Lisans bitiş tarihi zorunludur.")
            
            datetime.strptime(lisans_bitis_tarihi, '%Y-%m-%d')
            
            # g.supabase -> supabase_service
            response = supabase_service.table('sirketler') \
                .update({"lisans_bitis_tarihi": lisans_bitis_tarihi}) \
                .eq('id', sirket_id) \
                .execute()
                
            if not response.data:
                 raise ValueError("Şirket bulunamadı.")
            return response.data[0], None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Şirket lisansı güncellenirken hata: {e}", exc_info=True)
            return None, "Lisans güncellenirken bir sunucu hatası oluştu."

    def get_all_surum_notlari(self, sayfa: int, limit: int = 5):
        """Tüm sürüm notlarını sayfalayarak listeler (RLS bypass)."""
        try:
            offset = (sayfa - 1) * limit
            # g.supabase -> supabase_service
            response = supabase_service.table('surum_notlari') \
                .select('*', count='exact') \
                .order('yayin_tarihi', desc=True) \
                .range(offset, offset + limit - 1) \
                .execute()
            return response.data, response.count, None
        except Exception as e:
            logger.error(f"Sürüm notları listelenirken hata: {e}", exc_info=True)
            return [], 0, f"Sürüm notları listelenirken bir hata oluştu: {str(e)}" # (data, count, error)

    def add_surum_notu(self, data: dict):
        """Yeni bir sürüm notu ekler (RLS bypass)."""
        try:
            surum_no = sanitize_input(data.get('surum_no'))
            yayin_tarihi = data.get('yayin_tarihi')
            notlar = sanitize_input(data.get('notlar')) 

            if not all([surum_no, yayin_tarihi, notlar]):
                raise ValueError("Sürüm No, Yayın Tarihi ve Notlar zorunludur.")
            
            datetime.strptime(yayin_tarihi, '%Y-%m-%d')

            yeni_not = {
                "surum_no": surum_no,
                "yayin_tarihi": yayin_tarihi,
                "notlar": notlar
            }
            # g.supabase -> supabase_service
            response = supabase_service.table('surum_notlari').insert(yeni_not).execute()
            return response.data[0], None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Sürüm notu eklenirken hata: {e}", exc_info=True)
            return None, "Sürüm notu eklenirken bir sunucu hatası oluştu."
            
    def delete_surum_notu(self, not_id: int):
        """Bir sürüm notunu siler (RLS bypass)."""
        try:
            # g.supabase -> supabase_service
            response = supabase_service.table('surum_notlari') \
                .delete() \
                .eq('id', not_id) \
                .execute()
            if not response.data:
                raise ValueError("Sürüm notu bulunamadı.")
            return True, None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Sürüm notu silinirken hata: {e}", exc_info=True)
            return None, "Sürüm notu silinirken bir hata oluştu."

    def get_global_settings(self):
        """Tüm global ayarları 'ayarlar' tablosundan çeker (RLS bypass)."""
        try:
            # g.supabase -> supabase_service
            response = supabase_service.table('ayarlar') \
                .select('*') \
                .execute()
            
            ayarlar_dict = {ayar['ayar_adi']: ayar['ayar_degeri'] for ayar in response.data}
            return ayarlar_dict, None
        except Exception as e:
            logger.error(f"Global ayarlar alınırken hata: {e}", exc_info=True)
            return None, "Global ayarlar alınamadı."

    def update_global_settings(self, data: dict):
        """Global ayarları 'ayarlar' tablosunda günceller (RLS bypass)."""
        try:
            if not data:
                raise ValueError("Güncellenecek ayar verisi bulunamadı.")
                
            upsert_data = []
            for ayar_adi, ayar_degeri in data.items():
                upsert_data.append({
                    "ayar_adi": sanitize_input(ayar_adi),
                    "ayar_degeri": sanitize_input(str(ayar_degeri or '')) # Değerin string olduğundan emin ol
                })

            if not upsert_data:
                 raise ValueError("İşlenecek geçerli ayar bulunamadı.")

            # g.supabase -> supabase_service
            response = supabase_service.table('ayarlar') \
                .upsert(upsert_data, on_conflict='ayar_adi') \
                .execute()
                
            return True, None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Global ayarlar güncellenirken hata: {e}", exc_info=True)
            return None, "Global ayarlar güncellenirken bir sunucu hatası oluştu."

# Servisin bir örneğini (instance) oluştur
admin_service = AdminService()