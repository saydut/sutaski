# services/finans_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation
from constants import FinansIslemTipi

logger = logging.getLogger(__name__)

class FinansService:
    """Finansal işlemler için servis katmanı."""

    def get_paginated_transactions(self, sirket_id: int, sayfa: int, limit: int = 15):
        """Finansal işlemleri sayfalayarak listeler."""
        try:
            offset = (sayfa - 1) * limit
            query = g.supabase.table('finansal_islemler').select(
                '*, tedarikciler(isim)', count='exact'
            ).eq('sirket_id', sirket_id).order('islem_tarihi', desc=True).range(offset, offset + limit - 1)
            response = query.execute()
            return response.data, response.count
        except Exception as e:
            logger.error(f"Finansal işlemler listelenirken hata oluştu: {e}", exc_info=True)
            raise Exception("İşlemler listelenirken bir sunucu hatası oluştu.")

    def add_transaction(self, sirket_id: int, kullanici_id: int, data: dict):
        """Yeni bir finansal işlem ekler."""
        try:
            islem_tipi = data.get('islem_tipi')
            tedarikci_id = data.get('tedarikci_id')
            tutar = data.get('tutar')
            
            if not all([islem_tipi, tedarikci_id, tutar]):
                raise ValueError("Lütfen tüm zorunlu alanları doldurun.")
            
            gecerli_tipler = [tip.value for tip in FinansIslemTipi]
            if islem_tipi not in gecerli_tipler:
                raise ValueError("Geçersiz işlem tipi.")

            tutar_decimal = Decimal(tutar)
            if tutar_decimal <= 0:
                raise ValueError("Tutar pozitif bir değer olmalıdır.")

            yeni_islem = {
                "sirket_id": sirket_id,
                "tedarikci_id": tedarikci_id,
                "kullanici_id": kullanici_id,
                "islem_tipi": islem_tipi,
                "tutar": str(tutar_decimal),
                "aciklama": data.get('aciklama') or None,
                "islem_tarihi": data.get('islem_tarihi') or None
            }
            if not yeni_islem["islem_tarihi"]:
                del yeni_islem["islem_tarihi"]

            g.supabase.table('finansal_islemler').insert(yeni_islem).execute()
            return f"{islem_tipi} işlemi başarıyla kaydedildi."
        except (InvalidOperation, TypeError):
            raise ValueError("Lütfen tutar için geçerli bir sayı girin.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Finansal işlem eklenirken hata oluştu: {e}", exc_info=True)
            raise Exception("İşlem sırasında bir sunucu hatası oluştu.")

    def update_transaction(self, islem_id: int, sirket_id: int, data: dict):
        """Bir finansal işlemi günceller."""
        try:
            guncellenecek_veri = {}
            if 'tutar' in data:
                tutar_decimal = Decimal(data['tutar'])
                if tutar_decimal <= 0:
                    raise ValueError("Tutar pozitif olmalıdır.")
                guncellenecek_veri['tutar'] = str(tutar_decimal)
            
            if 'aciklama' in data:
                guncellenecek_veri['aciklama'] = data['aciklama'].strip() or None

            if not guncellenecek_veri:
                raise ValueError("Güncellenecek veri bulunamadı.")

            response = g.supabase.table('finansal_islemler').update(guncellenecek_veri).eq('id', islem_id).eq('sirket_id', sirket_id).execute()
            if not response.data:
                raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")
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
            response = g.supabase.table('finansal_islemler').delete().eq('id', islem_id).eq('sirket_id', sirket_id).execute()
            if not response.data:
                raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Finansal işlem silinirken hata oluştu: {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")

finans_service = FinansService()
