# blueprints/pdf_generator.py

from flask import Blueprint, jsonify, request, session, send_file, current_app, render_template
from decorators import login_required, lisans_kontrolu
from extensions import supabase, turkey_tz
from decimal import Decimal
from datetime import datetime
import calendar
import io
from weasyprint import HTML

pdf_generator_bp = Blueprint('pdf_generator', __name__, url_prefix='/api/pdf')

# --- PDF OLUŞTURMA İÇİN YARDIMCI VE ANA FONKSİYONLAR ---

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

    # --- HATA BURADAYDI! ---
    # ESKİ HATALI KOD: data = response.data
    # Veritabanı sonucu liste içinde döndürdüğü için listenin ilk elemanını almalıyız.
    # DOĞRU KOD:
    data = response.data[0]
    
    ozet = data.get('ozet', {})
    ozet['toplam_sut_tutari'] = Decimal(str(ozet.get('toplam_sut_tutari', '0')))
    ozet['toplam_yem_borcu'] = Decimal(str(ozet.get('toplam_yem_borcu', '0')))
    ozet['toplam_odeme'] = Decimal(str(ozet.get('toplam_odeme', '0')))
    data['ozet'] = ozet

    for girdi in data.get('sut_girdileri', []):
        girdi['tutar'] = girdi['toplam_tutar']

    return data

@pdf_generator_bp.route('/tedarikci/<int:tedarikci_id>/hesap_ozeti')
@login_required
@lisans_kontrolu
def tedarikci_hesap_ozeti_pdf(tedarikci_id):
    try:
        sirket_id = session['user']['sirket_id']
        sirket_adi = session['user'].get('sirket_adi', 'Bilinmeyen Şirket')
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        tedarikci_res = supabase.table('tedarikciler').select('isim').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
        if not tedarikci_res.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya yetkiniz yok."}), 404
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
    except Exception as e:
        print(f"Hesap özeti PDF hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@pdf_generator_bp.route('/tedarikci/<int:tedarikci_id>/mustahsil_makbuzu')
@login_required
@lisans_kontrolu
def tedarikci_mustahsil_makbuzu_pdf(tedarikci_id):
    try:
        sirket_id = session['user']['sirket_id']
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        tedarikci_res = supabase.table('tedarikciler').select('isim, tc_no, adres').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
        sirket_res = supabase.table('sirketler').select('sirket_adi, adres, vergi_kimlik_no').eq('id', sirket_id).single().execute()
        if not tedarikci_res.data or not sirket_res.data:
            return jsonify({"error": "Gerekli şirket veya tedarikçi bilgisi bulunamadı."}), 404
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
    except Exception as e:
        print(f"Müstahsil PDF hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@pdf_generator_bp.route('/aylik_rapor')
@login_required
@lisans_kontrolu
def aylik_rapor_pdf():
    try:
        sirket_id = session['user']['sirket_id']
        sirket_adi = session['user'].get('sirket_adi', 'Bilinmeyen Şirket')
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        
        _, ayin_son_gunu = calendar.monthrange(yil, ay)
        baslangic_tarihi = datetime(yil, ay, 1).date()
        bitis_tarihi = datetime(yil, ay, ayin_son_gunu).date()
        
        start_utc_str = f"{baslangic_tarihi} 00:00:00+03"
        end_utc_str = f"{bitis_tarihi} 23:59:59+03"

        response = supabase.table('sut_girdileri').select('litre, taplanma_tarihi, tedarikciler(isim)').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_utc_str).lte('taplanma_tarihi', end_utc_str).execute()
        girdiler = response.data
        
        gunluk_dokum_dict = {i: {'toplam_litre': Decimal(0), 'girdi_sayisi': 0} for i in range(1, ayin_son_gunu + 1)}
        tedarikci_dokumu_dict = {}
        
        for girdi in girdiler:
            girdi_tarihi_tr = datetime.fromisoformat(girdi['taplanma_tarihi']).astimezone(turkey_tz)
            gun = girdi_tarihi_tr.day
            gunluk_dokum_dict[gun]['toplam_litre'] += Decimal(str(girdi.get('litre', '0')))
            gunluk_dokum_dict[gun]['girdi_sayisi'] += 1
            if girdi.get('tedarikciler') and girdi['tedarikciler'].get('isim'):
                isim = girdi['tedarikciler']['isim']
                if isim not in tedarikci_dokumu_dict:
                    tedarikci_dokumu_dict[isim] = {'toplam_litre': Decimal(0), 'girdi_sayisi': 0}
                tedarikci_dokumu_dict[isim]['toplam_litre'] += Decimal(str(girdi.get('litre', '0')))
                tedarikci_dokumu_dict[isim]['girdi_sayisi'] += 1
        
        gunluk_dokum = [{'tarih': f"{day:02d}.{ay:02d}.{yil}", 'toplam_litre': float(data['toplam_litre']), 'girdi_sayisi': data['girdi_sayisi']} for day, data in gunluk_dokum_dict.items()]
        tedarikci_dokumu = sorted([{'isim': isim, 'toplam_litre': float(data['toplam_litre']), 'girdi_sayisi': data['girdi_sayisi']} for isim, data in tedarikci_dokumu_dict.items()], key=lambda x: x['toplam_litre'], reverse=True)
        toplam_litre = sum(Decimal(str(g.get('litre', '0'))) for g in girdiler)
        ozet = {'toplam_litre': float(toplam_litre), 'girdi_sayisi': len(girdiler), 'gunluk_ortalama': float(toplam_litre / ayin_son_gunu if ayin_son_gunu > 0 else 0)}
        aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
        rapor_basligi = f"{aylar[ay-1]} {yil} Süt Toplama Raporu"
        html_out = render_template('aylik_rapor_pdf.html', rapor_basligi=rapor_basligi, sirket_adi=sirket_adi, olusturma_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y %H:%M'), ozet=ozet, tedarikci_dokumu=tedarikci_dokumu, gunluk_dokum=gunluk_dokum)
        pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
        filename = f"{yil}_{ay:02d}_{sirket_adi.replace(' ', '_')}_raporu.pdf"
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)
    except Exception as e:
        print(f"Aylık rapor PDF hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500