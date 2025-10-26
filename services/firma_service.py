# services/firma_service.py

import logging
from flask import g
from extensions import bcrypt
from constants import UserRole
from postgrest import APIError
import random # YENİ
import string # YENİ
logger = logging.getLogger(__name__)

class FirmaService:
    """Firma yetkilisi işlemleri için servis katmanı."""

    def get_yonetim_data(self, sirket_id: int):
        """Bir şirketin kullanıcılarını (toplayıcı, muhasebeci) ve lisans limitini getirir."""
        try:
            sirket_res = g.supabase.table('sirketler').select('max_toplayici_sayisi').eq('id', sirket_id).single().execute()
            if not sirket_res.data:
                raise ValueError("Şirket bilgileri bulunamadı.")

            limit = sirket_res.data.get('max_toplayici_sayisi', 3)

            roles_to_fetch = [UserRole.TOPLAYICI.value, UserRole.MUHASEBECI.value]
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
        """Yeni bir toplayıcı kullanıcı ekler ve lisans limitini kontrol eder."""
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
                # Yeni eklenen alanlar için varsayılan değerler (opsiyonel)
                'telefon_no': data.get('telefon_no'),
                'adres': data.get('adres')
            }

            response = g.supabase.table('kullanicilar').insert(yeni_kullanici_data).execute()
            return response.data[0]

        except ValueError as ve:
            raise ve
        except APIError as e:
            logger.error(f"Toplayıcı eklenirken API hatası: {e.message}", exc_info=True)
            # Daha anlaşılır bir hata mesajı döndürmeye çalışalım
            if 'unique constraint "kullanicilar_kullanici_adi_key"' in e.message:
                raise ValueError("Bu kullanıcı adı zaten başka bir kullanıcı tarafından kullanılıyor.")
            raise Exception("Veritabanı hatası oluştu.")
        except Exception as e:
            logger.error(f"Toplayıcı eklenirken genel hata: {e}", exc_info=True)
            raise Exception("Toplayıcı eklenirken bir sunucu hatası oluştu.")

    def delete_kullanici(self, sirket_id: int, kullanici_id_to_delete: int):
        """Bir toplayıcıyı veya muhasebeciyi siler."""
        try:
            kullanici_res = g.supabase.table('kullanicilar').select('id, rol') \
                .eq('id', kullanici_id_to_delete) \
                .eq('sirket_id', sirket_id) \
                .single().execute()

            if not kullanici_res.data:
                raise ValueError("Kullanıcı bulunamadı veya bu işlem için yetkiniz yok.")

            if kullanici_res.data['rol'] == UserRole.FIRMA_YETKILISI.value:
                raise ValueError("Firma yetkilisi silinemez.")

            # ÖNEMLİ: Kullanıcı silinmeden önce ilişkili atamalar 'ON DELETE CASCADE'
            # nedeniyle otomatik silinecektir (SQL'de böyle ayarladık).
            g.supabase.table('kullanicilar').delete().eq('id', kullanici_id_to_delete).execute()
            return True

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Kullanıcı silinirken hata: {e}", exc_info=True)
            raise Exception("Kullanıcı silinirken bir sunucu hatası oluştu.")

    # --- YENİ FONKSİYON: Kullanıcı Detaylarını Getir ---
    def get_kullanici_detay(self, sirket_id: int, kullanici_id_to_get: int):
        """Düzenleme için bir kullanıcının detaylarını ve atanmış tedarikçi ID'lerini getirir."""
        try:
            # Kullanıcı bilgilerini al
            kullanici_res = g.supabase.table('kullanicilar') \
                .select('id, kullanici_adi, telefon_no, adres, rol') \
                .eq('id', kullanici_id_to_get) \
                .eq('sirket_id', sirket_id) \
                .single().execute()

            if not kullanici_res.data:
                raise ValueError("Kullanıcı bulunamadı veya bu işlem için yetkiniz yok.")

            kullanici_data = kullanici_res.data

            # Eğer kullanıcı toplayıcı ise, atanmış tedarikçi ID'lerini al
            atanmis_tedarikci_idler = []
            if kullanici_data['rol'] == UserRole.TOPLAYICI.value:
                atama_res = g.supabase.table('toplayici_tedarikci_atananlari') \
                    .select('tedarikci_id') \
                    .eq('toplayici_id', kullanici_id_to_get) \
                    .execute()
                atanmis_tedarikci_idler = [atama['tedarikci_id'] for atama in atama_res.data]

            # Kullanıcı bilgilerini ve atama listesini birleştirip döndür
            return {
                "kullanici": kullanici_data,
                "atanan_tedarikciler": atanmis_tedarikci_idler
            }

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Kullanıcı detayı alınırken hata: {e}", exc_info=True)
            raise Exception("Kullanıcı detayı alınırken bir hata oluştu.")

    # --- YENİ FONKSİYON: Kullanıcıyı Güncelle ---
    def update_kullanici(self, sirket_id: int, kullanici_id_to_update: int, data: dict):
        """Bir kullanıcının bilgilerini, şifresini ve tedarikçi atamalarını günceller."""
        try:
            # 1. Güncellenecek kullanıcıyı bul ve yetki kontrolü yap
            kullanici_res = g.supabase.table('kullanicilar').select('rol').eq('id', kullanici_id_to_update).eq('sirket_id', sirket_id).single().execute()
            if not kullanici_res.data:
                raise ValueError("Güncellenecek kullanıcı bulunamadı veya yetkiniz yok.")

            mevcut_rol = kullanici_res.data['rol']
            if mevcut_rol == UserRole.FIRMA_YETKILISI.value:
                 raise ValueError("Firma yetkilisinin bilgileri buradan güncellenemez.")

            # 2. Temel kullanıcı bilgilerini güncelle
            guncellenecek_veri = {}
            kullanici_adi_geldi = data.get('kullanici_adi', '').strip()
            if kullanici_adi_geldi:
                # Kullanıcı adının başkası tarafından kullanılıp kullanılmadığını kontrol et
                mevcut_kullanici = g.supabase.table('kullanicilar').select('id').eq('kullanici_adi', kullanici_adi_geldi).neq('id', kullanici_id_to_update).execute()
                if mevcut_kullanici.data:
                    raise ValueError("Bu kullanıcı adı zaten başka bir kullanıcı tarafından kullanılıyor.")
                guncellenecek_veri['kullanici_adi'] = kullanici_adi_geldi
            else:
                 raise ValueError("Kullanıcı adı boş bırakılamaz.")

            # Telefon ve adres için None kontrolü yapalım (boş gönderilirse NULL olsun)
            guncellenecek_veri['telefon_no'] = data.get('telefon_no') if data.get('telefon_no') else None
            guncellenecek_veri['adres'] = data.get('adres') if data.get('adres') else None


            if guncellenecek_veri:
                g.supabase.table('kullanicilar').update(guncellenecek_veri).eq('id', kullanici_id_to_update).execute()

            # 3. Şifreyi güncelle (eğer yeni şifre girildiyse)
            yeni_sifre = data.get('sifre')
            if yeni_sifre: # Sadece boş değilse güncelle
                hashed_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')
                g.supabase.table('kullanicilar').update({'sifre': hashed_sifre}).eq('id', kullanici_id_to_update).execute()

            # 4. Tedarikçi atamalarını güncelle (eğer kullanıcı toplayıcı ise ve atama listesi geldiyse)
            if mevcut_rol == UserRole.TOPLAYICI.value and 'atanan_tedarikciler' in data:
                # Gelen ID listesinin integer olduğundan emin olalım (JSON'dan string gelebilir)
                yeni_atanan_idler = [int(tid) for tid in data.get('atanan_tedarikciler', []) if tid]

                # Önce mevcut tüm atamaları sil
                g.supabase.table('toplayici_tedarikci_atananlari').delete().eq('toplayici_id', kullanici_id_to_update).execute()

                # Sonra yeni atamaları ekle (eğer liste boş değilse)
                if yeni_atanan_idler:
                    # Atanacak tedarikçilerin gerçekten bu şirkete ait olup olmadığını kontrol et (güvenlik için)
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

            return True # Başarılı

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

def reset_ciftci_password(self, sirket_id: int, kullanici_id_to_reset: int):
        """Bir çiftçi kullanıcısının şifresini rastgele 4 haneli olarak sıfırlar ve yeni şifreyi döndürür."""
        try:
            # 1. Kullanıcıyı bul ve rolünün 'ciftci' olduğunu doğrula
            kullanici_res = g.supabase.table('kullanicilar') \
                .select('rol') \
                .eq('id', kullanici_id_to_reset) \
                .eq('sirket_id', sirket_id) \
                .single().execute()

            if not kullanici_res.data:
                raise ValueError("Kullanıcı bulunamadı veya yetkiniz yok.")
            if kullanici_res.data['rol'] != UserRole.CIFCI.value:
                raise ValueError("Sadece çiftçi rolündeki kullanıcıların şifresi sıfırlanabilir.")

            # 2. Yeni 4 haneli şifre üret
            yeni_sifre_plain = ''.join(random.choices(string.digits, k=4))
            hashed_sifre = bcrypt.generate_password_hash(yeni_sifre_plain).decode('utf-8')

            # 3. Veritabanını yeni hashlenmiş şifre ile güncelle
            g.supabase.table('kullanicilar') \
                .update({'sifre': hashed_sifre}) \
                .eq('id', kullanici_id_to_reset) \
                .execute()

            # 4. Yeni oluşturulan şifreyi (hashlenmemiş halini) döndür
            return yeni_sifre_plain

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Çiftçi şifresi sıfırlanırken hata: {e}", exc_info=True)
            raise Exception("Şifre sıfırlanırken bir sunucu hatası oluştu.")


firma_service = FirmaService()