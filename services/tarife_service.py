# services/tarife_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation
from datetime import datetime

logger = logging.getLogger(__name__)

class TarifeService:
    """Süt fiyat tarifelerini yönetmek için servis katmanı."""

    def get_fiyat_for_date(self, sirket_id: int, tarih_str: str):
        """
        Belirli bir tarih için geçerli süt fiyatını Supabase RPC fonksiyonu ile alır.
        """
        try:
            # Tarih format kontrolü
            datetime.strptime(tarih_str, '%Y-%m-%d')
            
            # SQL Fonksiyonunu Çağır
            response = g.supabase.rpc('get_sut_fiyati_for_date', {
                'p_sirket_id': sirket_id,
                'p_target_date': tarih_str
            }).execute()
            
            if response.data and len(response.data) > 0:
                # SQL'den {fiyat: 18.50, satis_fiyati: 20.00} döner
                return response.data[0].get('fiyat') 
            
            return None

        except Exception as e:
            logger.error(f"RPC 'get_sut_fiyati_for_date' hatası: {e}", exc_info=True)
            # Hata durumunda None dön ki panel çalışmaya devam etsin
            return None

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
            alis_fiyat_str = data.get('alis_fiyati')
            satis_fiyat_str = data.get('satis_fiyati')
            baslangic_tarihi = data.get('baslangic_tarihi')
            bitis_tarihi = data.get('bitis_tarihi') or None

            if not alis_fiyat_str or not baslangic_tarihi:
                raise ValueError("Başlangıç tarihi ve alış fiyatı zorunludur.")

            # Sayısal dönüşüm ve kontrol
            try:
                alis_fiyat = Decimal(str(alis_fiyat_str))
                if alis_fiyat <= 0: raise ValueError("Alış fiyatı pozitif olmalıdır.")
            except: raise ValueError("Geçersiz alış fiyatı.")
            
            satis_fiyat = Decimal('0')
            if satis_fiyat_str:
                try:
                    satis_fiyat = Decimal(str(satis_fiyat_str))
                except: raise ValueError("Geçersiz satış fiyatı.")

            yeni_tarife = {
                "sirket_id": sirket_id,
                "baslangic_tarihi": baslangic_tarihi,
                "bitis_tarihi": bitis_tarihi,
                "alis_fiyati": str(alis_fiyat),
                "satis_fiyati": str(satis_fiyat)
            }
            
            response = g.supabase.table('sut_fiyat_tarifesi').insert(yeni_tarife).execute()
            return response.data[0]
        
        except ValueError as ve:
            raise ve
        except Exception as e:
            if 'duplicate key' in str(e).lower():
                raise ValueError(f"{baslangic_tarihi} için zaten tarife var.")
            logger.error(f"Tarife ekleme hatası: {e}", exc_info=True)
            raise Exception("Sunucu hatası.")

    def update_tariff(self, sirket_id: int, tarife_id: int, data: dict):
        """Tarifeyi günceller."""
        try:
            update_data = {}
            if 'alis_fiyati' in data: update_data['alis_fiyati'] = str(Decimal(data['alis_fiyati']))
            if 'satis_fiyati' in data: update_data['satis_fiyati'] = str(Decimal(data['satis_fiyati']))
            if 'baslangic_tarihi' in data: update_data['baslangic_tarihi'] = data['baslangic_tarihi']
            if 'bitis_tarihi' in data: update_data['bitis_tarihi'] = data['bitis_tarihi'] or None

            response = g.supabase.table('sut_fiyat_tarifesi') \
                .update(update_data) \
                .eq('id', tarife_id) \
                .eq('sirket_id', sirket_id) \
                .execute()
            return response.data[0]
        except Exception as e:
            logger.error(f"Güncelleme hatası: {e}", exc_info=True)
            raise Exception("Güncelleme yapılamadı.")

    def delete_tariff(self, sirket_id: int, tarife_id: int):
        """Tarifeyi siler."""
        try:
            g.supabase.table('sut_fiyat_tarifesi').delete().eq('id', tarife_id).eq('sirket_id', sirket_id).execute()
            return True
        except Exception as e:
            logger.error(f"Silme hatası: {e}", exc_info=True)
            raise Exception("Silinemedi.")

tarife_service = TarifeService()