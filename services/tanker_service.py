# services/tanker_service.py

from flask import g 
from constants import UserRole
from postgrest import APIError 
import logging

logger = logging.getLogger(__name__) 

def get_tankerler(sirket_id):
    try:
        response = g.supabase.table('tankerler') \
            .select('*') \
            .eq('sirket_id', sirket_id) \
            .order('tanker_adi', desc=False) \
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"Tankerler alınırken hata: {e}", exc_info=True)
        raise

def add_tanker(sirket_id, data):
    try:
        tanker_adi = data.get('tanker_adi')
        kapasite = data.get('kapasite_litre')
        
        if not tanker_adi or not kapasite:
            raise ValueError("Tanker adı ve kapasite zorunludur.")
        
        try:
            kapasite_numeric = float(kapasite)
        except ValueError:
            raise ValueError("Kapasite sayısal bir değer olmalıdır.")

        response = g.supabase.table('tankerler').insert({
            'sirket_id': sirket_id,
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

def update_tanker(sirket_id, tanker_id, data):
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

        response = g.supabase.table('tankerler') \
            .update(update_data) \
            .eq('id', tanker_id) \
            .eq('sirket_id', sirket_id) \
            .execute()
            
        if not response.data:
             return None
             
        return response.data[0]
    except ValueError as ve:
        raise ve
    except Exception as e:
        logger.error(f"Tanker güncellenirken hata: {e}", exc_info=True)
        raise

def delete_tanker(tanker_id):
    """
    Bir tankeri güvenli bir şekilde siler.
    RPC fonksiyonunu çağırır.
    """
    try:
        rpc_result = g.supabase.rpc('delete_tanker_safely', {'p_tanker_id': tanker_id}).execute()
        
        if rpc_result.data and isinstance(rpc_result.data, str) and 'SQL tanker silme hatasi' in rpc_result.data:
            logger.error(f"SQL delete_tanker_safely hatası (Tanker ID: {tanker_id}): {rpc_result.data}")
            raise Exception(f"SQL fonksiyon hatası: {rpc_result.data}")
            
        return {"success": True, "message": "Tanker başarıyla silindi."}
        
    except APIError as e: 
        logger.error(f"Tanker silinirken Postgrest hatası (Tanker ID: {tanker_id}): {e}", exc_info=True)
        return {"success": False, "message": f"Veritabanı hatası: {e.message}"}
    except Exception as e:
        logger.error(f"Tanker silinirken genel hata (Tanker ID: {tanker_id}): {e}", exc_info=True)
        return {"success": False, "message": "Tanker silinirken beklenmedik bir hata oluştu."}

def get_tanker_assignments(sirket_id):
    try:
        response = g.supabase.table('toplayici_tanker_atama') \
            .select('id, toplayici_user_id, tanker_id, kullanicilar(kullanici_adi), tankerler(tanker_adi)') \
            .eq('sirket_id', sirket_id) \
            .execute()
        return response.data
    except Exception as e:
        logger.error(f"Tanker atamaları alınırken hata: {e}", exc_info=True)
        raise

def assign_toplayici_to_tanker(sirket_id, data):
    try:
        toplayici_id = data.get('toplayici_id')
        tanker_id = data.get('tanker_id')

        if not toplayici_id: 
             raise ValueError("Toplayıcı ID zorunludur.")
             
        if not tanker_id:
             raise ValueError("Tanker ID zorunludur.")

        response = g.supabase.table('toplayici_tanker_atama').upsert({
            'toplayici_user_id': toplayici_id,
            'tanker_id': tanker_id,
            'sirket_id': sirket_id
        }, on_conflict='toplayici_user_id').execute()
        
        return response.data[0]
    except Exception as e:
        logger.error(f"Tanker ataması yapılırken hata: {e}", exc_info=True)
        if 'unique constraint' in str(e).lower():
             raise ValueError("Bu toplayıcı zaten bir tankere atanmış.")
        raise

def unassign_toplayici_from_tanker(sirket_id, assignment_id):
    try:
        g.supabase.table('toplayici_tanker_atama') \
            .delete() \
            .eq('id', assignment_id) \
            .eq('sirket_id', sirket_id) \
            .execute()
        return True
    except Exception as e:
        logger.error(f"Tanker ataması kaldırılırken hata: {e}", exc_info=True)
        raise

def get_collectors_for_assignment(sirket_id):
    try:
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

def sell_and_empty_tanker(sirket_id, kullanici_id, tanker_id, data):
    try:
        birim_fiyat = data.get('birim_fiyat')
        aciklama = data.get('aciklama', '')

        if not birim_fiyat:
            raise ValueError("Birim satış fiyatı zorunludur.")
            
        try:
            birim_fiyat = float(birim_fiyat)
        except ValueError:
             raise ValueError("Fiyat sayısal olmalıdır.")

        tanker_resp = g.supabase.table('tankerler') \
            .select('*') \
            .eq('id', tanker_id) \
            .eq('sirket_id', sirket_id) \
            .single() \
            .execute()
            
        if not tanker_resp.data:
            raise ValueError("Tanker bulunamadı.")
            
        tanker = tanker_resp.data
        miktar_kg = float(tanker.get('mevcut_doluluk', 0))
        
        if miktar_kg <= 0:
            raise ValueError("Boş tanker satılamaz.")

        # GÜNCELLEME: 'toplam_tutar' veritabanında generated column olduğu için
        # buradan göndermiyoruz. Veritabanı (miktar_kg * birim_fiyat) işlemini kendi yapacak.

        satis_data = {
            'sirket_id': sirket_id,
            'kullanici_id': kullanici_id,
            'tanker_id': tanker_id,
            'miktar_kg': miktar_kg,
            'birim_satis_fiyati': birim_fiyat,
            # 'toplam_tutar' KALDIRILDI
            'aciklama': aciklama
        }
        
        satis_resp = g.supabase.table('sut_satis_islemleri').insert(satis_data).execute()
        g.supabase.table('tankerler').update({'mevcut_doluluk': 0}).eq('id', tanker_id).execute()

        return satis_resp.data[0]

    except Exception as e:
        logger.error(f"Tanker satış/boşaltma hatası: {e}", exc_info=True)
        raise