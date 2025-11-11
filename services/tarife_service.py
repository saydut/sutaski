# services/tarife_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation
from utils import sanitize_input
from datetime import datetime
from extensions import supabase_client # g.supabase yerine bunu kullanacağız

logger = logging.getLogger(__name__)

class TarifeService:
    """Süt fiyat tarifelerini yönetmek için servis katmanı. RLS ile güncellendi."""

    def get_fiyat_for_date(self, tarih_str: str):
        """
        Belirli bir tarih için geçerli süt fiyatını (alis_fiyati) RPC ile alır.
        sirket_id'yi 'g' objesinden alır.
        """
        try:
            # 1. sirket_id'yi 'g' objesinden al
            sirket_id = g.profile['sirket_id']
            
            # Tarih formatını doğrula
            datetime.strptime(tarih_str, '%Y-%m-%d')
            
            # 2. RPC'ye sirket_id'yi g objesinden alarak gönder
            # g.supabase -> supabase_client
            response = supabase_client.rpc('get_sut_fiyati_for_date', {
                'p_sirket_id': sirket_id,
                'p_target_date': tarih_str
            }).execute()
            
            if response.data and len(response.data) > 0:
                # RPC'nizin 'alis_fiyati'nı 'fiyat' olarak döndürdüğünü varsayıyoruz.
                return response.data[0].get('fiyat'), None 
            return None, "Belirtilen tarih için bir fiyat tarifesi bulunamadı."

        except ValueError:
            logger.warning(f"get_fiyat_for_date: Geçersiz tarih formatı alındı: {tarih_str}")
            return None, "Geçersiz tarih formatı."
        except Exception as e:
            logger.error(f"RPC 'get_sut_fiyati_for_date' çağrılırken hata: {e}", exc_info=True)
            return None, "Fiyat bilgisi alınırken sunucu hatası oluştu."

    def get_all_tariffs(self):
        """Bir şirkete ait tüm fiyat tarifelerini RLS kullanarak getirir."""
        try:
            # sirket_id parametresi ve .eq() filtresi KALDIRILDI
            # g.supabase -> supabase_client
            response = supabase_client.table('sut_fiyat_tarifesi') \
                .select('*') \
                .order('baslangic_tarihi', desc=True) \
                .execute()
            return response.data, None
        except Exception as e:
            logger.error(f"Tüm tarifeler alınırken hata: {e}", exc_info=True)
            return None, "Tarifeler listelenirken bir hata oluştu."

    def add_tariff(self, data: dict):
        """Yeni bir fiyat tarifesi ekler. sirket_id'yi 'g' objesinden alır."""
        try:
            # 1. sirket_id'yi 'g' objesinden al
            sirket_id = g.profile['sirket_id']
            
            alis_fiyat_str = data.get('alis_fiyati')
            satis_fiyat_str = data.get('satis_fiyati')
            baslangic_tarihi = data.get('baslangic_tarihi')
            bitis_tarihi = data.get('bitis_tarihi') or None 

            if not alis_fiyat_str or not satis_fiyat_str or not baslangic_tarihi:
                raise ValueError("Başlangıç tarihi, alış fiyatı ve satış fiyatı zorunludur.")

            alis_fiyat = Decimal(alis_fiyat_str)
            satis_fiyat = Decimal(satis_fiyat_str)
            
            if alis_fiyat <= 0:
                raise ValueError("Alış fiyatı pozitif bir değer olmalıdır.")
            if satis_fiyat < 0: 
                raise ValueError("Satış fiyatı negatif olamaz.")

            baslangic_dt = datetime.strptime(baslangic_tarihi, '%Y-%m-%d')
            if bitis_tarihi:
                bitis_dt = datetime.strptime(bitis_tarihi, '%Y-%m-%d')
                if bitis_dt < baslangic_dt:
                    raise ValueError("Bitiş tarihi, başlangıç tarihinden önce olamaz.")

            yeni_tarife = {
                "sirket_id": sirket_id, # RLS 'WITH CHECK' için
                "baslangic_tarihi": baslangic_tarihi,
                "bitis_tarihi": bitis_tarihi,
                "alis_fiyati": str(alis_fiyat),
                "satis_fiyati": str(satis_fiyat)
            }
            
            # g.supabase -> supabase_client
            response = supabase_client.table('sut_fiyat_tarifesi').insert(yeni_tarife).execute()
            return response.data[0], None
        
        except (InvalidOperation, TypeError):
            return None, "Lütfen fiyatlar için geçerli sayılar girin."
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            if 'duplicate key value violates unique constraint' in str(e).lower():
                return None, f"{baslangic_tarihi} tarihi için zaten bir tarife mevcut."
            logger.error(f"Tarife eklenirken hata: {e}", exc_info=True)
            return None, "Tarife eklenirken bir sunucu hatası oluştu."

    def update_tariff(self, tarife_id: int, data: dict):
        """Mevcut bir fiyat tarifesini RLS kullanarak günceller."""
        try:
            # sirket_id parametresi KALDIRILDI
            guncellenecek_veri = {}
            
            if 'alis_fiyati' in data:
                alis_fiyat = Decimal(data['alis_fiyati'])
                if alis_fiyat <= 0: raise ValueError("Alış fiyatı pozitif olmalıdır.")
                guncellenecek_veri['alis_fiyati'] = str(alis_fiyat)
            
            if 'satis_fiyati' in data:
                satis_fiyat = Decimal(data['satis_fiyati'])
                if satis_fiyat < 0: raise ValueError("Satış fiyatı negatif olamaz.")
                guncellenecek_veri['satis_fiyati'] = str(satis_fiyat)
                
            if 'baslangic_tarihi' in data:
                guncellenecek_veri['baslangic_tarihi'] = data['baslangic_tarihi']
            
            if 'bitis_tarihi' in data:
                guncellenecek_veri['bitis_tarihi'] = data.get('bitis_tarihi') or None
            
            if not guncellenecek_veri:
                raise ValueError("Güncellenecek veri yok.")

            # g.supabase -> supabase_client
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('sut_fiyat_tarifesi') \
                .update(guncellenecek_veri) \
                .eq('id', tarife_id) \
                .execute()
            
            if not response.data:
                raise ValueError("Tarife bulunamadı veya güncelleme yetkiniz yok.")
            return response.data[0], None
            
        except (InvalidOperation, TypeError):
            return None, "Geçersiz fiyat formatı."
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            if 'duplicate key value violates unique constraint' in str(e).lower():
                return None, "Başlangıç tarihi başka bir tarife ile çakışıyor."
            logger.error(f"Tarife güncellenirken hata (ID: {tarife_id}): {e}", exc_info=True)
            return None, "Tarife güncellenirken bir sunucu hatası oluştu."


    def delete_tariff(self, tarife_id: int):
        """Bir fiyat tarifesini RLS kullanarak siler."""
        try:
            # sirket_id parametresi KALDIRILDI
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            # g.supabase -> supabase_client
            response = supabase_client.table('sut_fiyat_tarifesi') \
                .delete() \
                .eq('id', tarife_id) \
                .execute()
            
            if not response.data:
                raise ValueError("Tarife bulunamadı veya silme yetkiniz yok.")
            return True, None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Tarife silinirken hata (ID: {tarife_id}): {e}", exc_info=True)
            return None, "Tarife silinirken bir sunucu hatası oluştu."

tarife_service = TarifeService()