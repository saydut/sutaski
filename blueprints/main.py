# blueprints/main.py

# --- GEREKLİ KÜTÜPHANELER ---
from flask import Blueprint, jsonify, render_template, request, session, send_file, current_app, flash, redirect, url_for
from decorators import login_required, lisans_kontrolu, modification_allowed
from extensions import supabase, turkey_tz, bcrypt
from datetime import datetime, timedelta
import pytz
import io
import csv
import calendar
from weasyprint import HTML
from decimal import Decimal, getcontext
import traceback

# Decimal hassasiyetini ayarla
getcontext().prec = 10


def _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil):
    """Belirli bir tedarikçinin aylık süt, yem ve finans verilerini tek seferde çeker."""
    # Tarih aralığını belirle
    _, ayin_son_gunu = calendar.monthrange(yil, ay)
    baslangic_tarihi = datetime(yil, ay, 1).date()
    bitis_tarihi = datetime(yil, ay, ayin_son_gunu).date()
    start_utc = turkey_tz.localize(datetime.combine(baslangic_tarihi, datetime.min.time())).astimezone(pytz.utc).isoformat()
    end_utc = turkey_tz.localize(datetime.combine(bitis_tarihi, datetime.max.time())).astimezone(pytz.utc).isoformat()

    # Gerekli tüm verileri Supabase'den çek
    sut_response = supabase.table('sut_girdileri').select('litre, fiyat, taplanma_tarihi').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc).order('taplanma_tarihi', desc=False).execute()
    yem_response = supabase.table('yem_islemleri').select('islem_tarihi, miktar_kg, islem_anindaki_birim_fiyat, toplam_tutar, yem_urunleri(yem_adi)').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).gte('islem_tarihi', start_utc).lte('islem_tarihi', end_utc).order('islem_tarihi', desc=False).execute()
    finans_response = supabase.table('finansal_islemler').select('islem_tarihi, islem_tipi, tutar, aciklama').eq('sirket_id', sirket_id).eq('tedarikci_id', tedarikci_id).gte('islem_tarihi', start_utc).lte('islem_tarihi', end_utc).order('islem_tarihi', desc=False).execute()

    # Süt girdilerini işle ve toplam tutarı hesapla
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

    # Diğer toplamları hesapla
    toplam_yem_borcu = sum(Decimal(str(islem.get('toplam_tutar', '0'))) for islem in yem_response.data)
    toplam_odeme = sum(Decimal(str(islem.get('tutar', '0'))) for islem in finans_response.data)
    
    return {
        "sut_girdileri": islenmis_sut_girdileri,
        "yem_islemleri": yem_response.data,
        "finansal_islemler": finans_response.data,
        "ozet": {
            "toplam_sut_tutari": toplam_sut_tutari,
            "toplam_yem_borcu": toplam_yem_borcu,
            "toplam_odeme": toplam_odeme
        }
    }






# --- YARDIMCI FONKSİYON ---
def parse_supabase_timestamp(timestamp_str):
    if not timestamp_str: return None
    if '+' in timestamp_str:
        timestamp_str = timestamp_str.split('+')[0]
    try:
        dt_obj = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S.%f')
    except ValueError:
        try:
            dt_obj = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S')
        except ValueError:
            dt_obj = datetime.strptime(timestamp_str, '%Y-%m-%d')
    return pytz.utc.localize(dt_obj)

# --- BLUEPRINT TANIMLAMASI ---
main_bp = Blueprint(
    'main',
    __name__,
    template_folder='../../templates',
    static_folder='../../static'
)

# --- ARAYÜZ SAYFALARI ---
@main_bp.route('/')
def anasayfa():
    # Service Worker'ın önbellekleme isteğini özel bir başlık ile anlıyoruz
    if request.headers.get('X-Cache-Me') == 'true':
        # Eğer istek Service Worker'dan geliyorsa, giriş kontrolü yapmadan
        # temiz bir "uygulama kabuğu" gönderiyoruz.
        return render_template('index.html', session={})

    # Eğer normal bir kullanıcı isteğiyse, giriş kontrolü yapıyoruz
    if 'user' not in session:
        flash("Bu sayfayı görüntülemek için giriş yapmalısınız.", "warning")
        return redirect(url_for('auth.login_page'))

    # Lisans kontrolü mantığı (decorator'den buraya taşındı)
    user_info = session.get('user')
    if user_info and user_info.get('rol') != 'admin':
        lisans_bitis = user_info.get('lisans_bitis_tarihi')
        if lisans_bitis:
            try:
                lisans_bitis_tarihi_obj = datetime.strptime(lisans_bitis, '%Y-%m-%d').date()
                if lisans_bitis_tarihi_obj < datetime.now().date():
                    flash("Şirketinizin lisans süresi dolmuştur. Lütfen sistem yöneticinizle iletişime geçin.", "danger")
                    session.pop('user', None)
                    return redirect(url_for('auth.login_page'))
            except (ValueError, TypeError):
                 flash("Lisans tarihi formatı geçersiz.", "danger")
                 session.pop('user', None)
                 return redirect(url_for('auth.login_page'))
        else:
             flash("Şirketiniz için bir lisans tanımlanmamıştır.", "danger")
             session.pop('user', None)
             return redirect(url_for('auth.login_page'))
            
    # Tüm kontrollerden geçtiyse, kullanıcı verisiyle dolu normal sayfayı gönder
    return render_template('index.html', session=session)

@main_bp.route('/raporlar')
@login_required
@lisans_kontrolu
def raporlar_page():
    return render_template('raporlar.html')

@main_bp.route('/tedarikciler')
@login_required
@lisans_kontrolu
def tedarikciler_sayfasi():
    return render_template('tedarikciler.html')

@main_bp.route('/tedarikci/<int:tedarikci_id>')
@login_required
@lisans_kontrolu
def tedarikci_detay_sayfasi(tedarikci_id):
    return render_template('tedarikci_detay.html', tedarikci_id=tedarikci_id)

# --- API'LER ---
@main_bp.route('/api/tedarikci/<int:tedarikci_id>/mustahsil_makbuzu_pdf')
@login_required
@lisans_kontrolu
def tedarikci_mustahsil_makbuzu_pdf(tedarikci_id):
    try:
        sirket_id = session['user']['sirket_id']
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        
        # Statik şirket ve tedarikçi bilgilerini al
        tedarikci_res = supabase.table('tedarikciler').select('isim, tc_no, adres').eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()
        sirket_res = supabase.table('sirketler').select('sirket_adi, adres, vergi_kimlik_no').eq('id', sirket_id).single().execute()

        if not tedarikci_res.data or not sirket_res.data:
            return jsonify({"error": "Gerekli şirket veya tedarikçi bilgisi bulunamadı."}), 404
        
        # Tüm dinamik verileri yardımcı fonksiyondan al
        veri = _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil)
        
        # Müstahsil için ek hesaplamalar
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
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/tedarikci/<int:tedarikci_id>/hesap_ozeti_pdf')
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
        
        # Tüm dinamik verileri yardımcı fonksiyondan al
        veri = _get_aylik_tedarikci_verileri(sirket_id, tedarikci_id, ay, yil)
        
        # Hesap özeti için net bakiye hesaplaması
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
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/tedarikci/<int:tedarikci_id>/detay')
@login_required
def get_tedarikci_detay(tedarikci_id):
    try:
        sirket_id = session['user']['sirket_id']
        
        # --- PERFORMANS GÜNCELLEMESİ: Tek Sorguda Tüm Verileri Çek ---
        # Ayrı ayrı sorgu yapmak yerine, Supabase'in select yeteneği ile
        # ilgili tüm tabloları (sut_girdileri, yem_islemleri, finansal_islemler)
        # tek bir istekte birleştiriyoruz.
        query = """
            id, isim,
            sut_girdileri (*, kullanicilar(kullanici_adi)),
            yem_islemleri (*, kullanicilar(kullanici_adi), yem_urunleri(yem_adi)),
            finansal_islemler (*, kullanicilar(kullanici_adi))
        """
        response = supabase.table('tedarikciler').select(query).eq('id', tedarikci_id).eq('sirket_id', sirket_id).single().execute()

        if not response.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya yetkiniz yok."}), 404

        tedarikci_data = response.data
        
        # Gelen veriler üzerinden hesaplamaları yap
        toplam_sut_alacagi = sum(Decimal(str(g.get('litre', 0))) * Decimal(str(g.get('fiyat', 0))) for g in tedarikci_data.get('sut_girdileri', []))
        toplam_yem_borcu = sum(Decimal(str(y.get('toplam_tutar', 0))) for y in tedarikci_data.get('yem_islemleri', []))
        toplam_odeme = sum(Decimal(str(f.get('tutar', 0))) for f in tedarikci_data.get('finansal_islemler', []))

        # Frontend'e gönderilecek sonucu hazırla
        sonuc = {
            "isim": tedarikci_data['isim'],
            "sut_girdileri": sorted(tedarikci_data.get('sut_girdileri', []), key=lambda x: x['taplanma_tarihi'], reverse=True),
            "yem_islemleri": sorted(tedarikci_data.get('yem_islemleri', []), key=lambda x: x['islem_tarihi'], reverse=True),
            "finansal_islemler": sorted(tedarikci_data.get('finansal_islemler', []), key=lambda x: x['islem_tarihi'], reverse=True),
            "ozet": {
                "toplam_sut_alacagi": f"{toplam_sut_alacagi:.2f}",
                "toplam_yem_borcu": f"{toplam_yem_borcu:.2f}",
                "toplam_odeme": f"{toplam_odeme:.2f}",
                "net_bakiye": f"{toplam_sut_alacagi - toplam_yem_borcu - toplam_odeme:.2f}"
            }
        }
        return jsonify(sonuc)
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/sut_girdileri', methods=['GET'])
@login_required
def get_sut_girdileri():
    try:
        sirket_id = session['user']['sirket_id']
        secilen_tarih_str = request.args.get('tarih')
        sayfa = int(request.args.get('sayfa', 1))
        limit = 6
        offset = (sayfa - 1) * limit
        query = supabase.table('sut_girdileri').select('id,litre,fiyat,taplanma_tarihi,duzenlendi_mi,kullanicilar(kullanici_adi),tedarikciler(isim)', count='exact').eq('sirket_id', sirket_id)
        if secilen_tarih_str:
            target_date = datetime.strptime(secilen_tarih_str, '%Y-%m-%d').date()
            start_utc = turkey_tz.localize(datetime.combine(target_date, datetime.min.time())).astimezone(pytz.utc).isoformat()
            end_utc = turkey_tz.localize(datetime.combine(target_date, datetime.max.time())).astimezone(pytz.utc).isoformat()
            query = query.gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc)
        data = query.order('id', desc=True).range(offset, offset + limit - 1).execute()
        return jsonify({"girdiler": data.data, "toplam_girdi_sayisi": data.count})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/rapor/aylik_pdf')
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
        start_utc = turkey_tz.localize(datetime.combine(baslangic_tarihi, datetime.min.time())).astimezone(pytz.utc).isoformat()
        end_utc = turkey_tz.localize(datetime.combine(bitis_tarihi, datetime.max.time())).astimezone(pytz.utc).isoformat()
        response = supabase.table('sut_girdileri').select('litre, taplanma_tarihi, tedarikciler(isim)').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc).execute()
        girdiler = response.data
        gunluk_dokum_dict = {i: {'toplam_litre': 0, 'girdi_sayisi': 0} for i in range(1, ayin_son_gunu + 1)}
        tedarikci_dokumu_dict = {}
        for girdi in girdiler:
            parsed_date = parse_supabase_timestamp(girdi.get('taplanma_tarihi'))
            if not parsed_date: continue
            girdi_tarihi_tr = parsed_date.astimezone(turkey_tz)
            gun = girdi_tarihi_tr.day
            gunluk_dokum_dict[gun]['toplam_litre'] += girdi.get('litre', 0)
            gunluk_dokum_dict[gun]['girdi_sayisi'] += 1
            if girdi.get('tedarikciler') and girdi['tedarikciler'].get('isim'):
                isim = girdi['tedarikciler']['isim']
                if isim not in tedarikci_dokumu_dict:
                    tedarikci_dokumu_dict[isim] = {'toplam_litre': 0, 'girdi_sayisi': 0}
                tedarikci_dokumu_dict[isim]['toplam_litre'] += girdi.get('litre', 0)
                tedarikci_dokumu_dict[isim]['girdi_sayisi'] += 1
        gunluk_dokum = [{'tarih': f"{day:02d}.{ay:02d}.{yil}", **data} for day, data in gunluk_dokum_dict.items()]
        tedarikci_dokumu = sorted([{'isim': isim, **data} for isim, data in tedarikci_dokumu_dict.items()], key=lambda x: x['toplam_litre'], reverse=True)
        toplam_litre = sum(g.get('litre', 0) for g in girdiler)
        ozet = {'toplam_litre': toplam_litre, 'girdi_sayisi': len(girdiler), 'gunluk_ortalama': toplam_litre / ayin_son_gunu if ayin_son_gunu > 0 else 0}
        aylar = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
        rapor_basligi = f"{aylar[ay-1]} {yil} Süt Toplama Raporu"
        html_out = render_template('aylik_rapor_pdf.html', rapor_basligi=rapor_basligi, sirket_adi=sirket_adi, olusturma_tarihi=datetime.now(turkey_tz).strftime('%d.%m.%Y %H:%M'), ozet=ozet, tedarikci_dokumu=tedarikci_dokumu, gunluk_dokum=gunluk_dokum)
        pdf_bytes = HTML(string=html_out, base_url=current_app.root_path).write_pdf()
        filename = f"{yil}_{ay:02d}_{sirket_adi.replace(' ', '_')}_raporu.pdf"
        return send_file(io.BytesIO(pdf_bytes), mimetype='application/pdf', as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/rapor/detayli_rapor', methods=['GET'])
@login_required
def get_detayli_rapor():
    try:
        sirket_id = session['user']['sirket_id']
        start_date_str = request.args.get('baslangic')
        end_date_str = request.args.get('bitis')
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        if start_date > end_date or (end_date - start_date).days > 90:
            return jsonify({"error": "Geçersiz tarih aralığı."}), 400
        start_utc = turkey_tz.localize(datetime.combine(start_date, datetime.min.time())).astimezone(pytz.utc).isoformat()
        end_utc = turkey_tz.localize(datetime.combine(end_date, datetime.max.time())).astimezone(pytz.utc).isoformat()
        response = supabase.table('sut_girdileri').select('litre, taplanma_tarihi, tedarikciler(isim)').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc).execute()
        date_range = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]
        daily_totals = {gun.strftime('%Y-%m-%d'): 0 for gun in date_range}
        supplier_totals = {}
        for girdi in response.data:
            parsed_date = parse_supabase_timestamp(girdi.get('taplanma_tarihi'))
            if not parsed_date: continue
            girdi_gunu_str = parsed_date.astimezone(turkey_tz).strftime('%Y-%m-%d')
            if girdi_gunu_str in daily_totals:
                daily_totals[girdi_gunu_str] += girdi.get('litre', 0)
            if girdi.get('tedarikciler') and girdi.get('tedarikciler').get('isim'):
                isim = girdi['tedarikciler']['isim']
                if isim not in supplier_totals: supplier_totals[isim] = {'litre': 0, 'entryCount': 0}
                supplier_totals[isim]['litre'] += girdi.get('litre', 0)
                supplier_totals[isim]['entryCount'] += 1
        turkce_aylar = {"01":"Oca","02":"Şub","03":"Mar","04":"Nis","05":"May","06":"Haz","07":"Tem","08":"Ağu","09":"Eyl","10":"Eki","11":"Kas","12":"Ara"}
        labels = [f"{datetime.strptime(gun, '%Y-%m-%d').strftime('%d')} {turkce_aylar.get(datetime.strptime(gun, '%Y-%m-%d').strftime('%m'), '')}" for gun in sorted(daily_totals.keys())]
        data = [round(toplam, 2) for gun, toplam in sorted(daily_totals.items())]
        total_litre = sum(daily_totals.values())
        summary = {'totalLitre': round(total_litre, 2), 'averageDailyLitre': round(total_litre / len(date_range) if date_range else 0, 2), 'dayCount': len(date_range), 'entryCount': len(response.data)}
        breakdown = sorted([{'name': isim, 'litre': round(totals['litre'], 2), 'entryCount': totals['entryCount']} for isim, totals in supplier_totals.items()], key=lambda x: x['litre'], reverse=True)
        return jsonify({'chartData': {'labels': labels, 'data': data}, 'summaryData': summary, 'supplierBreakdown': breakdown})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/export_csv')
@login_required
def export_csv():
    try:
        sirket_id = session['user']['sirket_id']
        secilen_tarih_str = request.args.get('tarih')
        query = supabase.table('sut_girdileri').select('taplanma_tarihi,tedarikciler(isim),litre,kullanicilar(kullanici_adi)').eq('sirket_id', sirket_id)
        if secilen_tarih_str:
            target_date = datetime.strptime(secilen_tarih_str, '%Y-%m-%d').date()
            start_utc = turkey_tz.localize(datetime.combine(target_date, datetime.min.time())).astimezone(pytz.utc).isoformat()
            end_utc = turkey_tz.localize(datetime.combine(target_date, datetime.max.time())).astimezone(pytz.utc).isoformat()
            query = query.gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc)
        data = query.order('id', desc=True).execute().data
        output = io.StringIO()
        writer = csv.writer(output, delimiter=';')
        writer.writerow(['Tarih', 'Tedarikçi', 'Litre', 'Toplayan Kişi'])
        for row in data:
            parsed_date = parse_supabase_timestamp(row.get('taplanma_tarihi'))
            formatli_tarih = parsed_date.astimezone(turkey_tz).strftime('%d.%m.%Y %H:%M') if parsed_date else ''
            tedarikci_adi = row.get('tedarikciler', {}).get('isim', 'Bilinmiyor')
            toplayan_kisi = row.get('kullanicilar', {}).get('kullanici_adi', 'Bilinmiyor')
            writer.writerow([formatli_tarih, tedarikci_adi, str(row.get('litre','0')).replace('.',','), toplayan_kisi])
        output.seek(0)
        filename = f"{secilen_tarih_str}_sut_raporu.csv" if secilen_tarih_str else "sut_raporu.csv"
        return send_file(io.BytesIO(output.getvalue().encode('utf-8-sig')), mimetype='text/csv', as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/tedarikciler_liste')
@login_required
def get_tedarikciler_liste():
    try:
        sirket_id = session['user']['sirket_id']
        tedarikciler_response = supabase.table('tedarikciler').select('*').eq('sirket_id', sirket_id).execute()
        tedarikciler = tedarikciler_response.data
        girdiler_response = supabase.table('sut_girdileri').select('tedarikci_id, litre').eq('sirket_id', sirket_id).execute()
        girdiler_by_tedarikci = {}
        for girdi in girdiler_response.data:
            tid = girdi['tedarikci_id']
            if tid not in girdiler_by_tedarikci:
                girdiler_by_tedarikci[tid] = {'toplam_litre': 0, 'girdi_sayisi': 0}
            girdiler_by_tedarikci[tid]['toplam_litre'] += girdi.get('litre', 0)
            girdiler_by_tedarikci[tid]['girdi_sayisi'] += 1
        for t in tedarikciler:
            stats = girdiler_by_tedarikci.get(t['id'], {'toplam_litre': 0, 'girdi_sayisi': 0})
            t.update(stats)
        sonuc_sirali = sorted(tedarikciler, key=lambda x: x['isim'])
        return jsonify(sonuc_sirali)
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/tedarikci_ekle', methods=['POST'])
@login_required
@lisans_kontrolu
@modification_allowed
def add_tedarikci():
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        if not data.get('isim'):
            return jsonify({"error": "Tedarikçi ismi zorunludur."}), 400
        supabase.table('tedarikciler').insert({'isim': data.get('isim'), 'sirket_id': sirket_id, 'tc_no': data.get('tc_no') or None, 'telefon_no': data.get('telefon_no') or None, 'adres': data.get('adres') or None}).execute()
        return jsonify({"message": "Tedarikçi başarıyla eklendi."}), 201
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/tedarikci_duzenle/<int:id>', methods=['PUT'])
@login_required
@lisans_kontrolu
@modification_allowed
def update_tedarikci(id):
    try:
        data = request.get_json()
        sirket_id = session['user']['sirket_id']
        
        # --- GÜVENLİK GÜNCELLEMESİ ---
        # Veritabanı sorgusuna sirket_id eklenerek sadece yetkili olunan tedarikçinin güncellenmesi garanti altına alındı.
        guncellenecek_veri = {
            'isim': data.get('isim'),
            'tc_no': data.get('tc_no') or None,
            'telefon_no': data.get('telefon_no') or None,
            'adres': data.get('adres') or None
        }
        response = supabase.table('tedarikciler').update(guncellenecek_veri).eq('id', id).eq('sirket_id', sirket_id).execute()

        # Eğer response.data boş ise, ya böyle bir ID yok ya da ID başka bir şirkete ait demektir.
        if not response.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya bu işlem için yetkiniz yok."}), 404
        
        return jsonify({"message": "Tedarikçi bilgileri güncellendi."})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/tedarikci_sil/<int:id>', methods=['DELETE'])
@login_required
@lisans_kontrolu
@modification_allowed
def delete_tedarikci(id):
    try:
        sirket_id = session['user']['sirket_id']

        # --- GÜVENLİK GÜNCELLEMESİ ---
        # Veritabanı sorgusuna sirket_id eklenerek sadece yetkili olunan tedarikçinin silinmesi garanti altına alındı.
        response = supabase.table('tedarikciler').delete().eq('id', id).eq('sirket_id', sirket_id).execute()

        # Eğer response.data boş ise, ya böyle bir ID yok ya da ID başka bir şirkete ait demektir.
        if not response.data:
            return jsonify({"error": "Tedarikçi bulunamadı veya bu işlem için yetkiniz yok."}), 404

        return jsonify({"message": "Tedarikçi başarıyla silindi."})
    except Exception as e:
        if 'violates foreign key constraint' in str(e).lower():
            return jsonify({"error": "Bu tedarikçiye ait süt veya yem girdisi olduğu için silinemiyor."}), 409
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/gunluk_ozet')
@login_required
def get_gunluk_ozet():
    try:
        sirket_id = session['user']['sirket_id']
        tarih_str = request.args.get('tarih')
        if tarih_str:
            target_date = datetime.strptime(tarih_str, '%Y-%m-%d').date()
        else:
            target_date = datetime.now(turkey_tz).date()
        start_time_tr = turkey_tz.localize(datetime.combine(target_date, datetime.min.time()))
        end_time_tr = turkey_tz.localize(datetime.combine(target_date, datetime.max.time()))
        start_time_utc = start_time_tr.astimezone(pytz.utc).isoformat()
        end_time_utc = end_time_tr.astimezone(pytz.utc).isoformat()
        response = supabase.table('sut_girdileri').select('litre').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_time_utc).lte('taplanma_tarihi', end_time_utc).execute()
        toplam_litre = sum(item.get('litre', 0) for item in response.data)
        return jsonify({'toplam_litre': round(toplam_litre, 2)})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/rapor/haftalik_ozet')
@login_required
def get_haftalik_ozet():
    try:
        sirket_id = session['user']['sirket_id']
        today = datetime.now(turkey_tz).date()
        turkce_aylar = {"Jan": "Oca", "Feb": "Şub", "Mar": "Mar", "Apr": "Nis","May": "May", "Jun": "Haz", "Jul": "Tem", "Aug": "Ağu","Sep": "Eyl", "Oct": "Eki", "Nov": "Kas", "Dec": "Ara"}
        labels, data = [], []
        for i in range(7):
            target_date = today - timedelta(days=i)
            gun, ay_ingilizce = target_date.strftime('%d %b').split()
            labels.append(f"{gun} {turkce_aylar.get(ay_ingilizce, ay_ingilizce)}")
            start_tr = turkey_tz.localize(datetime.combine(target_date, datetime.min.time()))
            end_tr = turkey_tz.localize(datetime.combine(target_date, datetime.max.time()))
            response = supabase.table('sut_girdileri').select('litre').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_tr.astimezone(pytz.utc).isoformat()).lte('taplanma_tarihi', end_tr.astimezone(pytz.utc).isoformat()).execute()
            data.append(round(sum(item.get('litre', 0) for item in response.data), 2))
        return jsonify({'labels': labels[::-1], 'data': data[::-1]})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/rapor/tedarikci_dagilimi')
@login_required
def get_tedarikci_dagilimi():
    try:
        sirket_id = session['user']['sirket_id']
        start_date = datetime.now(turkey_tz).date() - timedelta(days=30)
        start_tr = turkey_tz.localize(datetime.combine(start_date, datetime.min.time()))
        response = supabase.table('sut_girdileri').select('litre, tedarikciler(isim)').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_tr.astimezone(pytz.utc).isoformat()).execute()
        dagilim = {}
        for girdi in response.data:
            if girdi.get('tedarikciler') and girdi['tedarikciler'].get('isim'):
                isim = girdi['tedarikciler']['isim']
                dagilim[isim] = dagilim.get(isim, 0) + girdi.get('litre', 0)
        sorted_dagilim = dict(sorted(dagilim.items(), key=lambda item: item[1], reverse=True))
        return jsonify({'labels': list(sorted_dagilim.keys()), 'data': [round(v, 2) for v in sorted_dagilim.values()]})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/girdi_gecmisi/<int:girdi_id>')
@login_required
def get_girdi_gecmisi(girdi_id):
    try:
        # --- GÜVENLİK GÜNCELLEMESİ ---
        # Sorguya sirket_id eklenerek sadece yetkili olunan girdinin geçmişi alınabilir.
        original_girdi_response = supabase.table('sut_girdileri').select('sirket_id').eq('id', girdi_id).eq('sirket_id', session['user']['sirket_id']).single().execute()
        if not original_girdi_response.data:
            return jsonify({"error": "Yetkisiz erişim veya girdi bulunamadı."}), 403
        
        gecmis_data = supabase.table('girdi_gecmisi').select('*,duzenleyen_kullanici_id(kullanici_adi)').eq('orijinal_girdi_id', girdi_id).order('created_at', desc=True).execute()
        return jsonify(gecmis_data.data)
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/sut_girdisi_ekle', methods=['POST'])
@login_required
@lisans_kontrolu
@modification_allowed
def add_sut_girdisi():
    yeni_girdi = request.get_json()
    data = supabase.table('sut_girdileri').insert({'tedarikci_id': yeni_girdi['tedarikci_id'], 'litre': yeni_girdi['litre'], 'fiyat': yeni_girdi.get('fiyat'), 'kullanici_id': session['user']['id'], 'sirket_id': session['user']['sirket_id']}).execute()
    return jsonify({"status": "success", "data": data.data})

@main_bp.route('/api/sut_girdisi_duzenle/<int:girdi_id>', methods=['PUT'])
@login_required
@lisans_kontrolu
@modification_allowed
def update_sut_girdisi(girdi_id):
    try:
        data = request.get_json()
        
        # --- GÜVENLİK GÜNCELLEMESİ ---
        # Sorguya sirket_id eklenerek sadece yetkili olunan girdi verisi çekilir.
        mevcut_girdi_res = supabase.table('sut_girdileri').select('*').eq('id', girdi_id).eq('sirket_id', session['user']['sirket_id']).single().execute()
        if not mevcut_girdi_res.data:
             return jsonify({"error": "Girdi bulunamadı veya bu işlem için yetkiniz yok."}), 404

        supabase.table('girdi_gecmisi').insert({'orijinal_girdi_id': girdi_id, 'duzenleyen_kullanici_id': session['user']['id'], 'duzenleme_sebebi': data['duzenleme_sebebi'], 'eski_litre_degeri': mevcut_girdi_res.data['litre'], 'eski_fiyat_degeri': mevcut_girdi_res.data.get('fiyat'), 'eski_tedarikci_id': mevcut_girdi_res.data['tedarikci_id']}).execute()
        guncel_girdi = supabase.table('sut_girdileri').update({'litre': data['yeni_litre'],'duzenlendi_mi': True}).eq('id', girdi_id).execute()
        return jsonify({"status": "success", "data": guncel_girdi.data})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/sut_girdisi_sil/<int:girdi_id>', methods=['DELETE'])
@login_required
@lisans_kontrolu
@modification_allowed
def delete_sut_girdisi(girdi_id):
    try:
        # --- GÜVENLİK GÜNCELLEMESİ ---
        # Önce girdinin bu şirkete ait olup olmadığını kontrol et
        mevcut_girdi_res = supabase.table('sut_girdileri').select('sirket_id').eq('id', girdi_id).eq('sirket_id', session['user']['sirket_id']).single().execute()
        if not mevcut_girdi_res.data:
             return jsonify({"error": "Girdi bulunamadı veya silme yetkiniz yok."}), 404
        
        # Girdi bu şirkete aitse, güvenle silebiliriz.
        supabase.table('girdi_gecmisi').delete().eq('orijinal_girdi_id', girdi_id).execute()
        supabase.table('sut_girdileri').delete().eq('id', girdi_id).execute()
        return jsonify({"message": "Girdi başarıyla silindi."}), 200
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/api/user/change_password', methods=['POST'])
@login_required
def change_password():
    try:
        data = request.get_json()
        user_response = supabase.table('kullanicilar').select('sifre').eq('id', session['user']['id']).single().execute()
        if not bcrypt.check_password_hash(user_response.data['sifre'], data.get('mevcut_sifre')):
            return jsonify({"error": "Mevcut şifreniz yanlış."}), 401
        if data.get('yeni_sifre') != data.get('yeni_sifre_tekrar'):
            return jsonify({"error": "Yeni şifreler eşleşmiyor."}), 400
        hashed_yeni_sifre = bcrypt.generate_password_hash(data.get('yeni_sifre')).decode('utf-8')
        supabase.table('kullanicilar').update({'sifre': hashed_yeni_sifre}).eq('id', session['user']['id']).execute()
        return jsonify({"message": "Şifreniz başarıyla güncellendi."})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@main_bp.route('/offline')
def offline_page():
    return render_template('offline.html')