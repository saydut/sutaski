# services/tedarikci_service.py

from flask import g
from decimal import Decimal
import logging
from datetime import datetime, timedelta # Dashboard fonksiyonları için eklendi
from extensions import supabase_client, supabase_service, turkey_tz # turkey_tz eklendi
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


# --- YENİ EKLENEN DASHBOARD FONKSİYONLARI ---
# (main.py'nin ihtiyaç duyduğu fonksiyonlar)

def get_supplier_stats(sirket_id):
    """
    Anasayfa (Dashboard) için temel istatistik kartlarını hesaplar.
    Bu, RLS'e tabidir (sadece g.user'ın sirket_id'si üzerinden çalışır).
    """
    try:
        # RPC'yi çağır (Bu RPC'nin RLS'e tabi olması gerekir)
        # VEYA daha iyisi, RPC'nin sirket_id parametresi alması
        response = supabase_client.rpc('get_supplier_stats', {'p_sirket_id': sirket_id}).execute()
        
        if response.data:
            return response.data[0]
        else:
            logger.warning(f"get_supplier_stats RPC'si sirket_id {sirket_id} için veri döndürmedi.")
            return {"total_sut": 0, "total_yem": 0, "total_odeme": 0, "aktif_tedarikci": 0}
            
    except Exception as e:
        logger.error(f"get_supplier_stats hatası: {e}", exc_info=True)
        return {"total_sut": 0, "total_yem": 0, "total_odeme": 0, "aktif_tedarikci": 0}

def get_dashboard_charts(sirket_id):
    """
    Anasayfa (Dashboard) için grafik verilerini çeker.
    """
    try:
        # 1. Son 30 günlük süt toplama (Line chart)
        # (Bu RPC'nin RLS'e tabi olması veya sirket_id alması gerekir)
        line_chart_res = supabase_client.rpc(
            'get_weekly_summary', 
            {'p_sirket_id': sirket_id}
        ).execute()
        
        daily_milk_data = {
            "labels": [formatDate(item['gun']) for item in line_chart_res.data],
            "values": [item['toplam_litre'] for item in line_chart_res.data]
        }
        
        # 2. Tedarikçi dağılımı (Pie chart)
        # (Bu RPC'nin RLS'e tabi olması veya sirket_id alması gerekir)
        pie_chart_res = supabase_client.rpc(
            'get_supplier_distribution', 
            {'p_sirket_id': sirket_id}
        ).execute()
        
        supplier_dist_data = {
            "labels": [item['isim'] for item in pie_chart_res.data],
            "values": [item['toplam_litre'] for item in pie_chart_res.data]
        }
        
        return {
            "daily_milk": daily_milk_data,
            "supplier_distribution": supplier_dist_data
        }
        
    except Exception as e:
        logger.error(f"get_dashboard_charts hatası: {e}", exc_info=True)
        return {"daily_milk": {"labels": [], "values": []}, "supplier_distribution": {"labels": [], "values": []}}

def get_recent_actions_for_dashboard(sirket_id, limit=5):
    """
    Anasayfa (Dashboard) için "Son İşlemler" listesini oluşturur.
    (Bu fonksiyon, SQL'de bir RPC ile daha verimli hale getirilebilir.)
    """
    try:
        # Son 5 süt girdisi
        sut_res = supabase_client.table('sut_girdileri') \
            .select('id, taplanma_tarihi, tedarikciler(isim), litre, fiyat') \
            .eq('sirket_id', sirket_id) \
            .order('taplanma_tarihi', desc=True) \
            .limit(limit) \
            .execute()
            
        # Son 5 yem işlemi
        yem_res = supabase_client.table('yem_islemleri') \
            .select('id, islem_tarihi, tedarikciler(isim), toplam_tutar, yem_urunleri(yem_adi)') \
            .eq('sirket_id', sirket_id) \
            .order('islem_tarihi', desc=True) \
            .limit(limit) \
            .execute()

        # Son 5 ödeme
        odeme_res = supabase_client.table('finansal_islemler') \
            .select('id, islem_tarihi, tedarikciler(isim), tutar, aciklama') \
            .eq('sirket_id', sirket_id) \
            .in_('islem_tipi', ['Odeme', 'Tahsilat']) \
            .order('islem_tarihi', desc=True) \
            .limit(limit) \
            .execute()
        
        combined_list = []

        for item in sut_res.data:
            combined_list.append({
                'tip': 'sut',
                'tarih': item['taplanma_tarihi'],
                'tutar': float(item['litre']) * float(item.get('fiyat') or 0),
                'tedarikci_ad': item['tedarikciler']['isim'] if item.get('tedarikciler') else 'Bilinmeyen',
                'detay': {'litre': item['litre']}
            })
            
        for item in yem_res.data:
            combined_list.append({
                'tip': 'yem',
                'tarih': item['islem_tarihi'],
                'tutar': float(item['toplam_tutar']),
                'tedarikci_ad': item['tedarikciler']['isim'] if item.get('tedarikciler') else 'Bilinmeyen',
                'detay': {'yem_tipi': item['yem_urunleri']['yem_adi'] if item.get('yem_urunleri') else 'Bilinmeyen Yem'}
            })
            
        for item in odeme_res.data:
            combined_list.append({
                'tip': 'odeme',
                'tarih': item['islem_tarihi'],
                'tutar': float(item['tutar']),
                'tedarikci_ad': item['tedarikciler']['isim'] if item.get('tedarikciler') else 'Bilinmeyen',
                'detay': {'aciklama': item['aciklama']}
            })
            
        # Tümünü tarihe göre tersten sırala ve ilk 5'i al
        combined_list.sort(key=lambda x: x['tarih'], reverse=True)
        return combined_list[:limit]

    except Exception as e:
        logger.error(f"get_recent_actions_for_dashboard hatası: {e}", exc_info=True)
        return []

def formatDate(iso_date_str):
    """
    ISO 8601 formatındaki tarihi (2023-10-27T10:00:00+00:00) 
    'dd.MM.yyyy' formatına çevirir.
    """
    if not iso_date_str:
        return ""
    try:
        # Pytz'den bağımsız olarak timezone bilgisini ayıkla
        dt = datetime.fromisoformat(iso_date_str)
        # Tarihi Türkiye saatine çevir
        dt_tr = dt.astimezone(turkey_tz)
        return dt_tr.strftime('%d.%m.%Y')
    except Exception as e:
        logger.warning(f"Tarih formatlama hatası (formatDate): {e}. Orjinal: {iso_date_str}")
        try:
            # Sadece tarihi almayı dene (örn: '2023-10-27')
            dt = datetime.strptime(iso_date_str, '%Y-%m-%d')
            return dt.strftime('%d.%m.%Y')
        except:
            return iso_date_str # Başarısız olursa orijinali döndür


# Servisleri başlat
paged_data_service = PagedDataService()
tedarikci_service = TedarikciService()