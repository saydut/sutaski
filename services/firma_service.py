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
    # İsim sanitize ediliyor
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
             # Güvenlik önlemi: Sonsuz döngüye girmesin
             raise Exception("Benzersiz çiftçi kullanıcı adı üretilemedi.")

class FirmaService:
    """Firma yetkilisi işlemleri için servis katmanı."""

    # DÜZELTME: 'g.supabase' yerine 'supabase_client' parametresi eklendi
    def get_yonetim_data(self, supabase_client, sirket_id: int):
        """
        Yönetim sayfası için kullanıcıları ve lisans limitini getirir.
        """
        try:
            # 1. Lisans limitini al
            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            sirket_res = supabase_client.table('sirketler').select('max_toplayici_sayisi').eq('id', sirket_id).single().execute()
            if not sirket_res.data:
                raise ValueError("Şirket bilgileri bulunamadı.")

            limit = sirket_res.data.get('max_toplayici_sayisi', 3) # Varsayılan limit 3

            # 2. Kullanıcıları al
            roles_to_fetch = [UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value, UserRole.CIFCI.value] 
            
            # --- ANA DÜZELTME: RLS GÜVENLİĞİ İÇİN 'select(*)' KALDIRILDI ---
            # 'sifre' sütununu çekmemek için sadece ihtiyacımız olan sütunları seçiyoruz.
            # Frontend'in (firma_yonetimi.js) bu alanlara ihtiyacı var.
            select_query = 'id, kullanici_adi, rol, eposta, telefon_no, adres'
            
            # DÜZELTME: 'g.supabase' -> 'supabase_client'
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
    # DÜZELTME: Fonksiyon adı 'add_kullanici' olarak genelleştirildi ve 'rol' parametresi eklendi
    def add_kullanici(self, supabase_client, sirket_id: int, data: dict):
        """
        Yeni bir kullanıcı (toplayıcı, çiftçi, muhasebeci) ekler.
        """
        try:
            kullanici_adi = sanitize_input(data.get('kullanici_adi', ''))
            sifre = data.get('sifre')
            rol = sanitize_input(data.get('rol')) # JS'den gelen rolü al
            
            if not all([kullanici_adi, sifre, rol]):
                raise ValueError("Kullanıcı adı, şifre ve rol zorunludur.")
            
            gecerli_roller = [UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value, UserRole.CIFCI.value]
            if rol not in gecerli_roller:
                raise ValueError(f"Geçersiz rol: {rol}")

            # Eğer rol 'toplayici' ise lisans limitini kontrol et
            if rol == UserRole.TOPLAYICI.value:
                # DÜZELTME: 'get_yonetim_data' artık 'supabase_client' bekliyor
                yonetim_data = self.get_yonetim_data(supabase_client, sirket_id)
                limit = yonetim_data['limit']
                mevcut_toplayici_sayisi = len([k for k in yonetim_data['kullanicilar'] if k['rol'] == UserRole.TOPLAYICI.value])

                if mevcut_toplayici_sayisi >= limit:
                    raise ValueError(f"Lisans limitinize ulaştınız. Mevcut lisansınız en fazla {limit} toplayıcıya izin vermektedir.")

            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            # Kullanıcı adı benzersiz mi kontrolü
            kullanici_var_mi = supabase_client.table('kullanicilar').select('id', count='exact').eq('kullanici_adi', kullanici_adi).execute()
            if kullanici_var_mi.count > 0:
                raise ValueError("Bu kullanıcı adı zaten mevcut.")

            hashed_sifre = bcrypt.generate_password_hash(sifre).decode('utf-8')
            
            yeni_kullanici_data = {
                'kullanici_adi': kullanici_adi,
                'sifre': hashed_sifre,
                'sirket_id': sirket_id,
                'rol': rol, # JS'den gelen rolü kullan
                'telefon_no': sanitize_input(data.get('telefon_no')) or None,
                'adres': sanitize_input(data.get('adres')) or None,
                'eposta': sanitize_input(data.get('eposta')) or None
            }
            
            # Eğer rol çiftçi ise, özel kullanıcı adı oluştur
            if rol == UserRole.CIFCI.value:
                # 'isim' (ad_soyad) alanı 'kullanici_adi' olarak geliyor
                yeni_kullanici_data['kullanici_adi'] = _generate_unique_farmer_username(supabase_client, kullanici_adi, sirket_id)


            # DÜZELTME: 'g.supabase' -> 'supabase_client'
            response = supabase_client.table('kullanicilar').insert(yeni_kullanici_data).execute()
            return response.data[0]

        except ValueError as ve:
            raise ve
        except APIError as e:
            logger.error(f"Kullanıcı eklenirken API hatası: {e.message}", exc_info=True)
            if 'unique constraint "kullanicilar_kullanici_adi_key"' in e.message:
                raise ValueError("Bu kullanıcı adı zaten başka bir kullanıcı tarafından kullanılıyor.")
            raise Exception("Veritabanı hatası oluştu.")
        except Exception as e:
            logger.error(f"Kullanıcı eklenirken genel hata: {e}", exc_info=True)
            raise Exception("Kullanıcı eklenirken bir sunucu hatası oluştu.")
            
    # Eski 'add_toplayici' fonksiyonunu, 'add_kullanici'ya yönlendiren bir kısayol olarak tutuyoruz
    def add_toplayici(self, supabase_client, sirket_id: int, data: dict):
        data['rol'] = UserRole.TOPLAYICI.value # Rolü manuel olarak ayarla
        return self.add_kullanici(supabase_client, sirket_id, data)


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

            kullanici_rolu = kullanici_res.data['rol']
            if kullanici_rolu == UserRole.FIRMA_YETKILISI.value:
                raise ValueError("Firma yetkilisi silinemez.")
            
            # İlişkili verileri temizle (Supabase şemanızda ON DELETE CASCADE yoksa bu gereklidir)
            if kullanici_rolu == UserRole.CIFCI.value:
                 supabase_client.table('tedarikciler') \
                    .update({'kullanici_id': None}) \
                    .eq('kullanici_id', kullanici_id_to_delete) \
                    .execute()

            if kullanici_rolu == UserRole.TOPLAYICI.value:
                supabase_client.table('toplayici_tedarikci_atananlari') \
                    .delete() \
                    .eq('toplayici_id', kullanici_id_to_delete) \
                    .execute()
                supabase_client.table('toplayici_tanker_atama') \
                    .delete() \
                    .eq('toplayici_user_id', kullanici_id_to_delete) \
                    .execute()

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
            # 'sifre' hariç alanları seçiyoruz
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
            
            elif kullanici_data['rol'] == UserRole.CIFCI.value:
                 # DÜZELTME: 'g.supabase' -> 'supabase_client'
                 tedarikci_res = supabase_client.table('tedarikciler') \
                    .select('id') \
                    .eq('kullanici_id', kullanici_id_to_get) \
                    .single() \
                    .execute()
                 if tedarikci_res.data:
                    atanmis_tedarikci_idler = [tedarikci_res.data['id']]


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

            # DÜZELTME: Hem Çiftçi hem Toplayıcı için tedarikçi atamasını güncelle
            if 'atanan_tedarikciler' in data:
                yeni_atanan_idler = [int(tid) for tid in data.get('atanan_tedarikciler', []) if tid]
                
                if mevcut_rol == UserRole.TOPLAYICI.value:
                    # DÜZELTME: 'g.supabase' -> 'supabase_client'
                    supabase_client.table('toplayici_tedarikci_atananlari').delete().eq('toplayici_id', kullanici_id_to_update).execute()
                    if yeni_atanan_idler:
                        kayitlar = [{'toplayici_id': kullanici_id_to_update, 'tedarikci_id': tid} for tid in yeni_atanan_idler]
                        supabase_client.table('toplayici_tedarikci_atananlari').insert(kayitlar).execute()
                
                elif mevcut_rol == UserRole.CIFCI.value:
                    # Önce bu kullanıcıya bağlı TÜM tedarikçileri ayır
                    supabase_client.table('tedarikciler') \
                        .update({'kullanici_id': None}) \
                        .eq('kullanici_id', kullanici_id_to_update) \
                        .execute()
                    
                    if yeni_atanan_idler:
                        # JS'den gelen listedeki ilk ID'yi al (Çiftçi sadece 1 tedarikçiye bağlanabilir)
                        yeni_tedarikci_id = yeni_atanan_idler[0]
                        # Yeni tedarikçiyi bu kullanıcıya bağla
                        supabase_client.table('tedarikciler') \
                            .update({'kullanici_id': kullanici_id_to_update}) \
                            .eq('id', yeni_tedarikci_id) \
                            .eq('sirket_id', sirket_id) \
                            .execute()

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
        """Bir kullanıcının (çiftçi, toplayıcı, muhasebeci) şifresini sıfırlar."""
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
            
    # 'set_user_password' ismini koruyalım (blueprints/firma.py bu ismi kullanıyor)
    set_user_password = set_ciftci_password


# Servis class'ından bir örnek (instance) oluştur
firma_service = FirmaService()