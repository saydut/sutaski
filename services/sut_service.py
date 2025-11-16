# services/sut_service.py (TANKER MANTIĞI ENTEGRE EDİLMİŞ TAM HALİ)

import logging
from flask import g, session
from postgrest import APIError
from extensions import turkey_tz 
from decimal import Decimal, InvalidOperation
from datetime import datetime
import pytz
import bleach
from utils import parse_supabase_timestamp
from constants import UserRole

logger = logging.getLogger(__name__)

class SutService:
    """Süt girdileri veritabanı işlemleri için servis katmanı."""

    # === YENİ YARDIMCI FONKSİYON ===
    def _get_toplayici_tanker(self, toplayici_id: int, sirket_id: int):
        """Yardımcı fonksiyon: Toplayıcının atanmış tankerini ve detaylarını getirir."""
        # Not: Şemaya göre toplayici_tanker_atama'da sirket_id/firma_id yok,
        # ancak biz yine de sirket_id'yi ekleyerek sorguyu güvenli hale getirebiliriz.
        # Orijinal şemada 'toplayici_user_id' idi, 'toplayici_id' değilse düzeltilmeli.
        atama_res = g.supabase.table('toplayici_tanker_atama') \
            .select('tanker_id') \
            .eq('toplayici_user_id', toplayici_id) \
            .eq('sirket_id', sirket_id) \
            .maybe_single() \
            .execute()
            
        if not atama_res.data or not atama_res.data.get('tanker_id'):
            # Tanker atanmamışsa, girişe izin verme
            raise ValueError(f"Bu toplayıcıya (ID: {toplayici_id}) atanmış aktif bir tanker bulunamadı.")
            
        tanker_id = atama_res.data['tanker_id']
        
        # Şemaya göre 'sirket_id' olmalı ('firma_id' değil)
        tanker_res = g.supabase.table('tankerler') \
            .select('id, kapasite_litre, mevcut_doluluk') \
            .eq('id', tanker_id) \
            .eq('sirket_id', sirket_id) \
            .single() \
            .execute()
            
        if not tanker_res.data:
            # Atama var ama tanker silinmiş
            raise ValueError(f"Atanmış tanker (ID: {tanker_id}) sistemde bulunamadı.")
            
        return tanker_res.data
    # === YARDIMCI FONKSİYON SONU ===


    def get_daily_summary(self, sirket_id: int, tarih_str: str):
        """Belirtilen tarih için RPC kullanarak özet veriyi çeker."""
        try:
            response = g.supabase.rpc('get_daily_summary_rpc', {
                'target_sirket_id': sirket_id,
                'target_date': tarih_str
            }).execute()
            if not response.data or not response.data[0]:
                logger.warning(f"get_daily_summary_rpc veri döndürmedi. Sirket: {sirket_id}, Tarih: {tarih_str}")
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
                # logger.warning(f"get_paginated_sut_girdileri RPC'si veri döndürmedi. Parametreler: {params}")
                return [], 0
            
            result_data = response.data
            girdiler = result_data.get('data', [])
            toplam_kayit = result_data.get('count', 0)
            
            for girdi in girdiler:
                if 'kullanici_adi' in girdi:
                    girdi['kullanicilar'] = {'kullanici_adi': girdi['kullanici_adi']}
                if 'tedarikci_isim' in girdi:
                    girdi['tedarikciler'] = {'isim': girdi['tedarikci_isim']}

            # logger.info(f"Süt girdileri listelendi (RPC): Sayfa {sayfa}, Limit {limit}, Tarih: {tarih_str}, Toplam: {toplam_kayit}")
            return girdiler, toplam_kayit
            
        except Exception as e:
            logger.error(f"Süt girdileri listelenirken (RPC) hata: {e}", exc_info=True)
            return [], 0

    # === ADD_ENTRY GÜNCELLENDİ ===
    def add_entry(self, sirket_id: int, kullanici_id: int, yeni_girdi: dict):
        """Yeni bir süt girdisi ekler VE GEREKİRSE TANKERİ GÜNCELLER."""
        try:
            litre_str = yeni_girdi.get('litre')
            fiyat_str = yeni_girdi.get('fiyat')
            tedarikci_id_to_add = yeni_girdi.get('tedarikci_id')

            if not tedarikci_id_to_add:
                 raise ValueError("Tedarikçi seçimi zorunludur.")
            if not litre_str or not fiyat_str:
                 raise ValueError("Litre ve Fiyat alanları zorunludur.")

            try:
                litre = Decimal(litre_str)
                fiyat = Decimal(fiyat_str)
            except (InvalidOperation, TypeError):
                 raise ValueError("Litre ve Fiyat geçerli bir sayı olmalıdır.")

            if litre <= 0 or fiyat < 0:
                raise ValueError("Litre pozitif, fiyat negatif olmayan bir değer olmalıdır.")

            user_role = session.get('user', {}).get('rol')
            
            # === YENİ TANKER MANTIĞI BAŞLANGICI ===
            tanker_id_to_update = None
            mevcut_doluluk = Decimal(0)
            
            if user_role == UserRole.TOPLAYICI.value:
                # 1. Tedarikçi yetkisini kontrol et
                atama_res = g.supabase.table('toplayici_tedarikci_atama') \
                    .select('tedarikci_id', count='exact') \
                    .eq('toplayici_id', kullanici_id) \
                    .eq('tedarikci_id', tedarikci_id_to_add) \
                    .execute()
                if atama_res.count == 0:
                    logger.warning(f"Yetkisiz ekleme denemesi: Toplayıcı {kullanici_id}, Tedarikçi {tedarikci_id_to_add}")
                    raise ValueError("Bu tedarikçiye veri ekleme yetkiniz yok.")
                    
                # 2. Toplayıcının tankerini bul ve kapasiteyi kontrol et
                tanker = self._get_toplayici_tanker(kullanici_id, sirket_id)
                kapasite = Decimal(tanker['kapasite_litre'])
                mevcut_doluluk = Decimal(tanker['mevcut_doluluk'])
                kalan_kapasite = kapasite - mevcut_doluluk
                
                if litre > kalan_kapasite:
                    raise ValueError(f"Tanker kapasitesi aşıldı! Kalan kapasite: {kalan_kapasite:.2f} L. Girmek istediğiniz: {litre} L.")
                
                tanker_id_to_update = tanker['id']
            # === YENİ TANKER MANTIĞI SONU ===

            insert_data = {
                'tedarikci_id': tedarikci_id_to_add,
                'litre': str(litre),
                'fiyat': str(fiyat),
                'kullanici_id': kullanici_id,
                'sirket_id': sirket_id
            }
            logger.info(f"Süt girdisi ekleniyor: {insert_data}")
            response = g.supabase.table('sut_girdileri').insert(insert_data).execute()

            if not response.data:
                 logger.error(f"Supabase insert işlemi veri döndürmedi. İstek: {insert_data}")
                 raise Exception("Veritabanına kayıt sırasında bir sorun oluştu.")

            # === YENİ TANKER GÜNCELLEME ADIMI ===
            if tanker_id_to_update:
                try:
                    yeni_doluluk = mevcut_doluluk + litre
                    g.supabase.table('tankerler') \
                        .update({'mevcut_doluluk': str(yeni_doluluk)}) \
                        .eq('id', tanker_id_to_update) \
                        .execute()
                    logger.info(f"Tanker (ID: {tanker_id_to_update}) doluluğu {yeni_doluluk} L olarak güncellendi.")
                except Exception as tanker_e:
                    # Tanker güncellenemezse, süt girdisini sil (Atomik işlem)
                    logger.error(f"Tanker GÜNCELLEME HATASI: {tanker_e}. Süt girdisi (ID: {response.data[0]['id']}) geri alınıyor...", exc_info=True)
                    g.supabase.table('sut_girdileri').delete().eq('id', response.data[0]['id']).execute()
                    raise Exception(f"Tanker güncellenemedi, süt girişi iptal edildi. Hata: {tanker_e}")
            # === TANKER GÜNCELLEME SONU ===
            
            logger.info(f"Süt girdisi başarıyla eklendi: ID {response.data[0].get('id')}")
            return response.data[0]

        except ValueError as ve:
            logger.warning(f"Süt girdisi ekleme validation hatası: {ve}")
            raise ve
        except APIError as api_err:
            logger.error(f"Supabase API hatası (süt ekleme): {api_err.message}", exc_info=True)
            raise Exception(f"Veritabanı hatası: {api_err.message}")
        except Exception as e:
            logger.error(f"Süt girdisi eklenirken BİLİNMEYEN hata: {e}", exc_info=True)
            raise Exception("Girdi eklenirken bir sunucu hatası oluştu.")

    # === UPDATE_ENTRY GÜNCELLENDİ ===
    def update_entry(self, girdi_id: int, sirket_id: int, duzenleyen_kullanici_id: int, data: dict):
        """Mevcut bir süt girdisini günceller, TANKERİ GÜNCELLER ve geçmiş kaydı oluşturur."""
        try:
            logger.info(f"update_entry çağrıldı. Girdi ID: {girdi_id}, Kullanıcı ID: {duzenleyen_kullanici_id}, Gelen Data: {data}")

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

            # **Adım 2: Mevcut girdiyi ve yetkiyi kontrol et**
            mevcut_girdi_res = g.supabase.table('sut_girdileri') \
                .select('id, litre, fiyat, kullanici_id, tedarikci_id, taplanma_tarihi, sirket_id') \
                .eq('id', girdi_id).eq('sirket_id', sirket_id).maybe_single().execute()

            if not mevcut_girdi_res.data:
                logger.warning(f"Güncellenecek girdi bulunamadı. Girdi ID: {girdi_id}, Sirket ID: {sirket_id}")
                raise ValueError("Girdi bulunamadı veya bu şirkete ait değil.")

            mevcut_girdi = mevcut_girdi_res.data
            girdi_sahibi_id = mevcut_girdi.get('kullanici_id')
            mevcut_tedarikci_id = mevcut_girdi.get('tedarikci_id')
            eski_litre = Decimal(mevcut_girdi.get('litre'))
            eski_fiyat = Decimal(mevcut_girdi.get('fiyat'))
            girdi_tarihi_str_db = mevcut_girdi.get('taplanma_tarihi')

            duzenleyen_rol = session.get('user', {}).get('rol')
            if duzenleyen_rol != UserRole.FIRMA_YETKILISI.value and duzenleyen_kullanici_id != girdi_sahibi_id:
                logger.warning(f"Yetkisiz düzenleme denemesi: Kullanıcı {duzenleyen_kullanici_id}, Girdi ID {girdi_id}, Sahip ID {girdi_sahibi_id}")
                raise ValueError("Bu girdiyi düzenleme yetkiniz yok.")

            # === YENİ TANKER GÜNCELLEME KONTROLÜ ===
            tanker_id_to_update = None
            litre_farki = yeni_litre - eski_litre # Pozitif (artış) veya negatif (azalış) olabilir
            mevcut_doluluk = Decimal(0)
            
            # Girdinin sahibi bir toplayıcı ise, tankerini güncelle
            girdi_sahibi_rol_res = g.supabase.table('kullanicilar').select('rol').eq('id', girdi_sahibi_id).single().execute()
            girdi_sahibi_rol = girdi_sahibi_rol_res.data.get('rol') if girdi_sahibi_rol_res.data else None
            
            if girdi_sahibi_rol == UserRole.TOPLAYICI.value:
                try:
                    tanker = self._get_toplayici_tanker(girdi_sahibi_id, sirket_id)
                    tanker_id_to_update = tanker['id']
                    mevcut_doluluk = Decimal(tanker['mevcut_doluluk'])
                    kapasite = Decimal(tanker['kapasite_litre'])
                    
                    if litre_farki > 0: # Litre artıyorsa
                        kalan_kapasite = kapasite - mevcut_doluluk
                        if litre_farki > kalan_kapasite:
                            raise ValueError(f"Tanker kapasitesi aşıldı! Kalan kapasite: {kalan_kapasite:.2f} L. Eklemek istediğiniz fark: {litre_farki} L.")
                    
                    elif litre_farki < 0 and (mevcut_doluluk + litre_farki) < 0:
                         logger.warning(f"Tanker (ID: {tanker_id_to_update}) doluluğu 0'a eşitleniyor.")
                         litre_farki = -mevcut_doluluk # Tankeri 0'a çekecek kadar fark
                
                except ValueError as ve:
                     logger.warning(f"Tanker güncelleme atlandı (update_entry): {ve}")
                     tanker_id_to_update = None
                     litre_farki = Decimal(0)
            # === TANKER KONTROLÜ SONU ===

            # **Adım 3: Geçmiş kaydını ekle**
            history_data = {
                'orijinal_girdi_id': girdi_id,
                'duzenleyen_kullanici_id': duzenleyen_kullanici_id,
                'duzenleme_sebebi': duzenleme_sebebi,
                'eski_litre_degeri': str(eski_litre),
                'eski_fiyat_degeri': str(eski_fiyat) if eski_fiyat is not None else None,
                'eski_tedarikci_id': mevcut_tedarikci_id
            }
            g.supabase.table('girdi_gecmisi').insert(history_data).execute()

            # **Adım 4: Ana girdiyi güncelle**
            guncellenecek_veri = {
                'duzenlendi_mi': True,
                'litre': str(yeni_litre),
                'fiyat': str(yeni_fiyat)
            }
            g.supabase.table('sut_girdileri') \
                .update(guncellenecek_veri) \
                .eq('id', girdi_id) \
                .execute()

            # **Adım 5: Tankeri Güncelle** (Eğer gerekiyorsa)
            if tanker_id_to_update and litre_farki != 0:
                try:
                    yeni_doluluk = mevcut_doluluk + litre_farki
                    g.supabase.table('tankerler') \
                        .update({'mevcut_doluluk': str(yeni_doluluk)}) \
                        .eq('id', tanker_id_to_update) \
                        .execute()
                    logger.info(f"Tanker (ID: {tanker_id_to_update}) doluluğu {litre_farki} L değiştirildi. Yeni doluluk: {yeni_doluluk} L.")
                except Exception as tanker_e:
                    # Tanker güncellenemezse, süt girdisini geri al
                    logger.error(f"Tanker GÜNCELLEME HATASI (Update): {tanker_e}. Süt girdisi (ID: {girdi_id}) eski haline döndürülüyor...", exc_info=True)
                    g.supabase.table('sut_girdileri') \
                        .update({'duzenlendi_mi': False, 'litre': str(eski_litre), 'fiyat': str(eski_fiyat)}) \
                        .eq('id', girdi_id) \
                        .execute()
                    # Geçmiş kaydını sil
                    g.supabase.table('girdi_gecmisi').delete().eq('orijinal_girdi_id', girdi_id).execute()
                    raise Exception(f"Tanker güncellenemedi, süt güncellemesi iptal edildi. Hata: {tanker_e}")

            # **Adım 6: Güncel veriyi döndür**
            guncel_girdi_res = g.supabase.table('sut_girdileri') \
                .select('*') \
                .eq('id', girdi_id) \
                .single() \
                .execute()
            
            if not guncel_girdi_res.data:
                 logger.error(f"Girdi güncellendi ancak tekrar çekilemedi. Girdi ID: {girdi_id}")
                 raise Exception("Girdi güncellendi ancak sunucudan güncel veri alınamadı.")

            girdi_tarihi_str_formatted = datetime.now(turkey_tz).date().isoformat()
            if girdi_tarihi_str_db:
                girdi_tarihi = parse_supabase_timestamp(girdi_tarihi_str_db)
                if girdi_tarihi: girdi_tarihi_str_formatted = girdi_tarihi.astimezone(turkey_tz).date().isoformat()

            logger.info(f"Süt girdisi ID {girdi_id} başarıyla güncellendi.")
            return guncel_girdi_res.data, girdi_tarihi_str_formatted

        except ValueError as ve:
             logger.warning(f"Süt girdisi güncelleme validation hatası: {ve}")
             raise ve
        except APIError as api_err:
            logger.error(f"Supabase API hatası (süt güncelleme genel): {api_err.message}", exc_info=True)
            raise Exception(f"Veritabanı hatası: {api_err.message}")
        except Exception as e:
            logger.error(f"Süt girdisi güncellenirken BİLİNMEYEN hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")

    # === DELETE_ENTRY GÜNCELLENDİ ===
    def delete_entry(self, girdi_id: int, sirket_id: int):
        """Bir süt girdisini siler, TANKERİ GÜNCELLER ve ilgili geçmiş kayıtlarını siler."""
        try:
            silen_kullanici_id = session.get('user', {}).get('id')
            silen_rol = session.get('user', {}).get('rol')

            mevcut_girdi_res = g.supabase.table('sut_girdileri') \
                .select('sirket_id, taplanma_tarihi, kullanici_id, litre') \
                .eq('id', girdi_id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single() \
                .execute()

            if not mevcut_girdi_res.data:
                raise ValueError("Girdi bulunamadı veya silme yetkiniz yok.")

            mevcut_girdi = mevcut_girdi_res.data
            girdi_sahibi_id = mevcut_girdi.get('kullanici_id')
            silinen_litre = Decimal(mevcut_girdi.get('litre')) # Silinen litreyi al
            
            if silen_rol != UserRole.FIRMA_YETKILISI.value and silen_kullanici_id != girdi_sahibi_id:
                logger.warning(f"Yetkisiz silme denemesi: Kullanıcı {silen_kullanici_id}, Girdi ID {girdi_id}, Sahip ID {girdi_sahibi_id}")
                raise ValueError("Bu girdiyi silme yetkiniz yok.")

            girdi_tarihi_str_db = mevcut_girdi.get('taplanma_tarihi')
            girdi_tarihi_str_formatted = datetime.now(turkey_tz).date().isoformat()
            if girdi_tarihi_str_db:
                girdi_tarihi = parse_supabase_timestamp(girdi_tarihi_str_db)
                if girdi_tarihi:
                    girdi_tarihi_str_formatted = girdi_tarihi.astimezone(turkey_tz).date().isoformat()

            # **Tanker Güncelleme Kontrolü (Silme)**
            girdi_sahibi_rol_res = g.supabase.table('kullanicilar').select('rol').eq('id', girdi_sahibi_id).single().execute()
            girdi_sahibi_rol = girdi_sahibi_rol_res.data.get('rol') if girdi_sahibi_rol_res.data else None

            tanker_id_to_update = None
            mevcut_doluluk = Decimal(0)
            
            if girdi_sahibi_rol == UserRole.TOPLAYICI.value:
                try:
                    tanker = self._get_toplayici_tanker(girdi_sahibi_id, sirket_id)
                    tanker_id_to_update = tanker['id']
                    mevcut_doluluk = Decimal(tanker['mevcut_doluluk'])
                except ValueError as ve:
                    logger.warning(f"Tanker güncelleme atlandı (delete_entry): {ve}")
                    tanker_id_to_update = None
            
            # **Girdiyi ve Geçmişini Sil**
            logger.info(f"Girdi geçmişi siliniyor: Orijinal Girdi ID {girdi_id}")
            g.supabase.table('girdi_gecmisi').delete().eq('orijinal_girdi_id', girdi_id).execute()

            logger.info(f"Süt girdisi siliniyor: ID {girdi_id}")
            g.supabase.table('sut_girdileri').delete().eq('id', girdi_id).execute()

            # **Tankeri Güncelle**
            if tanker_id_to_update:
                try:
                    yeni_doluluk = mevcut_doluluk - silinen_litre
                    if yeni_doluluk < 0:
                        logger.warning(f"Tanker (ID: {tanker_id_to_update}) doluluğu 0'a eşitleniyor.")
                        yeni_doluluk = Decimal('0')
                        
                    g.supabase.table('tankerler') \
                        .update({'mevcut_doluluk': str(yeni_doluluk)}) \
                        .eq('id', tanker_id_to_update) \
                        .execute()
                    logger.info(f"Tanker (ID: {tanker_id_to_update}) doluluğu {silinen_litre} L azaltıldı. Yeni doluluk: {yeni_doluluk} L.")
                except Exception as tanker_e:
                    logger.error(f"HATA: Tanker GÜNCELLEME HATASI (Delete): {tanker_e}. Girdi (ID: {girdi_id}) zaten silindi. Lütfen Tanker (ID: {tanker_id_to_update}) doluluğunu manuel kontrol edin!", exc_info=True)

            logger.info(f"Süt girdisi ID {girdi_id}, kullanıcı {silen_kullanici_id} tarafından silindi.")
            return girdi_tarihi_str_formatted

        except ValueError as ve:
            logger.warning(f"Süt girdisi silme validation hatası: {ve}")
            raise ve
        except APIError as api_err:
            logger.error(f"Supabase API hatası (süt silme): {api_err.message}", exc_info=True)
            raise Exception(f"Veritabanı hatası: {api_err.message}")
        except Exception as e:
            logger.error(f"Süt girdisi silinirken BİLİNMEYEN hata: {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")

    # --- Kalan Fonksiyonlar Değişmedi ---
    def get_entry_history(self, girdi_id: int, sirket_id: int):
        try:
            original_girdi_response = g.supabase.table('sut_girdileri').select('id').eq('id', girdi_id).eq('sirket_id', sirket_id).maybe_single().execute()
            if not original_girdi_response.data:
                logger.warning(f"Yetkisiz geçmiş sorgusu veya girdi bulunamadı. Girdi ID: {girdi_id}, Sirket ID: {sirket_id}")
                raise ValueError("Yetkisiz erişim veya girdi bulunamadı.")

            logger.debug(f"Girdi geçmişi çekiliyor: Orijinal Girdi ID {girdi_id}")
            gecmis_data = g.supabase.table('girdi_gecmisi').select('*,duzenleyen_kullanici_id(kullanici_adi)').eq('orijinal_girdi_id', girdi_id).order('created_at', desc=True).execute()
            return gecmis_data.data
        except ValueError as ve:
             raise ve
        except Exception as e:
            logger.error(f"Girdi geçmişi alınırken hata: {e}", exc_info=True)
            raise Exception("Girdi geçmişi alınamadı.")

    def get_last_price_for_supplier(self, sirket_id: int, tedarikci_id: int):
        try:
            logger.debug(f"Son fiyat çekiliyor: Sirket ID {sirket_id}, Tedarikçi ID {tedarikci_id}")
            response = g.supabase.table('sut_girdileri').select('fiyat').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order('taplanma_tarihi', desc=True).limit(1).maybe_single().execute()
            return response.data if response.data else {}
        except Exception as e:
            logger.error(f"Son fiyat alınırken hata: {e}", exc_info=True)
            return {}

sut_service = SutService()