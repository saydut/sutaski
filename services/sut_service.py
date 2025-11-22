# services/sut_service.py (REVİZE EDİLMİŞ TAM HALİ)

import logging
from flask import g, session
from postgrest import APIError
from extensions import turkey_tz 
from decimal import Decimal, InvalidOperation
from datetime import datetime
import bleach
from utils import parse_supabase_timestamp
from constants import UserRole

# --- YENİ EKLENEN IMPORT ---
from services.audit_service import audit_service

logger = logging.getLogger(__name__)

class SutService:
    """Süt girdileri veritabanı işlemleri için servis katmanı."""

    # === YARDIMCI FONKSİYON (SADELEŞTİRİLDİ) ===
    def _get_toplayici_tanker_id(self, toplayici_id: int, sirket_id: int):
        """
        Yardımcı fonksiyon: Toplayıcının atanmış tankerinin sadece ID'sini döner.
        Artık doluluk hesabını SQL yaptığı için tüm tanker objesine ihtiyacımız yok.
        """
        atama_res = g.supabase.table('toplayici_tanker_atama') \
            .select('tanker_id') \
            .eq('toplayici_user_id', toplayici_id) \
            .eq('sirket_id', sirket_id) \
            .maybe_single() \
            .execute()
            
        if not atama_res.data or not atama_res.data.get('tanker_id'):
            # Tanker atanmamış
            return None
            
        return atama_res.data['tanker_id']

    def get_daily_summary(self, sirket_id: int, tarih_str: str):
        """Belirtilen tarih için RPC kullanarak özet veriyi çeker."""
        try:
            response = g.supabase.rpc('get_daily_summary_rpc', {
                'target_sirket_id': sirket_id,
                'target_date': tarih_str
            }).execute()
            if not response.data or not response.data[0]:
                return {'toplam_litre': 0, 'girdi_sayisi': 0}
            return response.data[0]
        except Exception as e:
            logger.error(f"Günlük özet alınırken hata: {e}", exc_info=True)
            return {'toplam_litre': 0, 'girdi_sayisi': 0}

    def get_paginated_list(self, sirket_id: int, kullanici_id: int, rol: str, tarih_str: str, sayfa: int, limit: int = 6):
        """Süt girdilerini sayfalama ve filtreleme yaparak listeler (RPC kullanarak)."""
        try:
            offset = (sayfa - 1) * limit
            params = {
                'p_sirket_id': sirket_id,
                'p_kullanici_id': kullanici_id,
                'p_rol': rol,
                'p_tarih_str': tarih_str,
                'p_limit': limit,
                'p_offset': offset
            }
            response = g.supabase.rpc('get_paginated_sut_girdileri', params).execute()

            if not response.data:
                return [], 0
            
            result_data = response.data
            girdiler = result_data.get('data', [])
            toplam_kayit = result_data.get('count', 0)
            
            # Frontend için iç içe objeleri düzenle
            for girdi in girdiler:
                if 'kullanici_adi' in girdi:
                    girdi['kullanicilar'] = {'kullanici_adi': girdi['kullanici_adi']}
                if 'tedarikci_isim' in girdi:
                    girdi['tedarikciler'] = {'isim': girdi['tedarikci_isim']}

            return girdiler, toplam_kayit
            
        except Exception as e:
            logger.error(f"Süt girdileri listelenirken hata: {e}", exc_info=True)
            return [], 0

    # === ADD_ENTRY (ATOMIC UPDATE + AUDIT LOG) ===
    def add_entry(self, sirket_id: int, kullanici_id: int, yeni_girdi: dict):
        """Yeni bir süt girdisi ekler."""
        try:
            litre_str = yeni_girdi.get('litre')
            fiyat_str = yeni_girdi.get('fiyat')
            tedarikci_id_to_add = yeni_girdi.get('tedarikci_id')

            if not tedarikci_id_to_add: raise ValueError("Tedarikçi seçimi zorunludur.")
            if not litre_str or not fiyat_str: raise ValueError("Litre ve Fiyat alanları zorunludur.")

            try:
                litre = Decimal(str(litre_str))
                fiyat = Decimal(str(fiyat_str))
            except (InvalidOperation, TypeError):
                 raise ValueError("Litre ve Fiyat geçerli bir sayı olmalıdır.")

            if litre <= 0 or fiyat < 0:
                raise ValueError("Litre pozitif, fiyat negatif olmayan bir değer olmalıdır.")

            user_role = session.get('user', {}).get('rol')
            
            # 1. Yetki ve Tanker Kontrolü
            tanker_id_to_update = None
            
            if user_role == UserRole.TOPLAYICI.value:
                # Tedarikçi yetkisi kontrolü
                atama_res = g.supabase.table('toplayici_tedarikci_atama') \
                    .select('tedarikci_id', count='exact') \
                    .eq('toplayici_id', kullanici_id) \
                    .eq('tedarikci_id', tedarikci_id_to_add) \
                    .execute()
                if atama_res.count == 0:
                    raise ValueError("Bu tedarikçiye veri ekleme yetkiniz yok.")
                    
                # Tanker ID bul
                tanker_id_to_update = self._get_toplayici_tanker_id(kullanici_id, sirket_id)
                if not tanker_id_to_update:
                     raise ValueError("Bu toplayıcıya atanmış aktif bir tanker bulunamadı.")
            
            # 2. Süt Girdisini Ekle
            insert_data = {
                'tedarikci_id': tedarikci_id_to_add,
                'litre': str(litre),
                'fiyat': str(fiyat),
                'kullanici_id': kullanici_id,
                'sirket_id': sirket_id
            }
            response = g.supabase.table('sut_girdileri').insert(insert_data).execute()
            
            if not response.data:
                 raise Exception("Veritabanına kayıt sırasında bir sorun oluştu.")
            
            yeni_kayit_id = response.data[0]['id']

            # 3. ATOMIC TANKER UPDATE (RPC İLE)
            if tanker_id_to_update:
                try:
                    # RPC çağırıyoruz: atomic_tanker_update(tanker_id, litre_change)
                    g.supabase.rpc('atomic_tanker_update', {
                        'p_tanker_id': tanker_id_to_update,
                        'p_litre_change': float(litre) # Decimal RPC'ye float gidebilir
                    }).execute()
                    logger.info(f"Tanker (ID: {tanker_id_to_update}) atomik olarak güncellendi.")
                except Exception as tanker_e:
                    # Tanker güncellenemezse (örn: kapasite doldu), süt girdisini sil (Rollback)
                    logger.error(f"Tanker RPC Hatası: {tanker_e}. Girdi siliniyor...", exc_info=True)
                    g.supabase.table('sut_girdileri').delete().eq('id', yeni_kayit_id).execute()
                    # Hatayı kullanıcıya anlamlı şekilde dön
                    if 'Tanker kapasitesi aşıldı' in str(tanker_e):
                        raise ValueError("Tanker kapasitesi bu işlem için yetersiz!")
                    raise ValueError("Tanker güncellenemediği için işlem iptal edildi.")

            # 4. AUDIT LOG KAYDI
            audit_service.log_islem(
                islem_turu='INSERT',
                tablo_adi='sut_girdileri',
                kayit_id=yeni_kayit_id,
                detaylar={
                    'litre': str(litre), 
                    'fiyat': str(fiyat), 
                    'tedarikci_id': tedarikci_id_to_add,
                    'tanker_updated': tanker_id_to_update
                },
                sirket_id=sirket_id
            )
            
            return response.data[0]

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Süt girdisi eklenirken hata: {e}", exc_info=True)
            raise Exception("Girdi eklenirken bir sunucu hatası oluştu.")

    # === UPDATE_ENTRY (ATOMIC UPDATE + AUDIT LOG) ===
    def update_entry(self, girdi_id: int, sirket_id: int, duzenleyen_kullanici_id: int, data: dict):
        """Mevcut bir süt girdisini günceller."""
        try:
            yeni_litre_str = data.get('yeni_litre')
            yeni_fiyat_str = data.get('yeni_fiyat')
            raw_duzenleme_sebebi = data.get('duzenleme_sebebi', '').strip()
            duzenleme_sebebi = bleach.clean(str(raw_duzenleme_sebebi)) if raw_duzenleme_sebebi else '-'

            if not yeni_litre_str or not yeni_fiyat_str:
                raise ValueError("Yeni litre ve fiyat değerleri zorunludur.")
            
            yeni_litre = Decimal(str(yeni_litre_str))
            yeni_fiyat = Decimal(str(yeni_fiyat_str))
            if yeni_litre <= 0 or yeni_fiyat < 0:
                 raise ValueError("Litre pozitif, fiyat negatif olmayan bir değer olmalıdır.")

            # Mevcut girdiyi çek
            mevcut_girdi_res = g.supabase.table('sut_girdileri') \
                .select('*') \
                .eq('id', girdi_id).eq('sirket_id', sirket_id).maybe_single().execute()

            if not mevcut_girdi_res.data:
                raise ValueError("Girdi bulunamadı veya bu şirkete ait değil.")

            mevcut_girdi = mevcut_girdi_res.data
            girdi_sahibi_id = mevcut_girdi.get('kullanici_id')
            eski_litre = Decimal(mevcut_girdi.get('litre'))
            eski_fiyat = Decimal(mevcut_girdi.get('fiyat'))

            # Yetki kontrolü
            duzenleyen_rol = session.get('user', {}).get('rol')
            if duzenleyen_rol != UserRole.FIRMA_YETKILISI.value and duzenleyen_kullanici_id != girdi_sahibi_id:
                raise ValueError("Bu girdiyi düzenleme yetkiniz yok.")

            # Litre Farkı
            litre_farki = yeni_litre - eski_litre

            # Tanker Kontrolü
            tanker_id_to_update = None
            girdi_sahibi_rol_res = g.supabase.table('kullanicilar').select('rol').eq('id', girdi_sahibi_id).single().execute()
            if girdi_sahibi_rol_res.data and girdi_sahibi_rol_res.data['rol'] == UserRole.TOPLAYICI.value:
                tanker_id_to_update = self._get_toplayici_tanker_id(girdi_sahibi_id, sirket_id)

            # 1. Geçmiş kaydını ekle
            g.supabase.table('girdi_gecmisi').insert({
                'orijinal_girdi_id': girdi_id,
                'duzenleyen_kullanici_id': duzenleyen_kullanici_id,
                'duzenleme_sebebi': duzenleme_sebebi,
                'eski_litre_degeri': str(eski_litre),
                'eski_fiyat_degeri': str(eski_fiyat),
                'eski_tedarikci_id': mevcut_girdi.get('tedarikci_id')
            }).execute()

            # 2. Ana girdiyi güncelle
            g.supabase.table('sut_girdileri') \
                .update({'duzenlendi_mi': True, 'litre': str(yeni_litre), 'fiyat': str(yeni_fiyat)}) \
                .eq('id', girdi_id) \
                .execute()

            # 3. ATOMIC TANKER UPDATE (Eğer fark varsa)
            if tanker_id_to_update and litre_farki != 0:
                try:
                    g.supabase.rpc('atomic_tanker_update', {
                        'p_tanker_id': tanker_id_to_update,
                        'p_litre_change': float(litre_farki)
                    }).execute()
                except Exception as tanker_e:
                    # Bu noktada rollback yapmak zordur (veritabanı transaction'ı olmadığı için).
                    # Logluyoruz, manuel müdahale gerekebilir.
                    logger.error(f"CRITICAL: Girdi güncellendi ANCAK Tanker güncellenemedi! Girdi: {girdi_id}, Fark: {litre_farki}, Hata: {tanker_e}")
                    # Kullanıcıya bilgi verilebilir veya sessizce loglanabilir.
                    pass

            # 4. AUDIT LOG
            audit_service.log_islem(
                islem_turu='UPDATE',
                tablo_adi='sut_girdileri',
                kayit_id=girdi_id,
                detaylar={
                    'eski_litre': str(eski_litre),
                    'yeni_litre': str(yeni_litre),
                    'fark': str(litre_farki),
                    'tanker_updated': tanker_id_to_update
                },
                sirket_id=sirket_id
            )

            # Güncel veriyi döndür
            guncel_girdi = g.supabase.table('sut_girdileri').select('*').eq('id', girdi_id).single().execute()
            
            # Tarih formatlama
            girdi_tarihi_str_db = mevcut_girdi.get('taplanma_tarihi')
            girdi_tarihi_str_formatted = datetime.now(turkey_tz).date().isoformat()
            if girdi_tarihi_str_db:
                parsed_date = parse_supabase_timestamp(girdi_tarihi_str_db)
                if parsed_date: girdi_tarihi_str_formatted = parsed_date.astimezone(turkey_tz).date().isoformat()

            return guncel_girdi.data, girdi_tarihi_str_formatted

        except ValueError as ve:
             raise ve
        except Exception as e:
            logger.error(f"Süt girdisi güncellenirken hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")

    # === DELETE_ENTRY (ATOMIC UPDATE + AUDIT LOG) ===
    def delete_entry(self, girdi_id: int, sirket_id: int):
        """Bir süt girdisini siler."""
        try:
            silen_kullanici_id = session.get('user', {}).get('id')
            silen_rol = session.get('user', {}).get('rol')

            # Girdiyi çek
            mevcut_girdi_res = g.supabase.table('sut_girdileri') \
                .select('*') \
                .eq('id', girdi_id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single() \
                .execute()

            if not mevcut_girdi_res.data:
                raise ValueError("Girdi bulunamadı veya silme yetkiniz yok.")

            mevcut_girdi = mevcut_girdi_res.data
            girdi_sahibi_id = mevcut_girdi.get('kullanici_id')
            silinen_litre = Decimal(mevcut_girdi.get('litre'))
            
            # Yetki kontrolü
            if silen_rol != UserRole.FIRMA_YETKILISI.value and silen_kullanici_id != girdi_sahibi_id:
                raise ValueError("Bu girdiyi silme yetkiniz yok.")

            # Tanker tespiti
            tanker_id_to_update = None
            girdi_sahibi_rol_res = g.supabase.table('kullanicilar').select('rol').eq('id', girdi_sahibi_id).single().execute()
            if girdi_sahibi_rol_res.data and girdi_sahibi_rol_res.data['rol'] == UserRole.TOPLAYICI.value:
                tanker_id_to_update = self._get_toplayici_tanker_id(girdi_sahibi_id, sirket_id)
            
            # 1. Girdiyi ve Geçmişini Sil
            g.supabase.table('girdi_gecmisi').delete().eq('orijinal_girdi_id', girdi_id).execute()
            g.supabase.table('sut_girdileri').delete().eq('id', girdi_id).execute()

            # 2. ATOMIC TANKER UPDATE (Negatif değer ile düşüm)
            if tanker_id_to_update:
                try:
                    g.supabase.rpc('atomic_tanker_update', {
                        'p_tanker_id': tanker_id_to_update,
                        'p_litre_change': float(-silinen_litre) # Negatif değer gönderiyoruz
                    }).execute()
                except Exception as tanker_e:
                    logger.error(f"CRITICAL: Girdi silindi ANCAK Tanker düşülemedi! Girdi: {girdi_id}, Silinen: {silinen_litre}, Hata: {tanker_e}")

            # 3. AUDIT LOG
            audit_service.log_islem(
                islem_turu='DELETE',
                tablo_adi='sut_girdileri',
                kayit_id=girdi_id,
                detaylar={
                    'silinen_litre': str(silinen_litre),
                    'tanker_updated': tanker_id_to_update
                },
                sirket_id=sirket_id
            )

            # Tarih döndür (UI güncellemesi için)
            girdi_tarihi_str_formatted = datetime.now(turkey_tz).date().isoformat()
            db_date = parse_supabase_timestamp(mevcut_girdi.get('taplanma_tarihi'))
            if db_date:
                girdi_tarihi_str_formatted = db_date.astimezone(turkey_tz).date().isoformat()

            return girdi_tarihi_str_formatted

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Süt girdisi silinirken hata: {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")

    # --- Kalan Fonksiyonlar Değişmedi ---
    def get_entry_history(self, girdi_id: int, sirket_id: int):
        try:
            res = g.supabase.table('sut_girdileri').select('id').eq('id', girdi_id).eq('sirket_id', sirket_id).maybe_single().execute()
            if not res.data:
                raise ValueError("Yetkisiz erişim veya girdi bulunamadı.")
            return g.supabase.table('girdi_gecmisi').select('*,duzenleyen_kullanici_id(kullanici_adi)').eq('orijinal_girdi_id', girdi_id).order('created_at', desc=True).execute().data
        except ValueError as ve:
             raise ve
        except Exception as e:
            logger.error(f"Girdi geçmişi alınırken hata: {e}", exc_info=True)
            raise Exception("Girdi geçmişi alınamadı.")

    def get_last_price_for_supplier(self, sirket_id: int, tedarikci_id: int):
        try:
            response = g.supabase.table('sut_girdileri').select('fiyat').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order('taplanma_tarihi', desc=True).limit(1).maybe_single().execute()
            return response.data if response.data else {}
        except Exception as e:
            logger.error(f"Son fiyat alınırken hata: {e}", exc_info=True)
            return {}

sut_service = SutService()