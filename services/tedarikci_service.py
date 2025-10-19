# services/tedarikci_service.py

from flask import g
from postgrest import APIError
from decimal import Decimal
from collections import namedtuple
import logging

logger = logging.getLogger(__name__)

class TedarikciService:
    """Tedarikçi veritabanı işlemleri için servis katmanı."""

    def get_all_for_dropdown(self, sirket_id: int):
        """Dropdown menüler için tüm tedarikçileri getirir."""
        try:
            response = g.supabase.table('tedarikciler').select('id, isim').eq('sirket_id', sirket_id).order('isim', desc=False).execute()
            return response.data
        except Exception as e:
            logger.error(f"Dropdown için tedarikçi listesi alınırken hata: {e}", exc_info=True)
            raise

    def get_by_id(self, sirket_id: int, tedarikci_id: int):
        """ID ile tek bir tedarikçinin detaylarını getirir."""
        try:
            response = g.supabase.table('tedarikciler').select('id, isim, tc_no, telefon_no, adres').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
            return response.data
        except Exception as e:
            logger.error(f"ID ile tedarikçi detayı alınırken hata: {e}", exc_info=True)
            raise

    def get_summary_by_id(self, sirket_id: int, tedarikci_id: int):
        """Bir tedarikçinin finansal özetini RPC ile hesaplar."""
        try:
            tedarikci_res = g.supabase.table('tedarikciler').select('isim').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
            if not tedarikci_res.data:
                return None, None 

            summary_res = g.supabase.rpc('get_supplier_summary', { 'p_sirket_id': sirket_id, 'p_tedarikci_id': tedarikci_id }).execute()
            return tedarikci_res.data, summary_res.data
        except Exception as e:
            logger.error(f"Tedarikçi özeti alınırken hata: {e}", exc_info=True)
            raise
    
    def get_paginated_list(self, sirket_id: int, sayfa: int, limit: int, arama: str, sirala_sutun: str, sirala_yon: str):
        """Tedarikçileri sayfalama, arama ve sıralama yaparak RPC ile getirir."""
        try:
            offset = (sayfa - 1) * limit
            params = {
                'p_sirket_id': sirket_id, 'p_limit': limit, 'p_offset': offset,
                'p_search_term': arama, 'p_sort_column': sirala_sutun, 'p_sort_direction': sirala_yon
            }
            response = g.supabase.rpc('get_paginated_suppliers', params).execute()
            result = response.data
            
            APIResponse = namedtuple('APIResponse', ['data', 'count'])
            return APIResponse(data=result.get('data', []), count=result.get('count', 0))

        except Exception as e:
            logger.error(f"Sayfalı tedarikçi listesi (RPC) alınırken hata: {e}", exc_info=True)
            raise

    def create(self, sirket_id: int, data: dict):
        """Yeni bir tedarikçi oluşturur."""
        try:
            isim = data.get('isim')
            if not isim:
                raise ValueError("Tedarikçi ismi zorunludur.")
            
            yeni_veri = {'isim': isim, 'sirket_id': sirket_id}
            if data.get('tc_no'): yeni_veri['tc_no'] = data.get('tc_no')
            if data.get('telefon_no'): yeni_veri['telefon_no'] = data.get('telefon_no')
            if data.get('adres'): yeni_veri['adres'] = data.get('adres')
            
            response = g.supabase.table('tedarikciler').insert(yeni_veri).execute()
            return response.data[0]
        except Exception as e:
            logger.error(f"Tedarikçi oluşturulurken hata: {e}", exc_info=True)
            raise

    def update(self, sirket_id: int, tedarikci_id: int, data: dict):
        """Mevcut bir tedarikçiyi günceller."""
        try:
            guncellenecek_veri = {}
            if 'isim' in data and data.get('isim'):
                guncellenecek_veri['isim'] = data.get('isim')
            else:
                raise ValueError("Tedarikçi ismi boş bırakılamaz.")
            
            if 'tc_no' in data: guncellenecek_veri['tc_no'] = data.get('tc_no')
            if 'telefon_no' in data: guncellenecek_veri['telefon_no'] = data.get('telefon_no')
            if 'adres' in data: guncellenecek_veri['adres'] = data.get('adres')

            response = g.supabase.table('tedarikciler').update(guncellenecek_veri).eq('id', tedarikci_id).eq('sirket_id', sirket_id).execute()
            
            if not response.data:
                raise ValueError("Tedarikçi bulunamadı veya bu işlem için yetkiniz yok.")
                
            return response.data[0]
        except Exception as e:
            logger.error(f"Tedarikçi güncellenirken hata: {e}", exc_info=True)
            raise

    def delete(self, sirket_id: int, tedarikci_id: int):
        """Bir tedarikçiyi siler."""
        try:
            response = g.supabase.table('tedarikciler').delete().eq('id', tedarikci_id).eq('sirket_id', sirket_id).execute()
            if not response.data:
                 raise ValueError("Tedarikçi bulunamadı veya bu işlem için yetkiniz yok.")
            return True
        except Exception as e:
            if 'violates foreign key constraint' in str(e).lower():
                raise ValueError("Bu tedarikçiye ait süt veya yem girdisi olduğu için silinemiyor.")
            logger.error(f"Tedarikçi silinirken hata: {e}", exc_info=True)
            raise

class PagedDataService:
    def get_sut_girdileri(self, sirket_id: int, tedarikci_id: int, sayfa: int, limit: int = 10):
        offset = (sayfa - 1) * limit
        return g.supabase.table('sut_girdileri').select(
            '*, kullanicilar(kullanici_adi)', count='exact'
        ).eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order(
            'taplanma_tarihi', desc=True
        ).range(offset, offset + limit - 1).execute()

    def get_yem_islemleri(self, sirket_id: int, tedarikci_id: int, sayfa: int, limit: int = 10):
        offset = (sayfa - 1) * limit
        return g.supabase.table('yem_islemleri').select(
            '*, kullanicilar(kullanici_adi), yem_urunleri(yem_adi)', count='exact'
        ).eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order(
            'islem_tarihi', desc=True
        ).range(offset, offset + limit - 1).execute()

    def get_finansal_islemler(self, sirket_id: int, tedarikci_id: int, sayfa: int, limit: int = 10):
        offset = (sayfa - 1) * limit
        return g.supabase.table('finansal_islemler').select(
            '*, kullanicilar(kullanici_adi)', count='exact'
        ).eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order(
            'islem_tarihi', desc=True
        ).range(offset, offset + limit - 1).execute()

tedarikci_service = TedarikciService()
paged_data_service = PagedDataService()
