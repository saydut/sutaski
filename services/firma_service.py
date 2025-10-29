# services/firma_service.py

import logging
from flask import g
from extensions import bcrypt
from constants import UserRole
from postgrest import APIError
# random ve string importları artık gerekli değil (kaldırıldı)
logger = logging.getLogger(__name__)

# --- Yardımcı Fonksiyon: Benzersiz Çiftçi Kullanıcı Adı Oluştur ---
# Bu fonksiyon aynı kalıyor
def _generate_unique_farmer_username(base_name: str, sirket_id: int) -> str:
    # Türkçe karakterleri ve boşlukları temizle
    clean_name = ''.join(c for c in base_name.lower() if c.isalnum() or c == '_').replace(' ', '_')
    username_base = f"{clean_name}_ciftci"
    username = username_base
    counter = 1
    while True:
        # Veritabanında bu kullanıcı adının olup olmadığını kontrol et
        exists_res = g.supabase.table('kullanicilar') \
            .select('id', count='exact') \
            .eq('kullanici_adi', username) \
            .eq('sirket_id', sirket_id) \
            .execute()
        if exists_res.count == 0:
            return username # Benzersiz isim bulundu
        # Varsa, sonuna sayı ekleyerek tekrar dene
        username = f"{username_base}_{counter}"
        counter += 1
        if counter > 100: # Sonsuz döngü riskine karşı
             raise Exception("Benzersiz çiftçi kullanıcı adı üretilemedi.")

class FirmaService:
    """Firma yetkilisi işlemleri için servis katmanı."""

    def get_yonetim_data(self, sirket_id: int):
        # Bu fonksiyon aynı kalıyor
        try:
            sirket_res = g.supabase.table('sirketler').select('max_toplayici_sayisi').eq('id', sirket_id).single().execute()
            if not sirket_res.data:
                raise ValueError("Şirket bilgileri bulunamadı.")

            limit = sirket_res.data.get('max_toplayici_sayisi', 3)

            roles_to_fetch = [UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value, UserRole.CIFCI.value] # Çiftçiyi de dahil edelim
            kullanicilar_res = g.supabase.table('kullanicilar').select('*') \
                .eq('sirket_id', sirket_id) \
                .in_('rol', roles_to_fetch) \
                .order('id', desc=True) \
                .execute()

            return {
                "kullanicilar": kullanicilar_res.data,
                "limit": limit
            }
        except Exception as e:
            logger.error(f"Şirket yönetim verileri alınırken hata: {e}", exc_info=True)
            raise Exception("Yönetim verileri alınırken bir hata oluştu.")

    def add_toplayici(self, sirket_id: int, data: dict):
        # Bu fonksiyon aynı kalıyor
        try:
            kullanici_adi = data.get('kullanici_adi', '').strip()
            sifre = data.get('sifre')
            if not all([kullanici_adi, sifre]):
                raise ValueError("Kullanıcı adı ve şifre zorunludur.")

            yonetim_data = self.get_yonetim_data(sirket_id)
            limit = yonetim_data['limit']
            mevcut_toplayici_sayisi = len([k for k in yonetim_data['kullanicilar'] if k['rol'] == UserRole.TOPLAYICI.value])

            if mevcut_toplayici_sayisi >= limit:
                raise ValueError(f"Lisans limitinize ulaştınız. Mevcut lisansınız en fazla {limit} toplayıcıya izin vermektedir.")

            kullanici_var_mi = g.supabase.table('kullanicilar').select('id', count='exact').eq('kullanici_adi', kullanici_adi).execute()
            if kullanici_var_mi.count > 0:
                raise ValueError("Bu kullanıcı adı zaten mevcut.")

            hashed_sifre = bcrypt.generate_password_hash(sifre).decode('utf-8')
            yeni_kullanici_data = {
                'kullanici_adi': kullanici_adi,
                'sifre': hashed_sifre,
                'sirket_id': sirket_id,
                'rol': UserRole.TOPLAYICI.value,
                'telefon_no': data.get('telefon_no'),
                'adres': data.get('adres')
            }

            response = g.supabase.table('kullanicilar').insert(yeni_kullanici_data).execute()
            return response.data[0]

        except ValueError as ve:
            raise ve
        except APIError as e:
            logger.error(f"Toplayıcı eklenirken API hatası: {e.message}", exc_info=True)
            if 'unique constraint "kullanicilar_kullanici_adi_key"' in e.message:
                raise ValueError("Bu kullanıcı adı zaten başka bir kullanıcı tarafından kullanılıyor.")
            raise Exception("Veritabanı hatası oluştu.")
        except Exception as e:
            logger.error(f"Toplayıcı eklenirken genel hata: {e}", exc_info=True)
            raise Exception("Toplayıcı eklenirken bir sunucu hatası oluştu.")

    def delete_kullanici(self, sirket_id: int, kullanici_id_to_delete: int):
        # Bu fonksiyon aynı kalıyor
        try:
            kullanici_res = g.supabase.table('kullanicilar').select('id, rol') \
                .eq('id', kullanici_id_to_delete) \
                .eq('sirket_id', sirket_id) \
                .single().execute()

            if not kullanici_res.data:
                raise ValueError("Kullanıcı bulunamadı veya bu işlem için yetkiniz yok.")

            if kullanici_res.data['rol'] == UserRole.FIRMA_YETKILISI.value:
                raise ValueError("Firma yetkilisi silinemez.")

            g.supabase.table('kullanicilar').delete().eq('id', kullanici_id_to_delete).execute()
            return True

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Kullanıcı silinirken hata: {e}", exc_info=True)
            raise Exception("Kullanıcı silinirken bir sunucu hatası oluştu.")

    def get_kullanici_detay(self, sirket_id: int, kullanici_id_to_get: int):
        # Bu fonksiyon aynı kalıyor
        try:
            kullanici_res = g.supabase.table('kullanicilar') \
                .select('id, kullanici_adi, telefon_no, adres, rol') \
                .eq('id', kullanici_id_to_get) \
                .eq('sirket_id', sirket_id) \
                .single().execute()

            if not kullanici_res.data:
                raise ValueError("Kullanıcı bulunamadı veya bu işlem için yetkiniz yok.")

            kullanici_data = kullanici_res.data
            atanmis_tedarikci_idler = []
            if kullanici_data['rol'] == UserRole.TOPLAYICI.value:
                atama_res = g.supabase.table('toplayici_tedarikci_atananlari') \
                    .select('tedarikci_id') \
                    .eq('toplayici_id', kullanici_id_to_get) \
                    .execute()
                atanmis_tedarikci_idler = [atama['tedarikci_id'] for atama in atama_res.data]

            return {
                "kullanici": kullanici_data,
                "atanan_tedarikciler": atanmis_tedarikci_idler
            }

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Kullanıcı detayı alınırken hata: {e}", exc_info=True)
            raise Exception("Kullanıcı detayı alınırken bir hata oluştu.")

    def update_kullanici(self, sirket_id: int, kullanici_id_to_update: int, data: dict):
        # Bu fonksiyon aynı kalıyor
        try:
            kullanici_res = g.supabase.table('kullanicilar').select('rol').eq('id', kullanici_id_to_update).eq('sirket_id', sirket_id).single().execute()
            if not kullanici_res.data:
                raise ValueError("Güncellenecek kullanıcı bulunamadı veya yetkiniz yok.")

            mevcut_rol = kullanici_res.data['rol']
            if mevcut_rol == UserRole.FIRMA_YETKILISI.value:
                 raise ValueError("Firma yetkilisinin bilgileri buradan güncellenemez.")

            guncellenecek_veri = {}
            kullanici_adi_geldi = data.get('kullanici_adi', '').strip()
            if kullanici_adi_geldi:
                mevcut_kullanici = g.supabase.table('kullanicilar').select('id').eq('kullanici_adi', kullanici_adi_geldi).neq('id', kullanici_id_to_update).execute()
                if mevcut_kullanici.data:
                    raise ValueError("Bu kullanıcı adı zaten başka bir kullanıcı tarafından kullanılıyor.")
                guncellenecek_veri['kullanici_adi'] = kullanici_adi_geldi
            else:
                 raise ValueError("Kullanıcı adı boş bırakılamaz.")

            guncellenecek_veri['telefon_no'] = data.get('telefon_no') if data.get('telefon_no') else None
            guncellenecek_veri['adres'] = data.get('adres') if data.get('adres') else None

            if guncellenecek_veri:
                g.supabase.table('kullanicilar').update(guncellenecek_veri).eq('id', kullanici_id_to_update).execute()

            yeni_sifre = data.get('sifre')
            if yeni_sifre:
                hashed_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')
                g.supabase.table('kullanicilar').update({'sifre': hashed_sifre}).eq('id', kullanici_id_to_update).execute()

            if mevcut_rol == UserRole.TOPLAYICI.value and 'atanan_tedarikciler' in data:
                yeni_atanan_idler = [int(tid) for tid in data.get('atanan_tedarikciler', []) if tid]
                g.supabase.table('toplayici_tedarikci_atananlari').delete().eq('toplayici_id', kullanici_id_to_update).execute()

                if yeni_atanan_idler:
                    tedarikci_kontrol = g.supabase.table('tedarikciler') \
                        .select('id', count='exact') \
                        .eq('sirket_id', sirket_id) \
                        .in_('id', yeni_atanan_idler) \
                        .execute()
                    if tedarikci_kontrol.count != len(yeni_atanan_idler):
                        logger.warning(f"Firma Yetkilisi {sirket_id}, başka şirketin tedarikçisini atamaya çalıştı!")
                        raise ValueError("Geçersiz tedarikçi seçimi yapıldı.")
                    kayitlar = [{'toplayici_id': kullanici_id_to_update, 'tedarikci_id': tid} for tid in yeni_atanan_idler]
                    g.supabase.table('toplayici_tedarikci_atananlari').insert(kayitlar).execute()

            return True

        except ValueError as ve:
            raise ve
        except APIError as e:
             logger.error(f"Kullanıcı güncellenirken API hatası: {e.message}", exc_info=True)
             if 'unique constraint "kullanicilar_kullanici_adi_key"' in e.message:
                 raise ValueError("Bu kullanıcı adı zaten başka bir kullanıcı tarafından kullanılıyor.")
             raise Exception(f"Veritabanı hatası: {e.message}")
        except Exception as e:
            logger.error(f"Kullanıcı güncellenirken genel hata: {e}", exc_info=True)
            raise Exception("Kullanıcı güncellenirken bir sunucu hatası oluştu.")


    # --- ŞİFRE AYARLAMA FONKSİYONU GÜNCELLENDİ ---
    def set_ciftci_password(self, sirket_id: int, kullanici_id_to_reset: int, yeni_sifre_plain: str):
        """Bir çiftçi kullanıcısının şifresini firma yetkilisinin belirlediği yeni şifre ile günceller."""
        try:
            # 1. Yeni şifrenin boş olup olmadığını kontrol et
            if not yeni_sifre_plain:
                raise ValueError("Yeni şifre boş bırakılamaz.")
            # İsteğe bağlı: Minimum şifre uzunluğu kontrolü eklenebilir
            # if len(yeni_sifre_plain) < 4:
            #     raise ValueError("Yeni şifre en az 4 karakter olmalıdır.")

            # 2. Kullanıcıyı bul ve rolünün 'ciftci' olduğunu doğrula
            kullanici_res = g.supabase.table('kullanicilar') \
                .select('rol') \
                .eq('id', kullanici_id_to_reset) \
                .eq('sirket_id', sirket_id) \
                .single().execute()

            if not kullanici_res.data:
                raise ValueError("Kullanıcı bulunamadı veya yetkiniz yok.")
            if kullanici_res.data['rol'] != UserRole.CIFCI.value:
                raise ValueError("Sadece çiftçi rolündeki kullanıcıların şifresi değiştirilebilir.")

            # 3. Yeni şifreyi hashle
            hashed_sifre = bcrypt.generate_password_hash(yeni_sifre_plain).decode('utf-8')

            # 4. Veritabanını yeni hashlenmiş şifre ile güncelle
            g.supabase.table('kullanicilar') \
                .update({'sifre': hashed_sifre}) \
                .eq('id', kullanici_id_to_reset) \
                .execute()

            # 5. Başarılı olduğunu belirtmek için True döndür (şifreyi döndürme!)
            logger.info(f"Çiftçi (ID: {kullanici_id_to_reset}) şifresi firma yetkilisi tarafından güncellendi.")
            return True

        except ValueError as ve:
            raise ve # ValueError'ları doğrudan yukarı ilet
        except Exception as e:
            logger.error(f"Çiftçi şifresi ayarlanırken hata: {e}", exc_info=True)
            raise Exception("Şifre ayarlanırken bir sunucu hatası oluştu.")


firma_service = FirmaService()
