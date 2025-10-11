# services/tedarikci_service.py
# GÜNCELLENDİ: Bu dosya artık yavaş olan "view" yerine hızlı olan RPC fonksiyonunu kullanacak.

from extensions import supabase
from postgrest import APIError
from decimal import Decimal
from collections import namedtuple

class TedarikciService:
    """Tedarikçi veritabanı işlemleri için servis katmanı."""

    def get_all_for_dropdown(self, sirket_id: int):
        """Dropdown menüler için tüm tedarikçileri getirir."""
        try:
            # View kaldırıldığı için, artık direkt tedarikciler tablosundan çekiyoruz.
            # Dropdown'da toplam litre bilgisi kritik değil, performansı artırmak için kaldırıyoruz.
            response = supabase.table('tedarikciler').select(
                'id, isim'
            ).eq('sirket_id', sirket_id).order('isim', desc=False).execute()
            return response.data
        except Exception as e:
            print(f"Hata (get_all_for_dropdown): {e}")
            raise

    def get_by_id(self, sirket_id: int, tedarikci_id: int):
        """ID ile tek bir tedarikçinin detaylarını getirir."""
        try:
            response = supabase.table('tedarikciler').select(
                'id, isim, tc_no, telefon_no, adres'
            ).eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
            return response.data
        except Exception as e:
            print(f"Hata (get_by_id): {e}")
            raise

    def get_summary_by_id(self, sirket_id: int, tedarikci_id: int):
        """Bir tedarikçinin finansal özetini RPC ile hesaplar."""
        try:
            tedarikci_res = supabase.table('tedarikciler').select('isim').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
            if not tedarikci_res.data:
                return None, None # Tedarikçi bulunamadı

            summary_res = supabase.rpc('get_supplier_summary', {
                'p_sirket_id': sirket_id,
                'p_tedarikci_id': tedarikci_id
            }).execute()
            
            return tedarikci_res.data, summary_res.data
        except Exception as e:
            print(f"Hata (get_summary_by_id): {e}")
            raise
    
    def get_paginated_list(self, sirket_id: int, sayfa: int, limit: int, arama: str, sirala_sutun: str, sirala_yon: str):
        """Tedarikçileri sayfalama, arama ve sıralama yaparak yeni RPC fonksiyonu ile getirir."""
        try:
            offset = (sayfa - 1) * limit
            
            params = {
                'p_sirket_id': sirket_id,
                'p_limit': limit,
                'p_offset': offset,
                'p_search_term': arama,
                'p_sort_column': sirala_sutun,
                'p_sort_direction': sirala_yon
            }

            # Yeni ve performanslı RPC'mizi çağırıyoruz
            response = supabase.rpc('get_paginated_suppliers', params).execute()
            
            # supabase-py v2 RPC'den tek bir JSON objesi döner
            result = response.data
            
            tedarikciler = result.get('data', [])
            toplam_kayit = result.get('count', 0)

            # Blueprint katmanıyla uyumlu bir dönüş tipi sağlıyoruz.
            APIResponse = namedtuple('APIResponse', ['data', 'count'])
            
            return APIResponse(data=tedarikciler, count=toplam_kayit)

        except Exception as e:
            print(f"Hata (get_paginated_list with RPC): {e}")
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
            
            response = supabase.table('tedarikciler').insert(yeni_veri).execute()
            return response.data[0]
        except (APIError, Exception) as e:
            print(f"Hata (create): {e}")
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

            response = supabase.table('tedarikciler').update(guncellenecek_veri).eq('id', tedarikci_id).eq('sirket_id', sirket_id).execute()
            
            if not response.data:
                raise ValueError("Tedarikçi bulunamadı veya bu işlem için yetkiniz yok.")
                
            return response.data[0]
        except (APIError, Exception) as e:
            print(f"Hata (update): {e}")
            raise

    def delete(self, sirket_id: int, tedarikci_id: int):
        """Bir tedarikçiyi siler."""
        try:
            response = supabase.table('tedarikciler').delete().eq('id', tedarikci_id).eq('sirket_id', sirket_id).execute()
            if not response.data:
                 raise ValueError("Tedarikçi bulunamadı veya bu işlem için yetkiniz yok.")
            return True
        except Exception as e:
            print(f"Hata (delete): {e}")
            if 'violates foreign key constraint' in str(e).lower():
                raise ValueError("Bu tedarikçiye ait süt veya yem girdisi olduğu için silinemiyor.")
            raise

# Sayfalama için yardımcı servisler (bunları da ayırabiliriz)
class PagedDataService:
    def get_sut_girdileri(self, sirket_id: int, tedarikci_id: int, sayfa: int, limit: int = 10):
        offset = (sayfa - 1) * limit
        query = supabase.table('sut_girdileri').select(
            '*, kullanicilar(kullanici_adi)', count='exact'
        ).eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order(
            'taplanma_tarihi', desc=True
        ).range(offset, offset + limit - 1)
        return query.execute()

    def get_yem_islemleri(self, sirket_id: int, tedarikci_id: int, sayfa: int, limit: int = 10):
        offset = (sayfa - 1) * limit
        query = supabase.table('yem_islemleri').select(
            '*, kullanicilar(kullanici_adi), yem_urunleri(yem_adi)', count='exact'
        ).eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order(
            'islem_tarihi', desc=True
        ).range(offset, offset + limit - 1)
        return query.execute()

    def get_finansal_islemler(self, sirket_id: int, tedarikci_id: int, sayfa: int, limit: int = 10):
        offset = (sayfa - 1) * limit
        query = supabase.table('finansal_islemler').select(
            '*, kullanicilar(kullanici_adi)', count='exact'
        ).eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order(
            'islem_tarihi', desc=True
        ).range(offset, offset + limit - 1)
        return query.execute()

# Servisleri tek bir yerden erişilebilir hale getirelim
tedarikci_service = TedarikciService()
paged_data_service = PagedDataService()
