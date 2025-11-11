# services/sut_service.py

from extensions import supabase_client
from flask import g  # Flask'in global 'g' objesini import ediyoruz
from datetime import datetime
import logging

def get_sut_girdileri(start_date=None, end_date=None, tedarikci_id=None):
    """
    Süt girdilerini RLS kullanarak filtreler.
    Tüm filtreler opsiyoneldir.
    RLS (Satır Seviyesi Güvenlik) otomatik olarak sadece kullanıcının
    kendi şirketinin verilerini getirecektir.
    """
    try:
        # Sorguyu 'supabase_client' (anon_key) ile başlatıyoruz
        query = supabase_client.table('sut_girdileri').select(
            '*, tedarikciler(isim), profiller(kullanici_adi)'
        )
        
        # ARTIK .eq('sirket_id', sirket_id) FİLTRESİNE GEREK YOK!
        # RLS bunu veritabanı seviyesinde yapar.

        if start_date:
            query = query.gte('taplanma_tarihi', start_date)
        if end_date:
            query = query.lte('taplanma_tarihi', end_date)
        if tedarikci_id:
            query = query.eq('tedarikci_id', tedarikci_id)

        response = query.order('taplanma_tarihi', desc=True).execute()
        return response.data, None
    except Exception as e:
        logging.error(f"Süt girdileri alınırken hata: {str(e)}")
        return None, str(e)

def add_sut_girdisi(data):
    """
    Yeni bir süt girdisi ekler.
    'sirket_id' ve 'kullanici_id' bilgileri 'g' objesinden (decorator'dan) alınır.
    """
    try:
        # 1. Kimlik bilgilerini 'g' objesinden al
        # Bu bilgiler @login_required decorator'ı tarafından doldurulur
        sirket_id = g.profile['sirket_id']
        kullanici_id_uuid = g.user.id  # Bu, 'profiller.id' (uuid)
        
        # 2. Gelen veriyi hazırla
        girdi_data = {
            'litre': data.get('litre'),
            'tedarikci_id': data.get('tedarikci_id'),
            'fiyat': data.get('fiyat'),
            'tanker_id': data.get('tanker_id'),
            'taplanma_tarihi': data.get('taplanma_tarihi', datetime.now().isoformat()),
            
            # 3. RLS 'WITH CHECK' politikası için zorunlu alanlar
            'sirket_id': sirket_id,
            'kullanici_id': kullanici_id_uuid 
        }

        # 4. Veritabanına ekle
        # RLS, bu kullanıcının bu sirket_id'ye veri ekleme yetkisi
        # olup olmadığını (WITH CHECK) kontrol edecektir.
        response = supabase_client.table('sut_girdileri').insert(girdi_data).execute()
        
        return response.data, None
    except Exception as e:
        logging.error(f"Süt girdisi eklenirken hata: {str(e)}")
        return None, str(e)

def get_sut_girdisi_by_id(girdi_id):
    """
    Tek bir süt girdisini ID ile alır.
    RLS, bu girdinin kullanıcının şirketine ait olup olmadığını
    otomatik olarak kontrol eder.
    """
    try:
        # .eq('sirket_id', sirket_id) FİLTRESİNE GEREK YOK!
        response = supabase_client.table('sut_girdileri') \
            .select('*') \
            .eq('id', girdi_id) \
            .single() \
            .execute()
            
        # RLS, kayıt bulunamazsa veya başka şirkete aitse 'PostgrestError' fırlatır
        # (veya data: None döner)
        
        return response.data, None
    except Exception as e:
        logging.error(f"Süt girdisi {girdi_id} alınırken hata: {str(e)}")
        # Hata "list index out of range" ise kayıt bulunamadı demektir
        if "list index out of range" in str(e):
             return None, "Kayıt bulunamadı veya bu kaydı görme yetkiniz yok."
        return None, str(e)

def update_sut_girdisi(girdi_id, data):
    """
    Mevcut bir süt girdisini günceller.
    RLS, kullanıcının bu kaydı güncelleme yetkisi olup olmadığını kontrol eder.
    """
    try:
        # 'sirket_id' veya 'kullanici_id' gibi alanların
        # buradan güncellenmesine izin vermemeliyiz.
        # Sadece izin verilen alanları güncelle:
        update_data = {
            'litre': data.get('litre'),
            'tedarikci_id': data.get('tedarikci_id'),
            'fiyat': data.get('fiyat'),
            'tanker_id': data.get('tanker_id'),
            'taplanma_tarihi': data.get('taplanma_tarihi'),
            'duzenlendi_mi': True
        }
        
        # .eq('sirket_id', sirket_id) FİLTRESİNE GEREK YOK!
        response = supabase_client.table('sut_girdileri') \
            .update(update_data) \
            .eq('id', girdi_id) \
            .execute()
            
        return response.data, None
    except Exception as e:
        logging.error(f"Süt girdisi {girdi_id} güncellenirken hata: {str(e)}")
        return None, str(e)

def delete_sut_girdisi(girdi_id):
    """
    Bir süt girdisini siler.
    RLS, kullanıcının bu kaydı silme yetkisi (örn: 'firma_admin' rolü) 
    olup olmadığını kontrol eder.
    """
    try:
        # .eq('sirket_id', sirket_id) FİLTRESİNE GEREK YOK!
        response = supabase_client.table('sut_girdileri') \
            .delete() \
            .eq('id', girdi_id) \
            .execute()
            
        return response.data, None
    except Exception as e:
        logging.error(f"Süt girdisi {girdi_id} silinirken hata: {str(e)}")
        return None, str(e)

# Eski 'get_sut_girdileri_by_sirket_id_ve_tarih' fonksiyonu artık
# 'get_sut_girdileri' fonksiyonu ile aynı işi yaptığı için kaldırıldı.

# Eski 'get_toplayici_sut_girdileri' fonksiyonu artık
# 'get_sut_girdileri' ile aynı, sadece 'kullanici_id' filtresi eklenmesi lazım.
# İsterseniz 'get_sut_girdileri' fonksiyonuna 'kullanici_id' filtresi de ekleyebiliriz.

# Eski 'get_tedarikci_sut_girdileri_by_tarih' fonksiyonu da
# 'get_sut_girdileri(tedarikci_id=..., start_date=...)' çağrısı ile yapılabilir.

# Eski 'add_girdi_gecmisi' fonksiyonu güncellenmeli
def add_girdi_gecmisi(orijinal_girdi_id, duzenleme_sebebi, eski_data):
    """
    Bir süt girdisi düzenlendiğinde denetim kaydı tutar.
    """
    try:
        # Düzenleyen kullanıcıyı 'g' objesinden al
        duzenleyen_kullanici_id_uuid = g.user.id

        gecmis_data = {
            'orijinal_girdi_id': orijinal_girdi_id,
            'duzenleyen_kullanici_id': duzenleyen_kullanici_id_uuid,
            'duzenleme_sebebi': duzenleme_sebebi,
            'eski_litre_degeri': eski_data.get('litre'),
            'eski_tedarikci_id': eski_data.get('tedarikci_id'),
            'eski_fiyat_degeri': eski_data.get('fiyat')
        }
        
        # BU TABLOYA DA RLS EKLEMELİYİZ (orijinal_girdi_id'nin sirket_id'sine bakarak)
        # Şimdilik direkt ekliyoruz:
        response = supabase_client.table('girdi_gecmisi').insert(gecmis_data).execute()
        return response.data, None
    except Exception as e:
         logging.error(f"Girdi geçmişi eklenirken hata: {str(e)}")
         return None, str(e)