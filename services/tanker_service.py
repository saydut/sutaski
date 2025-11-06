# services/tanker_service.py
# YENİ ÖZELLİK: Tanker silme servisi eklendi.

import logging
from flask import g, session
from decimal import Decimal, InvalidOperation
from constants import UserRole # Yetki kontrolü için

logger = logging.getLogger(__name__)

class TankerService:
    """Tanker yönetimi, atama ve satış işlemleri için servis katmanı."""

    def add_tanker(self, firma_id: int, data: dict):
        """Yeni bir tanker ekler."""
        try:
            tanker_adi = data.get('tanker_adi')
            kapasite_str = data.get('kapasite')

            if not tanker_adi or not kapasite_str:
                raise ValueError("Tanker adı ve kapasite zorunludur.")

            try:
                kapasite = Decimal(kapasite_str)
            except (InvalidOperation, TypeError):
                raise ValueError("Kapasite geçerli bir sayı olmalıdır.")
            
            if kapasite <= 0:
                raise ValueError("Kapasite pozitif bir değer olmalıdır.")

            yeni_tanker = {
                "firma_id": firma_id,
                "tanker_adi": tanker_adi,
                "kapasite_litre": str(kapasite),
                "mevcut_doluluk": 0 
            }
            
            response = g.supabase.table('tankerler').insert(yeni_tanker).execute()
            
            if not response.data:
                 logger.error(f"Tanker eklenirken Supabase hatası: {response.error}")
                 raise Exception("Tanker eklenirken bir veritabanı hatası oluştu.")
                 
            return response.data[0]

        except ValueError as ve:
            raise ve
        except Exception as e:
            if 'duplicate key value violates unique constraint' in str(e).lower():
                raise ValueError(f"'{tanker_adi}' adında bir tanker zaten mevcut.")
            logger.error(f"Tanker eklenirken hata: {e}", exc_info=True)
            raise Exception("Tanker eklenirken sunucuda bir hata oluştu.")

    def list_tankers(self, firma_id: int):
        """Firmanın tüm tankerlerini listeler (doluluk oranıyla birlikte)."""
        try:
            response = g.supabase.table('tankerler') \
                .select('id, tanker_adi, kapasite_litre, mevcut_doluluk') \
                .eq('firma_id', firma_id) \
                .order('tanker_adi', desc=False) \
                .execute()
            
            tankerler = response.data
            
            for tanker in tankerler:
                kapasite = Decimal(tanker['kapasite_litre'])
                doluluk = Decimal(tanker['mevcut_doluluk'])
                
                if kapasite > 0:
                    tanker['doluluk_yuzdesi'] = round((doluluk / kapasite) * 100)
                else:
                    tanker['doluluk_yuzdesi'] = 0
            
            return tankerler

        except Exception as e:
            logger.error(f"Tankerler listelenirken hata: {e}", exc_info=True)
            raise Exception("Tankerler listelenirken bir sunucu hatası oluştu.")

    def get_collectors_for_assignment(self, firma_id: int):
        """
        Firmanın tüm 'toplayici' rolündeki kullanıcılarını,
        mevcut tanker atamalarıyla (sadece ID olarak) birlikte listeler.
        """
        try:
            # 1. Firmadaki tüm toplayıcıları çek
            users_response = g.supabase.table('kullanicilar') \
                .select('id, kullanici_adi') \
                .eq('sirket_id', firma_id) \
                .eq('rol', UserRole.TOPLAYICI.value) \
                .order('kullanici_adi') \
                .execute()
            
            toplayicilar = users_response.data
            
            if not toplayicilar:
                return []

            # 2. Mevcut atamaları çek (SADECE ID'LERİ ÇEK)
            atama_response = g.supabase.table('toplayici_tanker_atama') \
                .select('toplayici_user_id, tanker_id') \
                .eq('firma_id', firma_id) \
                .execute()

            # 3. Atamaları bir sözlüğe (dictionary) çevir
            atama_map = {
                atama['toplayici_user_id']: atama['tanker_id']
                for atama in atama_response.data
                if atama.get('tanker_id') and atama.get('tanker_id') > 0
            }

            # 4. İki listeyi birleştir
            for toplayici in toplayicilar:
                if toplayici['id'] in atama_map:
                    toplayici['atanan_tanker_id'] = atama_map[toplayici['id']]
                else:
                    toplayici['atanan_tanker_id'] = 0
            
            return toplayicilar

        except Exception as e:
            logger.error(f"Atama için toplayıcılar listelenirken hata: {e}", exc_info=True)
            raise Exception("Toplayıcı listesi alınamadı.")

    def assign_tanker(self, firma_id: int, toplayici_id: int, tanker_id: int):
        """Bir toplayıcıya bir tanker atar."""
        try:
            # Güvenlik Kontrolü: Toplayıcı bu firmaya mı ait?
            user_check = g.supabase.table('kullanicilar') \
                .select('id') \
                .eq('id', toplayici_id) \
                .eq('sirket_id', firma_id) \
                .single() \
                .execute()
            if not user_check.data:
                raise PermissionError("Başka bir firmaya ait toplayıcıya atama yapılamaz.")

            # Güvenlik Kontrolü: Tanker bu firmaya mı ait?
            if tanker_id != 0:
                tanker_check = g.supabase.table('tankerler') \
                    .select('id') \
                    .eq('id', tanker_id) \
                    .eq('firma_id', firma_id) \
                    .single() \
                    .execute()
                if not tanker_check.data:
                    raise PermissionError("Başka bir firmaya ait tankere atama yapılamaz.")

            # UPSERT (Update or Insert) - Atomik işlem
            # 1. Kaydı 'toplayici_user_id' üzerinden bulmaya çalış
            # 2. Bulursa 'tanker_id'yi güncelle, bulamazsa yeni kayıt ekle
            
            atama_data = {
                "firma_id": firma_id,
                "toplayici_user_id": toplayici_id,
                "tanker_id": tanker_id
            }
            
            # Eğer tanker_id 0 ise, atamayı kaldır (DELETE)
            if tanker_id == 0:
                 g.supabase.table('toplayici_tanker_atama') \
                    .delete() \
                    .eq('firma_id', firma_id) \
                    .eq('toplayici_user_id', toplayici_id) \
                    .execute()
                 return {"message": "Toplayıcının tanker ataması kaldırıldı."}
            
            # Tanker ID 0 değilse, Upsert yap
            response = g.supabase.table('toplayici_tanker_atama') \
                .upsert(atama_data, on_conflict='toplayici_user_id') \
                .execute()

            if not response.data:
                 raise Exception("Atama yapılırken veritabanı hatası oluştu.")
            
            return {"message": "Tanker başarıyla atandı.", "atama": response.data[0]}

        except PermissionError as pe:
            raise pe
        except Exception as e:
            if 'duplicate key value violates unique constraint' in str(e).lower():
                 raise ValueError("Bu toplayıcıya zaten bir tanker atanmış veya tanker başka birine atanmış.")
            logger.error(f"Tanker ataması yapılırken hata: {e}", exc_info=True)
            raise Exception("Tanker ataması sırasında bir hata oluştu.")


    # --- YENİ ÖZELLİK: TANKER SİLME ---
    def delete_tanker(self, firma_id: int, tanker_id: int):
        """
        Bir tankeri siler. Sadece boşsa ve ataması yoksa siler.
        """
        try:
            # 1. Tankeri bul ve firmayla eşleştir
            tanker_response = g.supabase.table('tankerler') \
                .select('id, tanker_adi, mevcut_doluluk') \
                .eq('id', tanker_id) \
                .eq('firma_id', firma_id) \
                .maybe_single() \
                .execute()

            tanker = tanker_response.data
            if not tanker:
                raise ValueError("Tanker bulunamadı veya bu firmaya ait değil.")

            # 2. Tankerin boş olup olmadığını kontrol et
            if Decimal(tanker['mevcut_doluluk']) > 0:
                raise ValueError(f"'{tanker['tanker_adi']}' adlı tanker dolu (Mevcut: {tanker['mevcut_doluluk']} L). Dolu tanker silinemez.")

            # 3. Tankerin bir toplayıcıya atanıp atanmadığını kontrol et
            atama_response = g.supabase.table('toplayici_tanker_atama') \
                .select('toplayici_user_id') \
                .eq('tanker_id', tanker_id) \
                .eq('firma_id', firma_id) \
                .execute()
            
            if atama_response.data:
                raise ValueError(f"'{tanker['tanker_adi']}' adlı tanker bir toplayıcıya atanmış. Silmeden önce atamayı kaldırın.")

            # 4. Tankeri sil
            g.supabase.table('tankerler') \
                .delete() \
                .eq('id', tanker_id) \
                .eq('firma_id', firma_id) \
                .execute()
            
            return {"message": f"'{tanker['tanker_adi']}' adlı tanker başarıyla silindi."}

        except ValueError as ve:
            raise ve
        except PermissionError as pe:
            raise pe
        except Exception as e:
            logger.error(f"Tanker silinirken hata: {e}", exc_info=True)
            raise Exception("Tanker silinirken bir sunucu hatası oluştu.")


# Servisin bir örneğini (instance) oluştur
tanker_service = TankerService()