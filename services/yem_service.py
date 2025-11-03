# services/yem_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation, DivisionByZero
# YENİ: Rolleri kontrol edebilmek için UserRole'u import ediyoruz.
from constants import UserRole
from utils import sanitize_input # YENİ: bleach temizleyicisini import et

logger = logging.getLogger(__name__)

class YemService:
    """Yem ürünleri ve işlemleri için servis katmanı."""

    # get_paginated_products, get_all_products_for_dropdown, _prepare_product_data,
    # add_product, update_product, delete_product fonksiyonları aynı kalıyor.
    # ... (Önceki fonksiyonlar burada - Değişiklik Yok) ...

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
            # Sadece peşin fiyatları çekmek yeterli (birim_fiyat veya cuval_fiyati/cuval_agirligi_kg)
            response = g.supabase.table('yem_urunleri').select(
                'id, yem_adi, stok_miktari_kg, birim_fiyat, cuval_agirligi_kg, cuval_fiyati'
            ).eq('sirket_id', sirket_id).order('yem_adi').execute()
            return response.data
        except Exception as e:
            logger.error(f"Dropdown için yem ürünleri listesi alınırken hata: {e}", exc_info=True)
            raise Exception("Ürün listesi alınamadı.")

    def _prepare_product_data(self, sirket_id: int, data: dict):
        """Gelen veriye göre yem ürünü verisini hazırlar."""
        fiyatlandirma_tipi = data.get('fiyatlandirma_tipi')
        # YENİ: Yem adı sanitize ediliyor
        yem_adi = sanitize_input(data.get('yem_adi'))

        if not yem_adi:
            raise ValueError("Yem adı zorunludur.")

        # Vadeli fiyat kolonları artık yok.
        urun_verisi = {
            "sirket_id": sirket_id,
            "yem_adi": yem_adi,
            "cuval_agirligi_kg": None,
            "cuval_fiyati": None,
            "birim_fiyat": None, # Başlangıçta None
            "stok_miktari_kg": None # Başlangıçta None
         }


        if fiyatlandirma_tipi == 'cuval':
            # HATA DÜZELTMESİ: data.get() None döndürebilir, bu da Decimal(None) hatasına yol açar.
            # data.get(...) or '0' kullanarak None veya "" gelirse '0' kullanılmasını sağlıyoruz.
            cuval_fiyati = Decimal(data.get('cuval_fiyati') or '0')
            cuval_agirligi_kg = Decimal(data.get('cuval_agirligi_kg') or '0')
            # Yem düzenleme modalı 'stok_adedi' değil, 'yem-stok-input' değerini gönderir.
            # JS tarafı (yemUrunuKaydet) bunu 'stok_adedi' veya 'stok_miktari_kg' olarak ayarlar.
            # GÜNCELLEME: JS'den 'stok_adedi' geliyorsa onu, yoksa 'stok_miktari_kg' yi al.
            stok_adedi = Decimal(data.get('stok_adedi') or data.get('stok_miktari_kg') or '0')


            if cuval_fiyati <= 0 or cuval_agirligi_kg <= 0 or stok_adedi < 0:
                raise ValueError("Çuval fiyatı, ağırlığı ve stok adedi pozitif değerler olmalıdır.")

            urun_verisi["birim_fiyat"] = str(cuval_fiyati / cuval_agirligi_kg)
            urun_verisi["stok_miktari_kg"] = str(stok_adedi * cuval_agirligi_kg)
            urun_verisi["cuval_fiyati"] = str(cuval_fiyati)
            urun_verisi["cuval_agirligi_kg"] = str(cuval_agirligi_kg)
        else: # KG fiyatı
            # HATA DÜZELTMESİ: data.get(...) or '0' kullan.
            birim_fiyat = Decimal(data.get('birim_fiyat') or '0')
            stok_miktari_kg = Decimal(data.get('stok_miktari_kg') or '0')

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
            # sirket_id'yi güncelleme verisinden çıkaralım
            if 'sirket_id' in guncel_veri:
                del guncel_veri['sirket_id']

            # --- HATA DÜZELTMESİ ---
            # .update() ve .select() birlikte zincirlenemez.
            # 1. Önce güncellemeyi yap ve çalıştır.
            response = g.supabase.table('yem_urunleri').update(guncel_veri) \
                .eq('id', id).eq('sirket_id', sirket_id).execute()
            
            # 2. Güncelleme başarılıysa, güncellenen veriyi çekmek için ayrı bir sorgu yap.
            # response.data, güncelleme başarılı olsa bile boş dönebilir, 
            # bu yüzden hata kontrolünü buradan kaldırıp, aşağıdaki select sorgusuna güveniyoruz.
            
            guncellenen_urun_response = g.supabase.table('yem_urunleri').select() \
                .eq('id', id).eq('sirket_id', sirket_id).single().execute()
            
            if not guncellenen_urun_response.data:
            # --- DÜZELTME SONU ---
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
            # Önce bu ürüne ait işlem var mı kontrol et
            islem_kontrol = g.supabase.table('yem_islemleri') \
                .select('id', count='exact') \
                .eq('yem_urun_id', id) \
                .eq('sirket_id', sirket_id) \
                .execute()

            if islem_kontrol.count > 0:
                raise ValueError("Bu yeme ait çıkış işlemleri olduğu için silinemiyor.")

            # İşlem yoksa sil
            response = g.supabase.table('yem_urunleri').delete().eq('id', id).eq('sirket_id', sirket_id).execute()
            if not response.data:
                # Silinecek ürün bulunamadıysa veya yetki yoksa (count 0 ise de data boş dönebilir)
                 # count kontrolü Supabase Python client'ında delete için direkt yok, bu yüzden data kontrolü yapıyoruz.
                 # Eğer response.data boşsa ve islem_kontrol.count 0 ise, ürün bulunamadı varsayabiliriz.
                 if islem_kontrol.count == 0: # Ekstra kontrol
                     raise ValueError("Ürün bulunamadı veya bu işlem için yetkiniz yok.")
                 # Eğer işlem kontrolü > 0 iken buraya geldiysek (ki gelmemeli), yine de genel hata verelim.
                 # else: pass # Zaten yukarıdaki ValueError fırlatılmış olmalı

        except ValueError as ve: # Yakaladığımız ValueError'ı tekrar fırlat
            raise ve
        except Exception as e:
            # Diğer beklenmedik hataları logla ve genel hata döndür
            logger.error(f"Yem ürünü silinirken hata: {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")


    # GÜNCELLEME: Fonksiyonun imzasına 'kullanici_id' ve 'rol' parametrelerini ekledik.
    def get_paginated_transactions(self, sirket_id: int, kullanici_id: int, rol: str, sayfa: int, limit: int = 5):
        """Yem çıkış işlemlerini sayfalayarak listeler (RPC kullanarak)."""
        try:
            offset = (sayfa - 1) * limit
            
            # Yeni RPC'yi çağırmak için parametreleri hazırla
            params = {
                'p_sirket_id': sirket_id,
                'p_kullanici_id': kullanici_id,
                'p_rol': rol,
                'p_limit': limit,
                'p_offset': offset
            }
            
            # RPC'yi çağır
            response = g.supabase.rpc('get_paginated_yem_islemleri', params).execute()

            if not response.data:
                logger.warning(f"get_paginated_yem_islemleri RPC'si veri döndürmedi. Parametreler: {params}")
                return [], 0

            # RPC'den gelen JSON'ı ayrıştır
            result_data = response.data
            islemler = result_data.get('data', [])
            toplam_kayit = result_data.get('count', 0)

            # Frontend'in (yem_yonetimi.js) beklediği formata çevir
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
        """Yeni bir yem çıkış işlemi yapar ve stoğu günceller."""
        try:
            miktar_kg_str = data.get('miktar_kg')
            yem_urun_id = data.get('yem_urun_id')
            tedarikci_id = data.get('tedarikci_id')
            # --- YENİ: Fiyat tipi ve birim fiyatı al ---
            fiyat_tipi = data.get('fiyat_tipi') # 'pesin' veya 'vadeli'
            birim_fiyat_str = data.get('birim_fiyat') # Formdan gelen fiyat
            # --- /YENİ ---

            # --- GÜNCEL DOĞRULAMALAR ---
            if not all([miktar_kg_str, yem_urun_id, tedarikci_id, fiyat_tipi, birim_fiyat_str]):
                raise ValueError("Eksik bilgi: Tedarikçi, yem, miktar, fiyat tipi ve birim fiyat zorunludur.")

            if fiyat_tipi not in ['pesin', 'vadeli']:
                raise ValueError("Geçersiz fiyat tipi.")

            try:
                miktar_kg = Decimal(miktar_kg_str)
                # Formdan gelen birim fiyatı Decimal'e çevir
                islem_anindaki_birim_fiyat = Decimal(birim_fiyat_str)
            except (InvalidOperation, TypeError):
                 raise ValueError("Miktar ve Birim Fiyat geçerli bir sayı olmalıdır.")

            if miktar_kg <= 0 or islem_anindaki_birim_fiyat < 0:
                raise ValueError("Miktar pozitif, Birim Fiyat negatif olmayan bir değer olmalıdır.")
            # --- /GÜNCEL DOĞRULAMALAR ---

            # Stok kontrolü
            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg') \
                .eq('id', yem_urun_id) \
                .eq('sirket_id', sirket_id) \
                .single().execute()
            if not urun_res.data:
                raise ValueError("Yem ürünü bulunamadı.")

            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
            if mevcut_stok < miktar_kg:
                raise ValueError(f"Yetersiz stok! Mevcut stok: {mevcut_stok} kg")

            # Toplam tutarı formdan gelen birim fiyat ile hesapla
            toplam_tutar = miktar_kg * islem_anindaki_birim_fiyat

            yeni_islem = {
                "sirket_id": sirket_id,
                "tedarikci_id": tedarikci_id,
                "yem_urun_id": yem_urun_id,
                "kullanici_id": kullanici_id,
                "miktar_kg": str(miktar_kg),
                # --- YENİ: fiyat_tipi ve formdan gelen fiyatı kaydet ---
                "fiyat_tipi": fiyat_tipi,
                "islem_anindaki_birim_fiyat": str(islem_anindaki_birim_fiyat),
                # --- /YENİ ---
                "toplam_tutar": str(toplam_tutar),
                # YENİ: Açıklama sanitize ediliyor
                "aciklama": sanitize_input(data.get('aciklama')) or None
            }
            g.supabase.table('yem_islemleri').insert(yeni_islem).execute()

            # Stoğu güncelle
            yeni_stok = mevcut_stok - miktar_kg
            g.supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}) \
                .eq('id', yem_urun_id).execute()

        except ValueError as ve: # Yakaladığımız ValueError'ları tekrar fırlat
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi eklenirken hata: {e}", exc_info=True)
            raise Exception("İşlem sırasında bir hata oluştu.")
    # --- /add_transaction GÜNCELLEMESİ SONU ---

    def delete_transaction(self, id: int, sirket_id: int):
        """Bir yem çıkış işlemini siler ve stoğu iade eder."""
        try:
            # Silinecek işlemi bul
            islem_res = g.supabase.table('yem_islemleri').select('yem_urun_id, miktar_kg') \
                .eq('id', id).eq('sirket_id', sirket_id).single().execute()
            if not islem_res.data:
                raise ValueError("İşlem bulunamadı veya bu işlem için yetkiniz yok.")

            iade_edilecek_miktar = Decimal(islem_res.data['miktar_kg'])
            urun_id = islem_res.data['yem_urun_id']

            # İlgili ürünün stoğunu bul
            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg') \
                .eq('id', urun_id).single().execute()
            # Ürün bulunamazsa bile devam etmeye çalışabiliriz ama loglamak iyi olur
            if not urun_res.data:
                logger.warning(f"Silinen yem işlemine (ID: {id}) ait ürün (ID: {urun_id}) bulunamadı. Stok iade edilemedi.")
                # raise ValueError("Stoğu güncellenecek ürün bulunamadı.") # Hata vermek yerine loglayıp devam edelim mi? Karar verilmeli. Şimdilik devam.
            else:
                # Stoğu iade et
                mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])
                yeni_stok = mevcut_stok + iade_edilecek_miktar
                g.supabase.table('yem_urunleri').update({"stok_miktari_kg": str(yeni_stok)}) \
                    .eq('id', urun_id).execute()

            # İşlemi sil
            g.supabase.table('yem_islemleri').delete().eq('id', id).execute()
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi silinirken hata: {e}", exc_info=True)
            raise Exception("İşlem iptal edilirken bir sunucu hatası oluştu.")

    def update_transaction(self, id: int, sirket_id: int, data: dict):
        """Bir yem çıkış işlemini günceller ve stok farkını ayarlar."""
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


            # Mevcut işlemi al
            mevcut_islem_res = g.supabase.table('yem_islemleri') \
                .select('miktar_kg, yem_urun_id, islem_anindaki_birim_fiyat') \
                .eq('id', id).eq('sirket_id', sirket_id).single().execute()
            if not mevcut_islem_res.data:
                raise ValueError("Güncellenecek işlem bulunamadı.")

            eski_miktar = Decimal(mevcut_islem_res.data['miktar_kg'])
            urun_id = mevcut_islem_res.data['yem_urun_id']
            # Birim fiyat işlem anında sabitlendiği için onu kullanıyoruz
            birim_fiyat = Decimal(mevcut_islem_res.data['islem_anindaki_birim_fiyat'])
            fark = yeni_miktar - eski_miktar # Pozitifse stok azalacak, negatifse artacak

            # Ürün stoğunu al
            urun_res = g.supabase.table('yem_urunleri').select('stok_miktari_kg') \
                .eq('id', urun_id).single().execute()
            if not urun_res.data:
                # Ürün bulunamazsa hata ver, çünkü stok güncellenemez
                raise ValueError("Ürün stoğu bulunamadı. İşlem güncellenemiyor.")

            mevcut_stok = Decimal(urun_res.data['stok_miktari_kg'])

            # Yeterli stok var mı kontrol et (eğer miktar artırılıyorsa, yani fark > 0)
            if fark > 0 and mevcut_stok < fark:
                raise ValueError(f"Yetersiz stok! Sadece {mevcut_stok} kg daha çıkış yapabilirsiniz.")

            # Yeni stoğu hesapla ve güncelle
            yeni_stok = mevcut_stok - fark
            g.supabase.table('yem_urunleri').update({'stok_miktari_kg': str(yeni_stok)}) \
                .eq('id', urun_id).execute()

            # Yeni toplam tutarı hesapla
            yeni_toplam_tutar = yeni_miktar * birim_fiyat

            # İşlemi güncelle (miktar, toplam tutar ve açıklama)
            guncellenecek_islem = {
                'miktar_kg': str(yeni_miktar),
                'toplam_tutar': str(yeni_toplam_tutar)
            }
            if 'aciklama' in data: # Açıklama gönderildiyse onu da ekle
                # YENİ: Açıklama sanitize ediliyor
                guncellenecek_islem['aciklama'] = sanitize_input(data.get('aciklama')) or None
            g.supabase.table('yem_islemleri').update(guncellenecek_islem).eq('id', id).execute()

        except ValueError as ve: # Yakaladığımız ValueError'ları tekrar fırlat
            raise ve
        except Exception as e:
            logger.error(f"Yem işlemi güncellenirken hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")


yem_service = YemService()