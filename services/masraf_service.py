# services/masraf_service.py

import logging
from flask import g
from decimal import Decimal, InvalidOperation
from utils import sanitize_input
from datetime import datetime
from extensions import supabase_client # g.supabase yerine bunu kullanacağız

logger = logging.getLogger(__name__)

class MasrafService:
    """Genel masraf ve masraf kategorileri için servis katmanı. RLS ile güncellendi."""

    # --- Kategori Fonksiyonları ---

    def get_all_categories(self):
        """
        Bir şirkete ait tüm masraf kategorilerini RLS kullanarak getirir.
        sirket_id filtresine GEREK YOKTUR.
        """
        try:
            # g.supabase -> supabase_client
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('masraf_kategorileri') \
                .select('*') \
                .order('kategori_adi', desc=False) \
                .execute()
            return response.data, None
        except Exception as e:
            logger.error(f"Masraf kategorileri alınırken hata: {e}", exc_info=True)
            return None, "Kategoriler listelenirken bir hata oluştu."

    def add_category(self, data: dict):
        """Yeni bir masraf kategorisi ekler. sirket_id'yi 'g' objesinden alır."""
        try:
            # sirket_id parametresi KALDIRILDI, g objesinden alındı
            sirket_id = g.profile['sirket_id']
            
            kategori_adi = sanitize_input(data.get('kategori_adi', '')).strip()
            if not kategori_adi:
                raise ValueError("Kategori adı zorunludur.")

            yeni_kategori = {
                "sirket_id": sirket_id, # RLS 'WITH CHECK' için
                "kategori_adi": kategori_adi
            }
            response = supabase_client.table('masraf_kategorileri').insert(yeni_kategori).execute()
            return response.data[0], None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            if 'unique constraint' in str(e).lower():
                return None, f"'{kategori_adi}' adında bir kategori zaten mevcut."
            logger.error(f"Masraf kategorisi eklenirken hata: {e}", exc_info=True)
            return None, "Kategori eklenirken bir sunucu hatası oluştu."

    def update_category(self, kategori_id: int, data: dict):
        """Bir masraf kategorisini RLS kullanarak günceller."""
        try:
            # sirket_id parametresi KALDIRILDI
            kategori_adi = sanitize_input(data.get('kategori_adi', '')).strip()
            if not kategori_adi:
                raise ValueError("Kategori adı zorunludur.")
            
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('masraf_kategorileri') \
                .update({"kategori_adi": kategori_adi}) \
                .eq('id', kategori_id) \
                .execute()
            
            if not response.data:
                raise ValueError("Kategori bulunamadı veya güncelleme yetkiniz yok.")
            return response.data[0], None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            if 'unique constraint' in str(e).lower():
                return None, f"'{kategori_adi}' adında bir kategori zaten mevcut."
            logger.error(f"Kategori güncellenirken hata: {e}", exc_info=True)
            return None, "Kategori güncellenirken bir sunucu hatası oluştu."

    def delete_category(self, kategori_id: int):
        """Bir masraf kategorisini RLS kullanarak siler."""
        try:
            # sirket_id parametresi KALDIRILDI
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            kullanim_res = supabase_client.table('genel_masraflar') \
                .select('id', count='exact') \
                .eq('kategori_id', kategori_id) \
                .execute()

            if kullanim_res.count > 0:
                raise ValueError(f"Bu kategori, {kullanim_res.count} masraf kaydında kullanıldığı için silinemez.")

            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('masraf_kategorileri') \
                .delete() \
                .eq('id', kategori_id) \
                .execute()

            if not response.data:
                raise ValueError("Kategori bulunamadı veya silme yetkiniz yok.")
            return True, None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Kategori silinirken hata: {e}", exc_info=True)
            return None, "Kategori silinirken bir sunucu hatası oluştu."

    # --- Masraf Fonksiyonları ---

    def get_paginated_expenses(self, sayfa: int, limit: int = 15):
        """Genel masraf kayıtlarını RLS kullanarak listeler."""
        try:
            offset = (sayfa - 1) * limit
            
            # g.supabase -> supabase_client
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            # 'kullanicilar' -> 'profiller' olarak join düzeltildi
            query = supabase_client.table('genel_masraflar').select(
                '*, profiller(kullanici_adi), masraf_kategorileri(kategori_adi)', 
                count='exact'
            )
            
            query = query.order('masraf_tarihi', desc=True).order('created_at', desc=True).range(offset, offset + limit - 1)
            response = query.execute()
            return response.data, response.count
        except Exception as e:
            logger.error(f"Genel masraflar listelenirken hata: {e}", exc_info=True)
            raise Exception("Masraflar listelenirken bir hata oluştu.")

    def add_expense(self, data: dict):
        """Yeni bir genel masraf kaydı ekler. ID'leri 'g' objesinden alır."""
        try:
            # 1. ID'leri 'g' objesinden al
            sirket_id = g.profile['sirket_id']
            kullanici_id_uuid = g.user.id # Artık UUID

            # 2. Verileri al
            tutar_str = data.get('tutar')
            masraf_tarihi = data.get('masraf_tarihi')
            kategori_id = data.get('kategori_id')

            if not all([tutar_str, masraf_tarihi, kategori_id]):
                raise ValueError("Tutar, masraf tarihi ve kategori zorunludur.")

            tutar = Decimal(tutar_str)
            if tutar <= 0:
                raise ValueError("Tutar pozitif bir değer olmalıdır.")

            datetime.strptime(masraf_tarihi, '%Y-%m-%d') # Tarih format kontrolü
            
            # 3. Yeni masraf verisini oluştur
            yeni_masraf = {
                "sirket_id": sirket_id,           # RLS 'WITH CHECK' için
                "kullanici_id": kullanici_id_uuid,  # Yeni UUID
                "kategori_id": int(kategori_id),
                "tutar": str(tutar),
                "masraf_tarihi": masraf_tarihi,
                "aciklama": sanitize_input(data.get('aciklama')) or None
            }
            
            response = supabase_client.table('genel_masraflar').insert(yeni_masraf).execute()
            return response.data[0], None
        except (InvalidOperation, TypeError):
            return None, "Lütfen tutar için geçerli bir sayı girin."
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Genel masraf eklenirken hata: {e}", exc_info=True)
            return None, "Masraf eklenirken bir sunucu hatası oluştu."

    def update_expense(self, masraf_id: int, data: dict):
        """Bir genel masraf kaydını RLS kullanarak günceller."""
        try:
            # sirket_id parametresi KALDIRILDI
            guncellenecek_veri = {}

            if 'tutar' in data:
                tutar = Decimal(data['tutar'])
                if tutar <= 0: raise ValueError("Tutar pozitif olmalıdır.")
                guncellenecek_veri['tutar'] = str(tutar)
            
            if 'masraf_tarihi' in data:
                datetime.strptime(data['masraf_tarihi'], '%Y-%m-%d')
                guncellenecek_veri['masraf_tarihi'] = data['masraf_tarihi']
            
            if 'kategori_id' in data:
                guncellenecek_veri['kategori_id'] = int(data['kategori_id'])
            
            if 'aciklama' in data:
                guncellenecek_veri['aciklama'] = sanitize_input(data.get('aciklama')) or None
            
            if not guncellenecek_veri:
                raise ValueError("Güncellenecek veri yok.")

            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('genel_masraflar') \
                .update(guncellenecek_veri) \
                .eq('id', masraf_id) \
                .execute()
            
            if not response.data:
                raise ValueError("Masraf kaydı bulunamadı veya güncelleme yetkiniz yok.")
            return response.data[0], None
        except (InvalidOperation, TypeError):
            return None, "Geçersiz tutar formatı."
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Masraf güncellenirken hata (ID: {masraf_id}): {e}", exc_info=True)
            return None, "Masraf güncellenirken bir sunucu hatası oluştu."

    def delete_expense(self, masraf_id: int):
        """Bir genel masraf kaydını RLS kullanarak siler."""
        try:
            # sirket_id parametresi KALDIRILDI
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('genel_masraflar') \
                .delete() \
                .eq('id', masraf_id) \
                .execute()
            
            if not response.data:
                raise ValueError("Masraf kaydı bulunamadı veya silme yetkiniz yok.")
            return True, None
        except ValueError as ve:
            return None, str(ve)
        except Exception as e:
            logger.error(f"Masraf silinirken hata (ID: {masraf_id}): {e}", exc_info=True)
            return None, "Masraf silinirken bir sunucu hatası oluştu."

    def get_expense_summary_by_date_range(self, baslangic_tarihi: str, bitis_tarihi: str):
        """
        Tarih aralığındaki toplam genel masraf tutarını RLS kullanarak hesaplar.
        """
        try:
            # sirket_id parametresi KALDIRILDI
            # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
            response = supabase_client.table('genel_masraflar') \
                .select('tutar') \
                .gte('masraf_tarihi', baslangic_tarihi) \
                .lte('masraf_tarihi', bitis_tarihi) \
                .execute()
            
            toplam_masraf = sum(Decimal(item.get('tutar', 0)) for item in response.data)
            return toplam_masraf, None
        except Exception as e:
            logger.error(f"Masraf özeti alınırken hata: {e}", exc_info=True)
            return None, "Masraf özeti hesaplanırken bir hata oluştu."

masraf_service = MasrafService()