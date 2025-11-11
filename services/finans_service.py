# services/finans_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation
from constants import FinansIslemTipi  # UserRole'e gerek kalmadı
from utils import sanitize_input
from extensions import supabase_client # g.supabase yerine bunu kullanacağız

logger = logging.getLogger(__name__)

class FinansService:
    """Finansal işlemler için servis katmanı. RLS ile güncellendi."""

    def get_paginated_transactions(self, sayfa: int, limit: int = 5, tarih_str: str = None, tip: str = None):
        """
        Finansal işlemleri RLS ve RPC kullanarak sayfalayarak listeler.
        Gerekli ID ve rol bilgilerini 'g' objesinden alır.
        """
        try:
            offset = (sayfa - 1) * limit
            
            # 1. Parametreleri 'g' objesinden al
            sirket_id = g.profile['sirket_id']
            kullanici_id_uuid = g.user.id  # Artık UUID
            rol = g.profile['rol']
            
            # 2. RPC'yi çağırmak için parametreleri hazırla
            params = {
                'p_sirket_id': sirket_id,
                'p_kullanici_id': kullanici_id_uuid, # UUID olarak gönder
                'p_rol': rol,
                'p_tarih_str': tarih_str,
                'p_tip': tip,
                'p_limit': limit,
                'p_offset': offset
            }
            
            # 3. g.supabase -> supabase_client
            # SQL RPC'nizin 'kullanicilar' yerine 'profiller' tablosuna join yaptığından emin olun!
            response = supabase_client.rpc('get_paginated_finansal_islemleri', params).execute()

            if not response.data:
                logger.warning(f"get_paginated_finansal_islemleri RPC'si veri döndürmedi. Parametreler: {params}")
                return [], 0

            # RPC'den gelen JSON'ı ayrıştır
            result_data = response.data[0] # RPC genelde [data] döner
            islemler = result_data.get('data', [])
            toplam_kayit = result_data.get('count', 0)

            # Frontend'in beklediği formata çevir (kullanicilar -> profiller)
            for islem in islemler:
                if 'tedarikci_isim' in islem:
                    islem['tedarikciler'] = {'isim': islem['tedarikci_isim']}
                
                # RPC join'i 'kullanicilar' ise 'profiller' olarak düzelt
                if 'kullanicilar' in islem:
                    islem['profiller'] = islem.pop('kullanicilar')
                elif 'kullanici_adi' in islem and 'profiller' not in islem:
                     islem['profiller'] = {'kullanici_adi': islem['kullanici_adi']}


            return islemler, toplam_kayit
            
        except Exception as e:
            logger.error(f"Finansal işlemler listelenirken (RPC) hata: {e}", exc_info=True)
            raise Exception("Finansal işlemler listelenemedi.")

    def add_transaction(self, data: dict):
        """Yeni bir finansal işlem ekler. ID'leri 'g' objesinden alır."""
        try:
            # 1. Gerekli ID'leri 'g' objesinden al
            sirket_id = g.profile['sirket_id']
            kullanici_id_uuid = g.user.id # Artık UUID

            # 2. Verileri al
            islem_tipi = data.get('islem_tipi')
            tedarikci_id = data.get('tedarikci_id')
            tutar = data.get('tutar')

            if not all([islem_tipi, tutar]):
                raise ValueError("Lütfen işlem tipi ve tutar alanlarını doldurun.")
            
            # Tedarikçi ID'si sadece 'odeme' ve 'tahsilat' için zorunlu olabilir
            if islem_tipi in [FinansIslemTipi.ODEME.value, FinansIslemTipi.TAHSILAT.value] and not tedarikci_id:
                 raise ValueError("Ödeme/Tahsilat işlemleri için tedarikçi seçimi zorunludur.")

            gecerli_tipler = [tip.value for tip in FinansIslemTipi]
            if islem_tipi not in gecerli_tipler:
                raise ValueError("Geçersiz işlem tipi.")

            tutar_decimal = Decimal(tutar)
            if tutar_decimal <= 0:
                raise ValueError("Tutar pozitif bir değer olmalıdır.")

            # 3. Yeni işlem verisini oluştur
            yeni_islem = {
                "sirket_id": sirket_id,           # RLS 'WITH CHECK' için
                "tedarikci_id": tedarikci_id or None,
                "kullanici_id": kullanici_id_uuid,  # Yeni UUID
                "islem_tipi": islem_tipi,
                "tutar": str(tutar_decimal),
                "aciklama": sanitize_input(data.get('aciklama')) or None,
                "islem_tarihi": data.get('islem_tarihi') or None
            }
            if not yeni_islem["islem_tarihi"]:
                del yeni_islem["islem_tarihi"] # Supabase'in now() kullanmasını sağla

            # 4. g.supabase -> supabase_client
            supabase_client.table('finansal_islemler').insert(yeni_islem).execute()
            
            mesaj = f"{islem_tipi} işlemi başarıyla kaydedildi."
            return mesaj, None
        except (InvalidOperation, TypeError):
            return None, "Lütfen tutar için geçerli bir sayı girin."
        except ValueError as ve:
            return None, str(ve) # Hata mesajını döndür
        except Exception as e:
            logger.error(f"Finansal işlem eklenirken hata oluştu: {e}", exc_info=True)
            return None, "İşlem sırasında bir sunucu hatası oluştu."

    def update_transaction(self, islem_id: int, data: dict):
        """Bir finansal işlemi günceller. RLS, yetkiyi kontrol eder."""
        try:
            # sirket_id parametresi KALDIRILDI
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            mevcut_islem = supabase_client.table('finansal_islemler').select('islem_tipi') \
                .eq('id', islem_id).single().execute()
            
            if not mevcut_islem.data:
                raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")

            guncellenecek_veri = {}
            if 'tutar' in data:
                tutar_decimal = Decimal(data['tutar'])
                if tutar_decimal <= 0:
                    raise ValueError("Tutar pozitif olmalıdır.")
                guncellenecek_veri['tutar'] = str(tutar_decimal)

            if 'aciklama' in data:
                guncellenecek_veri['aciklama'] = sanitize_input(data.get('aciklama')) or None

            if not guncellenecek_veri:
                raise ValueError("Güncellenecek veri bulunamadı.")

            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            supabase_client.table('finansal_islemler').update(guncellenecek_veri) \
                .eq('id', islem_id).execute()
            
            return True, None

        except (InvalidOperation, TypeError):
            return None, "Geçerli bir tutar girin."
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Finansal işlem güncellenirken hata oluştu: {e}", exc_info=True)
            return None, "Güncelleme sırasında bir sunucu hatası oluştu."

    def delete_transaction(self, islem_id: int):
        """Bir finansal işlemi RLS kullanarak siler."""
        try:
            # sirket_id parametresi KALDIRILDI
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('finansal_islemler').delete() \
                .eq('id', islem_id).execute()

            if not response.data:
                raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")
            
            return True, None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Finansal işlem silinirken hata oluştu: {e}", exc_info=True)
            return None, "Silme işlemi sırasında bir hata oluştu."

finans_service = FinansService()