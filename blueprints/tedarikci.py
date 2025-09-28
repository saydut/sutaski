from flask import Blueprint, jsonify, request, session, render_template, current_app, send_file
from decorators import login_required, lisans_kontrolu, modification_allowed
from extensions import supabase, turkey_tz
from utils import parse_supabase_timestamp # <-- DEĞİŞİKLİK BURADA
from decimal import Decimal, InvalidOperation
from datetime import datetime
import pytz
import calendar
from weasyprint import HTML
import io

tedarikci_bp = Blueprint('tedarikci', __name__, url_prefix='/api')

def _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil):
    _, ayin_son_gunu = calendar.monthrange(yil, ay)
    baslangic_tarihi = datetime(yil, ay, 1).date()
    bitis_tarihi = datetime(yil, ay, ayin_son_gunu).date()
    start_utc = turkey_tz.localize(datetime.combine(baslangic_tarihi, datetime.min.time())).astimezone(pytz.utc).isoformat()
    end_utc = turkey_tz.localize(datetime.combine(bitis_tarihi, datetime.max.time())).astimezone(pytz.utc).isoformat()

    sut_response = supabase.table('sut_girdileri').select('litre, fiyat, taplanma_tarihi').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc).order('taplanma_tarihi', desc=False).execute()
    yem_response = supabase.table('yem_islemleri').select('islem_tarihi, miktar_kg, islem_anindaki_birim_fiyat, toplam_tutar, yem_urunleri(yem_adi)').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).gte('islem_tarihi', start_utc).lte('islem_tarihi', end_utc).order('islem_tarihi', desc=False).execute()
    finans_response = supabase.table('finansal_islemler').select('islem_tarihi, islem_tipi, tutar, aciklama').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).gte('islem_tarihi', start_utc).lte('islem_tarihi', end_utc).order('islem_tarihi', desc=False).execute()

    toplam_sut_tutari = Decimal('0.0')
    islenmis_sut_girdileri = []
    for girdi in sut_response.data:
        litre = Decimal(str(girdi.get('litre', '0')))
        fiyat = Decimal(str(girdi.get('fiyat', '0')))
        tutar = litre * fiyat
        toplam_sut_tutari += tutar
        parsed_date = parse_supabase_timestamp(girdi.get('taplanma_tarihi'))
        islenmis_sut_girdileri.append({
            "tarih": parsed_date.astimezone(turkey_tz).strftime('%d.%m.%Y') if parsed_date else 'Tarih Yok',
            "litre": litre, "fiyat": fiyat, "tutar": tutar, "toplam_tutar": tutar
        })

    toplam_yem_borcu = sum(Decimal(str(islem.get('toplam_tutar', '0'))) for islem in yem_response.data)
    toplam_odeme = sum(Decimal(str(islem.get('tutar', '0'))) for islem in finans_response.data)
    
    return {
        "sut_girdileri": islenmis_sut_girdileri,
        "yem_islemleri": yem_response.data,
        "finansal_islemler": finans_response.data,
        "ozet": { "toplam_sut_tutari": toplam_sut_tutari, "toplam_yem_borcu": toplam_yem_borcu, "toplam_odeme": toplam_odeme }
    }

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/detay')
@login_required
def get_tedarikci_detay(tedarikci_id):
    try:
        sirket_id = session['user']['sirket_id']
        query = "id, isim, sut_girdileri(*, kullanicilar(kullanici_adi)), yem_islemleri(*, kullanicilar(kullanici_adi), yem_urunleri(yem_adi)), finansal_islemler(*, kullanicilar(kullanici_adi))"
        response = supabase.table('tedarikciler').select(query).eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()

        if not response.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya yetkiniz yok."}), 404

        td = response.data
        toplam_sut_alacagi = sum(Decimal(str(g.get('litre', '0'))) * Decimal(str(g.get('fiyat', '0'))) for g in td.get('sut_girdileri', []))
        toplam_yem_borcu = sum(Decimal(str(y.get('toplam_tutar', '0'))) for y in td.get('yem_islemleri', []))
        toplam_odeme = sum(Decimal(str(f.get('tutar', '0'))) for f in td.get('finansal_islemler', []))

        sonuc = {
            "isim": td['isim'],
            "sut_girdileri": sorted(td.get('sut_girdileri', []), key=lambda x: x['taplanma_tarihi'], reverse=True),
            "yem_islemleri": sorted(td.get('yem_islemleri', []), key=lambda x: x['islem_tarihi'], reverse=True),
            "finansal_islemler": sorted(td.get('finansal_islemler', []), key=lambda x: x['islem_tarihi'], reverse=True),
            "ozet": {
                "toplam_sut_alacagi": f"{toplam_sut_alacagi:.2f}",
                "toplam_yem_borcu": f"{toplam_yem_borcu:.2f}",
                "toplam_odeme": f"{toplam_odeme:.2f}",
                "net_bakiye": f"{toplam_sut_alacagi - toplam_yem_borcu - toplam_odeme:.2f}"
            }
        }
        return jsonify(sonuc)
    except Exception as e:
        print(f"Tedarikçi detay hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/hesap_ozeti_pdf')
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

        def format_tarih_filter(timestamp_str):
            dt = parse_supabase_timestamp(timestamp_str)
            return dt.astimezone(turkey_tz).strftime('%d.%m.%Y') if dt else ''
        current_app.jinja_env.filters['format_tarih'] = format_tarih_filter

        html_out = render_template('tedarikci_hesap_ozeti_pdf.html', rapor_basligi=rapor_basligi, sirket_adi=sirket_adi, tedarikci_adi=tedarikci_res.data['isim'], olusturma_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y %H:%M'), ozet=ozet, sut_girdileri=veri["sut_girdileri"], yem_islemleri=veri["yem_islemleri"], finansal_islemler=veri["finansal_islemler"])
        pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
        filename = f"{yil}_{ay:02d}_{tedarikci_res.data['isim'].replace(' ', '_')}_hesap_ozeti.pdf"
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)
    except Exception as e:
        print(f"Hesap özeti PDF hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikci/<int:tedarikci_id>/mustahsil_makbuzu_pdf')
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

        def format_tarih_filter(timestamp_str):
            dt = parse_supabase_timestamp(timestamp_str)
            return dt.astimezone(turkey_tz).strftime('%d.%m.%Y') if dt else ''
        current_app.jinja_env.filters['format_tarih'] = format_tarih_filter

        html_out = render_template('mustahsil_makbuzu_pdf.html', sirket=sirket_res.data, tedarikci=tedarikci_res.data, makbuz_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y'), sut_girdileri=veri["sut_girdileri"], yem_islemleri=veri["yem_islemleri"], finansal_islemler=veri["finansal_islemler"], ozet=veri["ozet"], stopaj_orani=stopaj_orani)
        pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
        filename = f"{yil}_{ay:02d}_{tedarikci_res.data['isim'].replace(' ', '_')}_mustahsil.pdf"
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)
    except Exception as e:
        print(f"Müstahsil PDF hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikciler_liste')
@login_required
def get_tedarikciler_liste():
    try:
        sirket_id = session['user']['sirket_id']
        # Parametre adının SQL fonksiyonuyla tam eşleştiğinden emin oluyoruz.
        response = supabase.rpc('get_tedarikciler_with_stats', {'sirket_id_param': sirket_id}).execute()
        return jsonify(response.data)
    except Exception as e:
        print(f"Tedarikçi listesi hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikci_ekle', methods=['POST'])
@login_required
@lisans_kontrolu
@modification_allowed
def add_tedarikci():
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        if not data.get('isim'):
            return jsonify({"error": "Tedarikçi ismi zorunludur."}), 400
        yeni_veri = {'isim': data.get('isim'), 'sirket_id': sirket_id, 'tc_no': data.get('tc_no') or None, 'telefon_no': data.get('telefon_no') or None, 'adres': data.get('adres') or None}
        supabase.table('tedarikciler').insert(yeni_veri).execute()
        return jsonify({"message": "Tedarikçi başarıyla eklendi."}), 201
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikci_duzenle/<int:id>', methods=['PUT'])
@login_required
@lisans_kontrolu
@modification_allowed
def update_tedarikci(id):
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        guncellenecek_veri = {'isim': data.get('isim'), 'tc_no': data.get('tc_no') or None, 'telefon_no': data.get('telefon_no') or None, 'adres': data.get('adres') or None}
        response = supabase.table('tedarikciler').update(guncellenecek_veri).eq('id', id).eq('sirket_id', sirket_id).execute()
        if not response.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya bu işlem için yetkiniz yok."}), 404
        return jsonify({"message": "Tedarikçi bilgileri güncellendi."})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@tedarikci_bp.route('/tedarikci_sil/<int:id>', methods=['DELETE'])
@login_required
@lisans_kontrolu
@modification_allowed
def delete_tedarikci(id):
    try:
        sirket_id = session['user']['sirket_id']
        response = supabase.table('tedarikciler').delete().eq('id', id).eq('sirket_id', sirket_id).execute()
        if not response.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya bu işlem için yetkiniz yok."}), 404
        return jsonify({"message": "Tedarikçi başarıyla silindi."})
    except Exception as e:
        if 'violates foreign key constraint' in str(e).lower():
            return jsonify({"error": "Bu tedarikçiye ait süt veya yem girdisi olduğu için silinemiyor."}), 409
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500