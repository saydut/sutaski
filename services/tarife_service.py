# services/tarife_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation
from utils import sanitize_input # Güvenlik için
from datetime import datetime

logger = logging.getLogger(__name__)

class TarifeService:
    """Süt fiyat tarifelerini yönetmek için servis katmanı."""

    def get_fiyat_for_date(self, sirket_id: int, tarih_str: str):
        """
        Belirli bir tarih için geçerli süt fiyatını Supabase RPC
        (get_sut_fiyati_for_date) fonksiyonunu çağırarak alır.
        """
        try:
            # 'YYYY-MM-DD' formatında bir tarih bekliyoruz
            # Tarih formatını doğrula (opsiyonel ama güvenli)
            datetime.strptime(tarih_str, '%Y-%m-%d')
            
            response = g.supabase.rpc('get_sut_fiyati_for_date', {
                'p_sirket_id': sirket_id,
                'p_target_date': tarih_str
            }).execute()
            
            if response.data:
                return response.data.get('fiyat') # Fiyatı (örn: 15.50) veya None döndür
            return None # Veri gelmezse None döndür

        except ValueError:
            logger.warning(f"get_fiyat_for_date: Geçersiz tarih formatı alındı: {tarih_str}")
            raise ValueError("Geçersiz tarih formatı.")
        except Exception as e:
            logger.error(f"RPC 'get_sut_fiyati_for_date' çağrılırken hata: {e}", exc_info=True)
            raise Exception("Fiyat bilgisi alınırken sunucu hatası oluştu.")

    def get_all_tariffs(self, sirket_id: int):
        """Bir şirkete ait tüm fiyat tarifelerini getirir."""
        try:
            response = g.supabase.table('sut_fiyat_tarifesi') \
                .select('*') \
                .eq('sirket_id', sirket_id) \
                .order('baslangic_tarihi', desc=True) \
                .execute()
            return response.data
        except Exception as e:
            logger.error(f"Tüm tarifeler alınırken hata: {e}", exc_info=True)
            raise Exception("Tarifeler listelenirken bir hata oluştu.")

    def add_tariff(self, sirket_id: int, data: dict):
        """Yeni bir fiyat tarifesi ekler."""
        try:
            fiyat_str = data.get('fiyat')
            baslangic_tarihi = data.get('baslangic_tarihi')
            bitis_tarihi = data.get('bitis_tarihi') or None # Bitiş tarihi opsiyonel

            if not fiyat_str or not baslangic_tarihi:
                raise ValueError("Başlangıç tarihi ve fiyat zorunludur.")

            try:
                fiyat = Decimal(fiyat_str)
                if fiyat <= 0:
                    raise ValueError("Fiyat pozitif bir değer olmalıdır.")
            except (InvalidOperation, TypeError):
                raise ValueError("Geçersiz fiyat formatı.")

            # Tarih format kontrolü
            baslangic_dt = datetime.strptime(baslangic_tarihi, '%Y-%m-%d')
            if bitis_tarihi:
                bitis_dt = datetime.strptime(bitis_tarihi, '%Y-%m-%d')
                if bitis_dt < baslangic_dt:
                    raise ValueError("Bitiş tarihi, başlangıç tarihinden önce olamaz.")

            # Tarih çakışmasını Supabase'deki UNIQUE constraint (sirket_id, baslangic_tarihi)
            # bizim için büyük ölçüde halledecek.

            yeni_tarife = {
                "sirket_id": sirket_id,
                "baslangic_tarihi": baslangic_tarihi,
                "bitis_tarihi": bitis_tarihi,
                "fiyat": str(fiyat)
            }
            
            response = g.supabase.table('sut_fiyat_tarifesi').insert(yeni_tarife).execute()
            return response.data[0]
        
        except ValueError as ve:
            raise ve
        except Exception as e:
            # Unique constraint hatasını yakala (PK/UK)
            if 'duplicate key value violates unique constraint' in str(e).lower():
                raise ValueError(f"{baslangic_tarihi} tarihi için zaten bir tarife mevcut.")
            logger.error(f"Tarife eklenirken hata: {e}", exc_info=True)
            raise Exception("Tarife eklenirken bir sunucu hatası oluştu.")

    def update_tariff(self, sirket_id: int, tarife_id: int, data: dict):
        """Mevcut bir fiyat tarifesini günceller."""
        try:
            guncellenecek_veri = {}
            
            if 'fiyat' in data:
                fiyat = Decimal(data['fiyat'])
                if fiyat <= 0: raise ValueError("Fiyat pozitif olmalıdır.")
                guncellenecek_veri['fiyat'] = str(fiyat)
                
            if 'baslangic_tarihi' in data:
                guncellenecek_veri['baslangic_tarihi'] = data['baslangic_tarihi']
            
            if 'bitis_tarihi' in data:
                guncellenecek_veri['bitis_tarihi'] = data['bitis_tarihi'] or None
            
            if not guncellenecek_veri:
                raise ValueError("Güncellenecek veri yok.")

            response = g.supabase.table('sut_fiyat_tarifesi') \
                .update(guncellenecek_veri) \
                .eq('id', tarife_id) \
                .eq('sirket_id', sirket_id) \
                .execute()
            
            if not response.data:
                raise ValueError("Tarife bulunamadı veya güncelleme yetkiniz yok.")
            return response.data[0]
            
        except ValueError as ve:
            raise ve
        except Exception as e:
            if 'duplicate key value violates unique constraint' in str(e).lower():
                raise ValueError("Başlangıç tarihi başka bir tarife ile çakışıyor.")
            logger.error(f"Tarife güncellenirken hata (ID: {tarife_id}): {e}", exc_info=True)
            raise Exception("Tarife güncellenirken bir sunucu hatası oluştu.")


    def delete_tariff(self, sirket_id: int, tarife_id: int):
        """Bir fiyat tarifesini siler."""
        try:
            response = g.supabase.table('sut_fiyat_tarifesi') \
                .delete() \
                .eq('id', tarife_id) \
                .eq('sirket_id', sirket_id) \
                .execute()
            
            if not response.data:
                raise ValueError("Tarife bulunamadı veya silme yetkiniz yok.")
            return True
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Tarife silinirken hata (ID: {tarife_id}): {e}", exc_info=True)
            raise Exception("Tarife silinirken bir sunucu hatası oluştu.")

# Servisin bir örneğini (instance) oluştur
tarife_service = TarifeService()