# services/finans_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation
# FinansIslemTipi constants dosyasından import ediliyor.
from constants import FinansIslemTipi, UserRole
from utils import sanitize_input # YENİ: bleach temizleyicisini import et

logger = logging.getLogger(__name__)

class FinansService:
    """Finansal işlemler için servis katmanı."""

# GÜNCELLEME: Fonksiyonun imzası aynı kaldı, sadece iç mantığı RPC'ye devrettik
    def get_paginated_transactions(self, sirket_id: int, kullanici_id: int, rol: str, sayfa: int, limit: int = 5, tarih_str: str = None, tip: str = None):
        """Finansal işlemleri sayfalayarak ve filtreleyerek listeler (RPC kullanarak)."""
        try:
            offset = (sayfa - 1) * limit
            
            # Yeni RPC'yi çağırmak için parametreleri hazırla
            params = {
                'p_sirket_id': sirket_id,
                'p_kullanici_id': kullanici_id,
                'p_rol': rol,
                'p_tarih_str': tarih_str,
                'p_tip': tip,
                'p_limit': limit,
                'p_offset': offset
            }
            
            # RPC'yi çağır
            response = g.supabase.rpc('get_paginated_finansal_islemleri', params).execute()

            if not response.data:
                logger.warning(f"get_paginated_finansal_islemleri RPC'si veri döndürmedi. Parametreler: {params}")
                return [], 0

            # RPC'den gelen JSON'ı ayrıştır
            result_data = response.data
            islemler = result_data.get('data', [])
            toplam_kayit = result_data.get('count', 0)

            # Frontend'in (finans_yonetimi.js) beklediği formata çevir
            for islem in islemler:
                if 'tedarikci_isim' in islem:
                    islem['tedarikciler'] = {'isim': islem['tedarikci_isim']}
                if 'kullanici_adi' in islem:
                    islem['kullanicilar'] = {'kullanici_adi': islem['kullanici_adi']}

            return islemler, toplam_kayit
            
        except Exception as e:
            logger.error(f"Finansal işlemler listelenirken (RPC) hata: {e}", exc_info=True)
            raise Exception("Finansal işlemler listelenemedi.")

    def add_transaction(self, sirket_id: int, kullanici_id: int, data: dict):
        """Yeni bir finansal işlem ekler."""
        try:
            islem_tipi = data.get('islem_tipi')
            tedarikci_id = data.get('tedarikci_id')
            tutar = data.get('tutar')

            if not all([islem_tipi, tedarikci_id, tutar]):
                raise ValueError("Lütfen tüm zorunlu alanları doldurun.")

            # --- GÜNCELLEME: Geçerli tipler listesine Tahsilat eklendi ---
            gecerli_tipler = [tip.value for tip in FinansIslemTipi] # Artık Tahsilat'ı da içeriyor
            if islem_tipi not in gecerli_tipler:
                raise ValueError("Geçersiz işlem tipi.")
            # --- GÜNCELLEME SONU ---

            tutar_decimal = Decimal(tutar)
            if tutar_decimal <= 0:
                raise ValueError("Tutar pozitif bir değer olmalıdır.")

            yeni_islem = {
                "sirket_id": sirket_id,
                "tedarikci_id": tedarikci_id,
                "kullanici_id": kullanici_id,
                "islem_tipi": islem_tipi,
                "tutar": str(tutar_decimal),
                # YENİ: Açıklama sanitize ediliyor
                "aciklama": sanitize_input(data.get('aciklama')) or None,
                "islem_tarihi": data.get('islem_tarihi') or None
            }
            if not yeni_islem["islem_tarihi"]:
                # Tarih girilmediyse, Supabase'in otomatik now() kullanmasını sağla
                del yeni_islem["islem_tarihi"]

            g.supabase.table('finansal_islemler').insert(yeni_islem).execute()
            # Başarı mesajını işlem tipine göre özelleştirelim
            mesaj = f"{islem_tipi} işlemi başarıyla kaydedildi."
            return mesaj
        except (InvalidOperation, TypeError):
            raise ValueError("Lütfen tutar için geçerli bir sayı girin.")
        except ValueError as ve:
            raise ve # Kendi fırlattığımız ValueError'ları tekrar fırlat
        except Exception as e:
            logger.error(f"Finansal işlem eklenirken hata oluştu: {e}", exc_info=True)
            raise Exception("İşlem sırasında bir sunucu hatası oluştu.")

    def update_transaction(self, islem_id: int, sirket_id: int, data: dict):
        """Bir finansal işlemi günceller."""
        try:
            # Güncellenecek işlemi bul ve tipini kontrol et (belki tip değiştirilemez?)
            mevcut_islem = g.supabase.table('finansal_islemler').select('islem_tipi') \
                .eq('id', islem_id).eq('sirket_id', sirket_id).single().execute()
            if not mevcut_islem.data:
                raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")

            guncellenecek_veri = {}
            if 'tutar' in data:
                tutar_decimal = Decimal(data['tutar'])
                if tutar_decimal <= 0:
                    raise ValueError("Tutar pozitif olmalıdır.")
                guncellenecek_veri['tutar'] = str(tutar_decimal)

            if 'aciklama' in data:
                # YENİ: Açıklama sanitize ediliyor
                guncellenecek_veri['aciklama'] = sanitize_input(data.get('aciklama')) or None


            if not guncellenecek_veri:
                raise ValueError("Güncellenecek veri bulunamadı.")

            response = g.supabase.table('finansal_islemler').update(guncellenecek_veri) \
                .eq('id', islem_id).eq('sirket_id', sirket_id).execute()

            # response.data güncelleme sonrası genellikle boş döner, hata olup olmadığını kontrol etmek yeterli.
            # if not response.data: # Bu kontrol yanıltıcı olabilir, kaldıralım.
            #     raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")

        except (InvalidOperation, TypeError):
            raise ValueError("Geçerli bir tutar girin.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Finansal işlem güncellenirken hata oluştu: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")

    def delete_transaction(self, islem_id: int, sirket_id: int):
        """Bir finansal işlemi siler."""
        try:
            response = g.supabase.table('finansal_islemler').delete() \
                .eq('id', islem_id).eq('sirket_id', sirket_id).execute()

            # Silme işlemi sonrası response.data genellikle silinen kaydı içerir.
            # Eğer boşsa veya hata varsa, silinecek kayıt bulunamamıştır.
            if not response.data:
                raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Finansal işlem silinirken hata oluştu: {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")

finans_service = FinansService()