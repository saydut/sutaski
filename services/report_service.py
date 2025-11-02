# services/report_service.py

from flask import render_template, current_app, send_file, g
from extensions import turkey_tz
from weasyprint import HTML
from datetime import datetime
import calendar
import io
from decimal import Decimal
import logging
# YENİ: constants import edildi
from constants import FinansIslemTipi

logger = logging.getLogger(__name__)

def _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil):
    """Belirtilen ay içindeki tüm verileri PDF için güncellenmiş RPC çağrısıyla çeker."""
    try:
        _, ayin_son_gunu = calendar.monthrange(yil, ay)
        baslangic_tarihi_str = f"{yil}-{ay:02d}-01"
        bitis_tarihi_str = f"{yil}-{ay:02d}-{ayin_son_gunu}"

        # Güncellenmiş RPC fonksiyonunu çağır
        response = g.supabase.rpc('get_monthly_supplier_report_data', {
            'p_sirket_id': sirket_id,
            'p_tedarikci_id': tedarikci_id,
            'p_start_date': baslangic_tarihi_str,
            'p_end_date': bitis_tarihi_str
        }).execute()

        if not response.data:
            # RPC'den veri dönmezse varsayılan boş yapı döndür
            logger.warning(f"RPC get_monthly_supplier_report_data veri döndürmedi. Sirket: {sirket_id}, Tedarikçi: {tedarikci_id}, Ay/Yıl: {ay}/{yil}")
            return {
                "sut_girdileri": [],
                "yem_islemleri": [],
                "finansal_islemler": [],
                "ozet": {
                    "toplam_sut_tutari": Decimal('0'),
                    "toplam_yem_borcu": Decimal('0'),
                    "toplam_sirket_odemesi": Decimal('0'), # Yeni alan
                    "toplam_tahsilat": Decimal('0')        # Yeni alan
                }
            }

        # --- GÜNCELLEME: RPC'den gelen yeni özet alanlarını işle ---
        data = response.data
        ozet = data.get('ozet', {})
        # Decimal'e çevir
        ozet['toplam_sut_tutari'] = Decimal(str(ozet.get('toplam_sut_tutari', '0')))
        ozet['toplam_yem_borcu'] = Decimal(str(ozet.get('toplam_yem_borcu', '0')))
        ozet['toplam_sirket_odemesi'] = Decimal(str(ozet.get('toplam_sirket_odemesi', '0'))) # Yeni alan
        ozet['toplam_tahsilat'] = Decimal(str(ozet.get('toplam_tahsilat', '0')))          # Yeni alan
        data['ozet'] = ozet
        # --- GÜNCELLEME SONU ---

        # Süt girdilerine 'tutar' alanını ekle (PDF şablonu kullanıyor)
        for girdi in data.get('sut_girdileri', []):
            try:
                # RPC'den gelen 'toplam_tutar'ı kullan (bu zaten litre * fiyat olmalı)
                girdi['tutar'] = Decimal(str(girdi.get('toplam_tutar', '0')))
            except Exception as e:
                logger.error(f"Süt girdisi tutarı işlenirken hata: {girdi}, Hata: {e}")
                girdi['tutar'] = Decimal('0') # Hata durumunda sıfır ata

        # Finansal işlemlerdeki tarih formatını ve tutarı işle
        for islem in data.get('finansal_islemler', []):
             islem['islem_tarihi'] = islem.get('islem_tarihi_formatted', islem.get('islem_tarihi'))
             try:
                 islem['tutar'] = Decimal(str(islem.get('tutar', '0')))
             except Exception as e:
                 logger.error(f"Finansal işlem tutarı işlenirken hata: {islem}, Hata: {e}")
                 islem['tutar'] = Decimal('0')

        # Yem işlemlerindeki tarih formatını ve tutarları işle
        for islem in data.get('yem_islemleri', []):
             islem['islem_tarihi'] = islem.get('islem_tarihi_formatted', islem.get('islem_tarihi'))
             try:
                 islem['miktar_kg'] = Decimal(str(islem.get('miktar_kg', '0')))
                 islem['islem_anindaki_birim_fiyat'] = Decimal(str(islem.get('islem_anindaki_birim_fiyat', '0')))
                 islem['toplam_tutar'] = Decimal(str(islem.get('toplam_tutar', '0')))
             except Exception as e:
                 logger.error(f"Yem işlemi tutarları işlenirken hata: {islem}, Hata: {e}")
                 # Hata durumunda sıfır ata
                 islem['miktar_kg'] = Decimal('0')
                 islem['islem_anindaki_birim_fiyat'] = Decimal('0')
                 islem['toplam_tutar'] = Decimal('0')


        return data
    except Exception as e:
        logger.error(f"Aylık tedarikçi verileri (RPC: get_monthly_supplier_report_data) alınırken hata: {e}", exc_info=True)
        raise Exception("Rapor verileri alınırken bir hata oluştu.")


def generate_hesap_ozeti_pdf(sirket_id, sirket_adi, tedarikci_id, ay, yil):
    """Tedarikçi için aylık hesap özeti PDF'i oluşturur ve döndürür (GÜNCELLENMİŞ HESAPLAMA)."""
    tedarikci_res = g.supabase.table('tedarikciler').select('isim').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
    if not tedarikci_res.data:
        raise ValueError("Tedarikçi bulunamadı veya yetkiniz yok.")

    # Güncellenmiş veriyi çek
    veri = _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil)
    ozet_rpc = veri["ozet"]

    # --- GÜNCELLEME: Net bakiye hesaplaması ---
    # Net Bakiye = Süt Alacağı - Yem Borcu - Şirketin Yaptığı Ödemeler (Avans+Hakediş) + Çiftçiden Alınan Tahsilatlar
    net_bakiye = (
        ozet_rpc["toplam_sut_tutari"]
        - ozet_rpc["toplam_yem_borcu"]
        - ozet_rpc["toplam_sirket_odemesi"] # Yeni alan
        + ozet_rpc["toplam_tahsilat"]       # Yeni alan
    )
    # --- GÜNCELLEME SONU ---

    # PDF şablonuna gönderilecek özet verisi
    ozet_pdf = {
        'toplam_sut_alacagi': ozet_rpc["toplam_sut_tutari"],
        'toplam_yem_borcu': ozet_rpc["toplam_yem_borcu"],
        'toplam_sirket_odemesi': ozet_rpc["toplam_sirket_odemesi"], # Yeni alan
        'toplam_tahsilat': ozet_rpc["toplam_tahsilat"],             # Yeni alan
        'net_bakiye': net_bakiye
    }

    aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    rapor_basligi = f"{aylar[ay-1]} {yil} Hesap Özeti"

    # Finansal işlemleri Şirket Ödemesi (Avans+Hakediş) ve Tahsilat olarak ayıralım (şablonda göstermek için)
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
        sirket_odemeleri=sirket_odemeleri, # Ayrı liste
        tahsilatlar=tahsilatlar            # Ayrı liste
    )

    try:
        pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
        filename = f"{yil}_{ay:02d}_{tedarikci_res.data['isim'].replace(' ', '_')}_hesap_ozeti.pdf"
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)
    except Exception as e:
        logger.error(f"Hesap özeti PDF oluşturulurken WeasyPrint hatası: {e}", exc_info=True)
        raise Exception(f"PDF oluşturulurken bir hata oluştu: {e}")


def generate_mustahsil_makbuzu_pdf(sirket_id, tedarikci_id, ay, yil):
    """Tedarikçi için müstahsil makbuzu PDF'i oluşturur ve döndürür (GÜNCELLENMİŞ HESAPLAMA)."""
    tedarikci_res = g.supabase.table('tedarikciler').select('isim, tc_no, adres').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
    sirket_res = g.supabase.table('sirketler').select('sirket_adi, adres, vergi_kimlik_no').eq('id', sirket_id).single().execute()
    if not tedarikci_res.data or not sirket_res.data:
        raise ValueError("Gerekli şirket veya tedarikçi bilgisi bulunamadı.")

    # Güncellenmiş veriyi çek
    veri = _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil)
    ozet_rpc = veri["ozet"]

    stopaj_orani = Decimal('0.01') # %1 Stopaj
    stopaj_tutari = ozet_rpc["toplam_sut_tutari"] * stopaj_orani

    # --- GÜNCELLEME: Net ödenecek hesaplaması ---
    # Net Ödenecek = (Süt Alacağı - Stopaj) - Yem Borcu - Şirketin Yaptığı Ödemeler (Avans+Hakediş) + Çiftçiden Alınan Tahsilatlar
    net_odenecek = (
        (ozet_rpc["toplam_sut_tutari"] - stopaj_tutari)
        - ozet_rpc["toplam_yem_borcu"]
        - ozet_rpc["toplam_sirket_odemesi"] # Yeni alan
        + ozet_rpc["toplam_tahsilat"]       # Yeni alan
    )
    # --- GÜNCELLEME SONU ---

    # PDF şablonuna gönderilecek özet verisi
    ozet_pdf = {
        'toplam_sut_tutari': ozet_rpc["toplam_sut_tutari"],
        'stopaj_tutari': stopaj_tutari,
        'toplam_yem_borcu': ozet_rpc["toplam_yem_borcu"],
        'toplam_sirket_odemesi': ozet_rpc["toplam_sirket_odemesi"], # Yeni alan
        'toplam_tahsilat': ozet_rpc["toplam_tahsilat"],             # Yeni alan
        'net_odenecek': net_odenecek
    }

    # Finansal işlemleri Şirket Ödemesi (Avans+Hakediş) ve Tahsilat olarak ayıralım (şablonda göstermek için)
    sirket_odemeleri = [i for i in veri["finansal_islemler"] if i['islem_tipi'] in [FinansIslemTipi.ODEME.value, FinansIslemTipi.AVANS.value]]
    tahsilatlar = [i for i in veri["finansal_islemler"] if i['islem_tipi'] == FinansIslemTipi.TAHSILAT.value]

    html_out = render_template(
        'mustahsil_makbuzu_pdf.html',
        sirket=sirket_res.data,
        tedarikci=tedarikci_res.data,
        makbuz_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y'),
        sut_girdileri=veri["sut_girdileri"],
        yem_islemleri=veri["yem_islemleri"],
        sirket_odemeleri=sirket_odemeleri, # Ayrı liste
        tahsilatlar=tahsilatlar,            # Ayrı liste
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

