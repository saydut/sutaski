# services/yem_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation, DivisionByZero

logger = logging.getLogger(__name__)

class YemService:
    """Yem ürünleri ve işlemleri için servis katmanı."""

    def get_paginated_products(self, sirket_id: int, sayfa: int, limit: int = 10):
        """Yem ürünlerini sayfalayarak listeler."""
        try:
            offset = (sayfa - 1) * limit
            query = g.supabase.table('yem_urunleri').select('*, cuval_agirligi_kg, cuval_fiyati', count='exact').eq('sirket_id', sirket_id).order('yem_adi').range(offset, offset + limit - 1)
            response = query.execute()
            return response.data, response.count
        except Exception as e:
            logger.error(f"Yem ürünleri listelenirken hata oluştu: {e}", exc_info=True)
            raise Exception("Ürünler listelenirken bir hata oluştu.")

    def get_all_products_for_dropdown(self, sirket_id: int):
        """Dropdown menüler için tüm yem ürünlerini listeler."""
        try:
            response = g.supabase.table('yem_urunleri').select('id, yem_adi, stok_miktari_kg, birim_fiyat, cuval_agirligi_kg, cuval_fiyati').eq('sirket_id', sirket_id).order('yem_adi').execute()
            return response.data
        except Exception as e:
            logger.error(f"Dropdown için yem ürünleri listesi alınırken hata: {e}", exc_info=True)
            raise Exception("Ürün listesi alınamadı.")

    def _prepare_product_data(self, sirket_id: int, data: dict):
        """Gelen veriye göre yem ürünü verisini hazırlar."""
        fiyatlandirma_tipi = data.get('fiyatlandirma_tipi')
        yem_adi = data.get('yem_adi')
        
        if not yem_adi:
            raise ValueError("Yem adı zorunludur.")

        urun_verisi = { "sirket_id": sirket_id, "yem_adi": yem_adi, "cuval_agirligi_kg": None, "cuval_fiyati": None }

        if fiyatlandirma_tipi == 'cuval':
            cuval_fiyati = Decimal(data.get('cuval_fiyati', '0'))
            cuval_agirligi_kg = Decimal(data.get('cuval_agirligi_kg', '0'))
            stok_adedi = Decimal(data.get('stok_adedi', '0'))

            if cuval_fiyati <= 0 or cuval_agirligi_kg <= 0 or stok_adedi < 0:
                raise ValueError("Çuval fiyatı, ağırlığı ve stok adedi pozitif değerler olmalıdır.")
            
            urun_verisi["birim_fiyat"] = str(cuval_fiyati / cuval_agirligi_kg)
            urun_verisi["stok_miktari_kg"] = str(stok_adedi * cuval_agirligi_kg)
            urun_verisi["cuval_fiyati"] = str(cuval_fiyati)
            urun_verisi["cuval_agirligi_kg"] = str(cuval_agirligi_kg)
        else:
            birim_fiyat = Decimal(data.get('birim_fiyat', '0'))
            stok_miktari_kg = Decimal(data.get('stok_miktari_kg', '0'))

            if birim_fiyat <= 0 or stok_miktari_kg < 0:
                raise ValueError("Birim fiyat ve stok pozitif değerler olmalıdır.")
            urun_verisi["birim_fiyat"] = str(birim_fiyat)
            urun_verisi["stok_miktari_kg"] = str(stok_miktari_kg)
        
        return urun_verisi

    def add_product(self, sirket_id: int, data: dict):
        """Yeni bir yem ürünü ekler."""
        try:
            yeni_urun = self._prepare_product_data(sirket_id, data)
            response = g.supabase.table('yem_urunleri').insert(yeni_urun).execute()
            return response.data[0]
        except (InvalidOperation, TypeError, DivisionByZero):
            raise ValueError("Lütfen tüm fiyat ve ağırlık alanlarına geçerli sayılar girin.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem ürünü eklenirken hata: {e}", exc_info=True)
            raise Exception("Ürün eklenirken bir sunucu hatası oluştu.")

    def update_product(self, id: int, sirket_id: int, data: dict):
        """Bir yem ürününü günceller."""
        try:
            guncel_veri = self._prepare_product_data(sirket_id, data)
            del guncel_veri['sirket_id']
            
            response = g.supabase.table('yem_urunleri').update(guncel_veri).eq('id', id).eq('sirket_id', sirket_id).select().execute()
            if not response.data:
                raise ValueError("Ürün bulunamadı veya bu işlem için yetkiniz yok.")
            return response.data[0]
        except (InvalidOperation, TypeError, DivisionByZero):
            raise ValueError("Lütfen tüm fiyat ve ağırlık alanlarına geçerli sayılar girin.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem ürünü güncellenirken hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")

    def delete_product(self, id: int, sirket_id: int):
        """Bir yem ürününü siler."""
        try:
            response = g.supabase.table('yem_urunleri').delete().eq('id', id).eq('sirket_id', sirket_id).execute()
            if not response.data:
                raise ValueError("Ürün bulunamadı veya bu işlem için yetkiniz yok.")
        except Exception as e:
            if 'violates foreign key constraint' in str(e).lower():
                raise ValueError("Bu yeme ait çıkış işlemleri olduğu için silinemiyor.")
            logger.error(f"Yem ürünü silinirken hata: {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")

    def get_paginated_transactions(self, sirket_id: int, sayfa: int, limit: int = 5):
        """Yem çıkış işlemlerini sayfalayarak listeler."""
        try:
            offset = (sayfa - 1) * limit
            query = g.supabase.table('yem_islemleri').select('*, tedarikciler(isim), yem_urunleri(yem_adi)', count='exact').eq('sirket_id', sirket_id).order('islem_tarihi', desc=True).range(offset, offset + limit - 1)
            response = query.execute()
            return response.data, response.count
        except Exception as e:
            logger.error(f"Yem işlemleri listelenirken hata: {e}", exc_info=True)
            raise Exception("Yem işlemleri listelenemedi.")

    def add_transaction(self, sirket_id: int, kullanici_id: int, data: dict):
        """Yeni bir yem çıkış işlemi yapar ve stoğu günceller."""
        try:
            miktar_kg = Decimal(data.get('miktar_kg'))
            if miktar_kg <= 0:
                raise ValueError("Miktar pozitif bir değer olmalıdır.")

            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg, birim_fiyat').eq('id', data.get('yem_urun_id')).eq('sirket_id', sirket_id).single().execute()
            if not urun_res.data:
                raise ValueError("Yem ürünü bulunamadı.")
            
            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            if mevcut_stok < miktar_kg:
                raise ValueError(f"Yetersiz stok! Mevcut stok: {mevcut_stok} kg")

            birim_fiyat = Decimal(urun_res.data['birim_fiyat'])
            toplam_tutar = miktar_kg * birim_fiyat

            yeni_islem = { "sirket_id": sirket_id, "tedarikci_id": data.get('tedarikci_id'), "yem_urun_id": data.get('yem_urun_id'), "kullanici_id": kullanici_id, "miktar_kg": str(miktar_kg), "islem_anindaki_birim_fiyat": str(birim_fiyat), "toplam_tutar": str(toplam_tutar), "aciklama": data.get('aciklama') }
            g.supabase.table('yem_islemleri').insert(yeni_islem).execute()

            yeni_stok = mevcut_stok - miktar_kg
            g.supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}).eq('id', data.get('yem_urun_id')).execute()
        except (InvalidOperation, TypeError):
            raise ValueError("Lütfen miktar için geçerli bir sayı girin.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi eklenirken hata: {e}", exc_info=True)
            raise Exception("İşlem sırasında bir hata oluştu.")
            
    def delete_transaction(self, id: int, sirket_id: int):
        """Bir yem çıkış işlemini siler ve stoğu iade eder."""
        try:
            islem_res = g.supabase.table('yem_islemleri').select('yem_urun_id, miktar_kg').eq('id', id).eq('sirket_id', sirket_id).single().execute()
            if not islem_res.data:
                raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")

            iade_edilecek_miktar = Decimal(islem_res.data['miktar_kg'])
            urun_id = islem_res.data['yem_urun_id']

            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg').eq('id', urun_id).single().execute()
            if not urun_res.data:
                raise ValueError("Stoğu güncellenecek ürün bulunamadı.")
            
            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            yeni_stok = mevcut_stok + iade_edilecek_miktar

            g.supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}).eq('id', urun_id).execute()
            g.supabase.table('yem_islemleri').delete().eq('id', id).execute()
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi silinirken hata: {e}", exc_info=True)
            raise Exception("İşlem iptal edilirken bir sunucu hatası oluştu.")
            
    def update_transaction(self, id: int, sirket_id: int, data: dict):
        """Bir yem çıkış işlemini günceller ve stok farkını ayarlar."""
        try:
            yeni_miktar = Decimal(data.get('yeni_miktar_kg'))
            if yeni_miktar <= 0:
                raise ValueError("Miktar pozitif bir değer olmalıdır.")

            mevcut_islem_res = g.supabase.table('yem_islemleri').select('miktar_kg, yem_urun_id, islem_anindaki_birim_fiyat').eq('id', id).eq('sirket_id', sirket_id).single().execute()
            if not mevcut_islem_res.data:
                raise ValueError("Güncellenecek işlem bulunamadı.")

            eski_miktar = Decimal(mevcut_islem_res.data['miktar_kg'])
            urun_id = mevcut_islem_res.data['yem_urun_id']
            birim_fiyat = Decimal(mevcut_islem_res.data['islem_anindaki_birim_fiyat'])
            fark = yeni_miktar - eski_miktar

            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg').eq('id', urun_id).single().execute()
            if not urun_res.data:
                raise ValueError("Ürün stoğu bulunamadı.")
            
            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            if fark > 0 and mevcut_stok < fark:
                raise ValueError(f"Yetersiz stok! Sadece {mevcut_stok} kg daha çıkış yapabilirsiniz.")

            yeni_stok = mevcut_stok - fark
            yeni_toplam_tutar = yeni_miktar * birim_fiyat

            g.supabase.table('yem_urunleri').update({'stok_miktari_kg': str(yeni_stok)}).eq('id', urun_id).execute()
            
            guncellenecek_islem = {'miktar_kg': str(yeni_miktar), 'toplam_tutar': str(yeni_toplam_tutar)}
            if 'aciklama' in data:
                guncellenecek_islem['aciklama'] = data.get('aciklama')
            g.supabase.table('yem_islemleri').update(guncellenecek_islem).eq('id', id).execute()
        except (InvalidOperation, TypeError):
            raise ValueError("Lütfen geçerli bir miktar girin.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi güncellenirken hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")

yem_service = YemService()
