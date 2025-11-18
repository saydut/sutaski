# services/firma_service.py

import logging
from flask import g
from extensions import bcrypt
from constants import UserRole
from postgrest import APIError
from utils import sanitize_input 

logger = logging.getLogger(__name__)

# --- Yardımcı Fonksiyon: Benzersiz Çiftçi Kullanıcı Adı Oluştur ---
def _generate_unique_farmer_username(base_name: str, sirket_id: int) -> str:
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

# --- Ana Servis Fonksiyonları ---

def add_kullanici(sirket_id, data):
    """
    Yeni bir çiftçi/toplayıcı/muhasebeci oluşturur.
    """
    try:
        sifre = data.get('sifre')
        rol = sanitize_input(data.get('rol'))
        kullanici_adi = sanitize_input(data.get('kullanici_adi'))
        email = sanitize_input(data.get('email')) or None 
        telefon = sanitize_input(data.get('telefon'))

        if not kullanici_adi or not sifre or not rol:
            raise ValueError("Kullanıcı adı, şifre ve rol alanları zorunludur.")
            
        gecerli_roller = [UserRole.CIFCI.value, UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value]
        if rol not in gecerli_roller:
            raise ValueError(f"Geçersiz rol. Rol '{UserRole.CIFCI.value}', '{UserRole.TOPLAYICI.value}' veya '{UserRole.MUHASEBECI.value}' olmalı.")

        # Kullanıcı adının benzersizliğini kontrol et
        kullanici_var_mi = g.supabase.table('kullanicilar') \
            .select('id', count='exact') \
            .eq('kullanici_adi', kullanici_adi) \
            .eq('sirket_id', sirket_id) \
            .execute()
        if kullanici_var_mi.count > 0:
            raise ValueError(f"'{kullanici_adi}' kullanıcı adı bu şirkette zaten mevcut.")

        hashed_sifre = bcrypt.generate_password_hash(sifre).decode('utf-8')

        kullanici_data = {
            'sirket_id': sirket_id,
            'rol': rol,
            'kullanici_adi': kullanici_adi,
            'sifre': hashed_sifre, 
            'eposta': email,
            'telefon_no': telefon
        }
        
        kullanici_res = g.supabase.table('kullanicilar').insert(kullanici_data).execute()
        yeni_kullanici = kullanici_res.data[0]
        
        logger.info(f"Yeni kullanıcı (Rol: {rol}) başarıyla eklendi. DB ID: {yeni_kullanici['id']}")
        
        yeni_kullanici.pop('sifre', None)
        return yeni_kullanici

    except (ValueError, APIError) as e:
        logger.warning(f"Kullanıcı eklenirken doğrulama hatası: {str(e)}")
        if "unique constraint" in str(e).lower() and "kullanicilar_eposta_key" in str(e).lower():
            raise ValueError("Bu e-posta adresi zaten kayıtlı.")
        raise e
    except Exception as e:
        logger.error(f"Kullanıcı eklenirken beklenmedik hata: {e}", exc_info=True)
        raise Exception(f"Kullanıcı oluşturulurken sunucu hatası: {str(e)}")

def update_kullanici(sirket_id, kullanici_db_id, data):
    """
    Mevcut bir kullanıcının bilgilerini günceller.
    """
    try:
        kullanici_adi = sanitize_input(data.get('kullanici_adi')) 
        telefon = sanitize_input(data.get('telefon_no')) 
        yeni_sifre = data.get('sifre')

        update_data_kullanicilar = {}
        
        if kullanici_adi:
            update_data_kullanicilar['kullanici_adi'] = kullanici_adi
        
        if telefon:
            update_data_kullanicilar['telefon_no'] = telefon
            
        if yeni_sifre:
            hashed_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')
            update_data_kullanicilar['sifre'] = hashed_sifre

        if update_data_kullanicilar:
            g.supabase.table('kullanicilar') \
                .update(update_data_kullanicilar) \
                .eq('id', kullanici_db_id) \
                .eq('sirket_id', sirket_id) \
                .execute()

        # Tedarikçi Atamalarını Güncelle
        atanan_tedarikciler_ids = data.get('atanan_tedarikciler')

        if atanan_tedarikciler_ids is not None:
            # Mevcut atamaları sil
            g.supabase.table('toplayici_tedarikci_atama') \
                .delete() \
                .eq('sirket_id', sirket_id) \
                .eq('toplayici_id', kullanici_db_id) \
                .execute()

            # Yeni atamaları ekle
            if atanan_tedarikciler_ids:
                yeni_atamalar_data = []
                for tedarikci_id in atanan_tedarikciler_ids:
                    yeni_atamalar_data.append({
                        'sirket_id': sirket_id,
                        'toplayici_id': kullanici_db_id,
                        'tedarikci_id': int(tedarikci_id)
                    })
                
                if yeni_atamalar_data:
                    g.supabase.table('toplayici_tedarikci_atama') \
                        .insert(yeni_atamalar_data) \
                        .execute()
            
            logger.info(f"Toplayıcı (ID: {kullanici_db_id}) için tedarikçi atamaları güncellendi.")

        logger.info(f"Kullanıcı (DB ID: {kullanici_db_id}) bilgileri güncellendi.")
        
        return True

    except ValueError as ve:
        raise ve 
    except Exception as e:
        logger.error(f"Kullanıcı (DB ID: {kullanici_db_id}) güncellenirken hata: {e}", exc_info=True)
        raise Exception(f"Kullanıcı güncellenirken sunucu hatası: {str(e)}")

def delete_kullanici(kullanici_db_id):
    """
    Bir kullanıcıyı sistemden siler.
    """
    try:
        g.supabase.table('kullanicilar').delete().eq('id', kullanici_db_id).execute()
        logger.info(f"Kullanıcı (DB ID: {kullanici_db_id}) başarıyla silindi.")
        return {"success": True, "message": "Kullanıcı başarıyla silindi."}

    except APIError as e:
        logging.error(f"Kullanıcı silinirken Postgrest hatası (DB ID: {kullanici_db_id}): {e.message}", exc_info=True)
        return {"success": False, "message": f"Veritabanı hatası: {e.message}"}
    except Exception as e:
        logging.error(f"Kullanıcı silinirken genel hata (DB ID: {kullanici_db_id}): {e}", exc_info=True)
        return {"success": False, "message": "Kullanıcı silinirken beklenmedik bir hata oluştu."}

def get_kullanicilar_by_sirket_id(sirket_id):
    """
    Bir şirkete bağlı tüm kullanıcıları listeler.
    """
    try:
        response = g.supabase.table('kullanicilar') \
            .select('id, rol, kullanici_adi') \
            .eq('sirket_id', sirket_id) \
            .neq('rol', UserRole.FIRMA_YETKILISI.value) \
            .neq('rol', UserRole.ADMIN.value) \
            .order('kullanici_adi', desc=False) \
            .execute()
        
        formatted_data = []
        for user in response.data:
            formatted_data.append({
                'id': user.get('id'),
                'rol': user.get('rol'),
                'isim': user.get('kullanici_adi'),
                'kullanici_db_id': user.get('id')
            })
            
        return formatted_data
        
    except Exception as e:
        logger.error(f"Şirket kullanıcıları alınırken hata (Sirket ID: {sirket_id}): {e}", exc_info=True)
        raise Exception(f"Kullanıcılar alınırken sunucu hatası: {str(e)}")

def reset_kullanici_sifre(kullanici_id_to_reset, yeni_sifre_plain):
    """
    Firma yetkilisinin, kendi şirketindeki bir kullanıcının şifresini sıfırlamasını sağlar.
    (Mevcut fonksiyon korunuyor)
    """
    try:
        istek_yapan_sirket_id = g.user.sirket_id
        
        kullanici_res = g.supabase.table('kullanicilar') \
            .select('id, sirket_id, rol') \
            .eq('id', kullanici_id_to_reset) \
            .eq('sirket_id', istek_yapan_sirket_id) \
            .maybe_single() \
            .execute()

        if not kullanici_res.data:
            raise ValueError("Kullanıcı bulunamadı veya bu kullanıcı üzerinde işlem yapma yetkiniz yok.")

        gecerli_roller = [UserRole.CIFCI.value, UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value]
        if kullanici_res.data['rol'] not in gecerli_roller:
            raise ValueError("Sadece çiftçi, toplayıcı veya muhasebeci rolündeki kullanıcıların şifresi değiştirilebilir.")

        hashed_sifre = bcrypt.generate_password_hash(yeni_sifre_plain).decode('utf-8')

        g.supabase.table('kullanicilar') \
            .update({'sifre': hashed_sifre}) \
            .eq('id', kullanici_id_to_reset) \
            .execute()

        logger.info(f"Kullanıcı (ID: {kullanici_id_to_reset}) şifresi firma yetkilisi tarafından güncellendi.")
        return True

    except ValueError as ve:
        raise ve
    except Exception as e:
        logger.error(f"Kullanıcı şifresi ayarlanırken hata: {e}", exc_info=True)
        raise Exception(f"Kullanıcı şifresi sıfırlanırken sunucu hatası: {str(e)}")

# --- EKLENEN/DÜZELTİLEN FONKSİYONLAR ---

def set_user_password(sirket_id, kullanici_id, yeni_sifre):
    """
    Senaryo 9 hatasını çözen fonksiyon. 
    Firma yetkilisinin, alt kullanıcısının şifresini değiştirmesini sağlar.
    """
    try:
        if not yeni_sifre:
            raise ValueError("Yeni şifre boş olamaz.")
            
        # Kullanıcının bu şirkete ait olup olmadığını kontrol et
        check_user = g.supabase.table('kullanicilar').select('id, rol') \
            .eq('id', kullanici_id) \
            .eq('sirket_id', sirket_id) \
            .in_('rol', [UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value, UserRole.CIFCI.value]) \
            .single() \
            .execute()
            
        if not check_user.data:
            raise ValueError("Kullanıcı bulunamadı veya bu işlem için yetkiniz yok.")

        hashed_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')

        g.supabase.table('kullanicilar').update({'sifre': hashed_sifre}).eq('id', kullanici_id).execute()
        
        return True
    except ValueError as ve:
        raise ve
    except Exception as e:
        logger.error(f"Şifre sıfırlanırken hata: {e}", exc_info=True)
        raise Exception("Şifre sıfırlama işlemi başarısız oldu.")

def get_kullanici_detaylari(sirket_id, kullanici_id):
    """
    Belirli bir kullanıcının detaylarını ve atanmış tedarikçilerini getirir.
    (Tablo ismi hatası düzeltildi: toplayici_tedarikci_atama)
    """
    try:
        kullanici_res = g.supabase.table('kullanicilar') \
            .select('id, kullanici_adi, rol, eposta, telefon_no') \
            .eq('id', kullanici_id) \
            .eq('sirket_id', sirket_id) \
            .maybe_single() \
            .execute()
        
        kullanici_data = kullanici_res.data
        if not kullanici_data:
            return None

        # DÜZELTME: Tablo ismi 'toplayici_tedarikci_atama' olarak güncellendi
        atananlar_res = g.supabase.table('toplayici_tedarikci_atama') \
            .select('tedarikci_id') \
            .eq('toplayici_id', kullanici_id) \
            .eq('sirket_id', sirket_id) \
            .execute()

        atanan_ids = [item['tedarikci_id'] for item in atananlar_res.data]
        
        kullanici_data['atanan_tedarikciler'] = atanan_ids
        
        return kullanici_data

    except Exception as e:
        logger.error(f"Kullanıcı detayları (ID: {kullanici_id}) alınırken hata: {e}", exc_info=True)
        raise e