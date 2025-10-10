# services/yem_service.py

import logging
from extensions import supabase
from decimal import Decimal, InvalidOperation

logger = logging.getLogger(__name__)

class YemService:
    """Yem ürünleri ve işlemleri için servis katmanı."""

    # --- YEM ÜRÜNLERİ CRUD İŞLEMLERİ ---

    def get_paginated_products(self, sirket_id: int, sayfa: int, limit: int = 10):
        """Yem ürünlerini sayfalayarak listeler."""
        try:
            offset = (sayfa - 1) * limit
            query = supabase.table('yem_urunleri').select(
                '*', count='exact'
            ).eq('sirket_id', sirket_id).order('yem_adi').range(offset, offset + limit - 1)
            response = query.execute()
            return response.data, response.count
        except Exception as e:
            logger.error(f"Hata (get_paginated_products): {e}", exc_info=True)
            raise Exception("Ürünler listelenirken bir hata oluştu.")

    def get_all_products_for_dropdown(self, sirket_id: int):
        """Dropdown menüler için tüm yem ürünlerini listeler."""
        try:
            response = supabase.table('yem_urunleri').select(
                'id, yem_adi, stok_miktari_kg'
            ).eq('sirket_id', sirket_id).order('yem_adi').execute()
            return response.data
        except Exception as e:
            logger.error(f"Hata (get_all_products_for_dropdown): {e}", exc_info=True)
            raise Exception("Ürün listesi alınamadı.")

    def add_product(self, sirket_id: int, data: dict):
        """Yeni bir yem ürünü ekler."""
        try:
            yeni_urun = {
                "sirket_id": sirket_id,
                "yem_adi": data.get('yem_adi'),
                "stok_miktari_kg": str(Decimal(data.get('stok_miktari_kg'))),
                "birim_fiyat": str(Decimal(data.get('birim_fiyat')))
            }
            response = supabase.table('yem_urunleri').insert(yeni_urun).select().execute()
            return response.data[0]
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError("Lütfen stok ve fiyat için geçerli sayılar girin.")
        except Exception as e:
            logger.error(f"Hata (add_product): {e}", exc_info=True)
            raise Exception("Ürün eklenirken bir sunucu hatası oluştu.")

    def update_product(self, id: int, sirket_id: int, data: dict):
        """Bir yem ürününü günceller."""
        try:
            guncel_veri = {
                "yem_adi": data.get('yem_adi'),
                "stok_miktari_kg": str(Decimal(data.get('stok_miktari_kg'))),
                "birim_fiyat": str(Decimal(data.get('birim_fiyat')))
            }
            response = supabase.table('yem_urunleri').update(guncel_veri).eq('id', id).eq('sirket_id', sirket_id).select().execute()
            if not response.data:
                raise ValueError("Ürün bulunamadı veya bu işlem için yetkiniz yok.")
            return response.data[0]
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError("Lütfen stok ve fiyat için geçerli sayılar girin.")
        except Exception as e:
            logger.error(f"Hata (update_product): {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")

    def delete_product(self, id: int, sirket_id: int):
        """Bir yem ürününü siler."""
        try:
            response = supabase.table('yem_urunleri').delete().eq('id', id).eq('sirket_id', sirket_id).execute()
            if not response.data:
                raise ValueError("Ürün bulunamadı veya bu işlem için yetkiniz yok.")
        except Exception as e:
            if 'violates foreign key constraint' in str(e).lower():
                raise ValueError("Bu yeme ait çıkış işlemleri olduğu için silinemiyor.")
            logger.error(f"Hata (delete_product): {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")

    # --- YEM ÇIKIŞ İŞLEMLERİ ---

    def get_paginated_transactions(self, sirket_id: int, sayfa: int, limit: int = 5):
        """Yem çıkış işlemlerini sayfalayarak listeler."""
        try:
            offset = (sayfa - 1) * limit
            query = supabase.table('yem_islemleri').select(
                '*, tedarikciler(isim), yem_urunleri(yem_adi)', count='exact'
            ).eq('sirket_id', sirket_id).order('islem_tarihi', desc=True).range(offset, offset + limit - 1)
            response = query.execute()
            return response.data, response.count
        except Exception as e:
            logger.error(f"Hata (get_paginated_transactions): {e}", exc_info=True)
            raise Exception("Yem işlemleri listelenemedi.")

    def add_transaction(self, sirket_id: int, kullanici_id: int, data: dict):
        """Yeni bir yem çıkış işlemi yapar ve stoğu günceller."""
        try:
            miktar_kg = Decimal(data.get('miktar_kg'))
            if miktar_kg <= 0:
                raise ValueError("Miktar pozitif bir değer olmalıdır.")

            urun_res = supabase.table('yem_urunleri').select('stok_miktari_kg, birim_fiyat').eq('id', data.get('yem_urun_id')).eq('sirket_id', sirket_id).single().execute()
            if not urun_res.data:
                raise ValueError("Yem ürünü bulunamadı.")
            
            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            if mevcut_stok < miktar_kg:
                raise ValueError(f"Yetersiz stok! Mevcut stok: {mevcut_stok} kg")

            birim_fiyat = Decimal(urun_res.data['birim_fiyat'])
            toplam_tutar = miktar_kg * birim_fiyat

            yeni_islem = {
                "sirket_id": sirket_id, "tedarikci_id": data.get('tedarikci_id'),
                "yem_urun_id": data.get('yem_urun_id'), "kullanici_id": kullanici_id,
                "miktar_kg": str(miktar_kg),
                "islem_anindaki_birim_fiyat": str(birim_fiyat),
                "toplam_tutar": str(toplam_tutar),
                "aciklama": data.get('aciklama')
            }
            supabase.table('yem_islemleri').insert(yeni_islem).execute()

            yeni_stok = mevcut_stok - miktar_kg
            supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}).eq('id', data.get('yem_urun_id')).execute()
        except (InvalidOperation, TypeError):
            raise ValueError("Lütfen miktar için geçerli bir sayı girin.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Hata (add_transaction): {e}", exc_info=True)
            raise Exception("İşlem sırasında bir hata oluştu.")
            
    def delete_transaction(self, id: int, sirket_id: int):
        """Bir yem çıkış işlemini siler ve stoğu iade eder."""
        try:
            islem_res = supabase.table('yem_islemleri').select('yem_urun_id, miktar_kg').eq('id', id).eq('sirket_id', sirket_id).single().execute()
            if not islem_res.data:
                raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")

            iade_edilecek_miktar = Decimal(islem_res.data['miktar_kg'])
            urun_id = islem_res.data['yem_urun_id']

            urun_res = supabase.table('yem_urunleri').select('stok_miktari_kg').eq('id', urun_id).single().execute()
            if not urun_res.data:
                raise ValueError("Stoğu güncellenecek ürün bulunamadı.")
            
            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            yeni_stok = mevcut_stok + iade_edilecek_miktar

            supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}).eq('id', urun_id).execute()
            supabase.table('yem_islemleri').delete().eq('id', id).execute()
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Hata (delete_transaction): {e}", exc_info=True)
            raise Exception("İşlem iptal edilirken bir sunucu hatası oluştu.")
            
    def update_transaction(self, id: int, sirket_id: int, data: dict):
        """Bir yem çıkış işlemini günceller ve stok farkını ayarlar."""
        try:
            yeni_miktar = Decimal(data.get('yeni_miktar_kg'))
            if yeni_miktar <= 0:
                raise ValueError("Miktar pozitif bir değer olmalıdır.")

            mevcut_islem_res = supabase.table('yem_islemleri').select('miktar_kg, yem_urun_id, islem_anindaki_birim_fiyat').eq('id', id).eq('sirket_id', sirket_id).single().execute()
            if not mevcut_islem_res.data:
                raise ValueError("Güncellenecek işlem bulunamadı.")

            eski_miktar = Decimal(mevcut_islem_res.data['miktar_kg'])
            urun_id = mevcut_islem_res.data['yem_urun_id']
            birim_fiyat = Decimal(mevcut_islem_res.data['islem_anindaki_birim_fiyat'])
            
            fark = yeni_miktar - eski_miktar

            urun_res = supabase.table('yem_urunleri').select('stok_miktari_kg').eq('id', urun_id).single().execute()
            if not urun_res.data:
                raise ValueError("Ürün stoğu bulunamadı.")
            
            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            if fark > 0 and mevcut_stok < fark:
                raise ValueError(f"Yetersiz stok! Sadece {mevcut_stok} kg daha çıkış yapabilirsiniz.")

            yeni_stok = mevcut_stok - fark
            yeni_toplam_tutar = yeni_miktar * birim_fiyat

            supabase.table('yem_urunleri').update({'stok_miktari_kg': str(yeni_stok)}).eq('id', urun_id).execute()
            
            guncellenecek_islem = {'miktar_kg': str(yeni_miktar), 'toplam_tutar': str(yeni_toplam_tutar)}
            if 'aciklama' in data:
                guncellenecek_islem['aciklama'] = data.get('aciklama')
            supabase.table('yem_islemleri').update(guncellenecek_islem).eq('id', id).execute()
        except (InvalidOperation, TypeError):
            raise ValueError("Lütfen geçerli bir miktar girin.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Hata (update_transaction): {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")


# Servis'ten bir örnek (instance) oluşturalım.
yem_service = YemService()