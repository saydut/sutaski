# blueprints/rapor.py

from flask import Blueprint, jsonify, request, session, send_file, current_app, render_template
from decorators import login_required, lisans_kontrolu
from extensions import supabase, turkey_tz
from datetime import datetime, timedelta
import pytz
import io
import csv
import calendar
from weasyprint import HTML
from decimal import Decimal, getcontext, InvalidOperation

rapor_bp = Blueprint('rapor', __name__, url_prefix='/api/rapor')
getcontext().prec = 10

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

# --- RAPOR API'LARI ---
@rapor_bp.route('/gunluk_ozet')
@login_required
def get_gunluk_ozet():
    try:
        sirket_id = session['user']['sirket_id']
        tarih_str = request.args.get('tarih')
        target_date = datetime.strptime(tarih_str, '%Y-%m-%d').date() if tarih_str else datetime.now(turkey_tz).date()
        start_time_tr = turkey_tz.localize(datetime.combine(target_date, datetime.min.time()))
        end_time_tr = turkey_tz.localize(datetime.combine(target_date, datetime.max.time()))
        start_time_utc = start_time_tr.astimezone(pytz.utc).isoformat()
        end_time_utc = end_time_tr.astimezone(pytz.utc).isoformat()
        response = supabase.table('sut_girdileri').select('litre').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_time_utc).lte('taplanma_tarihi', end_time_utc).execute()
        
        toplam_litre = Decimal('0')
        for item in response.data:
            try:
                litre_str = str(item.get('litre', '0'))
                toplam_litre += Decimal(litre_str)
            except InvalidOperation:
                print(f"Uyarı: Günlük özette geçersiz litre değeri atlanıyor: {item.get('litre')}")

        return jsonify({'toplam_litre': round(float(toplam_litre), 2)})
    except Exception as e:
        print(f"Günlük özet hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@rapor_bp.route('/haftalik_ozet')
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
            data.append(float(sum(Decimal(str(item.get('litre', '0'))) for item in response.data)))
        return jsonify({'labels': labels[::-1], 'data': data[::-1]})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@rapor_bp.route('/tedarikci_dagilimi')
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
                dagilim[isim] = dagilim.get(isim, Decimal(0)) + Decimal(str(girdi.get('litre', '0')))
        sorted_dagilim = dict(sorted(dagilim.items(), key=lambda item: item[1], reverse=True))
        return jsonify({'labels': list(sorted_dagilim.keys()), 'data': [float(v) for v in sorted_dagilim.values()]})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@rapor_bp.route('/detayli_rapor', methods=['GET'])
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
        daily_totals = {gun.strftime('%Y-%m-%d'): Decimal(0) for gun in date_range}
        supplier_totals = {}
        for girdi in response.data:
            parsed_date = parse_supabase_timestamp(girdi.get('taplanma_tarihi'))
            if not parsed_date: continue
            girdi_gunu_str = parsed_date.astimezone(turkey_tz).strftime('%Y-%m-%d')
            if girdi_gunu_str in daily_totals:
                daily_totals[girdi_gunu_str] += Decimal(str(girdi.get('litre', '0')))
            if girdi.get('tedarikciler') and girdi.get('tedarikciler').get('isim'):
                isim = girdi['tedarikciler']['isim']
                if isim not in supplier_totals: supplier_totals[isim] = {'litre': Decimal(0), 'entryCount': 0}
                supplier_totals[isim]['litre'] += Decimal(str(girdi.get('litre', '0')))
                supplier_totals[isim]['entryCount'] += 1
        turkce_aylar = {"01":"Oca","02":"Şub","03":"Mar","04":"Nis","05":"May","06":"Haz","07":"Tem","08":"Ağu","09":"Eyl","10":"Eki","11":"Kas","12":"Ara"}
        labels = [f"{datetime.strptime(gun, '%Y-%m-%d').strftime('%d')} {turkce_aylar.get(datetime.strptime(gun, '%Y-%m-%d').strftime('%m'), '')}" for gun in sorted(daily_totals.keys())]
        data = [float(toplam) for gun, toplam in sorted(daily_totals.items())]
        total_litre = sum(daily_totals.values())
        summary = {'totalLitre': float(total_litre), 'averageDailyLitre': float(total_litre / len(date_range) if date_range else 0), 'dayCount': len(date_range), 'entryCount': len(response.data)}
        breakdown = sorted([{'name': isim, 'litre': float(totals['litre']), 'entryCount': totals['entryCount']} for isim, totals in supplier_totals.items()], key=lambda x: x['litre'], reverse=True)
        return jsonify({'chartData': {'labels': labels, 'data': data}, 'summaryData': summary, 'supplierBreakdown': breakdown})
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@rapor_bp.route('/aylik_pdf')
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
        gunluk_dokum_dict = {i: {'toplam_litre': Decimal(0), 'girdi_sayisi': 0} for i in range(1, ayin_son_gunu + 1)}
        tedarikci_dokumu_dict = {}
        for girdi in girdiler:
            parsed_date = parse_supabase_timestamp(girdi.get('taplanma_tarihi'))
            if not parsed_date: continue
            girdi_tarihi_tr = parsed_date.astimezone(turkey_tz)
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
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@rapor_bp.route('/export_csv')
@login_required
def export_csv():
    try:
        sirket_id = session['user']['sirket_id']
        secilen_tarih_str = request.args.get('tarih')
        query = supabase.table('sut_girdileri').select('taplanma_tarihi,tedarikciler(isim),litre,fiyat,kullanicilar(kullanici_adi)').eq('sirket_id', sirket_id)
        if secilen_tarih_str:
            target_date = datetime.strptime(secilen_tarih_str, '%Y-%m-%d').date()
            start_utc = turkey_tz.localize(datetime.combine(target_date, datetime.min.time())).astimezone(pytz.utc).isoformat()
            end_utc = turkey_tz.localize(datetime.combine(target_date, datetime.max.time())).astimezone(pytz.utc).isoformat()
            query = query.gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc)
        data = query.order('id', desc=True).execute().data
        output = io.StringIO()
        writer = csv.writer(output, delimiter=';')
        writer.writerow(['Tarih', 'Saat', 'Tedarikçi', 'Litre', 'Birim Fiyat (TL)', 'Tutar (TL)', 'Toplayan Kişi'])
        for row in data:
            parsed_date = parse_supabase_timestamp(row.get('taplanma_tarihi'))
            formatli_tarih = parsed_date.astimezone(turkey_tz).strftime('%d.%m.%Y') if parsed_date else ''
            formatli_saat = parsed_date.astimezone(turkey_tz).strftime('%H:%M') if parsed_date else ''
            tedarikci_adi = row.get('tedarikciler', {}).get('isim', 'Bilinmiyor')
            toplayan_kisi = row.get('kullanicilar', {}).get('kullanici_adi', 'Bilinmiyor')
            litre = Decimal(str(row.get('litre','0')))
            fiyat = Decimal(str(row.get('fiyat','0')))
            tutar = litre * fiyat
            writer.writerow([
                formatli_tarih, 
                formatli_saat,
                tedarikci_adi, 
                str(litre).replace('.',','), 
                str(fiyat).replace('.',','),
                str(tutar).replace('.',','),
                toplayan_kisi
            ])
        output.seek(0)
        filename = f"{secilen_tarih_str}_sut_raporu.csv" if secilen_tarih_str else "toplu_sut_raporu.csv"
        return send_file(io.BytesIO(output.getvalue().encode('utf-8-sig')), mimetype='text/csv', as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500