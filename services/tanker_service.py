# services/tanker_service.py

from flask import g  # 'supabase' yerine 'g' import edildi
from constants import UserRole
from postgrest import APIError  # PostgrestAPIError yerine standart APIError kullanıldı
import logging
from decimal import Decimal, InvalidOperation # Dosyanın başına import edin
from datetime import datetime # Dosyanın başına import edin


logger = logging.getLogger(__name__) # Logger eklendi

def get_tankerler(sirket_id):
    try:
        # 'supabase' -> 'g.supabase' olarak değiştirildi
        response = g.supabase.table('tankerler') \
            .select('*') \
            .eq('firma_id', sirket_id) \
            .order('tanker_adi', desc=False) \
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"Tankerler alınırken hata: {e}", exc_info=True)
        raise

def add_tanker(data):
    try:
        tanker_adi = data.get('tanker_adi')
        kapasite = data.get('kapasite_litre')
        firma_id = g.user.sirket_id

        if not tanker_adi or not kapasite:
            raise ValueError("Tanker adı ve kapasite zorunludur.")
        
        try:
            kapasite_numeric = float(kapasite)
        except ValueError:
            raise ValueError("Kapasite sayısal bir değer olmalıdır.")

        # 'supabase' -> 'g.supabase' olarak değiştirildi
        response = g.supabase.table('tankerler').insert({
            'firma_id': firma_id,
            'tanker_adi': tanker_adi,
            'kapasite_litre': kapasite_numeric,
            'mevcut_doluluk': 0
        }).execute()
        return response.data[0]
    except ValueError as ve: 
        raise ve
    except Exception as e:
        logger.error(f"Tanker eklenirken hata: {e}", exc_info=True)
        raise

def update_tanker(tanker_id, data):
    try:
        tanker_adi = data.get('tanker_adi')
        kapasite = data.get('kapasite_litre')
        
        update_data = {}
        if tanker_adi:
            update_data['tanker_adi'] = tanker_adi
        if kapasite:
            try:
                update_data['kapasite_litre'] = float(kapasite)
            except ValueError:
                raise ValueError("Kapasite sayısal bir değer olmalıdır.")

        if not update_data:
            raise ValueError("Güncellenecek veri bulunamadı.")

        # 'supabase' -> 'g.supabase' olarak değiştirildi
        response = g.supabase.table('tankerler') \
            .update(update_data) \
            .eq('id', tanker_id) \
            .eq('firma_id', g.user.sirket_id) \
            .execute()
        return response.data[0]
    except ValueError as ve:
        raise ve
    except Exception as e:
        logger.error(f"Tanker güncellenirken hata: {e}", exc_info=True)
        raise

# --- BU FONKSİYON GÜNCELLENDİ (delete_tanker) ---
def delete_tanker(tanker_id):
    """
    Bir tankeri güvenli bir şekilde siler.
    'g.supabase' kullanarak GÜVENLİ RPC fonksiyonunu çağırır.
    """
    try:
        # 'supabase.rpc' -> 'g.supabase.rpc' olarak değiştirildi
        rpc_result = g.supabase.rpc('delete_tanker_safely', {'p_tanker_id': tanker_id}).execute()
        
        if rpc_result.data and 'SQL tanker silme hatasi' in rpc_result.data:
            logger.error(f"SQL delete_tanker_safely hatası (Tanker ID: {tanker_id}): {rpc_result.data}")
            raise Exception(f"SQL fonksiyon hatası: {rpc_result.data}")
            
        return {"success": True, "message": "Tanker başarıyla silindi."}
        
    except APIError as e: # PostgrestAPIError -> APIError
        logger.error(f"Tanker silinirken Postgrest hatası (Tanker ID: {tanker_id}): {e}", exc_info=True)
        return {"success": False, "message": f"Veritabanı hatası: {e.message}"}
    except Exception as e:
        logger.error(f"Tanker silinirken genel hata (Tanker ID: {tanker_id}): {e}", exc_info=True)
        return {"success": False, "message": "Tanker silinirken beklenmedik bir hata oluştu."}

# --- Kalan fonksiyonlar (atamalarla ilgili) ---

def get_tanker_assignments(sirket_id):
    """Tankerlere atanan toplayıcıların listesini alır."""
    try:
        # 'supabase' -> 'g.supabase' olarak değiştirildi
        response = g.supabase.table('toplayici_tanker_atama') \
            .select('id, toplayici_user_id, tanker_id, kullanicilar(isim), tankerler(tanker_adi)') \
            .eq('firma_id', sirket_id) \
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"Tanker atamaları alınırken hata: {e}", exc_info=True)
        raise

def assign_toplayici_to_tanker(data):
    """Bir toplayıcıyı bir tankere atar."""
    try:
        toplayici_id = data.get('toplayici_id')
        tanker_id = data.get('tanker_id')
        firma_id = g.user.sirket_id

        if not toplayici_id or not tanker_id:
            raise ValueError("Toplayıcı ID ve Tanker ID zorunludur.")

        # 'supabase' -> 'g.supabase' olarak değiştirildi
        response = g.supabase.table('toplayici_tanker_atama').upsert({
            'toplayici_user_id': toplayici_id,
            'tanker_id': tanker_id,
            'firma_id': firma_id
        }, on_conflict='toplayici_user_id').execute()
        
        return response.data[0]
    except Exception as e:
        logger.error(f"Tanker ataması yapılırken hata: {e}", exc_info=True)
        if 'unique constraint' in str(e).lower():
             raise ValueError("Bu toplayıcı zaten bir tankere atanmış.")
        raise

def unassign_toplayici_from_tanker(assignment_id):
    """Bir toplayıcının tanker atamasını kaldırır."""
    try:
        # 'supabase' -> 'g.supabase' olarak değiştirildi
        g.supabase.table('toplayici_tanker_atama') \
            .delete() \
            .eq('id', assignment_id) \
            .eq('firma_id', g.user.sirket_id) \
            .execute()
        return True
    except Exception as e:
        logger.error(f"Tanker ataması kaldırılırken hata: {e}", exc_info=True)
        raise

def sell_and_empty_tanker(sirket_id: int, kullanici_id: int, tanker_id: int, data: dict):
    """
    Bir tankeri 'boşaltır' (satışını yapar), finansal kayıt oluşturur
    ve doluluğunu sıfırlar.
    """
    try:
        fiyat_str = data.get('satis_birim_fiyati')
        aciklama_str = sanitize_input(data.get('aciklama')) or None
        islem_tarihi_str = data.get('islem_tarihi') or None # Opsiyonel

        if not fiyat_str:
            raise ValueError("Satış birim fiyatı zorunludur.")
        
        satis_birim_fiyati = Decimal(fiyat_str)
        if satis_birim_fiyati <= 0:
            raise ValueError("Birim fiyat pozitif olmalıdır.")

        # 1. Tanker bilgilerini al
        tanker_res = g.supabase.table('tankerler') \
            .select('mevcut_doluluk, kapasite_litre') \
            .eq('id', tanker_id) \
            .eq('firma_id', sirket_id) \
            .single() \
            .execute()

        if not tanker_res.data:
            raise ValueError("Tanker bulunamadı veya yetkiniz yok.")
            
        mevcut_doluluk = Decimal(tanker_res.data['mevcut_doluluk'])
        
        if mevcut_doluluk <= 0:
            raise ValueError("Tanker zaten boş, satış yapılamaz.")

        # 2. Satış işlemini kaydet
        satis_kaydi = {
            "sirket_id": sirket_id,
            "kullanici_id": kullanici_id,
            "tanker_id": tanker_id,
            "bosaltilan_litre": str(mevcut_doluluk),
            "satis_birim_fiyati": str(satis_birim_fiyati),
            "aciklama": aciklama_str or f"{mevcut_doluluk} L süt satışı"
        }
        
        if islem_tarihi_str:
            satis_kaydi["islem_tarihi"] = datetime.strptime(islem_tarihi_str, '%Y-%m-%d').isoformat()
        
        # Bu insert işlemi, SQL trigger'ını tetikleyerek finansal kaydı da oluşturacak
        satis_response = g.supabase.table('tanker_satis_islemleri').insert(satis_kaydi).execute()
        
        if not satis_response.data:
            raise Exception("Satış kaydı oluşturulamadı.")

        # 3. Tankeri boşalt (Doluluğu sıfırla)
        g.supabase.table('tankerler') \
            .update({'mevcut_doluluk': 0}) \
            .eq('id', tanker_id) \
            .execute()
            
        logger.info(f"Tanker (ID: {tanker_id}) başarıyla boşaltıldı/satıldı. Litre: {mevcut_doluluk}")
        return satis_response.data[0]

    except (ValueError, InvalidOperation) as ve:
        raise ve
    except Exception as e:
        logger.error(f"Tanker satışı sırasında hata: {e}", exc_info=True)
        raise Exception("Tanker satışı sırasında beklenmedik bir hata oluştu.")

def get_collectors_for_assignment(sirket_id):
    """
    Tanker ataması modalı için sadece 'toplayici' rolündeki
    kullanıcıları listeler.
    """
    try:
        # DÜZELTME: .order('isim', ...) -> .order('kullanici_adi', ...)
        # Şemada 'isim' sütunu yok, 'kullanici_adi' var.
        response = g.supabase.table('kullanicilar') \
            .select('id, kullanici_adi') \
            .eq('sirket_id', sirket_id) \
            .eq('rol', UserRole.TOPLAYICI.value) \
            .order('kullanici_adi', desc=False) \
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"Atama için toplayıcılar alınırken hata: {e}", exc_info=True)
        raise