# services/firma_service.py

import logging
# DÜZELTME: 'from flask import g' satırı Döngüsel İçe Aktarma (Circular Import)
# hatasına neden olduğu için kaldırıldı.
from extensions import bcrypt
from constants import UserRole
from postgrest import APIError
from utils import sanitize_input 

logger = logging.getLogger(__name__)

# --- Yardımcı Fonksiyon: Benzersiz Çiftçi Kullanıcı Adı Oluştur ---
# DÜZELTME: 'g.supabase' yerine 'supabase_client' parametresi eklendi
def _generate_unique_farmer_username(supabase_client, base_name: str, sirket_id: int) -> str:
    clean_name = ''.join(c for c in sanitize_input(base_name).lower() if c.isalnum() or c == '_').replace(' ', '_')
    username_base = f"{clean_name}_ciftci"
    username = username_base
    counter = 1
    while True:
        # DÜZELTME: 'g.supabase' -> 'supabase_client'
        exists_res = supabase_client.table('kullanicilar') \
            .select('id', count='exact') \
            .eq('kullanici_adi', username) \
            .eq('sirket_id', sirket_id) \
            .execute()
        if exists_res.count == 0:
            return username 
        username = f"{username_base}_{counter}"
        counter += 1
        if counter > 100: 
             raise Exception("Benzersiz çiftçi kullanıcı adı üretilemedi.")

class FirmaService:
    """Firma yetkilisi işlemleri için servis katmanı."""

    # DÜZELTME: 'g.supabase' yerine 'supabase_client' parametresi eklendi
    def get_yonetim_data(self, supabase_client, sirket_id: int):
        try:
            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            sirket_res = supabase_client.table('sirketler').select('max_toplayici_sayisi').eq('id', sirket_id).single().execute()
            if not sirket_res.data:
                raise ValueError("Şirket bilgileri bulunamadı.")

            limit = sirket_res.data.get('max_toplayici_sayisi', 3)

            roles_to_fetch = [UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value, UserRole.CIFCI.value] 
            
            # --- ANA DÜZELTME: RLS GÜVENLİĞİ İÇİN 'select(*)' KALDIRILDI ---
            # 'sifre' sütununu çekmemek için sadece ihtiyacımız olan sütunları seçiyoruz.
            # Frontend'in (firma_yonetimi.js) bu alanlara ihtiyacı var.
            select_query = 'id, kullanici_adi, rol, eposta, telefon_no, adres'
            
            kullanicilar_res = supabase_client.table('kullanicilar') \
                .select(select_query) \
                .eq('sirket_id', sirket_id) \
                .in_('rol', roles_to_fetch) \
                .order('id', desc=True) \
                .execute()
            # --- DÜZELTME SONU ---

            return {
                "kullanicilar": kullanicilar_res.data,
                "limit": limit
            }
        except Exception as e:
            logger.error(f"Şirket yönetim verileri alınırken hata: {e}", exc_info=True)
            # Hatayı daha net görmek için 'e'yi de yazdıralım
            raise Exception(f"Yönetim verileri alınırken bir hata oluştu: {str(e)}")

    # DÜZELTME: 'g.supabase' yerine 'supabase_client' parametresi eklendi
    def add_toplayici(self, supabase_client, sirket_id: int, data: dict):
        try:
            kullanici_adi = sanitize_input(data.get('kullanici_adi', ''))
            sifre = data.get('sifre')
            if not all([kullanici_adi, sifre]):
                raise ValueError("Kullanıcı adı ve şifre zorunludur.")

            # DÜZELTME: 'get_yonetim_data' artık 'supabase_client' bekliyor
            yonetim_data = self.get_yonetim_data(supabase_client, sirket_id)
            limit = yonetim_data['limit']
            mevcut_toplayici_sayisi = len([k for k in yonetim_data['kullanicilar'] if k['rol'] == UserRole.TOPLAYICI.value])

            if mevcut_toplayici_sayisi >= limit:
                raise ValueError(f"Lisans limitinize ulaştınız. Mevcut lisansınız en fazla {limit} toplayıcıya izin vermektedir.")

            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            kullanici_var_mi = supabase_client.table('kullanicilar').select('id', count='exact').eq('kullanici_adi', kullanici_adi).execute()
            if kullanici_var_mi.count > 0:
                raise ValueError("Bu kullanıcı adı zaten mevcut.")

            hashed_sifre = bcrypt.generate_password_hash(sifre).decode('utf-8')
            
            yeni_kullanici_data = {
                'kullanici_adi': kullanici_adi,
                'sifre': hashed_sifre,
                'sirket_id': sirket_id,
                'rol': UserRole.TOPLAYICI.value,
                'telefon_no': sanitize_input(data.get('telefon_no')) or None,
                'adres': sanitize_input(data.get('adres')) or None,
                'eposta': sanitize_input(data.get('eposta')) or None
            }

            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            response = supabase_client.table('kullanicilar').insert(yeni_kullanici_data).execute()
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

    # DÜZELTME: 'g.supabase' yerine 'supabase_client' parametresi eklendi
    def delete_kullanici(self, supabase_client, sirket_id: int, kullanici_id_to_delete: int):
        try:
            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            kullanici_res = supabase_client.table('kullanicilar').select('id, rol') \
                .eq('id', kullanici_id_to_delete) \
                .eq('sirket_id', sirket_id) \
                .single().execute()

            if not kullanici_res.data:
                raise ValueError("Kullanıcı bulunamadı veya bu işlem için yetkiniz yok.")

            if kullanici_res.data['rol'] == UserRole.FIRMA_YETKILISI.value:
                raise ValueError("Firma yetkilisi silinemez.")

            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            supabase_client.table('kullanicilar').delete().eq('id', kullanici_id_to_delete).execute()
            return True

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Kullanıcı silinirken hata: {e}", exc_info=True)
            raise Exception("Kullanıcı silinirken bir sunucu hatası oluştu.")

    # DÜZELTME: 'g.supabase' yerine 'supabase_client' parametresi eklendi
    def get_kullanici_detay(self, supabase_client, sirket_id: int, kullanici_id_to_get: int):
        try:
            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            kullanici_res = supabase_client.table('kullanicilar') \
                .select('id, kullanici_adi, telefon_no, adres, rol, eposta') \
                .eq('id', kullanici_id_to_get) \
                .eq('sirket_id', sirket_id) \
                .single().execute()

            if not kullanici_res.data:
                raise ValueError("Kullanıcı bulunamadı veya bu işlem için yetkiniz yok.")

            kullanici_data = kullanici_res.data
            atanmis_tedarikci_idler = []
            if kullanici_data['rol'] == UserRole.TOPLAYICI.value:
                # DÜZELTME: 'g.supabase' -> 'supabase_client'
                atama_res = supabase_client.table('toplayici_tedarikci_atananlari') \
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

    # DÜZELTME: 'g.supabase' yerine 'supabase_client' parametresi eklendi
    def update_kullanici(self, supabase_client, sirket_id: int, kullanici_id_to_update: int, data: dict):
        try:
            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            kullanici_res = supabase_client.table('kullanicilar').select('rol').eq('id', kullanici_id_to_update).eq('sirket_id', sirket_id).single().execute()
            if not kullanici_res.data:
                raise ValueError("Güncellenecek kullanıcı bulunamadı veya yetkiniz yok.")

            mevcut_rol = kullanici_res.data['rol']
            if mevcut_rol == UserRole.FIRMA_YETKILISI.value:
                 raise ValueError("Firma yetkilisinin bilgileri buradan güncellenemez.")

            guncellenecek_veri = {}
            kullanici_adi_geldi = sanitize_input(data.get('kullanici_adi', ''))
            if kullanici_adi_geldi:
                # DÜZELTME: 'g.supabase' -> 'supabase_client'
                mevcut_kullanici = supabase_client.table('kullanicilar').select('id').eq('kullanici_adi', kullanici_adi_geldi).neq('id', kullanici_id_to_update).execute()
                if mevcut_kullanici.data:
                    raise ValueError("Bu kullanıcı adı zaten başka bir kullanıcı tarafından kullanılıyor.")
                guncellenecek_veri['kullanici_adi'] = kullanici_adi_geldi
            else:
                 raise ValueError("Kullanıcı adı boş bırakılamaz.")

            guncellenecek_veri['telefon_no'] = sanitize_input(data.get('telefon_no')) or None
            guncellenecek_veri['adres'] = sanitize_input(data.get('adres')) or None
            guncellenecek_veri['eposta'] = sanitize_input(data.get('eposta')) or None


            if guncellenecek_veri:
                # DÜZELTME: 'g.supabase' -> 'supabase_client'
                supabase_client.table('kullanicilar').update(guncellenecek_veri).eq('id', kullanici_id_to_update).execute()

            yeni_sifre = data.get('sifre')
            if yeni_sifre:
                hashed_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')
                # DÜZELTME: 'g.supabase' -> 'supabase_client'
                supabase_client.table('kullanicilar').update({'sifre': hashed_sifre}).eq('id', kullanici_id_to_update).execute()

            if mevcut_rol == UserRole.TOPLAYICI.value and 'atanan_tedarikciler' in data:
                yeni_atanan_idler = [int(tid) for tid in data.get('atanan_tedarikciler', []) if tid]
                # DÜZELTME: 'g.supabase' -> 'supabase_client'
                supabase_client.table('toplayici_tedarikci_atananlari').delete().eq('toplayici_id', kullanici_id_to_update).execute()

                if yeni_atanan_idler:
                    # DÜZELTME: 'g.supabase' -> 'supabase_client'
                    tedarikci_kontrol = supabase_client.table('tedarikciler') \
                        .select('id', count='exact') \
                        .eq('sirket_id', sirket_id) \
                        .in_('id', yeni_atanan_idler) \
                        .execute()
                    if tedarikci_kontrol.count != len(yeni_atanan_idler):
                        logger.warning(f"Firma Yetkilisi {sirket_id}, başka şirketin tedarikçisini atamaya çalıştı!")
                        raise ValueError("Geçersiz tedarikçi seçimi yapıldı.")
                    kayitlar = [{'toplayici_id': kullanici_id_to_update, 'tedarikci_id': tid} for tid in yeni_atanan_idler]
                    # DÜZELTME: 'g.supabase' -> 'supabase_client'
                    supabase_client.table('toplayici_tedarikci_atananlari').insert(kayitlar).execute()

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


    # DÜZELTME: 'g.supabase' yerine 'supabase_client' parametresi eklendi
    def set_ciftci_password(self, supabase_client, sirket_id: int, kullanici_id_to_reset: int, yeni_sifre_plain: str):
        try:
            if not yeni_sifre_plain:
                raise ValueError("Yeni şifre boş bırakılamaz.")

            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            kullanici_res = supabase_client.table('kullanicilar') \
                .select('rol') \
                .eq('id', kullanici_id_to_reset) \
                .eq('sirket_id', sirket_id) \
                .single().execute()

            if not kullanici_res.data:
                raise ValueError("Kullanıcı bulunamadı veya yetkiniz yok.")
                
            gecerli_roller = [UserRole.CIFCI.value, UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value]
            if kullanici_res.data['rol'] not in gecerli_roller:
                raise ValueError("Sadece çiftçi, toplayıcı veya muhasebeci rolündeki kullanıcıların şifresi değiştirilebilir.")

            hashed_sifre = bcrypt.generate_password_hash(yeni_sifre_plain).decode('utf-8')

            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            supabase_client.table('kullanicilar') \
                .update({'sifre': hashed_sifre}) \
                .eq('id', kullanici_id_to_reset) \
                .execute()

            logger.info(f"Kullanıcı (ID: {kullanici_id_to_reset}) şifresi firma yetkilisi tarafından güncellendi.")
            return True

        except ValueError as ve:
            raise ve 
        except Exception as e:
            logger.error(f"Kullanıcı şifresi ayarlanırken hata: {e}", exc_info=True)
            raise Exception("Şifre ayarlanırken bir sunucu hatası oluştu.")
            
    set_user_password = set_ciftci_password


firma_service = FirmaService()