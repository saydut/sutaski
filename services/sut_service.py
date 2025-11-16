# services/sut_service.py

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

    # get_daily_summary, get_paginated_list, add_entry metodları öncekiyle aynı kalabilir
    # ... (Önceki metodlar burada) ...
    def get_daily_summary(self, sirket_id: int, tarih_str: str):
        """Belirtilen tarih için RPC kullanarak özet veriyi çeker."""
        try:
            response = g.supabase.rpc('get_daily_summary_rpc', {
                'target_sirket_id': sirket_id,
                'target_date': tarih_str
            }).execute()
            # RPC'den veri gelmezse veya boş gelirse varsayılan döndür
            if not response.data or not response.data[0]:
                logger.warning(f"get_daily_summary_rpc veri döndürmedi. Sirket: {sirket_id}, Tarih: {tarih_str}")
                return {'toplam_litre': 0, 'girdi_sayisi': 0}
            return response.data[0]
        except Exception as e:
            logger.error(f"Günlük özet alınırken hata: {e}", exc_info=True)
            # Hata durumunda da varsayılan bir yapı döndürerek frontend'in bozulmasını engelle
            return {'toplam_litre': 0, 'girdi_sayisi': 0}


    def get_paginated_list(self, sirket_id: int, kullanici_id: int, rol: str, tarih_str: str, sayfa: int, limit: int = 6):
        """Süt girdilerini sayfalama ve filtreleme yaparak listeler (RPC kullanarak)."""
        try:
            offset = (sayfa - 1) * limit
            
            # Yeni RPC'yi çağırmak için parametreleri hazırla
            params = {
                'p_sirket_id': sirket_id,
                'p_kullanici_id': kullanici_id,
                'p_rol': rol,
                'p_tarih_str': tarih_str,
                'p_limit': limit,
                'p_offset': offset
            }
            
            # RPC'yi çağır
            response = g.supabase.rpc('get_paginated_sut_girdileri', params).execute()

            if not response.data:
                logger.warning(f"get_paginated_sut_girdileri RPC'si veri döndürmedi. Parametreler: {params}")
                return [], 0
            
            # RPC'den gelen JSON'ı ayrıştır
            result_data = response.data
            girdiler = result_data.get('data', [])
            toplam_kayit = result_data.get('count', 0)
            
            # Gerekli: RPC'den gelen 'kullanici_adi' ve 'tedarikci_isim' alanlarını
            # eski kodun beklediği iç içe yapıya dönüştür.
            for girdi in girdiler:
                if 'kullanici_adi' in girdi:
                    girdi['kullanicilar'] = {'kullanici_adi': girdi['kullanici_adi']}
                if 'tedarikci_isim' in girdi:
                    girdi['tedarikciler'] = {'isim': girdi['tedarikci_isim']}

            logger.info(f"Süt girdileri listelendi (RPC): Sayfa {sayfa}, Limit {limit}, Tarih: {tarih_str}, Toplam: {toplam_kayit}")
            return girdiler, toplam_kayit
            
        except Exception as e:
            logger.error(f"Süt girdileri listelenirken (RPC) hata: {e}", exc_info=True)
            return [], 0

    def add_entry(self, sirket_id: int, kullanici_id: int, yeni_girdi: dict):
        """Yeni bir süt girdisi ekler."""
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
            if user_role == UserRole.TOPLAYICI.value:
                atama_res = g.supabase.table('toplayici_tedarikci_atananlari') \
                    .select('tedarikci_id', count='exact') \
                    .eq('toplayici_id', kullanici_id) \
                    .eq('tedarikci_id', tedarikci_id_to_add) \
                    .execute()
                if atama_res.count == 0:
                    logger.warning(f"Yetkisiz ekleme denemesi: Toplayıcı {kullanici_id}, Tedarikçi {tedarikci_id_to_add}")
                    raise ValueError("Bu tedarikçiye veri ekleme yetkiniz yok.")

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
                 raise Exception("Veritabanına kayıt sırasında bir sorun oluştu, lütfen tekrar deneyin.")

            logger.info(f"Süt girdisi başarıyla eklendi: ID {response.data[0].get('id')}")
            # Ekleme sonrası veriyi geri döndürmek yerine sadece ID döndürmek de yeterli olabilir
            # Ancak özet güncellemesi için yine de çekmek gerekebilir.
            # Şimdilik eklenen verinin tamamını döndürelim.
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


    def update_entry(self, girdi_id: int, sirket_id: int, duzenleyen_kullanici_id: int, data: dict):
        """Mevcut bir süt girdisini günceller, yetki kontrolü yapar ve geçmiş kaydı oluşturur."""
        # **Adım 1: Girdi verilerini ve geçerliliğini kontrol et**
        try:
            logger.info(f"update_entry çağrıldı. Girdi ID: {girdi_id}, Kullanıcı ID: {duzenleyen_kullanici_id}, Gelen Data: {data}")

            yeni_litre_str = data.get('yeni_litre')
            yeni_fiyat_str = data.get('yeni_fiyat')
            raw_duzenleme_sebebi = data.get('duzenleme_sebebi', '').strip()
            duzenleme_sebebi = bleach.clean(str(raw_duzenleme_sebebi)) if raw_duzenleme_sebebi else '-'

            if not yeni_litre_str or not yeni_fiyat_str:
                raise ValueError("Yeni litre ve fiyat değerleri zorunludur.")

            try:
                yeni_litre = Decimal(str(yeni_litre_str))
                yeni_fiyat = Decimal(str(yeni_fiyat_str))
                if yeni_litre <= 0 or yeni_fiyat < 0:
                     raise ValueError("Litre pozitif, fiyat negatif olmayan bir değer olmalıdır.")
            except (InvalidOperation, TypeError) as e:
                 logger.error(f"Decimal dönüşüm hatası: {e}. Litre: '{yeni_litre_str}', Fiyat: '{yeni_fiyat_str}'")
                 raise ValueError("Litre ve Fiyat geçerli bir sayı olmalıdır.")

            # **Adım 2: Mevcut girdiyi ve yetkiyi kontrol et**
            logger.debug(f"Mevcut girdi çekiliyor: ID {girdi_id}, Sirket ID {sirket_id}")
            mevcut_girdi_res = g.supabase.table('sut_girdileri') \
                .select('id, litre, fiyat, kullanici_id, tedarikci_id, taplanma_tarihi, sirket_id') \
                .eq('id', girdi_id).eq('sirket_id', sirket_id).maybe_single().execute()

            if not mevcut_girdi_res.data:
                logger.warning(f"Güncellenecek girdi bulunamadı. Girdi ID: {girdi_id}, Sirket ID: {sirket_id}")
                raise ValueError("Girdi bulunamadı veya bu şirkete ait değil.")

            mevcut_girdi = mevcut_girdi_res.data
            girdi_sahibi_id = mevcut_girdi.get('kullanici_id')
            mevcut_tedarikci_id = mevcut_girdi.get('tedarikci_id')
            mevcut_litre_db = mevcut_girdi.get('litre')
            mevcut_fiyat_db = mevcut_girdi.get('fiyat')
            girdi_tarihi_str_db = mevcut_girdi.get('taplanma_tarihi')

            duzenleyen_rol = session.get('user', {}).get('rol')
            logger.debug(f"Yetki kontrolü: Duzenleyen Rol: {duzenleyen_rol}, Duzenleyen ID: {duzenleyen_kullanici_id}, Girdi Sahibi ID: {girdi_sahibi_id}")
            if duzenleyen_rol != UserRole.FIRMA_YETKILISI.value and duzenleyen_kullanici_id != girdi_sahibi_id:
                logger.warning(f"Yetkisiz düzenleme denemesi: Kullanıcı {duzenleyen_kullanici_id}, Girdi ID {girdi_id}, Sahip ID {girdi_sahibi_id}")
                raise ValueError("Bu girdiyi düzenleme yetkiniz yok.")

            # **Adım 3: Geçmiş kaydını ekle**
            if girdi_id is None or duzenleyen_kullanici_id is None or mevcut_litre_db is None or mevcut_tedarikci_id is None:
                 logger.error(f"Geçmiş kaydı için eksik veri! Girdi ID: {girdi_id}, Duzenleyen ID: {duzenleyen_kullanici_id}, Eski Litre: {mevcut_litre_db}, Eski Tedarikçi: {mevcut_tedarikci_id}")
                 raise Exception("Geçmiş kaydı oluşturulurken veri eksik.")

            history_data = {
                'orijinal_girdi_id': girdi_id,
                'duzenleyen_kullanici_id': duzenleyen_kullanici_id,
                'duzenleme_sebebi': duzenleme_sebebi,
                'eski_litre_degeri': str(mevcut_litre_db),
                'eski_fiyat_degeri': str(mevcut_fiyat_db) if mevcut_fiyat_db is not None else None,
                'eski_tedarikci_id': mevcut_tedarikci_id
            }
            logger.debug(f"Geçmiş kaydı ekleniyor: {history_data}")
            try:
                g.supabase.table('girdi_gecmisi').insert(history_data).execute()
                logger.info(f"Geçmiş kaydı eklendi: Orijinal Girdi ID {girdi_id}")
            except APIError as api_err_hist:
                 logger.error(f"Geçmiş kaydı eklenirken Supabase API hatası: {api_err_hist.message}", exc_info=True)
                 raise Exception(f"Geçmiş kaydı oluşturulamadı: {api_err_hist.message}")
            except Exception as e_hist:
                 logger.error(f"Geçmiş kaydı eklenirken bilinmeyen hata: {e_hist}", exc_info=True)
                 raise Exception("Geçmiş kaydı oluşturulurken beklenmedik bir hata oluştu.")

            # **Adım 4: Ana girdiyi güncelle**
            guncellenecek_veri = {
                'duzenlendi_mi': True,
                'litre': str(yeni_litre),
                'fiyat': str(yeni_fiyat)
            }
            logger.debug(f"Süt girdisi güncelleniyor: ID {girdi_id}, Veri: {guncellenecek_veri}")
            try:
                # --- DÜZELTME: update() sonrası execute() çağırılır, select() kullanılmaz ---
                update_response = g.supabase.table('sut_girdileri') \
                    .update(guncellenecek_veri) \
                    .eq('id', girdi_id) \
                    .execute()
                # --- DÜZELTME SONU ---

                # Güncellemenin başarılı olup olmadığını kontrol etmek için data'ya bakabiliriz (genelde boştur)
                # Önemli olan hata fırlatmamasıdır.
                logger.debug(f"Süt girdisi update response: {update_response.data}") # Genellikle [] döner

                # --- YENİ: Güncellenen veriyi tekrar çek ---
                guncel_girdi_res = g.supabase.table('sut_girdileri') \
                    .select('*') \
                    .eq('id', girdi_id) \
                    .single() \
                    .execute()
                # --- YENİ SON ---

            except APIError as api_err_upd:
                 logger.error(f"Süt girdisi güncellenirken Supabase API hatası: {api_err_upd.message}", exc_info=True)
                 raise Exception(f"Süt girdisi güncellenemedi: {api_err_upd.message}")
            except Exception as e_upd:
                 logger.error(f"Süt girdisi güncellenirken bilinmeyen hata: {e_upd}", exc_info=True)
                 raise Exception("Süt girdisi güncellenirken beklenmedik bir hata oluştu.")


            if not guncel_girdi_res.data:
                 logger.error(f"Girdi güncellendi ancak tekrar çekilemedi. Girdi ID: {girdi_id}")
                 raise Exception("Girdi güncellendi ancak sunucudan güncel veri alınamadı.")

            # **Adım 5: Başarılı sonucu ve tarihi döndür**
            girdi_tarihi_str_formatted = datetime.now(turkey_tz).date().isoformat()
            if girdi_tarihi_str_db:
                try:
                    girdi_tarihi = parse_supabase_timestamp(girdi_tarihi_str_db)
                    if girdi_tarihi: girdi_tarihi_str_formatted = girdi_tarihi.astimezone(turkey_tz).date().isoformat()
                    else: logger.warning(f"taplanma_tarihi parse edilemedi: {girdi_tarihi_str_db}")
                except Exception as parse_e: logger.warning(f"taplanma_tarihi parse edilirken hata: {parse_e}")

            logger.info(f"Süt girdisi ID {girdi_id} başarıyla güncellendi.")
            # Güncel veriyi döndür
            return guncel_girdi_res.data, girdi_tarihi_str_formatted

        # **Genel Hata Yakalama**
        except ValueError as ve:
             logger.warning(f"Süt girdisi güncelleme validation hatası: {ve}")
             raise ve
        except APIError as api_err:
            logger.error(f"Supabase API hatası (süt güncelleme genel): {api_err.message}", exc_info=True)
            raise Exception(f"Veritabanı hatası: {api_err.message}")
        except Exception as e:
            logger.error(f"Süt girdisi güncellenirken BİLİNMEYEN hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")


    def delete_entry(self, girdi_id: int, sirket_id: int):
        """Bir süt girdisini siler, yetki kontrolü yapar ve ilgili geçmiş kayıtlarını siler."""
        try:
            silen_kullanici_id = session.get('user', {}).get('id')
            silen_rol = session.get('user', {}).get('rol')

            mevcut_girdi_res = g.supabase.table('sut_girdileri') \
                .select('sirket_id, taplanma_tarihi, kullanici_id') \
                .eq('id', girdi_id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single() \
                .execute()

            if not mevcut_girdi_res.data:
                raise ValueError("Girdi bulunamadı veya silme yetkiniz yok.")

            mevcut_girdi = mevcut_girdi_res.data
            girdi_sahibi_id = mevcut_girdi.get('kullanici_id')

            if silen_rol != UserRole.FIRMA_YETKILISI.value and silen_kullanici_id != girdi_sahibi_id:
                logger.warning(f"Yetkisiz silme denemesi: Kullanıcı {silen_kullanici_id}, Girdi ID {girdi_id}, Sahip ID {girdi_sahibi_id}")
                raise ValueError("Bu girdiyi silme yetkiniz yok.")

            girdi_tarihi_str_db = mevcut_girdi.get('taplanma_tarihi')
            girdi_tarihi_str_formatted = datetime.now(turkey_tz).date().isoformat()
            if girdi_tarihi_str_db:
                girdi_tarihi = parse_supabase_timestamp(girdi_tarihi_str_db)
                if girdi_tarihi:
                    girdi_tarihi_str_formatted = girdi_tarihi.astimezone(turkey_tz).date().isoformat()

            logger.info(f"Girdi geçmişi siliniyor: Orijinal Girdi ID {girdi_id}")
            g.supabase.table('girdi_gecmisi').delete().eq('orijinal_girdi_id', girdi_id).execute()

            logger.info(f"Süt girdisi siliniyor: ID {girdi_id}")
            g.supabase.table('sut_girdileri').delete().eq('id', girdi_id).execute()


            logger.info(f"Süt girdisi ID {girdi_id}, kullanıcı {silen_kullanici_id} tarafından silindi.")
            return girdi_tarihi_str_formatted # Silinen girdinin tarihini döndür

        except ValueError as ve:
            logger.warning(f"Süt girdisi silme validation hatası: {ve}")
            raise ve
        except APIError as api_err:
            logger.error(f"Supabase API hatası (süt silme): {api_err.message}", exc_info=True)
            raise Exception(f"Veritabanı hatası: {api_err.message}")
        except Exception as e:
            logger.error(f"Süt girdisi silinirken BİLİNMEYEN hata: {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")

    def get_entry_history(self, girdi_id: int, sirket_id: int):
        """Bir girdinin düzenleme geçmişini getirir."""
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
        """Bir tedarikçi için girilen en son süt fiyatını getirir."""
        try:
            logger.debug(f"Son fiyat çekiliyor: Sirket ID {sirket_id}, Tedarikçi ID {tedarikci_id}")
            response = g.supabase.table('sut_girdileri').select('fiyat').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order('taplanma_tarihi', desc=True).limit(1).maybe_single().execute() # maybe_single() kullanıldı
            return response.data if response.data else {} # Boş dict döndür
        except Exception as e:
            logger.error(f"Son fiyat alınırken hata: {e}", exc_info=True)
            # Frontend'in hata almaması için boş dict döndür
            return {}


sut_service = SutService()