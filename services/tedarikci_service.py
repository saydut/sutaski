# services/tedarikci_service.py

from flask import g, session
from postgrest import APIError
from decimal import Decimal
from collections import namedtuple
import logging
import random
import string
from extensions import bcrypt
from constants import UserRole
from utils import sanitize_input # YENİ: bleach temizleyicisini import et

logger = logging.getLogger(__name__)

# --- Yardımcı Fonksiyon: Benzersiz Çiftçi Kullanıcı Adı Oluştur ---
def _generate_unique_farmer_username(base_name: str, sirket_id: int) -> str:
    # Bu fonksiyon aynı kalıyor...
    # YENİ: Gelen base_name'i de sanitize edelim
    clean_name = ''.join(c for c in sanitize_input(base_name).lower() if c.isalnum() or c == '_').replace(' ', '_')
    username_base = f"{clean_name}_ciftci"
    username = username_base
    counter = 1
    while True:
        exists_res = g.supabase.table('kullanicilar') \
            .select('id', count='exact') \
            .eq('kullanici_adi', username) \
            .eq('sirket_id', sirket_id) \
            .execute()
        if exists_res.count == 0:
            return username
        username = f"{username_base}_{counter}"
        counter += 1
        if counter > 100:
             raise Exception("Benzersiz çiftçi kullanıcı adı üretilemedi.")

class TedarikciService:

    def get_by_id(self, sirket_id: int, tedarikci_id: int):
        """ID ile tek bir tedarikçinin tüm detaylarını getirir."""
        # Bu fonksiyon aynı kalıyor...
        try:
            response = g.supabase.table('tedarikciler') \
                .select('*') \
                .eq('id', tedarikci_id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single() \
                .execute()
            return response.data
        except Exception as e:
            logger.error(f"get_by_id hatası (ID: {tedarikci_id}): {e}", exc_info=True)
            raise Exception(f"Tedarikçi detayı (ID: {tedarikci_id}) alınırken bir hata oluştu.")

    def get_summary_by_id(self, sirket_id: int, tedarikci_id: int):
        """Bir tedarikçinin finansal özetini RPC ile hesaplar ve tedarikçi bilgilerini de döndürür."""
        try:
            # Tedarikçi temel bilgilerini al
            tedarikci_res = self.get_by_id(sirket_id, tedarikci_id)
            if not tedarikci_res:
                 return None, None

            # Güncellenmiş RPC ile finansal özeti hesapla
            summary_res = g.supabase.rpc('get_supplier_summary', {
                'p_sirket_id': sirket_id,
                'p_tedarikci_id': tedarikci_id
            }).execute()

            ozet_verisi = summary_res.data if summary_res.data else {}

            # --- GÜNCELLEME: Frontend'e gönderilecek özet verisini yeni alan adlarıyla oluştur ---
            # Sayıları Decimal'e çevirip string olarak formatlayalım
            formatted_ozet = {
                "toplam_sut_alacagi": f"{Decimal(ozet_verisi.get('toplam_sut_alacagi', 0)):.2f}",
                "toplam_yem_borcu": f"{Decimal(ozet_verisi.get('toplam_yem_borcu', 0)):.2f}",
                "toplam_sirket_odemesi": f"{Decimal(ozet_verisi.get('toplam_sirket_odemesi', 0)):.2f}", # Yeni ad
                "toplam_tahsilat": f"{Decimal(ozet_verisi.get('toplam_tahsilat', 0)):.2f}",          # Yeni ad
                "net_bakiye": f"{Decimal(ozet_verisi.get('net_bakiye', 0)):.2f}"
            }
            # --- GÜNCELLEME SONU ---

            # Tedarikçi verisini ve formatlanmış özeti döndür
            return tedarikci_res, formatted_ozet

        except Exception as e:
            logger.error(f"get_summary_by_id hatası (ID: {tedarikci_id}): {e}", exc_info=True)
            raise Exception(f"Tedarikçi özeti (ID: {tedarikci_id}) hesaplanırken bir hata oluştu.")

    def get_all_for_dropdown(self, sirket_id: int):
        """Dropdown menüler için tedarikçileri getirir. Rol filtrelemesi yapar."""
        # Bu fonksiyon aynı kalıyor...
        try:
            user_rol = session.get('user', {}).get('rol')
            kullanici_id = session.get('user', {}).get('id')
            query = g.supabase.table('tedarikciler').select('id, isim').eq('sirket_id', sirket_id)

            if user_rol == UserRole.TOPLAYICI.value:
                atama_res = g.supabase.table('toplayici_tedarikci_atananlari') \
                    .select('tedarikci_id') \
                    .eq('toplayici_id', kullanici_id) \
                    .execute()
                atanan_idler = [item['tedarikci_id'] for item in atama_res.data if item.get('tedarikci_id')]
                if not atanan_idler:
                    logger.info(f"Toplayıcı {kullanici_id} için atanmış tedarikçi bulunamadı.")
                    return []
                logger.info(f"Toplayıcı {kullanici_id} için tedarikçi listesi filtreleniyor: {atanan_idler}")
                query = query.in_('id', atanan_idler)

            response = query.order('isim', desc=False).execute()
            logger.info(f"Dropdown için {len(response.data)} tedarikçi bulundu.")
            return response.data
        except Exception as e:
            logger.error(f"Dropdown için tedarikçi listesi alınırken hata: {e}", exc_info=True)
            raise Exception("Tedarikçi listesi alınamadı.")

    def create(self, sirket_id: int, data: dict):
        """Yeni bir tedarikçi oluşturur ve otomatik olarak bir çiftçi hesabı açar."""
        # YENİ: İsim sanitize ediliyor
        isim = sanitize_input(data.get('isim', ''))
        if not isim:
            raise ValueError("Tedarikçi ismi zorunludur.")
        
        yeni_ciftci_kullanici_adi = None
        yeni_ciftci_sifre = None
        yeni_kullanici_id = None
        try:
            # YENİ: Diğer alanlar da sanitize ediliyor
            yeni_veri = {
                'isim': isim, 
                'sirket_id': sirket_id, 
                'kullanici_id': None,
                'tc_no': sanitize_input(data.get('tc_no')) or None,
                'telefon_no': sanitize_input(data.get('telefon_no')) or None,
                'adres': sanitize_input(data.get('adres')) or None
            }

            tedarikci_response = g.supabase.table('tedarikciler').insert(yeni_veri).execute()
            yeni_tedarikci = tedarikci_response.data[0]
            yeni_tedarikci_id = yeni_tedarikci['id']
            yeni_ciftci_kullanici_adi = _generate_unique_farmer_username(isim, sirket_id)
            yeni_ciftci_sifre = ''.join(random.choices(string.digits, k=4))
            hashed_sifre = bcrypt.generate_password_hash(yeni_ciftci_sifre).decode('utf-8')
            kullanici_insert_data = {
                'kullanici_adi': yeni_ciftci_kullanici_adi,
                'sifre': hashed_sifre,
                'sirket_id': sirket_id,
                'rol': UserRole.CIFCI.value
            }
            kullanici_response = g.supabase.table('kullanicilar').insert(kullanici_insert_data).execute()
            yeni_kullanici_id = kullanici_response.data[0]['id']
            g.supabase.table('tedarikciler') \
                .update({'kullanici_id': yeni_kullanici_id}) \
                .eq('id', yeni_tedarikci_id) \
                .execute()
            return {
                "tedarikci": yeni_tedarikci,
                "ciftci_kullanici_adi": yeni_ciftci_kullanici_adi,
                "ciftci_sifre": yeni_ciftci_sifre
            }
        except Exception as e:
            logger.error(f"Tedarikçi ve çiftçi hesabı oluşturulurken hata: {e}", exc_info=True)
            raise Exception("Tedarikçi ve çiftçi hesabı oluşturulurken bir hata oluştu.")


    def update(self, sirket_id: int, tedarikci_id: int, data: dict):
        """Mevcut bir tedarikçiyi günceller."""
        # Bu fonksiyon aynı kalıyor...
        try:
            guncellenecek_veri = {}
            # YENİ: Alanlar sanitize ediliyor
            if 'isim' in data and data.get('isim'):
                guncellenecek_veri['isim'] = sanitize_input(data.get('isim'))
            else:
                raise ValueError("Tedarikçi ismi boş bırakılamaz.")
            
            guncellenecek_veri['tc_no'] = sanitize_input(data.get('tc_no')) or None
            guncellenecek_veri['telefon_no'] = sanitize_input(data.get('telefon_no')) or None
            guncellenecek_veri['adres'] = sanitize_input(data.get('adres')) or None

            response = g.supabase.table('tedarikciler').update(guncellenecek_veri).eq('id', tedarikci_id).eq('sirket_id', sirket_id).execute()
            if not response.data:
                raise ValueError("Tedarikçi bulunamadı veya bu işlem için yetkiniz yok.")
            return response.data[0]
        except Exception as e:
            logger.error(f"Tedarikçi güncellenirken hata: {e}", exc_info=True)
            raise


    def delete(self, sirket_id: int, tedarikci_id: int):
        """Bir tedarikçiyi ve (varsa) ona bağlı çiftçi hesabını siler."""
        # Bu fonksiyon aynı kalıyor...
        try:
            tedarikci_res = g.supabase.table('tedarikciler') \
                .select('kullanici_id') \
                .eq('id', tedarikci_id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single() \
                .execute()
            if not tedarikci_res.data:
                 raise ValueError("Tedarikçi bulunamadı veya bu işlem için yetkiniz yok.")
            bagli_kullanici_id = tedarikci_res.data.get('kullanici_id')
            response = g.supabase.table('tedarikciler').delete().eq('id', tedarikci_id).eq('sirket_id', sirket_id).execute()
            if bagli_kullanici_id:
                try:
                    g.supabase.table('kullanicilar').delete().eq('id', bagli_kullanici_id).eq('sirket_id', sirket_id).execute()
                    logger.info(f"Tedarikçi {tedarikci_id} ile birlikte kullanıcı {bagli_kullanici_id} de silindi.")
                except Exception as user_delete_error:
                    logger.error(f"Tedarikçi silindi ancak bağlı kullanıcı {bagli_kullanici_id} silinirken hata oluştu: {user_delete_error}", exc_info=True)
            return True
        except ValueError as ve:
             raise ve
        except Exception as e:
            if 'violates foreign key constraint' in str(e).lower():
                raise ValueError("Bu tedarikçiye ait süt veya yem girdisi olduğu için silinemiyor.")
            logger.error(f"Tedarikçi silinirken hata: {e}", exc_info=True)
            raise Exception("Tedarikçi silinirken bir hata oluştu.")

# PagedDataService sınıfı aynı kalabilir, RPC'yi kullanmıyor.
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

# ... (PagedDataService sınıfının bittiği yer) ...

    # YENİ FONKSİYON: Tedarikçi detay sayfası için RPC'yi çağıran servis
    def get_detay_page_data(self, sirket_id: int, tedarikci_id: int, sayfa: int, limit: int = 10):
        """Tedarikçi detay sayfası için özet ve ilk sayfa girdilerini tek RPC ile çeker."""
        try:
            offset = (sayfa - 1) * limit
            params = {
                'p_sirket_id': sirket_id,
                'p_tedarikci_id': tedarikci_id,
                'p_limit': limit,
                'p_offset': offset
            }
            response = g.supabase.rpc('get_tedarikci_detay_page_data', params).execute()
            
            if not response.data:
                raise Exception("Tedarikçi detay verisi alınamadı.")
            
            # RPC'den gelen JSON içindeki verileri ayrıştıralım
            data = response.data
            ozet_verisi = data.get('ozet', {})
            girdiler_verisi = data.get('girdiler', [])
            toplam_kayit = data.get('toplam_kayit', 0)

            # Özeti formatlayalım (get_summary_by_id'deki gibi)
            formatted_ozet = {
                "toplam_sut_alacagi": f"{Decimal(ozet_verisi.get('toplam_sut_alacagi', 0)):.2f}",
                "toplam_yem_borcu": f"{Decimal(ozet_verisi.get('toplam_yem_borcu', 0)):.2f}",
                "toplam_sirket_odemesi": f"{Decimal(ozet_verisi.get('toplam_sirket_odemesi', 0)):.2f}",
                "toplam_tahsilat": f"{Decimal(ozet_verisi.get('toplam_tahsilat', 0)):.2f}",
                "net_bakiye": f"{Decimal(ozet_verisi.get('net_bakiye', 0)):.2f}"
            }

            return formatted_ozet, girdiler_verisi, toplam_kayit
        except Exception as e:
            logger.error(f"get_detay_page_data hatası (Tedarikçi ID: {tedarikci_id}): {e}", exc_info=True)
            raise Exception("Tedarikçi detay verileri alınırken bir hata oluştu.")


# PagedDataService sınıfından SONRA ve tedarikci_service = TedarikciService() satırından ÖNCE
paged_data_service = PagedDataService()

# YENİ: paged_data_service'e yeni fonksiyonumuzu ekleyelim
# Bu, paged_data_service = PagedDataService() satırından SONRA olmalı.
paged_data_service.get_detay_page_data = PagedDataService.get_detay_page_data.__get__(paged_data_service, PagedDataService)

tedarikci_service = TedarikciService()