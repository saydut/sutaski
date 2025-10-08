# services/report_service.py

from flask import render_template, current_app, send_file
from extensions import supabase, turkey_tz
from weasyprint import HTML
from datetime import datetime
import calendar
import io
from decimal import Decimal

def _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil):
    """Belirtilen ay içindeki tüm verileri PDF için tek bir RPC çağrısıyla çeker."""
    _, ayin_son_gunu = calendar.monthrange(yil, ay)
    baslangic_tarihi_str = f"{yil}-{ay:02d}-01"
    bitis_tarihi_str = f"{yil}-{ay:02d}-{ayin_son_gunu}"

    response = supabase.rpc('get_monthly_supplier_report_data', {
        'p_sirket_id': sirket_id,
        'p_tedarikci_id': tedarikci_id,
        'p_start_date': baslangic_tarihi_str,
        'p_end_date': bitis_tarihi_str
    }).execute()
    
    if not response.data:
        return {
            "sut_girdileri": [], "yem_islemleri": [], "finansal_islemler": [],
            "ozet": { "toplam_sut_tutari": 0, "toplam_yem_borcu": 0, "toplam_odeme": 0 }
        }

    data = response.data
    ozet = data.get('ozet', {})
    ozet['toplam_sut_tutari'] = Decimal(str(ozet.get('toplam_sut_tutari', '0')))
    ozet['toplam_yem_borcu'] = Decimal(str(ozet.get('toplam_yem_borcu', '0')))
    ozet['toplam_odeme'] = Decimal(str(ozet.get('toplam_odeme', '0')))
    data['ozet'] = ozet
    
    for girdi in data.get('sut_girdileri', []):
        girdi['tutar'] = girdi['toplam_tutar']

    return data

def generate_hesap_ozeti_pdf(sirket_id, sirket_adi, tedarikci_id, ay, yil):
    """Tedarikçi için aylık hesap özeti PDF'i oluşturur ve döndürür."""
    tedarikci_res = supabase.table('tedarikciler').select('isim').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
    if not tedarikci_res.data:
        raise ValueError("Tedarikçi bulunamadı veya yetkiniz yok.")
        
    veri = _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil)
    net_bakiye = veri["ozet"]["toplam_sut_tutari"] - veri["ozet"]["toplam_yem_borcu"] - veri["ozet"]["toplam_odeme"]
    ozet = {
        'toplam_sut_alacagi': veri["ozet"]["toplam_sut_tutari"],
        'toplam_yem_borcu': veri["ozet"]["toplam_yem_borcu"],
        'toplam_odeme': veri["ozet"]["toplam_odeme"],
        'net_bakiye': net_bakiye
    }
    aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    rapor_basligi = f"{aylar[ay-1]} {yil} Hesap Özeti"
    
    html_out = render_template('tedarikci_hesap_ozeti_pdf.html', rapor_basligi=rapor_basligi, sirket_adi=sirket_adi, tedarikci_adi=tedarikci_res.data['isim'], olusturma_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y %H:%M'), ozet=ozet, sut_girdileri=veri["sut_girdileri"], yem_islemleri=veri["yem_islemleri"], finansal_islemler=veri["finansal_islemler"])
    
    pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
    filename = f"{yil}_{ay:02d}_{tedarikci_res.data['isim'].replace(' ', '_')}_hesap_ozeti.pdf"
    
    return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)

def generate_mustahsil_makbuzu_pdf(sirket_id, tedarikci_id, ay, yil):
    """Tedarikçi için müstahsil makbuzu PDF'i oluşturur ve döndürür."""
    tedarikci_res = supabase.table('tedarikciler').select('isim, tc_no, adres').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
    sirket_res = supabase.table('sirketler').select('sirket_adi, adres, vergi_kimlik_no').eq('id', sirket_id).single().execute()
    if not tedarikci_res.data or not sirket_res.data:
        raise ValueError("Gerekli şirket veya tedarikçi bilgisi bulunamadı.")
        
    veri = _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil)
    stopaj_orani = Decimal('0.02')
    stopaj_tutari = veri["ozet"]["toplam_sut_tutari"] * stopaj_orani
    net_odenecek = (veri["ozet"]["toplam_sut_tutari"] - stopaj_tutari) - veri["ozet"]["toplam_yem_borcu"] - veri["ozet"]["toplam_odeme"]
    veri["ozet"]["stopaj_tutari"] = stopaj_tutari
    veri["ozet"]["net_odenecek"] = net_odenecek
    
    html_out = render_template('mustahsil_makbuzu_pdf.html', sirket=sirket_res.data, tedarikci=tedarikci_res.data, makbuz_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y'), sut_girdileri=veri["sut_girdileri"], yem_islemleri=veri["yem_islemleri"], finansal_islemler=veri["finansal_islemler"], ozet=veri["ozet"], stopaj_orani=stopaj_orani)
    
    pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
    filename = f"{yil}_{ay:02d}_{tedarikci_res.data['isim'].replace(' ', '_')}_mustahsil.pdf"
    
    return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)

