# services/tedarikci_service.py

from flask import g
from decimal import Decimal
import logging
from extensions import supabase_client, supabase_service # HER İKİ client'ı da import et
from utils import sanitize_input

logger = logging.getLogger(__name__)

class TedarikciService:

    def get_by_id(self, tedarikci_id: int):
        """
        ID ile tek bir tedarikçinin tüm detaylarını RLS kullanarak getirir.
        sirket_id filtresine gerek YOKTUR.
        """
        try:
            # g.supabase yerine supabase_client kullan
            response = supabase_client.table('tedarikciler') \
                .select('*') \
                .eq('id', tedarikci_id) \
                .maybe_single() \
                .execute()
            return response.data, None
        except Exception as e:
            logger.error(f"get_by_id hatası (ID: {tedarikci_id}): {e}", exc_info=True)
            return None, f"Tedarikçi detayı (ID: {tedarikci_id}) alınırken bir hata oluştu."

    def get_all(self):
        """
        Tüm tedarikçileri RLS kullanarak getirir.
        sirket_id filtresine gerek YOKTUR.
        """
        try:
            # g.supabase yerine supabase_client kullan
            response = supabase_client.table('tedarikciler') \
                .select('*') \
                .order('isim', desc=False) \
                .execute()
            return response.data, None
        except Exception as e:
            logger.error(f"Tüm tedarikçiler alınırken hata: {e}", exc_info=True)
            return None, "Tedarikçi listesi alınamadı."

    def get_summary_by_id(self, tedarikci_id: int):
        """
        Bir tedarikçinin finansal özetini RPC ile hesaplar.
        sirket_id'yi decorator'dan (g.profile) alır.
        """
        try:
            # 1. sirket_id'yi parametreden değil, g.profile'dan al
            sirket_id = g.profile['sirket_id']

            # 2. Tedarikçi temel bilgilerini (RLS'e tabi olarak) al
            tedarikci_data, error = self.get_by_id(tedarikci_id)
            if error or not tedarikci_data:
                 return None, None, (error or "Tedarikçi bulunamadı")

            # 3. RPC'ye sirket_id'yi g objesinden alarak gönder
            summary_res = supabase_client.rpc('get_supplier_summary', {
                'p_sirket_id': sirket_id,
                'p_tedarikci_id': tedarikci_id
            }).execute()

            ozet_verisi = summary_res.data[0] if summary_res.data else {}

            # Formatlama (Bu kısım aynı kalabilir)
            formatted_ozet = {
                "toplam_sut_alacagi": f"{Decimal(ozet_verisi.get('toplam_sut_alacagi', 0)):.2f}",
                "toplam_yem_borcu": f"{Decimal(ozet_verisi.get('toplam_yem_borcu', 0)):.2f}",
                "toplam_sirket_odemesi": f"{Decimal(ozet_verisi.get('toplam_sirket_odemesi', 0)):.2f}",
                "toplam_tahsilat": f"{Decimal(ozet_verisi.get('toplam_tahsilat', 0)):.2f}",
                "net_bakiye": f"{Decimal(ozet_verisi.get('net_bakiye', 0)):.2f}"
            }
            
            return tedarikci_data, formatted_ozet, None

        except Exception as e:
            logger.error(f"get_summary_by_id hatası (ID: {tedarikci_id}): {e}", exc_info=True)
            return None, None, f"Tedarikçi özeti (ID: {tedarikci_id}) hesaplanırken bir hata oluştu."

    def get_all_for_dropdown(self):
        """
        Dropdown menüler için tedarikçileri getirir. Rol filtrelemesi RLS ile yapılır.
        sirket_id'ye gerek YOKTUR.
        """
        try:
            # 1. Rol ve kullanıcı ID'sini session'dan değil, g objesinden al
            user_rol = g.profile['rol']
            kullanici_id = g.user.id  # Bu artık bir UUID

            # 2. RLS'in filtreleyeceği (anon_key) client'ı kullan
            query = supabase_client.table('tedarikciler').select('id, isim')

            # 3. Eğer toplayıcı ise, onun atanmış tedarikçilerini getir
            if user_rol == 'toplayici':
                # Bu sorgu da RLS'e tabidir ('toplayici_tedarikci_atananlari' RLS politikası)
                # Ancak daha verimli olması için direkt toplayici_id ile filtreleyelim
                atama_res = supabase_client.table('toplayici_tedarikci_atananlari') \
                    .select('tedarikci_id') \
                    .eq('toplayici_id', kullanici_id) \
                    .execute()
                
                atanan_idler = [item['tedarikci_id'] for item in atama_res.data if item.get('tedarikci_id')]
                
                if not atanan_idler:
                    logger.info(f"Toplayıcı {kullanici_id} için atanmış tedarikçi bulunamadı.")
                    return [], None
                
                logger.info(f"Toplayıcı {kullanici_id} için tedarikçi listesi filtreleniyor: {atanan_idler}")
                query = query.in_('id', atanan_idler)

            response = query.order('isim', desc=False).execute()
            logger.info(f"Dropdown için {len(response.data)} tedarikçi bulundu.")
            return response.data, None
        except Exception as e:
            logger.error(f"Dropdown için tedarikçi listesi alınırken hata: {e}", exc_info=True)
            return None, "Tedarikçi listesi alınamadı."

    def create(self, data: dict):
        """
        Yeni bir tedarikçi oluşturur.
        Çiftçi hesabı OLUŞTURMAZ (bu artık ayrı bir işlem olmalı).
        sirket_id'yi g objesinden alır.
        """
        try:
            sirket_id = g.profile['sirket_id']
            
            isim = sanitize_input(data.get('isim', ''))
            if not isim:
                raise ValueError("Tedarikçi ismi zorunludur.")
            
            yeni_veri = {
                'isim': isim, 
                'sirket_id': sirket_id,  # RLS 'WITH CHECK' için zorunlu
                'tc_no': sanitize_input(data.get('tc_no')) or None,
                'telefon_no': sanitize_input(data.get('telefon_no')) or None,
                'adres': sanitize_input(data.get('adres')) or None,
                'kullanici_id': None # Artık kullanıcı otomatik oluşturulmuyor
            }

            response = supabase_client.table('tedarikciler').insert(yeni_veri).execute()
            
            # Artık _generate_unique_farmer_username, bcrypt, 'kullanicilar' tablosuna
            # insert etme gibi işlemlerin TAMAMI KALDIRILDI.
            
            return response.data[0], None
        
        except Exception as e:
            logger.error(f"Tedarikçi oluşturulurken hata: {e}", exc_info=True)
            return None, "Tedarikçi oluşturulurken bir hata oluştu."


    def update(self, tedarikci_id: int, data: dict):
        """
        Mevcut bir tedarikçiyi günceller.
        RLS, bu kaydın doğru şirkete ait olduğunu doğrular.
        """
        try:
            guncellenecek_veri = {}
            if 'isim' in data and data.get('isim'):
                guncellenecek_veri['isim'] = sanitize_input(data.get('isim'))
            else:
                raise ValueError("Tedarikçi ismi boş bırakılamaz.")
            
            guncellenecek_veri['tc_no'] = sanitize_input(data.get('tc_no')) or None
            guncellenecek_veri['telefon_no'] = sanitize_input(data.get('telefon_no')) or None
            guncellenecek_veri['adres'] = sanitize_input(data.get('adres')) or None

            # sirket_id filtresi KALDIRILDI. RLS halleder.
            response = supabase_client.table('tedarikciler') \
                .update(guncellenecek_veri) \
                .eq('id', tedarikci_id) \
                .execute()
                
            if not response.data:
                raise ValueError("Tedarikçi bulunamadı veya bu işlem için yetkiniz yok.")
            
            return response.data[0], None
        except Exception as e:
            logger.error(f"Tedarikçi güncellenirken hata: {e}", exc_info=True)
            return None, f"Tedarikçi güncellenirken hata: {str(e)}"


    def delete(self, tedarikci_id: int):
        """
        Bir tedarikçiyi ve ona bağlı 'profiller' ve 'auth.users' kayıtlarını siler.
        """
        try:
            # 1. Tedarikçiyi bul ve bağlı 'kullanici_id' (UUID) yi al
            # RLS, bu tedarikçinin bizim şirketimize ait olduğunu doğrular
            tedarikci_res = supabase_client.table('tedarikciler') \
                .select('kullanici_id') \
                .eq('id', tedarikci_id) \
                .maybe_single() \
                .execute()
            
            if not tedarikci_res.data:
                 raise ValueError("Tedarikçi bulunamadı veya bu işlem için yetkiniz yok.")
            
            bagli_kullanici_id = tedarikci_res.data.get('kullanici_id')

            # 2. Tedarikçiyi sil (RLS ile)
            supabase_client.table('tedarikciler').delete().eq('id', tedarikci_id).execute()

            # 3. Bağlı bir kullanıcı (çiftçi hesabı) varsa, onu da sil
            if bagli_kullanici_id:
                try:
                    # 3a. 'profiller' tablosundan sil (RLS ile)
                    # Not: DB'de ON DELETE CASCADE ayarlanmışsa bu adıma gerek olmayabilir,
                    # ama emin olmak için yapıyoruz.
                    supabase_client.table('profiller').delete().eq('id', bagli_kullanici_id).execute()
                    
                    # 3b. 'auth.users' tablosundan sil (SERVICE_ROLE KEY GEREKLİ)
                    # Bu, gerçek kullanıcıyı siler.
                    supabase_service.auth.admin.delete_user(bagli_kullanici_id)
                    
                    logger.info(f"Tedarikçi {tedarikci_id} ile birlikte kullanıcı {bagli_kullanici_id} (profil ve auth) de silindi.")
                
                except Exception as user_delete_error:
                    logger.error(f"Tedarikçi silindi ancak bağlı kullanıcı {bagli_kullanici_id} silinirken hata oluştu: {user_delete_error}", exc_info=True)
                    # Tedarikçi silindiği için hatayı fırlatmıyoruz, sadece logluyoruz.

            return True, None
        
        except ValueError as ve:
             return None, str(ve)
        except Exception as e:
            if 'violates foreign key constraint' in str(e).lower():
                return None, "Bu tedarikçiye ait süt veya yem girdisi olduğu için silinemiyor."
            logger.error(f"Tedarikçi silinirken hata: {e}", exc_info=True)
            return None, "Tedarikçi silinirken bir hata oluştu."

class PagedDataService:
    
    def get_sut_girdileri(self, tedarikci_id: int, sayfa: int, limit: int = 10):
        """Tedarikçinin süt girdilerini RLS ile sayfalı getirir."""
        offset = (sayfa - 1) * limit
        # sirket_id filtresi KALDIRILDI. RLS halleder.
        # 'kullanicilar' -> 'profiller' olarak değiştirildi.
        return supabase_client.table('sut_girdileri').select(
            '*, profiller(kullanici_adi)', count='exact'
        ).eq('tedarikci_id', tedarikci_id).order(
            'taplanma_tarihi', desc=True
        ).range(offset, offset + limit - 1).execute()

    def get_yem_islemleri(self, tedarikci_id: int, sayfa: int, limit: int = 10):
        """Tedarikçinin yem işlemlerini RLS ile sayfalı getirir."""
        offset = (sayfa - 1) * limit
        # sirket_id filtresi KALDIRILDI. RLS halleder.
        # 'kullanicilar' -> 'profiller' olarak değiştirildi.
        return supabase_client.table('yem_islemleri').select(
            '*, profiller(kullanici_adi), yem_urunleri(yem_adi)', count='exact'
        ).eq('tedarikci_id', tedarikci_id).order(
            'islem_tarihi', desc=True
        ).range(offset, offset + limit - 1).execute()

    def get_finansal_islemler(self, tedarikci_id: int, sayfa: int, limit: int = 10):
        """Tedarikçinin finansal işlemlerini RLS ile sayfalı getirir."""
        offset = (sayfa - 1) * limit
        # sirket_id filtresi KALDIRILDI. RLS halleder.
        # 'kullanicilar' -> 'profiller' olarak değiştirildi.
        return supabase_client.table('finansal_islemler').select(
            '*, profiller(kullanici_adi)', count='exact'
        ).eq('tedarikci_id', tedarikci_id).order(
            'islem_tarihi', desc=True
        ).range(offset, offset + limit - 1).execute()

    def get_detay_page_data(self, tedarikci_id: int, sayfa: int, limit: int = 10):
        """
        Tedarikçi detay sayfası için özet ve ilk sayfa girdilerini tek RPC ile çeker.
        sirket_id'yi g objesinden alır.
        """
        try:
            # 1. sirket_id'yi g objesinden al
            sirket_id = g.profile['sirket_id']
            offset = (sayfa - 1) * limit
            
            # 2. RPC'ye sirket_id'yi gönder
            params = {
                'p_sirket_id': sirket_id,
                'p_tedarikci_id': tedarikci_id,
                'p_limit': limit,
                'p_offset': offset
            }
            # 3. g.supabase yerine supabase_client kullan
            response = supabase_client.rpc('get_tedarikci_detay_page_data', params).execute()
            
            if not response.data:
                raise Exception("Tedarikçi detay verisi alınamadı.")
            
            # RPC'den gelen JSON içindeki verileri ayrıştıralım
            data = response.data[0] # RPC'ler genelde [data] döner
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


# Servisleri başlat
paged_data_service = PagedDataService()
tedarikci_service = TedarikciService()