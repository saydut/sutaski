# services/masraf_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation
from utils import sanitize_input # Güvenlik için
from datetime import datetime

logger = logging.getLogger(__name__)

class MasrafService:
    """Genel masraf ve masraf kategorileri için servis katmanı."""

    # --- Kategori Fonksiyonları ---

    def get_all_categories(self, sirket_id: int):
        """Bir şirkete ait tüm masraf kategorilerini getirir."""
        try:
            response = g.supabase.table('masraf_kategorileri') \
                .select('*') \
                .eq('sirket_id', sirket_id) \
                .order('kategori_adi', desc=False) \
                .execute()
            return response.data
        except Exception as e:
            logger.error(f"Masraf kategorileri alınırken hata: {e}", exc_info=True)
            raise Exception("Kategoriler listelenirken bir hata oluştu.")

    def add_category(self, sirket_id: int, data: dict):
        """Yeni bir masraf kategorisi ekler."""
        try:
            kategori_adi = sanitize_input(data.get('kategori_adi', '')).strip()
            if not kategori_adi:
                raise ValueError("Kategori adı zorunludur.")

            yeni_kategori = {
                "sirket_id": sirket_id,
                "kategori_adi": kategori_adi
            }
            response = g.supabase.table('masraf_kategorileri').insert(yeni_kategori).execute()
            return response.data[0]
        except ValueError as ve:
            raise ve
        except Exception as e:
            if 'unique constraint "masraf_kategorileri_sirket_id_kategori_adi_key"' in str(e).lower():
                raise ValueError(f"'{kategori_adi}' adında bir kategori zaten mevcut.")
            logger.error(f"Masraf kategorisi eklenirken hata: {e}", exc_info=True)
            raise Exception("Kategori eklenirken bir sunucu hatası oluştu.")

    def update_category(self, sirket_id: int, kategori_id: int, data: dict):
        """Bir masraf kategorisini günceller."""
        try:
            kategori_adi = sanitize_input(data.get('kategori_adi', '')).strip()
            if not kategori_adi:
                raise ValueError("Kategori adı zorunludur.")
            
            response = g.supabase.table('masraf_kategorileri') \
                .update({"kategori_adi": kategori_adi}) \
                .eq('id', kategori_id) \
                .eq('sirket_id', sirket_id) \
                .execute()
            
            if not response.data:
                raise ValueError("Kategori bulunamadı veya güncelleme yetkiniz yok.")
            return response.data[0]
        except ValueError as ve:
            raise ve
        except Exception as e:
            if 'unique constraint' in str(e).lower():
                raise ValueError(f"'{kategori_adi}' adında bir kategori zaten mevcut.")
            logger.error(f"Kategori güncellenirken hata: {e}", exc_info=True)
            raise Exception("Kategori güncellenirken bir sunucu hatası oluştu.")

    def delete_category(self, sirket_id: int, kategori_id: int):
        """Bir masraf kategorisini siler. Eğer kullanımdaysa silmeyi engeller."""
        try:
            # Önce bu kategoriyi kullanan masraf var mı diye kontrol et
            kullanim_res = g.supabase.table('genel_masraflar') \
                .select('id', count='exact') \
                .eq('kategori_id', kategori_id) \
                .eq('sirket_id', sirket_id) \
                .execute()

            if kullanim_res.count > 0:
                raise ValueError(f"Bu kategori, {kullanim_res.count} masraf kaydında kullanıldığı için silinemez. Önce bu kayıtları silin veya kategorilerini değiştirin.")

            # Kullanımda değilse sil
            response = g.supabase.table('masraf_kategorileri') \
                .delete() \
                .eq('id', kategori_id) \
                .eq('sirket_id', sirket_id) \
                .execute()

            if not response.data:
                raise ValueError("Kategori bulunamadı veya silme yetkiniz yok.")
            return True
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Kategori silinirken hata: {e}", exc_info=True)
            raise Exception("Kategori silinirken bir sunucu hatası oluştu.")

    # --- Masraf Fonksiyonları ---

    def get_paginated_expenses(self, sirket_id: int, sayfa: int, limit: int = 15):
        """Genel masraf kayıtlarını sayfalayarak listeler."""
        try:
            offset = (sayfa - 1) * limit
            query = g.supabase.table('genel_masraflar').select(
                '*, kullanicilar(kullanici_adi), masraf_kategorileri(kategori_adi)', 
                count='exact'
            ).eq('sirket_id', sirket_id)

            # Bu sayfayı sadece yetkililer göreceği için rol bazlı filtrelemeye gerek yok
            
            query = query.order('masraf_tarihi', desc=True).order('created_at', desc=True).range(offset, offset + limit - 1)
            response = query.execute()
            return response.data, response.count
        except Exception as e:
            logger.error(f"Genel masraflar listelenirken hata: {e}", exc_info=True)
            raise Exception("Masraflar listelenirken bir hata oluştu.")

    def add_expense(self, sirket_id: int, kullanici_id: int, data: dict):
        """Yeni bir genel masraf kaydı ekler."""
        try:
            tutar_str = data.get('tutar')
            masraf_tarihi = data.get('masraf_tarihi')
            kategori_id = data.get('kategori_id')

            if not all([tutar_str, masraf_tarihi, kategori_id]):
                raise ValueError("Tutar, masraf tarihi ve kategori zorunludur.")

            tutar = Decimal(tutar_str)
            if tutar <= 0:
                raise ValueError("Tutar pozitif bir değer olmalıdır.")

            # Tarih format kontrolü
            datetime.strptime(masraf_tarihi, '%Y-%m-%d')
            
            yeni_masraf = {
                "sirket_id": sirket_id,
                "kullanici_id": kullanici_id,
                "kategori_id": int(kategori_id),
                "tutar": str(tutar),
                "masraf_tarihi": masraf_tarihi,
                "aciklama": sanitize_input(data.get('aciklama')) or None
            }
            
            response = g.supabase.table('genel_masraflar').insert(yeni_masraf).execute()
            return response.data[0]
        except (InvalidOperation, TypeError):
            raise ValueError("Lütfen tutar için geçerli bir sayı girin.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Genel masraf eklenirken hata: {e}", exc_info=True)
            raise Exception("Masraf eklenirken bir sunucu hatası oluştu.")

    def update_expense(self, sirket_id: int, masraf_id: int, data: dict):
        """Bir genel masraf kaydını günceller."""
        try:
            guncellenecek_veri = {}

            if 'tutar' in data:
                tutar = Decimal(data['tutar'])
                if tutar <= 0: raise ValueError("Tutar pozitif olmalıdır.")
                guncellenecek_veri['tutar'] = str(tutar)
            
            if 'masraf_tarihi' in data:
                datetime.strptime(data['masraf_tarihi'], '%Y-%m-%d') # Format kontrolü
                guncellenecek_veri['masraf_tarihi'] = data['masraf_tarihi']
            
            if 'kategori_id' in data:
                guncellenecek_veri['kategori_id'] = int(data['kategori_id'])
            
            if 'aciklama' in data:
                guncellenecek_veri['aciklama'] = sanitize_input(data.get('aciklama')) or None
            
            if not guncellenecek_veri:
                raise ValueError("Güncellenecek veri yok.")

            response = g.supabase.table('genel_masraflar') \
                .update(guncellenecek_veri) \
                .eq('id', masraf_id) \
                .eq('sirket_id', sirket_id) \
                .execute()
            
            if not response.data:
                raise ValueError("Masraf kaydı bulunamadı veya güncelleme yetkiniz yok.")
            return response.data[0]
        except (InvalidOperation, TypeError):
            raise ValueError("Geçersiz tutar formatı.")
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Masraf güncellenirken hata (ID: {masraf_id}): {e}", exc_info=True)
            raise Exception("Masraf güncellenirken bir sunucu hatası oluştu.")

    def delete_expense(self, sirket_id: int, masraf_id: int):
        """Bir genel masraf kaydını siler."""
        try:
            response = g.supabase.table('genel_masraflar') \
                .delete() \
                .eq('id', masraf_id) \
                .eq('sirket_id', sirket_id) \
                .execute()
            
            if not response.data:
                raise ValueError("Masraf kaydı bulunamadı veya silme yetkiniz yok.")
            return True
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Masraf silinirken hata (ID: {masraf_id}): {e}", exc_info=True)
            raise Exception("Masraf silinirken bir sunucu hatası oluştu.")

    def get_expense_summary_by_date_range(self, sirket_id: int, baslangic_tarihi: str, bitis_tarihi: str):
        """
        Belirli bir tarih aralığındaki toplam genel masraf tutarını hesaplar.
        Kârlılık raporu için gerekecektir.
        """
        try:
            response = g.supabase.table('genel_masraflar') \
                .select('tutar') \
                .eq('sirket_id', sirket_id) \
                .gte('masraf_tarihi', baslangic_tarihi) \
                .lte('masraf_tarihi', bitis_tarihi) \
                .execute()
            
            toplam_masraf = sum(Decimal(item.get('tutar', 0)) for item in response.data)
            return toplam_masraf
        except Exception as e:
            logger.error(f"Masraf özeti alınırken hata: {e}", exc_info=True)
            raise Exception("Masraf özeti hesaplanırken bir hata oluştu.")


# Servisin bir örneğini (instance) oluştur
masraf_service = MasrafService()