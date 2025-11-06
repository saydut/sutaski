# services/report_service.py

# YENİ: Eksik importlar eklendi
from flask import render_template, current_app, send_file, g
from extensions import turkey_tz
from weasyprint import HTML
from datetime import datetime
import calendar
import io
from decimal import Decimal
import logging
import pytz # YENİ: pytz import edildi

# YENİ: constants import edildi
from constants import FinansIslemTipi
# YENİ: utils'dan parse_supabase_timestamp import edildi (hata ayıklama için)
from utils import parse_supabase_timestamp

logger = logging.getLogger(__name__)

# --- generate_aylik_rapor_pdf (Değişiklik Yok) ---
def generate_aylik_rapor_pdf(sirket_id, sirket_adi, ay, yil):
    """Genel aylık rapor (tedarikçi ve gün dökümlü) PDF'ini oluşturur."""
    try:
        # 1. Tarih aralığını hesapla
        _, ayin_son_gunu = calendar.monthrange(yil, ay)
        baslangic_tarihi_str = f"{yil}-{ay:02d}-01"
        bitis_tarihi_str = f"{yil}-{ay:02d}-{ayin_son_gunu}"

        # 2. GÜNLÜK DÖKÜM verisini çek (v_gunluk_sut_ozetleri view'ından)
        gunluk_res = g.supabase.table('v_gunluk_sut_ozetleri') \
            .select('gun, toplam_litre, girdi_sayisi') \
            .eq('sirket_id', sirket_id) \
            .gte('gun', baslangic_tarihi_str) \
            .lte('gun', bitis_tarihi_str) \
            .order('gun', desc=False) \
            .execute()
        
        gunluk_dokum_verisi = gunluk_res.data or []
        
        # Template için formatla ve özet verileri hesapla
        gunluk_dokum = []
        toplam_litre = Decimal('0')
        toplam_girdi = 0
        for gun in gunluk_dokum_verisi:
            toplam_litre += Decimal(str(gun.get('toplam_litre', '0')))
            toplam_girdi += int(gun.get('girdi_sayisi', 0))
            gunluk_dokum.append({
                'tarih': datetime.strptime(gun['gun'], '%Y-%m-%d').strftime('%d.%m.%Y'),
                'toplam_litre': Decimal(str(gun.get('toplam_litre', '0'))),
                'girdi_sayisi': int(gun.get('girdi_sayisi', 0))
            })

        # 3. TEDARİKÇİ DÖKÜMÜ verisini çek (Manuel gruplama ile)
        start_utc = turkey_tz.localize(datetime.strptime(f"{baslangic_tarihi_str} 00:00:00", '%Y-%m-%d %H:%M:%S')).astimezone(pytz.utc).isoformat()
        end_utc = turkey_tz.localize(datetime.strptime(f"{bitis_tarihi_str} 23:59:59", '%Y-%m-%d %H:%M:%S')).astimezone(pytz.utc).isoformat()

        tedarikci_res = g.supabase.table('sut_girdileri') \
            .select('litre, tedarikciler(isim)') \
            .eq('sirket_id', sirket_id) \
            .gte('taplanma_tarihi', start_utc) \
            .lte('taplanma_tarihi', end_utc) \
            .execute()
        
        tedarikci_dokumu_dict = {}
        if tedarikci_res.data:
            for girdi in tedarikci_res.data:
                if not girdi.get('tedarikciler'):
                    continue # Tedarikçisi silinmiş girdileri atla
                isim = girdi['tedarikciler']['isim']
                if isim not in tedarikci_dokumu_dict:
                    tedarikci_dokumu_dict[isim] = {'toplam_litre': Decimal('0'), 'girdi_sayisi': 0, 'isim': isim}
                
                tedarikci_dokumu_dict[isim]['toplam_litre'] += Decimal(str(girdi.get('litre', '0')))
                tedarikci_dokumu_dict[isim]['girdi_sayisi'] += 1
        
        tedarikci_dokumu = sorted(tedarikci_dokumu_dict.values(), key=lambda x: x['toplam_litre'], reverse=True)

        # 4. ÖZET Verisini hazırla
        gun_sayisi = (datetime.strptime(bitis_tarihi_str, '%Y-%m-%d') - datetime.strptime(baslangic_tarihi_str, '%Y-%m-%d')).days + 1
        ozet = {
            'toplam_litre': toplam_litre,
            'girdi_sayisi': toplam_girdi,
            'gunluk_ortalama': (toplam_litre / gun_sayisi) if gun_sayisi > 0 else 0
        }

        # 5. PDF Render
        aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
        rapor_basligi = f"{aylar[ay-1]} {yil} Aylık Süt Raporu"

        html_out = render_template(
            'aylik_rapor_pdf.html',
            rapor_basligi=rapor_basligi,
            sirket_adi=sirket_adi,
            olusturma_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y %H:%M'),
            ozet=ozet,
            tedarikci_dokumu=tedarikci_dokumu,
            gunluk_dokum=gunluk_dokum
        )
        
        pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
        filename = f"{yil}_{ay:02d}_{sirket_adi.replace(' ', '_')}_aylik_rapor.pdf"
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)

    except Exception as e:
        logger.error(f"Aylık PDF raporu oluşturulurken (generate_aylik_rapor_pdf) hata: {e}", exc_info=True)
        # Hata mesajını daha anlaşılır kılmak için ValueError olarak fırlatalım
        raise ValueError(f"PDF oluşturulurken bir hata oluştu: {e}")


# --- _get_aylik_tedarikci_verileri (GÜNCELLENDİ) ---
def _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil):
    """Belirtilen ay içindeki tüm verileri PDF için güncellenmiş RPC çağrısıyla çeker."""
    try:
        _, ayin_son_gunu = calendar.monthrange(yil, ay)
        baslangic_tarihi_str = f"{yil}-{ay:02d}-01"
        bitis_tarihi_str = f"{yil}-{ay:02d}-{ayin_son_gunu}"

        response = g.supabase.rpc('get_monthly_supplier_report_data', {
            'p_sirket_id': sirket_id,
            'p_tedarikci_id': tedarikci_id,
            'p_start_date': baslangic_tarihi_str,
            'p_end_date': bitis_tarihi_str
        }).execute()

        if not response.data:
            logger.warning(f"RPC get_monthly_supplier_report_data veri döndürmedi...")
            # ... (boş veri döndürme kısmı aynı)
            return {
                "sut_girdileri": [],
                "yem_islemleri": [],
                "finansal_islemler": [],
                "ozet": {
                    "toplam_sut_tutari": Decimal('0'),
                    "toplam_yem_borcu": Decimal('0'),
                    "toplam_sirket_odemesi": Decimal('0'), 
                    "toplam_tahsilat": Decimal('0')
                }
            }

        data = response.data 
        ozet = data.get('ozet', {})
        # ... (ozet formatlama kısmı aynı)
        ozet['toplam_sut_tutari'] = Decimal(str(ozet.get('toplam_sut_tutari', '0')))
        ozet['toplam_yem_borcu'] = Decimal(str(ozet.get('toplam_yem_borcu', '0')))
        ozet['toplam_sirket_odemesi'] = Decimal(str(ozet.get('toplam_sirket_odemesi', '0'))) 
        ozet['toplam_tahsilat'] = Decimal(str(ozet.get('toplam_tahsilat', '0')))
        data['ozet'] = ozet

        # --- GÜNCELLEME: Süt girdilerini işle (Artık tarih alanı yok) ---
        for girdi in data.get('sut_girdileri', []):
            try:
                girdi['tutar'] = Decimal(str(girdi.get('toplam_tutar', '0')))
                girdi['litre'] = Decimal(str(girdi.get('litre', '0'))) 
                girdi['fiyat'] = Decimal(str(girdi.get('fiyat', '0'))) 
            except Exception as e:
                logger.error(f"Süt girdisi tutarı işlenirken hata: {girdi}, Hata: {e}")
                girdi['tutar'] = Decimal('0')
                girdi['litre'] = Decimal('0')
                girdi['fiyat'] = Decimal('0')
        # --- GÜNCELLEME SONU ---


        # Finansal işlemleri işle (DEĞİŞİKLİK YOK, TARİH KALIYOR)
        for islem in data.get('finansal_islemler', []):
             islem['islem_tarihi'] = islem.get('islem_tarihi_formatted', islem.get('islem_tarihi'))
             try:
                 islem['tutar'] = Decimal(str(islem.get('tutar', '0')))
             except Exception as e:
                 logger.error(f"Finansal işlem tutarı işlenirken hata: {islem}, Hata: {e}")
                 islem['tutar'] = Decimal('0')

        # --- GÜNCELLEME: Yem işlemlerini işle (Artık tarih alanı yok) ---
        for islem in data.get('yem_islemleri', []):
             # islem['islem_tarihi'] = ... satırı kaldırıldı
             try:
                 islem['miktar_kg'] = Decimal(str(islem.get('miktar_kg', '0')))
                 islem['islem_anindaki_birim_fiyat'] = Decimal(str(islem.get('islem_anindaki_birim_fiyat', '0')))
                 islem['toplam_tutar'] = Decimal(str(islem.get('toplam_tutar', '0')))
             except Exception as e:
                 logger.error(f"Yem işlemi tutarları işlenirken hata: {islem}, Hata: {e}")
                 islem['miktar_kg'] = Decimal('0')
                 islem['islem_anindaki_birim_fiyat'] = Decimal('0')
                 islem['toplam_tutar'] = Decimal('0')
        # --- GÜNCELLEME SONU ---

        return data
    except Exception as e:
        logger.error(f"Aylık tedarikçi verileri (RPC: get_monthly_supplier_report_data) alınırken hata: {e}", exc_info=True)
        raise Exception("Rapor verileri alınırken bir hata oluştu.")


# --- generate_hesap_ozeti_pdf (Değişiklik Yok) ---
def generate_hesap_ozeti_pdf(sirket_id, sirket_adi, tedarikci_id, ay, yil):
    """Tedarikçi için aylık hesap özeti PDF'i oluşturur ve döndürür (GÜNCELLENMİŞ HESAPLAMA)."""
    tedarikci_res = g.supabase.table('tedarikciler').select('isim').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
    if not tedarikci_res.data:
        raise ValueError("Tedarikçi bulunamadı veya yetkiniz yok.")

    veri = _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil)
    ozet_rpc = veri["ozet"]

    net_bakiye = (
        ozet_rpc["toplam_sut_tutari"]
        - ozet_rpc["toplam_yem_borcu"]
        - ozet_rpc["toplam_sirket_odemesi"] 
        + ozet_rpc["toplam_tahsilat"]
    )

    ozet_pdf = {
        'toplam_sut_alacagi': ozet_rpc["toplam_sut_tutari"],
        'toplam_yem_borcu': ozet_rpc["toplam_yem_borcu"],
        'toplam_sirket_odemesi': ozet_rpc["toplam_sirket_odemesi"], 
        'toplam_tahsilat': ozet_rpc["toplam_tahsilat"],
        'net_bakiye': net_bakiye
    }

    aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    rapor_basligi = f"{aylar[ay-1]} {yil} Hesap Özeti"

    sirket_odemeleri = [i for i in veri["finansal_islemler"] if i['islem_tipi'] in [FinansIslemTipi.ODEME.value, FinansIslemTipi.AVANS.value]]
    tahsilatlar = [i for i in veri["finansal_islemler"] if i['islem_tipi'] == FinansIslemTipi.TAHSILAT.value]


    html_out = render_template(
        'tedarikci_hesap_ozeti_pdf.html',
        rapor_basligi=rapor_basligi,
        sirket_adi=sirket_adi,
        tedarikci_adi=tedarikci_res.data['isim'],
        olusturma_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y %H:%M'),
        ozet=ozet_pdf,
        sut_girdileri=veri["sut_girdileri"],
        yem_islemleri=veri["yem_islemleri"],
        sirket_odemeleri=sirket_odemeleri,
        tahsilatlar=tahsilatlar
    )

    try:
        pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
        filename = f"{yil}_{ay:02d}_{tedarikci_res.data['isim'].replace(' ', '_')}_hesap_ozeti.pdf"
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)
    except Exception as e:
        logger.error(f"Hesap özeti PDF oluşturulurken WeasyPrint hatası: {e}", exc_info=True)
        raise Exception(f"PDF oluşturulurken bir hata oluştu: {e}")

# --- generate_mustahsil_makbuzu_pdf (Değişiklik Yok) ---
def generate_mustahsil_makbuzu_pdf(sirket_id, tedarikci_id, ay, yil):
    """Tedarikçi için müstahsil makbuzu PDF'i oluşturur ve döndürür (GÜNCELLENMİŞ HESAPLAMA)."""
    tedarikci_res = g.supabase.table('tedarikciler').select('isim, tc_no, adres').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
    sirket_res = g.supabase.table('sirketler').select('sirket_adi, adres, vergi_kimlik_no').eq('id', sirket_id).single().execute()
    if not tedarikci_res.data or not sirket_res.data:
        raise ValueError("Gerekli şirket veya tedarikçi bilgisi bulunamadı.")

    veri = _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil)
    ozet_rpc = veri["ozet"]

    stopaj_orani = Decimal('0.01') # %1 Stopaj
    stopaj_tutari = ozet_rpc["toplam_sut_tutari"] * stopaj_orani

    net_odenecek = (
        (ozet_rpc["toplam_sut_tutari"] - stopaj_tutari)
        - ozet_rpc["toplam_yem_borcu"]
        - ozet_rpc["toplam_sirket_odemesi"] 
        + ozet_rpc["toplam_tahsilat"]
    )

    ozet_pdf = {
        'toplam_sut_tutari': ozet_rpc["toplam_sut_tutari"],
        'stopaj_tutari': stopaj_tutari,
        'toplam_yem_borcu': ozet_rpc["toplam_yem_borcu"],
        'toplam_sirket_odemesi': ozet_rpc["toplam_sirket_odemesi"],
        'toplam_tahsilat': ozet_rpc["toplam_tahsilat"],
        'net_odenecek': net_odenecek
    }

    sirket_odemeleri = [i for i in veri["finansal_islemler"] if i['islem_tipi'] in [FinansIslemTipi.ODEME.value, FinansIslemTipi.AVANS.value]]
    tahsilatlar = [i for i in veri["finansal_islemler"] if i['islem_tipi'] == FinansIslemTipi.TAHSILAT.value]

    html_out = render_template(
        'mustahsil_makbuzu_pdf.html',
        sirket=sirket_res.data,
        tedarikci=tedarikci_res.data,
        makbuz_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y'),
        sut_girdileri=veri["sut_girdileri"],
        yem_islemleri=veri["yem_islemleri"],
        sirket_odemeleri=sirket_odemeleri,
        tahsilatlar=tahsilatlar,
        ozet=ozet_pdf,
        stopaj_orani=stopaj_orani
    )

    try:
        pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
        filename = f"{yil}_{ay:02d}_{tedarikci_res.data['isim'].replace(' ', '_')}_mustahsil.pdf"
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)
    except Exception as e:
        logger.error(f"Müstahsil makbuzu PDF oluşturulurken WeasyPrint hatası: {e}", exc_info=True)
        raise Exception(f"PDF oluşturulurken bir hata oluştu: {e}")
    



# services/report_service.py içindeki bu fonksiyonu GÜNCELLE

def get_profitability_report(sirket_id: int, baslangic: str, bitis: str):
    """
    Şirketin kârlılık raporunu yeni 'get_karlilik_raporu' RPC'sini
    kullanarak alır ve Decimal'e çevirir.
    """
    try:
        datetime.strptime(baslangic, '%Y-%m-%d')
        datetime.strptime(bitis, '%Y-%m-%d')

        # DÜZELTME BURADA: Parametre adları SQL fonksiyonuyla eşleşmeli
        response = g.supabase.rpc('get_karlilik_raporu', {
            'p_sirket_id': sirket_id,
            'p_start_date': baslangic, # p_baslangic_tarihi idi
            'p_end_date': bitis         # p_bitis_tarihi idi
        }).execute()

        if response.data:
            # GÜNCELLEME: RPC'den dönen veri artık tek bir JSON objesi
            # (Eğer liste dönerse ilk elemanı al, değilse direkt veriyi al)
            data = response.data[0] if isinstance(response.data, list) and len(response.data) > 0 else response.data
            
            if not isinstance(data, dict):
                 logger.warning("get_karlilik_raporu RPC'si beklenen formatta (dict) veri döndürmedi.")
                 return None

            # GÜNCELLEME: Rapor SQL'inden (Mesaj 46) gelen yeni anahtarlar
            formatted_data = {
                "sut_geliri": Decimal(str(data.get('sut_geliri', '0'))),
                "sut_maliyeti": Decimal(str(data.get('sut_maliyeti', '0'))),
                "sut_kari": Decimal(str(data.get('sut_kari', '0'))),
                "yem_geliri": Decimal(str(data.get('yem_geliri', '0'))),
                "yem_maliyeti": Decimal(str(data.get('yem_maliyeti', '0'))),
                "yem_kari": Decimal(str(data.get('yem_kari', '0'))),
                "diger_gelirler": Decimal(str(data.get('diger_gelirler', '0'))),
                "diger_giderler": Decimal(str(data.get('diger_giderler', '0'))),
                "toplam_gelir": Decimal(str(data.get('toplam_gelir', '0'))),
                "toplam_gider": Decimal(str(data.get('toplam_gider', '0'))),
                "net_kar": Decimal(str(data.get('net_kar', '0')))
            }
            return formatted_data
        
        logger.warning("get_karlilik_raporu RPC'si boş veri döndürdü.")
        return None 

    except ValueError:
        logger.warning(f"get_profitability_report: Geçersiz tarih formatı alındı.")
        raise ValueError("Geçersiz tarih formatı. YYYY-MM-DD bekleniyor.")
    except Exception as e:
        logger.error(f"get_karlilik_raporu RPC hatası: {e}", exc_info=True)
        raise Exception("Kârlılık raporu verileri alınamadı.")