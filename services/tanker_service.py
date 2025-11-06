# services/tanker_service.py

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
                "meveut_doluluk": 0 
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

    # --- YENİ FONKSİYONLAR ---

    def get_collectors_for_assignment(self, firma_id: int):
        """
        Firmanın tüm 'toplayici' rolündeki kullanıcılarını,
        mevcut tanker atamalarıyla birlikte listeler.
        """
        try:
            # 1. Firmadaki tüm toplayıcıları çek
            users_response = g.supabase.table('kullanicilar') \
                .select('id, kullanici_adi, ad_soyad') \
                .eq('sirket_id', firma_id) \
                .eq('rol', UserRole.TOPLAYICI.value) \
                .order('kullanici_adi') \
                .execute()
            
            toplayicilar = users_response.data
            
            if not toplayicilar:
                return []

            # 2. Mevcut atamaları çek (tanker adı ile birlikte)
            atama_response = g.supabase.table('toplayici_tanker_atama') \
                .select('toplayici_user_id, tankerler(id, tanker_adi)') \
                .eq('firma_id', firma_id) \
                .execute()

            # 3. Atamaları bir sözlüğe (dictionary) çevir (daha hızlı erişim için)
            # { 'toplayici_id': {'id': 1, 'tanker_adi': 'Tanker A'}, ... }
            atama_map = {
                atama['toplayici_user_id']: atama['tankerler']
                for atama in atama_response.data
                if atama.get('tankerler') # Eğer atanan tanker silindiyse (mümkün olmamalı)
            }

            # 4. İki listeyi birleştir
            for toplayici in toplayicilar:
                if toplayici['id'] in atama_map:
                    toplayici['atanan_tanker'] = atama_map[toplayici['id']]
                else:
                    toplayici['atanan_tanker'] = None
            
            return toplayicilar

        except Exception as e:
            logger.error(f"Atama için toplayıcılar listelenirken hata: {e}", exc_info=True)
            raise Exception("Toplayıcı listesi alınamadı.")

    def assign_tanker(self, firma_id: int, toplayici_id: int, tanker_id: int):
        """Bir toplayıcıya bir tanker atar."""
        try:
            # Önce bu toplayıcının eski atamasını (varsa) kaldır
            g.supabase.table('toplayici_tanker_atama') \
                .delete() \
                .eq('firma_id', firma_id) \
                .eq('toplayici_user_id', toplayici_id) \
                .execute()

            # Eğer tanker_id 0 veya None geldiyse (atama kaldırma işlemiyse)
            if not tanker_id or tanker_id == 0:
                return {"message": "Toplayıcının tanker ataması kaldırıldı."}

            # Yeni atamayı ekle
            yeni_atama = {
                "firma_id": firma_id,
                "toplayici_user_id": toplayici_id,
                "tanker_id": tanker_id
            }
            
            response = g.supabase.table('toplayici_tanker_atama').insert(yeni_atama).execute()
            
            if not response.data:
                 raise Exception("Atama yapılırken veritabanı hatası oluştu.")

            return {"message": "Tanker başarıyla atandı.", "atama": response.data[0]}

        except Exception as e:
            # unique constraint hatası (çok olası değil ama)
            if 'duplicate key value violates unique constraint' in str(e).lower():
                 raise ValueError("Bu toplayıcıya zaten bir tanker atanmış.")
            logger.error(f"Tanker ataması yapılırken hata: {e}", exc_info=True)
            raise Exception("Tanker ataması sırasında bir hata oluştu.")


# Servisin bir örneğini (instance) oluştur
tanker_service = TankerService()