# services/sut_service.py

from flask import g, session
from extensions import logger
from utils import (
    parse_supabase_timestamp, 
    turkey_tz, 
    sanitize_input, 
    get_today_start_end
)
from datetime import datetime, time
from decimal import Decimal, InvalidOperation
from constants import UserRole  # constants.py dosyasından UserRole'ü import et

class SutService:

    def get_daily_summary(self, sirket_id: int, date_str: str):
        """
        Belirtilen tarih için günlük süt özeti (toplam litre ve ortalama fiyat) 
        ve o gün girilen girdilerin listesini döndürür.
        """
        try:
            start_time, end_time = get_today_start_end(date_str)
            
            # RPC (Supabase fonksiyonu) çağırma
            # Bu fonksiyonun (get_daily_sut_summary) Supabase'de 
            # (veya `utils.py`/`extensions.py` içinde) tanımlı olması gerekir.
            # Eğer RPC yoksa, burayı SQL sorgusu ile değiştirmek gerekir.
            # Şimdilik RPC'nin var olduğunu varsayıyoruz:
            
            # Örnek RPC çağırma (Eğer RPC varsa):
            # rpc_params = {'p_sirket_id': sirket_id, 'p_start_time': start_time.isoformat(), 'p_end_time': end_time.isoformat()}
            # response = g.supabase.rpc('get_daily_sut_summary', rpc_params).execute()
            # summary_data = response.data

            # RPC YOKSA, MANUEL HESAPLAMA (Mevcut kodunuza daha yakın):
            response = g.supabase.table('sut_girdileri') \
                .select('id, litre, fiyat, tedarikciler(isim), kullanicilar(kullanici_adi), taplanma_tarihi, duzenlendi_mi') \
                .eq('sirket_id', sirket_id) \
                .gte('taplanma_tarihi', start_time.isoformat()) \
                .lte('taplanma_tarihi', end_time.isoformat()) \
                .order('taplanma_tarihi', desc=True) \
                .execute()

            if not response.data:
                return {'total_litre': 0, 'avg_fiyat': 0, 'entries': []}

            entries = response.data
            total_litre = Decimal(0)
            total_cost = Decimal(0)
            
            formatted_entries = []
            for entry in entries:
                litre = Decimal(entry['litre'])
                fiyat = Decimal(entry['fiyat'])
                total_litre += litre
                total_cost += (litre * fiyat)
                
                entry['tedarikci_isim'] = entry['tedarikciler']['isim'] if entry.get('tedarikciler') else 'Bilinmiyor'
                entry['kullanici_adi'] = entry['kullanicilar']['kullanici_adi'] if entry.get('kullanicilar') else 'Bilinmiyor'
                entry['taplanma_tarihi_formatted'] = parse_supabase_timestamp(entry['taplanma_tarihi']).astimezone(turkey_tz).strftime('%H:%M:%S')
                formatted_entries.append(entry)

            avg_fiyat = (total_cost / total_litre) if total_litre > 0 else Decimal(0)

            summary_data = {
                'total_litre': f"{total_litre:.2f}",
                'avg_fiyat': f"{avg_fiyat:.4f}",
                'entries': formatted_entries
            }
            # --- Manuel Hesaplama Sonu ---

            return summary_data

        except Exception as e:
            logger.error(f"Günlük süt özeti alınırken hata: {e}", exc_info=True)
            raise Exception("Günlük özet alınırken bir hata oluştu.")

    def get_paginated_list(self, sirket_id: int, page: int, per_page: int, filters: dict):
        """Tüm süt girdilerini filtreleyerek ve sayfalı olarak getirir."""
        try:
            query = g.supabase.table('sut_girdileri') \
                .select('*, tedarikciler(isim), kullanicilar(kullanici_adi)', count='exact') \
                .eq('sirket_id', sirket_id)

            # Filtreleme
            if filters.get('tedarikci_id'):
                query = query.eq('tedarikci_id', filters['tedarikci_id'])
            if filters.get('kullanici_id'):
                query = query.eq('kullanici_id', filters['kullanici_id'])
            if filters.get('start_date'):
                start_time = datetime.combine(datetime.strptime(filters['start_date'], '%Y-%m-%d').date(), time.min).astimezone(turkey_tz)
                query = query.gte('taplanma_tarihi', start_time.isoformat())
            if filters.get('end_date'):
                end_time = datetime.combine(datetime.strptime(filters['end_date'], '%Y-%m-%d').date(), time.max).astimezone(turkey_tz)
                query = query.lte('taplanma_tarihi', end_time.isoformat())

            # Sayfalama
            start_index = (page - 1) * per_page
            end_index = start_index + per_page - 1
            query = query.range(start_index, end_index).order('taplanma_tarihi', desc=True)

            response = query.execute()

            if not response.data:
                return [], 0

            return response.data, response.count
        except Exception as e:
            logger.error(f"Süt girdileri listelenirken hata: {e}", exc_info=True)
            raise Exception("Girdiler listelenirken bir hata oluştu.")

    def _get_toplayici_tanker(self, toplayici_id: int, sirket_id: int):
        """Yardımcı fonksiyon: Toplayıcının atanmış tankerini ve detaylarını getirir."""
        atama_res = g.supabase.table('toplayici_tanker_atama') \
            .select('tanker_id') \
            .eq('toplayici_id', toplayici_id) \
            .eq('sirket_id', sirket_id) \
            .maybe_single() \
            .execute()
            
        if not atama_res.data or not atama_res.data.get('tanker_id'):
            # Tanker atanmamışsa, girişe izin verme
            raise ValueError("Bu toplayıcıya atanmış aktif bir tanker bulunamadı. Lütfen yöneticinizle iletişime geçin.")
            
        tanker_id = atama_res.data['tanker_id']
        
        tanker_res = g.supabase.table('tankerler') \
            .select('id, kapasite_litre, mevcut_doluluk') \
            .eq('id', tanker_id) \
            .single() \
            .execute()
            
        if not tanker_res.data:
            # Atama var ama tanker silinmiş
            raise ValueError(f"Atanmış tanker (ID: {tanker_id}) sistemde bulunamadı.")
            
        return tanker_res.data

    def add_entry(self, sirket_id: int, kullanici_id: int, yeni_girdi: dict):
        """Yeni bir süt girdisi ekler VE GEREKİRSE TANKERİ GÜNCELLER."""
        try:
            litre_str = sanitize_input(yeni_girdi.get('litre'))
            fiyat_str = sanitize_input(yeni_girdi.get('fiyat'))
            tedarikci_id_to_add = yeni_girdi.get('tedarikci_id')

            if not tedarikci_id_to_add:
                 raise ValueError("Tedarikçi seçimi zorunludur.")
            if not litre_str or not fiyat_str:
                 raise ValueError("Litre ve Fiyat alanları zorunludur.")
            try:
                litre = Decimal(litre_str)
                fiyat = Decimal(fiyat_str)
            except (InvalidOperation, TypeError):
                 raise ValueError("Litre ve Fiyat geçerli bir sayı olmalıdır.")
            if litre <= 0 or fiyat < 0:
                raise ValueError("Litre pozitif, fiyat negatif olmayan bir değer olmalıdır.")

            user_role = session.get('user', {}).get('rol')
            
            # === YENİ TANKER MANTIĞI BAŞLANGICI ===
            tanker_id_to_update = None
            mevcut_doluluk = Decimal(0) # Eğer toplayıcı değilse bu 0 kalacak
            
            if user_role == UserRole.TOPLAYICI.value:
                # 1. Toplayıcının tedarikçi yetkisini kontrol et
                atama_res = g.supabase.table('toplayici_tedarikci_atananlari') \
                    .select('tedarikci_id', count='exact') \
                    .eq('toplayici_id', kullanici_id) \
                    .eq('tedarikci_id', tedarikci_id_to_add) \
                    .execute()
                if atama_res.count == 0:
                    logger.warning(f"Yetkisiz ekleme denemesi: Toplayıcı {kullanici_id}, Tedarikçi {tedarikci_id_to_add}")
                    raise ValueError("Bu tedarikçiye veri ekleme yetkiniz yok.")
                
                # 2. Toplayıcının tankerini bul ve kapasiteyi kontrol et
                tanker = self._get_toplayici_tanker(kullanici_id, sirket_id)
                kapasite = Decimal(tanker['kapasite_litre'])
                mevcut_doluluk = Decimal(tanker['mevcut_doluluk'])
                kalan_kapasite = kapasite - mevcut_doluluk
                
                if litre > kalan_kapasite:
                    raise ValueError(f"Tanker kapasitesi aşıldı! Kalan kapasite: {kalan_kapasite:.2f} L. Girmek istediğiniz: {litre} L.")
                
                tanker_id_to_update = tanker['id']
            # === YENİ TANKER MANTIĞI SONU ===

            insert_data = {
                'tedarikci_id': tedarikci_id_to_add,
                'litre': str(litre),
                'fiyat': str(fiyat),
                'kullanici_id': kullanici_id,
                'sirket_id': sirket_id
            }
            response = g.supabase.table('sut_girdileri').insert(insert_data).execute()

            if not response.data:
                 raise Exception("Veritabanına kayıt sırasında bir sorun oluştu.")

            # === YENİ TANKER GÜNCELLEME ADIMI ===
            if tanker_id_to_update:
                try:
                    yeni_doluluk = mevcut_doluluk + litre
                    g.supabase.table('tankerler') \
                        .update({'mevcut_doluluk': str(yeni_doluluk)}) \
                        .eq('id', tanker_id_to_update) \
                        .execute()
                    logger.info(f"Tanker (ID: {tanker_id_to_update}) doluluğu {yeni_doluluk} L olarak güncellendi.")
                except Exception as tanker_e:
                    # Tanker güncellenemezse, süt girdisini sil (Atomik işlem)
                    logger.error(f"Tanker GÜNCELLEME HATASI: {tanker_e}. Süt girdisi (ID: {response.data[0]['id']}) geri alınıyor...", exc_info=True)
                    g.supabase.table('sut_girdileri').delete().eq('id', response.data[0]['id']).execute()
                    raise Exception(f"Tanker güncellenemedi, süt girişi iptal edildi. Hata: {tanker_e}")
            # === TANKER GÜNCELLEME SONU ===
            
            return response.data[0]

        except ValueError as ve:
            # Bilinen hatalar (kapasite, yetki vb.)
            raise ve
        except Exception as e:
            logger.error(f"Süt girdisi eklenirken BİLİNMEYEN hata: {e}", exc_info=True)
            raise Exception("Girdi eklenirken bir sunucu hatası oluştu.")

    def update_entry(self, girdi_id: int, sirket_id: int, duzenleyen_kullanici_id: int, data: dict):
        """Mevcut bir süt girdisini günceller VE GEREKİRSE TANKERİ GÜNCELLER."""
        try:
            # **Adım 1: Yeni verileri al ve doğrula**
            yeni_litre_str = sanitize_input(data.get('yeni_litre'))
            yeni_fiyat_str = sanitize_input(data.get('yeni_fiyat'))

            if not yeni_litre_str or not yeni_fiyat_str:
                raise ValueError("Yeni litre ve fiyat zorunludur.")
            try:
                yeni_litre = Decimal(yeni_litre_str)
                yeni_fiyat = Decimal(yeni_fiyat_str)
            except (InvalidOperation, TypeError):
                raise ValueError("Litre ve Fiyat geçerli bir sayı olmalıdır.")
            if yeni_litre <= 0 or yeni_fiyat < 0:
                raise ValueError("Litre pozitif, fiyat negatif olmayan bir değer olmalıdır.")

            # **Adım 2: Mevcut girdiyi ve yetkiyi kontrol et**
            mevcut_girdi_res = g.supabase.table('sut_girdileri') \
                .select('id, litre, fiyat, kullanici_id, tedarikci_id, taplanma_tarihi, sirket_id') \
                .eq('id', girdi_id).eq('sirket_id', sirket_id).maybe_single().execute()
            if not mevcut_girdi_res.data:
                raise ValueError("Girdi bulunamadı veya bu şirkete ait değil.")
            
            mevcut_girdi = mevcut_girdi_res.data
            girdi_sahibi_id = mevcut_girdi.get('kullanici_id')
            eski_litre = Decimal(mevcut_girdi.get('litre'))
            eski_fiyat = Decimal(mevcut_girdi.get('fiyat'))
            
            # Yetki kontrolü
            duzenleyen_rol = session.get('user', {}).get('rol')
            if duzenleyen_rol != UserRole.FIRMA_YETKILISI.value and duzenleyen_kullanici_id != girdi_sahibi_id:
                raise ValueError("Bu girdiyi düzenleme yetkiniz yok.")

            # === YENİ TANKER GÜNCELLEME KONTROLÜ ===
            tanker_id_to_update = None
            litre_farki = yeni_litre - eski_litre # Pozitif (artış) veya negatif (azalış) olabilir
            
            # Eğer girdinin sahibi bir toplayıcı ise, tankerini güncelle
            girdi_sahibi_rol_res = g.supabase.table('kullanicilar').select('rol').eq('id', girdi_sahibi_id).single().execute()
            girdi_sahibi_rol = girdi_sahibi_rol_res.data.get('rol') if girdi_sahibi_rol_res.data else None
            
            mevcut_doluluk = Decimal(0)
            
            if girdi_sahibi_rol == UserRole.TOPLAYICI.value:
                try:
                    tanker = self._get_toplayici_tanker(girdi_sahibi_id, sirket_id)
                    tanker_id_to_update = tanker['id']
                    mevcut_doluluk = Decimal(tanker['mevcut_doluluk'])
                    kapasite = Decimal(tanker['kapasite_litre'])
                    
                    if litre_farki > 0: # Litre artıyorsa
                        kalan_kapasite = kapasite - mevcut_doluluk
                        if litre_farki > kalan_kapasite:
                            raise ValueError(f"Tanker kapasitesi aşıldı! Kalan kapasite: {kalan_kapasite:.2f} L. Eklemek istediğiniz fark: {litre_farki} L.")
                    
                    # Eğer litre azalıyorsa (litre_farki negatif) ve mevcut doluluktan fazla azalıyorsa
                    elif litre_farki < 0 and (mevcut_doluluk + litre_farki) < 0:
                         logger.warning(f"Tanker (ID: {tanker_id_to_update}) doluluğu, {mevcut_doluluk} L olmasına rağmen {litre_farki} L azaltılmaya çalışıldı. 0'a eşitleniyor.")
                         # Tankeri 0'a eşitle, farkı güncelleme (litre_farki = -mevcut_doluluk)
                         litre_farki = -mevcut_doluluk
                
                except ValueError as ve:
                     # Tanker atanmamışsa veya bulunamadıysa (eski kayıt vb)
                     logger.warning(f"Tanker güncelleme atlandı (update_entry): {ve}")
                     tanker_id_to_update = None # Tanker güncellemesi yapma
                     litre_farki = Decimal(0)
            
            # === TANKER KONTROLÜ SONU ===

            # **Adım 3: Değişiklik geçmişini kaydet**
            gecmis_data = {
                'orijinal_girdi_id': girdi_id,
                'eski_litre': str(eski_litre),
                'eski_fiyat': str(eski_fiyat),
                'yeni_litre': str(yeni_litre),
                'yeni_fiyat': str(yeni_fiyat),
                'duzenleyen_kullanici_id': duzenleyen_kullanici_id,
                'sirket_id': sirket_id
            }
            g.supabase.table('girdi_gecmisi').insert(gecmis_data).execute()
            
            # **Adım 4: Ana girdiyi güncelle**
            guncellenecek_veri = {
                'duzenlendi_mi': True,
                'litre': str(yeni_litre),
                'fiyat': str(yeni_fiyat)
            }
            update_response = g.supabase.table('sut_girdileri') \
                    .update(guncellenecek_veri) \
                    .eq('id', girdi_id) \
                    .execute()

            # **Adım 5: Tankeri Güncelle** (Eğer gerekiyorsa)
            if tanker_id_to_update and litre_farki != 0:
                try:
                    yeni_doluluk = mevcut_doluluk + litre_farki
                    g.supabase.table('tankerler') \
                        .update({'mevcut_doluluk': str(yeni_doluluk)}) \
                        .eq('id', tanker_id_to_update) \
                        .execute()
                    logger.info(f"Tanker (ID: {tanker_id_to_update}) doluluğu {litre_farki} L değiştirildi. Yeni doluluk: {yeni_doluluk} L.")
                except Exception as tanker_e:
                    # Tanker güncellenemezse, süt girdisini geri al (Eski haline getir)
                    logger.error(f"Tanker GÜNCELLEME HATASI (Update): {tanker_e}. Süt girdisi (ID: {girdi_id}) eski haline döndürülüyor...", exc_info=True)
                    g.supabase.table('sut_girdileri') \
                        .update({'duzenlendi_mi': False, 'litre': str(eski_litre), 'fiyat': str(eski_fiyat)}) \
                        .eq('id', girdi_id) \
                        .execute()
                    # Geçmiş kaydını sil
                    g.supabase.table('girdi_gecmisi').delete().eq('orijinal_girdi_id', girdi_id).execute()
                    raise Exception(f"Tanker güncellenemedi, süt güncellemesi iptal edildi. Hata: {tanker_e}")

            # **Adım 6: Güncel veriyi döndür**
            guncel_girdi_res = g.supabase.table('sut_girdileri') \
                .select('*, tedarikciler(isim), kullanicilar(kullanici_adi)') \
                .eq('id', girdi_id) \
                .single() \
                .execute()
            
            girdi_tarihi_str_db = mevcut_girdi.get('taplanma_tarihi')
            girdi_tarihi_str_formatted = datetime.now(turkey_tz).date().isoformat()
            if girdi_tarihi_str_db:
                try:
                    girdi_tarihi = parse_supabase_timestamp(girdi_tarihi_str_db)
                    if girdi_tarihi: 
                        girdi_tarihi_str_formatted = girdi_tarihi.astimezone(turkey_tz).date().isoformat()
                except Exception as parse_e: 
                    logger.warning(f"taplanma_tarihi parse edilirken hata: {parse_e}")
            
            return guncel_girdi_res.data, girdi_tarihi_str_formatted

        except ValueError as ve:
             raise ve
        except Exception as e:
            logger.error(f"Süt girdisi güncellenirken BİLİNMEYEN hata: {e}", exc_info=True)
            raise Exception("Güncelleme sırasında bir sunucu hatası oluştu.")

    def delete_entry(self, girdi_id: int, sirket_id: int):
        """Bir süt girdisini siler VE GEREKİRSE TANKERİ GÜNCELLER."""
        try:
            silen_kullanici_id = session.get('user', {}).get('id')
            silen_rol = session.get('user', {}).get('rol')

            # **Adım 1: Girdiyi ve sahibini bul**
            mevcut_girdi_res = g.supabase.table('sut_girdileri') \
                .select('sirket_id, taplanma_tarihi, kullanici_id, litre') \
                .eq('id', girdi_id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single() \
                .execute()
            if not mevcut_girdi_res.data:
                raise ValueError("Girdi bulunamadı veya silme yetkiniz yok.")
            
            mevcut_girdi = mevcut_girdi_res.data
            girdi_sahibi_id = mevcut_girdi.get('kullanici_id')
            silinen_litre = Decimal(mevcut_girdi.get('litre'))
            
            # **Adım 2: Yetkiyi kontrol et**
            if silen_rol != UserRole.FIRMA_YETKILISI.value and silen_kullanici_id != girdi_sahibi_id:
                raise ValueError("Bu girdiyi silme yetkiniz yok.")

            girdi_tarihi_str_db = mevcut_girdi.get('taplanma_tarihi')
            girdi_tarihi_str_formatted = datetime.now(turkey_tz).date().isoformat()
            if girdi_tarihi_str_db:
                girdi_tarihi = parse_supabase_timestamp(girdi_tarihi_str_db)
                if girdi_tarihi:
                    girdi_tarihi_str_formatted = girdi_tarihi.astimezone(turkey_tz).date().isoformat()

            # **Adım 3: Tanker Güncelleme Kontrolü (Silme)**
            girdi_sahibi_rol_res = g.supabase.table('kullanicilar').select('rol').eq('id', girdi_sahibi_id).single().execute()
            girdi_sahibi_rol = girdi_sahibi_rol_res.data.get('rol') if girdi_sahibi_rol_res.data else None

            tanker_id_to_update = None
            mevcut_doluluk = Decimal(0)
            
            if girdi_sahibi_rol == UserRole.TOPLAYICI.value:
                try:
                    tanker = self._get_toplayici_tanker(girdi_sahibi_id, sirket_id)
                    tanker_id_to_update = tanker['id']
                    mevcut_doluluk = Decimal(tanker['mevcut_doluluk'])
                except ValueError as ve:
                    logger.warning(f"Tanker güncelleme atlandı (delete_entry): {ve}")
                    tanker_id_to_update = None # Tanker bulunamazsa silmeye devam et
            
            # **Adım 4: Girdiyi Sil**
            # (Önce girdiyi sil, tanker güncellenemezse manuel düzeltme gerekir, 
            #  ama silmeyi engelleme)
            
            logger.info(f"Girdi geçmişi siliniyor: Orijinal Girdi ID {girdi_id}")
            g.supabase.table('girdi_gecmisi').delete().eq('orijinal_girdi_id', girdi_id).execute()
            
            logger.info(f"Süt girdisi siliniyor: ID {girdi_id}")
            g.supabase.table('sut_girdileri').delete().eq('id', girdi_id).execute()
            
            # **Adım 5: Tankeri Güncelle**
            if tanker_id_to_update:
                try:
                    yeni_doluluk = mevcut_doluluk - silinen_litre
                    if yeni_doluluk < 0:
                        logger.warning(f"Tanker (ID: {tanker_id_to_update}) doluluğu ({mevcut_doluluk} L) silinen litreden ({silinen_litre} L) az. 0'a eşitleniyor.")
                        yeni_doluluk = Decimal('0')
                        
                    g.supabase.table('tankerler') \
                        .update({'mevcut_doluluk': str(yeni_doluluk)}) \
                        .eq('id', tanker_id_to_update) \
                        .execute()
                    logger.info(f"Tanker (ID: {tanker_id_to_update}) doluluğu {silinen_litre} L azaltıldı. Yeni doluluk: {yeni_doluluk} L.")
                except Exception as tanker_e:
                    # Silme işlemi geri alınamaz, bu yüzden sadece logla
                    logger.error(f"Tanker GÜNCELLEME HATASI (Delete): {tanker_e}. Girdi (ID: {girdi_id}) zaten silindi. Lütfen Tanker (ID: {tanker_id_to_update}) doluluğunu manuel kontrol edin!", exc_info=True)

            return girdi_tarihi_str_formatted

        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Süt girdisi silinirken BİLİNMEYEN hata: {e}", exc_info=True)
            raise Exception("Silme işlemi sırasında bir hata oluştu.")
            
    def get_entry_history(self, girdi_id: int, sirket_id: int):
        """Bir süt girdisinin düzenleme geçmişini getirir."""
        try:
            # Ana girdinin şirket ID'sini doğrula
            ana_girdi_res = g.supabase.table('sut_girdileri') \
                .select('id') \
                .eq('id', girdi_id) \
                .eq('sirket_id', sirket_id) \
                .maybe_single() \
                .execute()
            
            if not ana_girdi_res.data:
                raise ValueError("Ana girdi bulunamadı veya yetkiniz yok.")
                
            response = g.supabase.table('girdi_gecmisi') \
                .select('*, kullanicilar(kullanici_adi)') \
                .eq('orijinal_girdi_id', girdi_id) \
                .order('degisiklik_tarihi', desc=True) \
                .execute()
            
            return response.data
        except ValueError as ve:
            raise ve
        except Exception as e:
            logger.error(f"Girdi geçmişi alınırken hata: {e}", exc_info=True)
            raise Exception("Girdi geçmişi alınırken bir hata oluştu.")

    def get_last_price_for_supplier(self, tedarikci_id: int, sirket_id: int):
        """Bir tedarikçi için girilen son süt fiyatını getirir."""
        try:
            response = g.supabase.table('sut_girdileri') \
                .select('fiyat') \
                .eq('tedarikci_id', tedarikci_id) \
                .eq('sirket_id', sirket_id) \
                .order('taplanma_tarihi', desc=True) \
                .limit(1) \
                .maybe_single() \
                .execute()

            if response.data:
                return {'last_price': str(response.data['fiyat'])}
            else:
                return {'last_price': None}
        except Exception as e:
            logger.error(f"Tedarikçi son fiyatı alınırken hata: {e}", exc_info=True)
            raise Exception("Son fiyat bilgisi alınamadı.")

sut_service = SutService()