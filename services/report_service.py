# services/report_service.py

import logging
from flask import g
from decimal import Decimal
from extensions import supabase_client # g.supabase yerine bunu kullanacağız
# Karlılık raporu için güncellenmiş masraf servisini import ediyoruz
from services.masraf_service import masraf_service 
from datetime import datetime

logger = logging.getLogger(__name__)

class ReportService:
    """Raporlama RPC'lerini çağırmak için servis katmanı. RLS ile güncellendi."""

    def get_daily_summary(self, target_date: str):
        """
        Ana panel için günlük özet verilerini RLS kullanarak RPC ile çeker.
        sirket_id'yi 'g' objesinden alır.
        """
        try:
            # 1. sirket_id'yi 'g' objesinden al
            sirket_id = g.profile['sirket_id']
            
            # 2. RPC'ye sirket_id'yi gönder
            params = {
                'p_sirket_id': sirket_id,
                'p_target_date': target_date
            }
            # g.supabase -> supabase_client
            response = supabase_client.rpc('get_daily_summary_rpc', params).execute()
            
            return response.data[0] if response.data else {}, None
        except Exception as e:
            logger.error(f"Günlük özet (RPC) alınırken hata: {e}", exc_info=True)
            return None, "Günlük özet verileri alınamadı."

    def get_weekly_summary(self, start_date: str, end_date: str):
        """
        Ana panel için haftalık grafik verilerini RLS kullanarak RPC ile çeker.
        sirket_id'yi 'g' objesinden alır.
        """
        try:
            sirket_id = g.profile['sirket_id']
            params = {
                'p_sirket_id': sirket_id,
                'p_start_date': start_date,
                'p_end_date': end_date
            }
            response = supabase_client.rpc('get_weekly_summary_rpc', params).execute()
            return response.data, None
        except Exception as e:
            logger.error(f"Haftalık özet (RPC) alınırken hata: {e}", exc_info=True)
            return None, "Haftalık grafik verileri alınamadı."

    def get_supplier_distribution(self, start_date: str, end_date: str):
        """
        Ana panel için tedarikçi dağılımı (pasta grafik) verilerini RLS ile çeker.
        sirket_id'yi 'g' objesinden alır.
        """
        try:
            sirket_id = g.profile['sirket_id']
            params = {
                'p_sirket_id': sirket_id,
                'p_start_date': start_date,
                'p_end_date': end_date
            }
            response = supabase_client.rpc('get_supplier_distribution', params).execute()
            return response.data, None
        except Exception as e:
            logger.error(f"Tedarikçi dağılımı (RPC) alınırken hata: {e}", exc_info=True)
            return None, "Tedarikçi dağılım verileri alınamadı."

    def get_karlilik_raporu(self, start_date: str, end_date: str):
        """
        Karlılık raporu verilerini RLS kullanarak RPC ile çeker.
        sirket_id'yi 'g' objesinden alır.
        Genel masrafları ayrıca Python'dan hesaplar.
        """
        try:
            sirket_id = g.profile['sirket_id']
            params = {
                'p_sirket_id': sirket_id,
                'p_start_date': start_date,
                'p_end_date': end_date
            }
            
            # 1. Süt, Yem, Satış vb. gelir/giderleri RPC ile al
            response = supabase_client.rpc('get_karlilik_raporu', params).execute()
            
            if not response.data:
                raise Exception("Karlılık raporu RPC'den veri döndürmedi.")
            
            rapor_data = response.data[0] # RPC tek bir JSON objesi döndürmeli

            # 2. Genel Masrafları RLS'e tabi servisimizden al
            # (Adım 15'te bu servisi (data, error) döndürecek şekilde güncellemiştik)
            toplam_genel_masraf, error = masraf_service.get_expense_summary_by_date_range(start_date, end_date)
            
            if error:
                 return None, f"Genel masraf verisi alınamadı: {error}"

            # Gelen veriyi Decimal'e çevir, None gelirse 0 kabul et
            toplam_genel_masraf_decimal = Decimal(toplam_genel_masraf or '0')
            rapor_data['toplam_genel_masraf'] = str(toplam_genel_masraf_decimal)

            # 3. Nihai Kâr/Zararı Python'da hesapla
            toplam_gelir = Decimal(rapor_data.get('toplam_sut_satisi', 0)) + Decimal(rapor_data.get('toplam_yem_satisi', 0))
            toplam_gider = Decimal(rapor_data.get('toplam_sut_maliyeti', 0)) + \
                           Decimal(rapor_data.get('toplam_yem_maliyeti', 0)) + \
                           toplam_genel_masraf_decimal # Zaten Decimal
            
            rapor_data['net_kar_zarar'] = str(toplam_gelir - toplam_gider)

            return rapor_data, None
            
        except Exception as e:
            logger.error(f"Karlılık raporu alınırken hata: {e}", exc_info=True)
            return None, "Karlılık raporu verileri alınamadı."

    def get_tedarikci_ozet_raporu(self, start_date: str, end_date: str):
        """
        Tedarikçi Özet Raporu (Aylık Rapor) verilerini RLS ile çeker.
        sirket_id'yi 'g' objesinden alır.
        """
        try:
            sirket_id = g.profile['sirket_id']
            params = {
                'p_sirket_id': sirket_id,
                'p_start_date': start_date,
                'p_end_date': end_date
            }
            response = supabase_client.rpc('get_monthly_supplier_report_data', params).execute()
            return response.data, None
        except Exception as e:
            logger.error(f"Tedarikçi özet raporu (RPC) alınırken hata: {e}", exc_info=True)
            return None, "Tedarikçi özet raporu verileri alınamadı."

    def get_detayli_sut_raporu(self, start_date: str, end_date: str, tedarikci_id: int = None, toplayici_id: str = None):
        """
        Detaylı Süt Raporu verilerini RLS ile çeker.
        sirket_id'yi 'g' objesinden alır.
        """
        try:
            sirket_id = g.profile['sirket_id']
            params = {
                'p_sirket_id': sirket_id,
                'p_start_date': start_date,
                'p_end_date': end_date,
                'p_tedarikci_id': tedarikci_id,
                # RPC parametresi 'p_kullanici_id' (UUID) olmalı
                'p_kullanici_id': toplayici_id 
            }
            response = supabase_client.rpc('get_detailed_report_data', params).execute()
            return response.data, None
        except Exception as e:
            logger.error(f"Detaylı süt raporu (RPC) alınırken hata: {e}", exc_info=True)
            return None, "Detaylı süt raporu verileri alınamadı."

# Servisin bir örneğini (instance) oluştur
report_service = ReportService()