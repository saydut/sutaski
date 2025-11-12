# services/yem_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation, DivisionByZero
from constants import UserRole
from utils import sanitize_input

logger = logging.getLogger(__name__)

class YemService:
    """Yem ürünleri ve işlemleri için servis katmanı."""

    def get_paginated_products(self, sirket_id: int, sayfa: int, limit: int = 10):
        """Yem ürünlerini sayfalayarak listeler."""
        try:
            offset = (sayfa - 1) * limit
            # GÜNCELLEME: Yeni satis_fiyati ve satis_cuval_fiyati sütunlarını da seç
            query = g.supabase.table('yem_urunleri').select(
                '*, cuval_agirligi_kg, cuval_fiyati, satis_fiyati, satis_cuval_fiyati', 
                count='exact'
            ).eq('sirket_id', sirket_id).order('yem_adi').range(offset, offset + limit - 1)
            response = query.execute()
            return response.data, response.count
        except Exception as e:
            logger.error(f"Yem ürünleri listelenirken hata oluştu: {e}", exc_info=True)
            raise Exception("Ürünler listelenirken bir hata oluştu.")

    def get_all_products_for_dropdown(self, sirket_id: int):
        """Dropdown menüler için tüm yem ürünlerini listeler."""
        try:
            # GÜNCELLEME: Sadece alış fiyatları değil, satış fiyatları da lazım
            response = g.supabase.table('yem_urunleri').select(
                'id, yem_adi, stok_miktari_kg, birim_fiyat, cuval_agirligi_kg, cuval_fiyati, satis_fiyati, satis_cuval_fiyati'
            ).eq('sirket_id', sirket_id).order('yem_adi').execute()
            return response.data
        except Exception as e:
            logger.error(f"Dropdown için yem ürünleri listesi alınırken hata: {e}", exc_info=True)
            raise Exception("Ürün listesi alınamadı.")

    def _prepare_product_data(self, sirket_id: int, data: dict):
        """Gelen veriye göre yem ürünü verisini hazırlar. (Önceki mesajdaki güncel hali)"""
        fiyatlandirma_tipi = data.get('fiyatlandirma_tipi')
        yem_adi = sanitize_input(data.get('yem_adi'))

        if not yem_adi:
            raise ValueError("Yem adı zorunludur.")

        urun_verisi = {
            "sirket_id": sirket_id,
            "yem_adi": yem_adi,
            "cuval_agirligi_kg": None,
            "cuval_fiyati": None,       # Alış Çuval Fiyatı
            "birim_fiyat": None,        # Alış KG Fiyatı (Hesaplanmış veya Girilmiş)
            "satis_cuval_fiyati": None, # Satış Çuval Fiyatı
            "satis_fiyati": None,       # Satış KG Fiyatı (Hesaplanmış veya Girilmiş)
            "stok_miktari_kg": None
         }

        try:
            if fiyatlandirma_tipi == 'cuval':
                cuval_fiyati = Decimal(data.get('cuval_fiyati') or '0')
                cuval_agirligi_kg = Decimal(data.get('cuval_agirligi_kg') or '0')
                stok_adedi = Decimal(data.get('stok_adedi') or data.get('stok_miktari_kg') or '0')
                satis_cuval_fiyati = Decimal(data.get('satis_cuval_fiyati') or '0')

                if cuval_fiyati <= 0 or cuval_agirligi_kg <= 0 or stok_adedi < 0 or satis_cuval_fiyati <= 0:
                    raise ValueError("Tüm çuval fiyatları, ağırlık ve stok pozitif değerler olmalıdır.")

                urun_verisi["birim_fiyat"] = str(cuval_fiyati / cuval_agirligi_kg)
                urun_verisi["satis_fiyati"] = str(satis_cuval_fiyati / cuval_agirligi_kg)
                urun_verisi["stok_miktari_kg"] = str(stok_adedi * cuval_agirligi_kg)
                urun_verisi["cuval_fiyati"] = str(cuval_fiyati)
                urun_verisi["cuval_agirligi_kg"] = str(cuval_agirligi_kg)
                urun_verisi["satis_cuval_fiyati"] = str(satis_cuval_fiyati)

            else: # KG fiyatı
                birim_fiyat = Decimal(data.get('birim_fiyat') or '0')
                stok_miktari_kg = Decimal(data.get('stok_miktari_kg') or '0')
                satis_fiyati = Decimal(data.get('satis_fiyati') or '0')

                if birim_fiyat <= 0 or stok_miktari_kg < 0 or satis_fiyati <= 0:
                    raise ValueError("Birim fiyat, satış fiyatı ve stok pozitif değerler olmalıdır.")
                
                urun_verisi["birim_fiyat"] = str(birim_fiyat)
                urun_verisi["satis_fiyati"] = str(satis_fiyati)
                urun_verisi["stok_miktari_kg"] = str(stok_miktari_kg)
                urun_verisi["satis_cuval_fiyati"] = None
                urun_verisi["cuval_fiyati"] = None
                urun_verisi["cuval_agirligi_kg"] = None

            return urun_verisi
            
        except (InvalidOperation, TypeError, DivisionByZero):
            raise ValueError("Lütfen tüm fiyat ve ağırlık alanlarına geçerli sayılar girin.")


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
            if 'sirket_id' in guncel_veri:
                del guncel_veri['sirket_id']

            response = g.supabase.table('yem_urunleri').update(guncel_veri) \
                .eq('id', id).eq('sirket_id', sirket_id).execute()
            
            guncellenen_urun_response = g.supabase.table('yem_urunleri').select() \
                .eq('id', id).eq('sirket_id', sirket_id).single().execute()
            
            if not guncellenen_urun_response.data:
                raise ValueError("Ürün bulunamadı veya bu işlem için yetkiniz yok.")
            return guncellenen_urun_response.data
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
            islem_kontrol = g.supabase.table('yem_islemleri') \
                .select('id', count='exact') \
                .eq('yem_urun_id', id) \
                .eq('sirket_id', sirket_id) \
                .execute()

            if islem_kontrol.count > 0:
                raise ValueError("Bu yeme ait çıkış işlemleri olduğu için silinemiyor.")

            response = g.supabase.table('yem_urunleri').delete().eq('id', id).eq('sirket_id', sirket_id).execute()
            if not response.data:
                 if islem_kontrol.count == 0:
                     raise ValueError("Ürün bulunamadı veya bu işlem için yetkiniz yok.")

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem ürünü silinirken hata: {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")


    def get_paginated_transactions(self, sirket_id: int, kullanici_id: int, rol: str, sayfa: int, limit: int = 5):
        """Yem çıkış işlemlerini sayfalayarak listeler (RPC kullanarak)."""
        try:
            offset = (sayfa - 1) * limit
            
            params = {
                'p_sirket_id': sirket_id,
                'p_kullanici_id': kullanici_id,
                'p_rol': rol,
                'p_limit': limit,
                'p_offset': offset
            }
            
            response = g.supabase.rpc('get_paginated_yem_islemleri', params).execute()

            if not response.data:
                logger.warning(f"get_paginated_yem_islemleri RPC'si veri döndürmedi. Parametreler: {params}")
                return [], 0

            result_data = response.data
            islemler = result_data.get('data', [])
            toplam_kayit = result_data.get('count', 0)

            for islem in islemler:
                if 'tedarikci_isim' in islem:
                    islem['tedarikciler'] = {'isim': islem['tedarikci_isim']}
                if 'yem_adi' in islem:
                    islem['yem_urunleri'] = {'yem_adi': islem['yem_adi']}

            return islemler, toplam_kayit
            
        except Exception as e:
            logger.error(f"Yem işlemleri listelenirken (RPC) hata: {e}", exc_info=True)
            raise Exception("Yem işlemleri listelenemedi.")

    # --- add_transaction FONKSİYONU GÜNCELLENDİ ---
    def add_transaction(self, sirket_id: int, kullanici_id: int, data: dict):
        """Yeni bir yem çıkış işlemi yapar, stoğu günceller VE FİNANS TABLOSUNA GELİR EKLER."""
        try:
            # Gerekli verileri al
            miktar_kg_str = data.get('miktar_kg')
            yem_urun_id = data.get('yem_urun_id')
            tedarikci_id = data.get('tedarikci_id')
            fiyat_tipi = data.get('fiyat_tipi') 
            birim_fiyat_str = data.get('birim_fiyat') # Bu, JS tarafında hesaplanmış TL/KG satış fiyatıdır
            aciklama_str = sanitize_input(data.get('aciklama')) or None

            # Doğrulamalar
            if not all([miktar_kg_str, yem_urun_id, tedarikci_id, fiyat_tipi, birim_fiyat_str]):
                raise ValueError("Eksik bilgi: Tedarikçi, yem, miktar, fiyat tipi ve birim fiyat zorunludur.")
            if fiyat_tipi not in ['pesin', 'vadeli']:
                raise ValueError("Geçersiz fiyat tipi.")
            try:
                miktar_kg = Decimal(miktar_kg_str)
                islem_anindaki_birim_fiyat = Decimal(birim_fiyat_str)
            except (InvalidOperation, TypeError):
                 raise ValueError("Miktar ve Birim Fiyat geçerli bir sayı olmalıdır.")
            if miktar_kg <= 0 or islem_anindaki_birim_fiyat < 0:
                raise ValueError("Miktar pozitif, Birim Fiyat negatif olmayan bir değer olmalıdır.")

            # Stok kontrolü ve Yem Ürünü bilgilerini alma
            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg, yem_adi') \
                .eq('id', yem_urun_id) \
                .eq('sirket_id', sirket_id) \
                .single().execute()
            if not urun_res.data:
                raise ValueError("Yem ürünü bulunamadı.")
            
            yem_adi = urun_res.data['yem_adi']
            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            if mevcut_stok < miktar_kg:
                raise ValueError(f"Yetersiz stok! Mevcut stok: {mevcut_stok} kg")

            # Toplam tutarı (satış tutarı) hesapla
            toplam_tutar = miktar_kg * islem_anindaki_birim_fiyat

            # 1. Yem İşlemini Kaydet
            yeni_islem = {
                "sirket_id": sirket_id,
                "tedarikci_id": tedarikci_id,
                "yem_urun_id": yem_urun_id,
                "kullanici_id": kullanici_id,
                "miktar_kg": str(miktar_kg),
                "fiyat_tipi": fiyat_tipi,
                "islem_anindaki_birim_fiyat": str(islem_anindaki_birim_fiyat),
                "toplam_tutar": str(toplam_tutar),
                "aciklama": aciklama_str
            }
            # Yem işlemini ekle ve ID'sini al
            islem_response = g.supabase.table('yem_islemleri').insert(yeni_islem).execute()
            yeni_islem_id = islem_response.data[0]['id']

            # 2. Stoğu Güncelle
            yeni_stok = mevcut_stok - miktar_kg
            g.supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}) \
                .eq('id', yem_urun_id).execute()

            # 3. FİNANSAL İŞLEMLERE GELİR KAYDI AT (YENİ EKLENDİ)
            # Tedarikçi adını bul (açıklama için)
            tedarikci_res = g.supabase.table('tedarikciler').select('isim').eq('id', tedarikci_id).single().execute()
            tedarikci_adi = tedarikci_res.data['isim'] if tedarikci_res.data else 'Bilinmeyen Tedarikçi'
            
            finans_aciklama = f"{tedarikci_adi} - {yem_adi} Satışı"
            if aciklama_str:
                finans_aciklama += f" ({aciklama_str})"

            yeni_finans_kaydi = {
                "sirket_id": sirket_id,
                "kullanici_id": kullanici_id,
                "tedarikci_id": tedarikci_id,
                "islem_tipi": "Yem Satışı", # Bu, raporda 'gelir' olarak yorumlanacak
                "tutar": str(toplam_tutar),
                "aciklama": finans_aciklama,
                "yem_islem_id": yeni_islem_id # Hangi yem işlemine bağlı olduğunu belirt
            }
            g.supabase.table('finansal_islemler').insert(yeni_finans_kaydi).execute()
            
            return islem_response.data[0] # Orijinal yem işlemini döndür

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi eklenirken hata: {e}", exc_info=True)
            raise Exception("İşlem sırasında bir hata oluştu.")


    def add_yem_girisi(self, sirket_id: int, kullanici_id: int, data: dict):
        """Yeni bir yem GİRİŞ işlemi yapar (Stok Artırır) ve Gider kaydı oluşturur."""
        try:
            # Gerekli verileri al
            miktar_kg_str = data.get('miktar_kg')
            yem_urun_id = data.get('yem_urun_id')
            # Not: Yem alışı tedarikçiden olmak zorunda değil, direkt firmaya giriş
            birim_alis_fiyat_str = data.get('birim_alis_fiyati')
            aciklama_str = sanitize_input(data.get('aciklama')) or None

            # Doğrulamalar
            if not all([miktar_kg_str, yem_urun_id, birim_alis_fiyat_str]):
                raise ValueError("Eksik bilgi: Yem ürünü, miktar ve alış fiyatı zorunludur.")
            try:
                miktar_kg = Decimal(miktar_kg_str)
                islem_anindaki_birim_alis_fiyati = Decimal(birim_alis_fiyat_str)
            except (InvalidOperation, TypeError):
                 raise ValueError("Miktar ve Birim Alış Fiyatı geçerli bir sayı olmalıdır.")
            if miktar_kg <= 0 or islem_anindaki_birim_alis_fiyati <= 0:
                raise ValueError("Miktar ve Birim Alış Fiyatı pozitif değerler olmalıdır.")

            # Stok kontrolü ve Yem Ürünü bilgilerini alma
            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg') \
                .eq('id', yem_urun_id) \
                .eq('sirket_id', sirket_id) \
                .single().execute()
            if not urun_res.data:
                raise ValueError("Yem ürünü bulunamadı.")
            
            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])

            # Toplam tutarı (alış tutarı) hesapla
            toplam_tutar = miktar_kg * islem_anindaki_birim_alis_fiyati

            # 1. Yem Girişini Kaydet
            yeni_giris = {
                "sirket_id": sirket_id,
                "yem_urun_id": yem_urun_id,
                "kullanici_id": kullanici_id,
                "miktar_kg": str(miktar_kg),
                "islem_anindaki_birim_alis_fiyati": str(islem_anindaki_birim_alis_fiyati),
                "toplam_tutar": str(toplam_tutar),
                "aciklama": aciklama_str
            }
            # Yem girişini ekle (Bu, SQL trigger'ını tetikleyecek ve GİDER kaydı oluşacak)
            giris_response = g.supabase.table('yem_girisleri').insert(yeni_giris).execute()

            # 2. Stoğu Güncelle (Artır)
            yeni_stok = mevcut_stok + miktar_kg
            g.supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}) \
                .eq('id', yem_urun_id).execute()
            
            return giris_response.data[0]

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem girişi eklenirken hata: {e}", exc_info=True)
            raise Exception("Stok girişi sırasında bir hata oluştu.")

    def delete_transaction(self, id: int, sirket_id: int):
        """Bir yem çıkış işlemini siler, stoğu iade eder VE FİNANS KAYDINI SİLER."""
        try:
            # 1. Silinecek işlemi bul (Stok iadesi için)
            islem_res = g.supabase.table('yem_islemleri').select('yem_urun_id, miktar_kg') \
                .eq('id', id).eq('sirket_id', sirket_id).single().execute()
            if not islem_res.data:
                raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")

            iade_edilecek_miktar = Decimal(islem_res.data['miktar_kg'])
            urun_id = islem_res.data['yem_urun_id']

            # 2. İlgili ürünün stoğunu iade et
            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg') \
                .eq('id', urun_id).single().execute()
            if not urun_res.data:
                logger.warning(f"Silinen yem işlemine (ID: {id}) ait ürün (ID: {urun_id}) bulunamadı. Stok iade edilemedi.")
            else:
                mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
                yeni_stok = mevcut_stok + iade_edilecek_miktar
                g.supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}) \
                    .eq('id', urun_id).execute()

            # 3. İlgili FİNANSAL KAYDI SİL (YENİ EKLENDİ)
            # yem_islem_id'si bu olan finansal kaydı bul ve sil
            g.supabase.table('finansal_islemler').delete() \
                .eq('yem_islem_id', id) \
                .eq('sirket_id', sirket_id) \
                .execute()

            # 4. Yem İşlemini Sil
            g.supabase.table('yem_islemleri').delete().eq('id', id).execute()
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi silinirken hata: {e}", exc_info=True)
            raise Exception("İşlem iptal edilirken bir sunucu hatası oluştu.")

    def update_transaction(self, id: int, sirket_id: int, data: dict):
        """Bir yem çıkış işlemini günceller, stok farkını ayarlar VE FİNANS KAYDINI GÜNCELLER."""
        try:
            yeni_miktar_str = data.get('yeni_miktar_kg')
            if not yeni_miktar_str:
                 raise ValueError("Yeni miktar boş olamaz.")
            try:
                yeni_miktar = Decimal(yeni_miktar_str)
                if yeni_miktar <= 0:
                    raise ValueError("Miktar pozitif bir değer olmalıdır.")
            except (InvalidOperation, TypeError):
                 raise ValueError("Lütfen geçerli bir miktar girin.")

            # 1. Mevcut işlemi al
            mevcut_islem_res = g.supabase.table('yem_islemleri') \
                .select('miktar_kg, yem_urun_id, islem_anindaki_birim_fiyat, aciklama') \
                .eq('id', id).eq('sirket_id', sirket_id).single().execute()
            if not mevcut_islem_res.data:
                raise ValueError("Güncellenecek işlem bulunamadı.")

            eski_miktar = Decimal(mevcut_islem_res.data['miktar_kg'])
            urun_id = mevcut_islem_res.data['yem_urun_id']
            birim_fiyat = Decimal(mevcut_islem_res.data['islem_anindaki_birim_fiyat'])
            fark = yeni_miktar - eski_miktar # Pozitifse stok azalacak, negatifse artacak

            # 2. Ürün stoğunu al ve güncelle
            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg, yem_adi') \
                .eq('id', urun_id).single().execute()
            if not urun_res.data:
                raise ValueError("Ürün stoğu bulunamadı. İşlem güncellenemiyor.")

            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            yem_adi = urun_res.data['yem_adi']

            if fark > 0 and mevcut_stok < fark:
                raise ValueError(f"Yetersiz stok! Sadece {mevcut_stok} kg daha çıkış yapabilirsiniz.")

            yeni_stok = mevcut_stok - fark
            g.supabase.table('yem_urunleri').update({'stok_miktari_kg': str(yeni_stok)}) \
                .eq('id', urun_id).execute()

            # 3. Yem İşlemini Güncelle
            yeni_toplam_tutar = yeni_miktar * birim_fiyat
            guncellenecek_islem = {
                'miktar_kg': str(yeni_miktar),
                'toplam_tutar': str(yeni_toplam_tutar)
            }
            yeni_aciklama = eski_miktar = mevcut_islem_res.data.get('aciklama') # Varsayılan
            if 'aciklama' in data: 
                yeni_aciklama = sanitize_input(data.get('aciklama')) or None
                guncellenecek_islem['aciklama'] = yeni_aciklama
            g.supabase.table('yem_islemleri').update(guncellenecek_islem).eq('id', id).execute()
            
            # 4. FİNANSAL KAYDI GÜNCELLE (YENİ EKLENDİ)
            # Finansal kaydı bul (yem_islem_id ile)
            finans_kaydi_res = g.supabase.table('finansal_islemler').select('id, aciklama') \
                .eq('yem_islem_id', id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single().execute()

            if finans_kaydi_res.data:
                # Yeni açıklama oluştur
                finans_aciklama = finans_kaydi_res.data['aciklama']
                # Açıklamanın "(...)" kısmını güncelleyelim
                if ' (' in finans_aciklama:
                    finans_aciklama = finans_aciklama.split(' (')[0] # Ana açıklamayı al
                
                if yeni_aciklama:
                    finans_aciklama += f" ({yeni_aciklama})" # Yeni notu ekle
                    
                g.supabase.table('finansal_islemler') \
                    .update({
                        'tutar': str(yeni_toplam_tutar),
                        'aciklama': finans_aciklama
                    }) \
                    .eq('id', finans_kaydi_res.data['id']) \
                    .execute()
            else:
                logger.error(f"Güncellenecek yem işlemine (ID: {id}) ait finansal kayıt bulunamadı!")


        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi güncellenirken hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")


yem_service = YemService()