# services/sut_service.py

import logging
from flask import g
from extensions import turkey_tz
from decimal import Decimal, InvalidOperation
from datetime import datetime
import pytz
from utils import parse_supabase_timestamp
# YENİ: Rolleri kontrol edebilmek için UserRole'u import ediyoruz.
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
        """Yeni bir süt girdisi ekler."""
        try:
            litre = Decimal(yeni_girdi.get('litre'))
            fiyat = Decimal(yeni_girdi.get('fiyat'))
            if litre <= 0 or fiyat <= 0:
                raise ValueError("Litre ve fiyat pozitif bir değer olmalıdır.")
            
            response = g.supabase.table('sut_girdileri').insert({
                'tedarikci_id': yeni_girdi['tedarikci_id'], 
                'litre': str(litre),
                'fiyat': str(fiyat),
                'kullanici_id': kullanici_id, 
                'sirket_id': sirket_id
            }).execute()
            return response.data
        except (InvalidOperation, TypeError, ValueError) as e:
            raise ValueError(f"Geçersiz girdi verisi: {e}")
        except Exception as e:
            logger.error(f"Süt girdisi eklenirken hata: {e}", exc_info=True)
            raise

    def update_entry(self, girdi_id: int, sirket_id: int, duzenleyen_kullanici_id: int, data: dict):
        """Mevcut bir süt girdisini günceller ve geçmiş kaydı oluşturur."""
        try:
            yeni_litre = data.get('yeni_litre')
            yeni_fiyat = data.get('yeni_fiyat')
            duzenleme_sebebi = data.get('duzenleme_sebebi', '').strip() or '-'

            if not yeni_litre or not yeni_fiyat:
                raise ValueError("Yeni litre ve fiyat değerleri zorunludur.")
            
            guncellenecek_veri = { 'duzenlendi_mi': True, 'litre': str(Decimal(yeni_litre)), 'fiyat': str(Decimal(yeni_fiyat)) }

            mevcut_girdi_res = g.supabase.table('sut_girdileri').select('*').eq('id', girdi_id).eq('sirket_id', sirket_id).single().execute()
            if not mevcut_girdi_res.data:
                raise ValueError("Girdi bulunamadı veya bu işlem için yetkiniz yok.")
            
            g.supabase.table('girdi_gecmisi').insert({
                'orijinal_girdi_id': girdi_id, 'duzenleyen_kullanici_id': duzenleyen_kullanici_id,
                'duzenleme_sebebi': duzenleme_sebebi, 'eski_litre_degeri': mevcut_girdi_res.data['litre'],
                'eski_fiyat_degeri': mevcut_girdi_res.data.get('fiyat'), 'eski_tedarikci_id': mevcut_girdi_res.data['tedarikci_id']
            }).execute()

            guncel_girdi = g.supabase.table('sut_girdileri').update(guncellenecek_veri).eq('id', girdi_id).execute()
            
            girdi_tarihi = parse_supabase_timestamp(mevcut_girdi_res.data['taplanma_tarihi'])
            girdi_tarihi_str = girdi_tarihi.astimezone(turkey_tz).date().isoformat() if girdi_tarihi else datetime.now(turkey_tz).date().isoformat()
            
            return guncel_girdi.data, girdi_tarihi_str
        except (InvalidOperation, TypeError, ValueError) as e:
            raise ValueError(f"Geçersiz güncelleme verisi: {e}")
        except Exception as e:
            logger.error(f"Süt girdisi güncellenirken hata: {e}", exc_info=True)
            raise

    def delete_entry(self, girdi_id: int, sirket_id: int):
        """Bir süt girdisini ve ilgili geçmiş kayıtlarını siler."""
        try:
            mevcut_girdi_res = g.supabase.table('sut_girdileri').select('sirket_id, taplanma_tarihi').eq('id', girdi_id).eq('sirket_id', sirket_id).single().execute()
            if not mevcut_girdi_res.data:
                raise ValueError("Girdi bulunamadı veya silme yetkiniz yok.")
            
            girdi_tarihi = parse_supabase_timestamp(mevcut_girdi_res.data['taplanma_tarihi'])
            girdi_tarihi_str = girdi_tarihi.astimezone(turkey_tz).date().isoformat() if girdi_tarihi else datetime.now(turkey_tz).date().isoformat()

            g.supabase.table('girdi_gecmisi').delete().eq('orijinal_girdi_id', girdi_id).execute()
            g.supabase.table('sut_girdileri').delete().eq('id', girdi_id).execute()
            
            return girdi_tarihi_str
        except Exception as e:
            logger.error(f"Süt girdisi silinirken hata: {e}", exc_info=True)
            raise

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