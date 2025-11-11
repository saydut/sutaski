# services/tanker_service.py

from flask import g
from constants import UserRole
from postgrest import APIError
import logging
from extensions import supabase_client # g.supabase yerine bunu kullanacağız
from utils import sanitize_input

logger = logging.getLogger(__name__) 

class TankerService:
    """Tanker ve atama işlemleri için servis katmanı. RLS ile güncellendi."""

    def get_all_tankers(self):
        """Tüm tankerleri RLS kullanarak listeler."""
        try:
            # g.supabase -> supabase_client
            # .eq('firma_id', ...) FİLTRESİ KALDIRILDI (RLS halleder)
            # Not: Veritabanı şemasında 'firma_id' 'sirket_id' olarak güncellenmişti.
            response = supabase_client.table('tankerler') \
                .select('*') \
                .order('tanker_adi', desc=False) \
                .execute()
            return response.data, None
        except Exception as e:
            logger.error(f"Tankerler alınırken hata: {e}", exc_info=True)
            return None, "Tankerler alınamadı."

    def add_tanker(self, data: dict):
        """Yeni bir tanker ekler. sirket_id'yi 'g' objesinden alır."""
        try:
            # ID'leri 'g' objesinden al
            sirket_id = g.profile['sirket_id']
            
            tanker_adi = sanitize_input(data.get('tanker_adi'))
            kapasite = data.get('kapasite_litre')

            if not tanker_adi or not kapasite:
                raise ValueError("Tanker adı ve kapasite zorunludur.")
            
            kapasite_numeric = float(kapasite)

            # g.supabase -> supabase_client
            # 'firma_id' -> 'sirket_id' (SQL şemamıza göre)
            response = supabase_client.table('tankerler').insert({
                'sirket_id': sirket_id, # RLS 'WITH CHECK' için
                'tanker_adi': tanker_adi,
                'kapasite_litre': kapasite_numeric,
                'mevcut_doluluk': 0
            }).execute()
            return response.data[0], None
        except ValueError as ve: 
            return None, str(ve)
        except Exception as e:
            if 'unique constraint' in str(e):
                return None, "Bu tanker adı zaten mevcut."
            logger.error(f"Tanker eklenirken hata: {e}", exc_info=True)
            return None, "Tanker eklenirken bir hata oluştu."

    def update_tanker(self, tanker_id: int, data: dict):
        """Bir tankeri RLS kullanarak günceller."""
        try:
            tanker_adi = sanitize_input(data.get('tanker_adi'))
            kapasite = data.get('kapasite_litre')
            
            update_data = {}
            if tanker_adi:
                update_data['tanker_adi'] = tanker_adi
            if kapasite:
                update_data['kapasite_litre'] = float(kapasite)

            if not update_data:
                raise ValueError("Güncellenecek veri bulunamadı.")

            # g.supabase -> supabase_client
            # .eq('firma_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('tankerler') \
                .update(update_data) \
                .eq('id', tanker_id) \
                .execute()
                
            if not response.data:
                 raise ValueError("Tanker bulunamadı veya güncelleme yetkiniz yok.")
            return response.data[0], None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            if 'unique constraint' in str(e):
                return None, "Bu tanker adı zaten mevcut."
            logger.error(f"Tanker güncellenirken hata: {e}", exc_info=True)
            return None, "Tanker güncellenirken bir hata oluştu."

    def delete_tanker(self, tanker_id: int):
        """Bir tankeri RLS kullanarak siler. Kullanımdaysa FK hatası verir."""
        try:
            # RPC'li karmaşık silme yerine, RLS'e güvenen basit silme
            # g.supabase -> supabase_client
            response = supabase_client.table('tankerler') \
                .delete() \
                .eq('id', tanker_id) \
                .execute()

            if not response.data:
                raise ValueError("Tanker bulunamadı veya silme yetkiniz yok.")
                
            return True, None
            
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            if 'violates foreign key constraint' in str(e).lower():
                return None, "Bu tanker süt girdilerinde veya atamalarda kullanıldığı için silinemez."
            logger.error(f"Tanker silinirken genel hata (Tanker ID: {tanker_id}): {e}", exc_info=True)
            return None, "Tanker silinirken beklenmedik bir hata oluştu."

    # --- Tanker Atama Fonksiyonları ---

    def get_tanker_assignments(self):
        """Tankerlere atanan toplayıcıların listesini RLS ile alır."""
        try:
            # sirket_id parametresi KALDIRILDI
            # g.supabase -> supabase_client
            # 'firma_id' -> 'sirket_id' (SQL şemasında düzeltmiştik)
            # 'kullanicilar(isim)' -> 'profiller(kullanici_adi)'
            response = supabase_client.table('toplayici_tanker_atama') \
                .select('id, toplayici_user_id, tanker_id, profiller(kullanici_adi), tankerler(tanker_adi)') \
                .execute()
            return response.data, None
        except Exception as e:
            logger.error(f"Tanker atamaları alınırken hata: {e}", exc_info=True)
            return None, "Tanker atamaları alınamadı."

    def assign_toplayici_to_tanker(self, data: dict):
        """Bir toplayıcıyı bir tankere atar. RLS (WITH CHECK) güvenliği sağlar."""
        try:
            # 'toplayici_id' (eski int) -> 'toplayici_user_id' (yeni UUID)
            toplayici_id_uuid = data.get('toplayici_id') 
            tanker_id = data.get('tanker_id')
            sirket_id = g.profile['sirket_id'] # 'g' objesinden al

            if not toplayici_id_uuid or not tanker_id:
                raise ValueError("Toplayıcı ID ve Tanker ID zorunludur.")

            # g.supabase -> supabase_client
            # 'firma_id' -> 'sirket_id'
            response = supabase_client.table('toplayici_tanker_atama').upsert({
                'toplayici_user_id': toplayici_id_uuid, # UUID'yi doğru sütuna ata
                'tanker_id': tanker_id,
                'sirket_id': sirket_id # RLS 'WITH CHECK' için
            }, on_conflict='toplayici_user_id').execute() # Toplayıcıyı tek tankere ata
            
            return response.data[0], None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Tanker ataması yapılırken hata: {e}", exc_info=True)
            if 'unique constraint "toplayici_tanker_atama_toplayici_user_id_key"' in str(e).lower():
                 return None, "Bu toplayıcı zaten bir tankere atanmış."
            if 'foreign key constraint' in str(e).lower():
                 return None, "Seçilen toplayıcı veya tanker bulunamadı."
            return None, "Tanker ataması yapılırken bir hata oluştu."

    def unassign_toplayici_from_tanker(self, assignment_id: int):
        """Bir toplayıcının tanker atamasını RLS ile kaldırır."""
        try:
            # g.supabase -> supabase_client
            # .eq('firma_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('toplayici_tanker_atama') \
                .delete() \
                .eq('id', assignment_id) \
                .execute()
                
            if not response.data:
                raise ValueError("Atama kaydı bulunamadı veya silme yetkiniz yok.")
            return True, None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Tanker ataması kaldırılırken hata: {e}", exc_info=True)
            return None, "Atama kaldırılırken bir hata oluştu."

    def get_collectors_for_assignment(self):
        """
        Tanker ataması modalı için RLS ile 'toplayici' rolündeki
        personeli listeler.
        """
        try:
            # sirket_id parametresi KALDIRILDI
            # g.supabase.table('kullanicilar') -> supabase_client.table('profiller')
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('profiller') \
                .select('id, kullanici_adi') \
                .eq('rol', UserRole.TOPLAYICI.value) \
                .order('kullanici_adi', desc=False) \
                .execute()
            return response.data, None
        except Exception as e:
            logger.error(f"Atama için toplayıcılar alınırken hata: {e}", exc_info=True)
            return None, "Toplayıcı listesi alınamadı."

# Servis objesini (instance) oluştur
tanker_service = TankerService()