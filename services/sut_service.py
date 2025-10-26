# services/sut_service.py

import logging
# YENİ: Gerekli importlar eklendi
from flask import g, session
from postgrest import APIError
# --- Bitiş ---
from extensions import turkey_tz
from decimal import Decimal, InvalidOperation
from datetime import datetime
import pytz
from utils import parse_supabase_timestamp
from constants import UserRole

logger = logging.getLogger(__name__)

class SutService:
    """Süt girdileri veritabanı işlemleri için servis katmanı."""

    def get_daily_summary(self, sirket_id: int, tarih_str: str):
        """Belirtilen tarih için RPC kullanarak özet veriyi çeker."""
        try:
            response = g.supabase.rpc('get_daily_summary_rpc', {
                'target_sirket_id': sirket_id,
                'target_date': tarih_str
            }).execute()
            return response.data[0] if response.data else {'toplam_litre': 0, 'girdi_sayisi': 0}
        except Exception as e:
            logger.error(f"Günlük özet alınırken hata: {e}", exc_info=True)
            raise

    # GÜNCELLEME: Fonksiyonun imzasına 'kullanici_id' ve 'rol' parametrelerini ekledik.
    def get_paginated_list(self, sirket_id: int, kullanici_id: int, rol: str, tarih_str: str, sayfa: int, limit: int = 6):
        """Süt girdilerini sayfalama ve tarihe göre filtreleme yaparak listeler."""
        try:
            offset = (sayfa - 1) * limit
            query = g.supabase.table('sut_girdileri').select(
                'id,litre,fiyat,taplanma_tarihi,duzenlendi_mi,kullanicilar(kullanici_adi),tedarikciler(isim)', 
                count='exact'
            ).eq('sirket_id', sirket_id)
            
            # --- YENİ EKLENEN VERİ İZOLASYON MANTIĞI ---
            # Eğer fonksiyonu çağıran kullanıcının rolü 'toplayici' ise,
            # sorguya ek bir filtre ekleyerek sadece kendi 'kullanici_id'sine sahip girdileri getirmesini sağlıyoruz.
            # 'firma_yetkilisi' veya 'muhasebeci' ise bu koşul atlanır ve tüm girdileri görürler.
            if rol == UserRole.TOPLAYICI.value:
                query = query.eq('kullanici_id', kullanici_id)
            # --- YENİ MANTIK SONU ---
            
            if tarih_str:
                target_date = datetime.strptime(tarih_str, '%Y-%m-%d').date()
                start_utc = turkey_tz.localize(datetime.combine(target_date, datetime.min.time())).astimezone(pytz.utc).isoformat()
                end_utc = turkey_tz.localize(datetime.combine(target_date, datetime.max.time())).astimezone(pytz.utc).isoformat()
                query = query.gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc)
                
            response = query.order('id', desc=True).range(offset, offset + limit - 1).execute()
            return response.data, response.count
        except Exception as e:
            logger.error(f"Süt girdileri listelenirken hata: {e}", exc_info=True)
            raise

    def add_entry(self, sirket_id: int, kullanici_id: int, yeni_girdi: dict):
        """Yeni bir süt girdisi ekler. Toplayıcı rolü için yetki kontrolü yapar."""
        try:
            litre_str = yeni_girdi.get('litre')
            fiyat_str = yeni_girdi.get('fiyat')
            tedarikci_id_to_add = yeni_girdi.get('tedarikci_id')

            if not tedarikci_id_to_add:
                 raise ValueError("Tedarikçi seçimi zorunludur.")
            if not litre_str or not fiyat_str:
                 raise ValueError("Litre ve Fiyat alanları zorunludur.")

            # Sayısal değerleri Decimal'e çevir ve kontrol et
            try:
                litre = Decimal(litre_str)
                fiyat = Decimal(fiyat_str)
            except (InvalidOperation, TypeError):
                 raise ValueError("Litre ve Fiyat geçerli bir sayı olmalıdır.")

            if litre <= 0 or fiyat < 0:
                raise ValueError("Litre pozitif, fiyat negatif olmayan bir değer olmalıdır.")

            # --- GÜNCELLENMİŞ YETKİ KONTROLÜ ---
            user_role = session.get('user', {}).get('rol') # session artık import edildi

            # Sadece Toplayıcı rolü için özel kontrol yap
            if user_role == UserRole.TOPLAYICI.value:
                # Bu toplayıcının bu tedarikçiye atanıp atanmadığını kontrol et
                atama_res = g.supabase.table('toplayici_tedarikci_atananlari') \
                    .select('tedarikci_id', count='exact') \
                    .eq('toplayici_id', kullanici_id) \
                    .eq('tedarikci_id', tedarikci_id_to_add) \
                    .execute()
                if atama_res.count == 0:
                    logger.warning(f"Yetkisiz ekleme denemesi: Toplayıcı {kullanici_id}, Tedarikçi {tedarikci_id_to_add}")
                    raise ValueError("Bu tedarikçiye veri ekleme yetkiniz yok.")
            # --- YETKİ KONTROLÜ SONU ---

            # Veritabanına ekleme işlemi
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
            return response.data[0]

        except ValueError as ve:
            logger.warning(f"Süt girdisi ekleme validation hatası: {ve}")
            raise ve
        # APIError artık import edildi
        except APIError as api_err:
            logger.error(f"Supabase API hatası (süt ekleme): {api_err.message}", exc_info=True)
            raise Exception(f"Veritabanı hatası: {api_err.message}")
        except Exception as e:
            logger.error(f"Süt girdisi eklenirken BİLİNMEYEN hata: {e}", exc_info=True)
            raise Exception("Girdi eklenirken bir sunucu hatası oluştu.")


    # --- YENİ: Düzenleme Yetki Kontrollü update_entry ---
    def update_entry(self, girdi_id: int, sirket_id: int, duzenleyen_kullanici_id: int, data: dict):
        """Mevcut bir süt girdisini günceller, yetki kontrolü yapar ve geçmiş kaydı oluşturur."""
        try:
            yeni_litre_str = data.get('yeni_litre')
            yeni_fiyat_str = data.get('yeni_fiyat')
            duzenleme_sebebi = data.get('duzenleme_sebebi', '').strip() or '-'

            if not yeni_litre_str or not yeni_fiyat_str:
                raise ValueError("Yeni litre ve fiyat değerleri zorunludur.")

            try:
                yeni_litre = Decimal(yeni_litre_str)
                yeni_fiyat = Decimal(yeni_fiyat_str)
                if yeni_litre <= 0 or yeni_fiyat < 0:
                     raise ValueError("Litre pozitif, fiyat negatif olmayan bir değer olmalıdır.")
            except (InvalidOperation, TypeError):
                 raise ValueError("Litre ve Fiyat geçerli bir sayı olmalıdır.")

            # Girdiyi ve sahibini getir
            mevcut_girdi_res = g.supabase.table('sut_girdileri') \
                .select('*, kullanici_id') \
                .eq('id', girdi_id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single() \
                .execute()

            if not mevcut_girdi_res.data:
                raise ValueError("Girdi bulunamadı veya bu şirkete ait değil.")

            mevcut_girdi = mevcut_girdi_res.data
            girdi_sahibi_id = mevcut_girdi['kullanici_id']
            duzenleyen_rol = session.get('user', {}).get('rol')

            # Yetki Kontrolü: Firma Yetkilisi değilse VE girdinin sahibi değilse engelle
            if duzenleyen_rol != UserRole.FIRMA_YETKILISI.value and duzenleyen_kullanici_id != girdi_sahibi_id:
                logger.warning(f"Yetkisiz düzenleme denemesi: Kullanıcı {duzenleyen_kullanici_id}, Girdi ID {girdi_id}, Sahip ID {girdi_sahibi_id}")
                raise ValueError("Bu girdiyi düzenleme yetkiniz yok.")

            # Geçmiş kaydı oluştur
            g.supabase.table('girdi_gecmisi').insert({
                'orijinal_girdi_id': girdi_id, 'duzenleyen_kullanici_id': duzenleyen_kullanici_id,
                'duzenleme_sebebi': duzenleme_sebebi, 'eski_litre_degeri': mevcut_girdi['litre'],
                'eski_fiyat_degeri': mevcut_girdi.get('fiyat'), 'eski_tedarikci_id': mevcut_girdi['tedarikci_id']
            }).execute()

            # Girdiyi güncelle
            guncellenecek_veri = { 'duzenlendi_mi': True, 'litre': str(yeni_litre), 'fiyat': str(yeni_fiyat) }
            guncel_girdi_res = g.supabase.table('sut_girdileri').update(guncellenecek_veri).eq('id', girdi_id).select().execute()

            # Güncellenen girdinin tarihini al (özet güncellemesi için)
            girdi_tarihi = parse_supabase_timestamp(mevcut_girdi['taplanma_tarihi'])
            girdi_tarihi_str = girdi_tarihi.astimezone(turkey_tz).date().isoformat() if girdi_tarihi else datetime.now(turkey_tz).date().isoformat()

            return guncel_girdi_res.data[0], girdi_tarihi_str # Güncellenen veriyi ve tarihi döndür

        except ValueError as ve:
             logger.warning(f"Süt girdisi güncelleme validation hatası: {ve}")
             raise ve
        except APIError as api_err:
            logger.error(f"Supabase API hatası (süt güncelleme): {api_err.message}", exc_info=True)
            raise Exception(f"Veritabanı hatası: {api_err.message}")
        except Exception as e:
            logger.error(f"Süt girdisi güncellenirken BİLİNMEYEN hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")

    # --- YENİ: Silme Yetki Kontrollü delete_entry ---
    def delete_entry(self, girdi_id: int, sirket_id: int):
        """Bir süt girdisini siler, yetki kontrolü yapar ve ilgili geçmiş kayıtlarını siler."""
        try:
            silen_kullanici_id = session.get('user', {}).get('id')
            silen_rol = session.get('user', {}).get('rol')

            # Silinecek girdiyi ve sahibini getir
            mevcut_girdi_res = g.supabase.table('sut_girdileri') \
                .select('sirket_id, taplanma_tarihi, kullanici_id') \
                .eq('id', girdi_id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single() \
                .execute()

            if not mevcut_girdi_res.data:
                raise ValueError("Girdi bulunamadı veya silme yetkiniz yok.")

            mevcut_girdi = mevcut_girdi_res.data
            girdi_sahibi_id = mevcut_girdi['kullanici_id']

            # Yetki Kontrolü: Firma Yetkilisi değilse VE girdinin sahibi değilse engelle
            if silen_rol != UserRole.FIRMA_YETKILISI.value and silen_kullanici_id != girdi_sahibi_id:
                logger.warning(f"Yetkisiz silme denemesi: Kullanıcı {silen_kullanici_id}, Girdi ID {girdi_id}, Sahip ID {girdi_sahibi_id}")
                raise ValueError("Bu girdiyi silme yetkiniz yok.")

            # Girdinin tarihini al (özet güncellemesi için)
            girdi_tarihi = parse_supabase_timestamp(mevcut_girdi['taplanma_tarihi'])
            girdi_tarihi_str = girdi_tarihi.astimezone(turkey_tz).date().isoformat() if girdi_tarihi else datetime.now(turkey_tz).date().isoformat()

            # Önce geçmiş kayıtlarını sil (varsa)
            g.supabase.table('girdi_gecmisi').delete().eq('orijinal_girdi_id', girdi_id).execute()
            # Sonra girdinin kendisini sil
            g.supabase.table('sut_girdileri').delete().eq('id', girdi_id).execute()

            logger.info(f"Süt girdisi ID {girdi_id}, kullanıcı {silen_kullanici_id} tarafından silindi.")
            return girdi_tarihi_str # Silinen girdinin tarihini döndür

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
            original_girdi_response = g.supabase.table('sut_girdileri').select('sirket_id').eq('id', girdi_id).eq('sirket_id', sirket_id).single().execute()
            if not original_girdi_response.data:
                raise ValueError("Yetkisiz erişim veya girdi bulunamadı.")
            
            gecmis_data = g.supabase.table('girdi_gecmisi').select('*,duzenleyen_kullanici_id(kullanici_adi)').eq('orijinal_girdi_id', girdi_id).order('created_at', desc=True).execute()
            return gecmis_data.data
        except Exception as e:
            logger.error(f"Girdi geçmişi alınırken hata: {e}", exc_info=True)
            raise

    def get_last_price_for_supplier(self, sirket_id: int, tedarikci_id: int):
        """Bir tedarikçi için girilen en son süt fiyatını getirir."""
        try:
            response = g.supabase.table('sut_girdileri').select('fiyat').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).order('taplanma_tarihi', desc=True).limit(1).single().execute()
            return response.data if response.data else {}
        except Exception as e:
            logger.error(f"Son fiyat alınırken hata: {e}", exc_info=True)
            raise Exception("Son fiyat bilgisi alınamadı.")

sut_service = SutService()