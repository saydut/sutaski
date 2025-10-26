# services/tedarikci_service.py

from flask import g, session
from postgrest import APIError
from decimal import Decimal
from collections import namedtuple
import logging
import random # YENİ: Rastgele şifre için
import string # YENİ: Rastgele şifre için
from extensions import bcrypt # YENİ: Şifre hashlemek için
from constants import UserRole # YENİ: Rolleri kullanmak için

logger = logging.getLogger(__name__)

# --- YENİ Yardımcı Fonksiyon: Benzersiz Çiftçi Kullanıcı Adı Oluştur ---
def _generate_unique_farmer_username(base_name: str, sirket_id: int) -> str:
    """Verilen temel isimden yola çıkarak benzersiz bir çiftçi kullanıcı adı üretir."""
    # Türkçe karakterleri ve boşlukları temizle
    clean_name = ''.join(c for c in base_name.lower() if c.isalnum() or c == '_').replace(' ', '_')
    username_base = f"{clean_name}_ciftci"
    username = username_base
    counter = 1
    while True:
        # Veritabanında bu kullanıcı adının olup olmadığını kontrol et
        exists_res = g.supabase.table('kullanicilar') \
            .select('id', count='exact') \
            .eq('kullanici_adi', username) \
            .eq('sirket_id', sirket_id) \
            .execute()
        if exists_res.count == 0:
            return username # Benzersiz isim bulundu
        # Varsa, sonuna sayı ekleyerek tekrar dene
        username = f"{username_base}_{counter}"
        counter += 1
        if counter > 100: # Sonsuz döngü riskine karşı
             raise Exception("Benzersiz çiftçi kullanıcı adı üretilemedi.")

class TedarikciService:

    # services/tedarikci_service.py DOSYASINA EKLE:

    def get_by_id(self, sirket_id: int, tedarikci_id: int):
        """ID ile tek bir tedarikçinin tüm detaylarını getirir."""
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
            # Önce tedarikçi temel bilgilerini al (isim vb. için)
            tedarikci_res = self.get_by_id(sirket_id, tedarikci_id) # Yukarıda eklediğimiz fonksiyonu kullan
            if not tedarikci_res:
                 # get_by_id zaten None döndürecek veya hata fırlatacak
                 return None, None # Hem tedarikçi verisi yok, hem özet verisi yok

            # Sonra RPC ile finansal özeti hesapla
            summary_res = g.supabase.rpc('get_supplier_summary', {
                'p_sirket_id': sirket_id,
                'p_tedarikci_id': tedarikci_id
            }).execute()

            # RPC'den veri dönmezse boş bir dict döndür
            ozet_verisi = summary_res.data if summary_res.data else {}

            return tedarikci_res, ozet_verisi # Tedarikçi verisi ve özet verisi döndürülüyor

        except Exception as e:
            logger.error(f"get_summary_by_id hatası (ID: {tedarikci_id}): {e}", exc_info=True)
            raise Exception(f"Tedarikçi özeti (ID: {tedarikci_id}) hesaplanırken bir hata oluştu.")
    # ... (get_all_for_dropdown, get_by_id, get_summary_by_id, get_paginated_list fonksiyonları aynı kalır) ...

    def get_all_for_dropdown(self, sirket_id: int):
        """Dropdown menüler için tedarikçileri getirir.
           YENİ: Toplayıcı rolü için filtreleme yapar."""
        try:
            # Session'dan kullanıcı rolünü ve ID'sini al
            user_rol = session.get('user', {}).get('rol')
            kullanici_id = session.get('user', {}).get('id')

            # Temel sorgu: Şirketteki tüm tedarikçiler
            query = g.supabase.table('tedarikciler').select('id, isim').eq('sirket_id', sirket_id)

            # Eğer kullanıcı Toplayıcı ise, sadece atanmışları getir
            if user_rol == UserRole.TOPLAYICI.value:
                # Toplayıcıya atanmış tedarikçi ID'lerini çek
                atama_res = g.supabase.table('toplayici_tedarikci_atananlari') \
                    .select('tedarikci_id') \
                    .eq('toplayici_id', kullanici_id) \
                    .execute()

                # Atanmış ID listesini oluştur
                atanan_idler = [item['tedarikci_id'] for item in atama_res.data if item.get('tedarikci_id')]

                # Eğer hiç atanmış tedarikçi yoksa, boş liste döndür
                if not atanan_idler:
                    logger.info(f"Toplayıcı {kullanici_id} için atanmış tedarikçi bulunamadı.")
                    return []

                # Sorguya ID filtresini ekle
                logger.info(f"Toplayıcı {kullanici_id} için tedarikçi listesi filtreleniyor: {atanan_idler}")
                query = query.in_('id', atanan_idler)

            # Sorguyu çalıştır ve isme göre sırala
            response = query.order('isim', desc=False).execute()
            logger.info(f"Dropdown için {len(response.data)} tedarikçi bulundu.")
            return response.data
        except Exception as e:
            logger.error(f"Dropdown için tedarikçi listesi alınırken hata: {e}", exc_info=True)
            raise Exception("Tedarikçi listesi alınamadı.")

        
        

    def create(self, sirket_id: int, data: dict):
        """Yeni bir tedarikçi oluşturur ve otomatik olarak bir çiftçi hesabı açar."""
        isim = data.get('isim', '').strip()
        if not isim:
            raise ValueError("Tedarikçi ismi zorunludur.")

        # --- Otomatik Çiftçi Hesabı Değişkenleri ---
        yeni_ciftci_kullanici_adi = None
        yeni_ciftci_sifre = None
        yeni_kullanici_id = None
        # --- / ---

        try:
            # 1. Tedarikçiyi oluştur (kullanici_id başlangıçta NULL)
            yeni_veri = {'isim': isim, 'sirket_id': sirket_id, 'kullanici_id': None}
            if data.get('tc_no'): yeni_veri['tc_no'] = data.get('tc_no')
            if data.get('telefon_no'): yeni_veri['telefon_no'] = data.get('telefon_no')
            if data.get('adres'): yeni_veri['adres'] = data.get('adres')

            tedarikci_response = g.supabase.table('tedarikciler').insert(yeni_veri).execute()
            yeni_tedarikci = tedarikci_response.data[0]
            yeni_tedarikci_id = yeni_tedarikci['id']

            # 2. Çiftçi Hesabını Oluştur
            yeni_ciftci_kullanici_adi = _generate_unique_farmer_username(isim, sirket_id)
            yeni_ciftci_sifre = ''.join(random.choices(string.digits, k=4)) # 4 haneli rastgele şifre
            hashed_sifre = bcrypt.generate_password_hash(yeni_ciftci_sifre).decode('utf-8')

            kullanici_insert_data = {
                'kullanici_adi': yeni_ciftci_kullanici_adi,
                'sifre': hashed_sifre,
                'sirket_id': sirket_id,
                'rol': UserRole.CIFCI.value
            }
            kullanici_response = g.supabase.table('kullanicilar').insert(kullanici_insert_data).execute()
            yeni_kullanici_id = kullanici_response.data[0]['id']

            # 3. Tedarikçi Kaydını Yeni Kullanıcı ID'si ile Güncelle
            g.supabase.table('tedarikciler') \
                .update({'kullanici_id': yeni_kullanici_id}) \
                .eq('id', yeni_tedarikci_id) \
                .execute()

            # Başarılı sonuç: Tedarikçi bilgisi + çiftçi giriş bilgileri
            return {
                "tedarikci": yeni_tedarikci,
                "ciftci_kullanici_adi": yeni_ciftci_kullanici_adi,
                "ciftci_sifre": yeni_ciftci_sifre # Şifreyi plaintext olarak döndür
            }

        except Exception as e:
            # Eğer hata oluşursa, potansiyel olarak oluşturulmuş kayıtları geri almaya çalışalım (best-effort)
            # Bu kısım daha karmaşık transaction yönetimi gerektirebilir, şimdilik basit tutalım.
            logger.error(f"Tedarikçi ve çiftçi hesabı oluşturulurken hata: {e}", exc_info=True)
            # Belki yarım kalan kayıtları silmek gerekebilir? Şimdilik sadece hata döndürelim.
            # if yeni_kullanici_id:
            #     try: g.supabase.table('kullanicilar').delete().eq('id', yeni_kullanici_id).execute()
            #     except: pass # Silme hatasını yoksay
            # if 'yeni_tedarikci_id' in locals() and yeni_tedarikci_id:
            #      try: g.supabase.table('tedarikciler').delete().eq('id', yeni_tedarikci_id).execute()
            #      except: pass
            raise Exception("Tedarikçi ve çiftçi hesabı oluşturulurken bir hata oluştu.")


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

    # GÜNCELLEME: Tedarikçi silinmeden önce bağlı kullanıcıyı silme mantığı eklendi.
    def delete(self, sirket_id: int, tedarikci_id: int):
        """Bir tedarikçiyi ve (varsa) ona bağlı çiftçi hesabını siler."""
        try:
            # Önce silinecek tedarikçinin bağlı kullanıcı ID'sini al
            tedarikci_res = g.supabase.table('tedarikciler') \
                .select('kullanici_id') \
                .eq('id', tedarikci_id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single() \
                .execute()

            if not tedarikci_res.data:
                 raise ValueError("Tedarikçi bulunamadı veya bu işlem için yetkiniz yok.")

            bagli_kullanici_id = tedarikci_res.data.get('kullanici_id')

            # Tedarikçiyi sil (Eğer bağlı işlemler varsa Foreign Key hatası verecektir, bu istediğimiz bir şey)
            response = g.supabase.table('tedarikciler').delete().eq('id', tedarikci_id).eq('sirket_id', sirket_id).execute()
            # Silme başarılı olduysa ve bağlı bir kullanıcı ID'si varsa, o kullanıcıyı da sil
            if bagli_kullanici_id:
                try:
                    g.supabase.table('kullanicilar').delete().eq('id', bagli_kullanici_id).eq('sirket_id', sirket_id).execute()
                    logger.info(f"Tedarikçi {tedarikci_id} ile birlikte kullanıcı {bagli_kullanici_id} de silindi.")
                except Exception as user_delete_error:
                    # Kullanıcı silme başarısız olursa logla ama ana işlemi geri alma (tedarikçi zaten silindi)
                    logger.error(f"Tedarikçi silindi ancak bağlı kullanıcı {bagli_kullanici_id} silinirken hata oluştu: {user_delete_error}", exc_info=True)

            return True
        except ValueError as ve:
             raise ve
        except Exception as e:
            if 'violates foreign key constraint' in str(e).lower():
                raise ValueError("Bu tedarikçiye ait süt veya yem girdisi olduğu için silinemiyor.")
            logger.error(f"Tedarikçi silinirken hata: {e}", exc_info=True)
            raise Exception("Tedarikçi silinirken bir hata oluştu.")
        
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