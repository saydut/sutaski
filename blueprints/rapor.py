from flask import Blueprint, jsonify, request, session, send_file, current_app, render_template, g
from decorators import login_required, lisans_kontrolu
from extensions import turkey_tz
from utils import parse_supabase_timestamp
from datetime import datetime, timedelta
import pytz
import io
import csv
import calendar
from weasyprint import HTML
from decimal import Decimal, getcontext, InvalidOperation


rapor_bp = Blueprint('rapor', __name__, url_prefix='/api/rapor')
getcontext().prec = 10 # Decimal hassasiyeti

@rapor_bp.route('/gunluk_ozet')
@login_required
def get_gunluk_ozet():
    """
    Bu fonksiyon, ana paneldeki özet kartlarını doldurur.
    Doğrudan ve verimli olan RPC fonksiyonunu çağırır.
    """
    try:
        sirket_id = session['user']['sirket_id']
        tarih_str = request.args.get('tarih')
        
        target_date_str = tarih_str if tarih_str else datetime.now(turkey_tz).date().isoformat()

        # Adım 1'de oluşturduğumuz RPC fonksiyonunu çağırıyoruz
        response = g.supabase.rpc('get_daily_summary_rpc', {
            'target_sirket_id': sirket_id,
            'target_date': target_date_str
        }).execute()
        
        summary = response.data[0] if response.data else {'toplam_litre': 0, 'girdi_sayisi': 0}
        
        return jsonify(summary)

    except Exception as e:
        print(f"!!! GÜNLÜK ÖZET (RPC) KRİTİK HATA: {e}")
        return jsonify({"error": "Özet hesaplanırken sunucuda bir hata oluştu."}), 500

    
    
@rapor_bp.route('/haftalik_ozet')
@login_required
def get_haftalik_ozet():
    try:
        sirket_id = session['user']['sirket_id']
        
        # Tek bir RPC çağrısıyla tüm haftalık veriyi hazır olarak alıyoruz
        response = g.supabase.rpc('get_weekly_summary', {'p_sirket_id': sirket_id}).execute()
        
        # Gelen veri zaten {'labels': [...], 'data': [...]} formatında olduğu için
        # direkt olarak istemciye gönderiyoruz.
        return jsonify(response.data)

    except Exception as e:
        print(f"Haftalık özet (RPC) hatası: {e}")
        return jsonify({"error": "Sunucuda beklenmedik bir hata oluştu."}), 500

@rapor_bp.route('/tedarikci_dagilimi')
@login_required
def get_tedarikci_dagilimi():
    try:
        sirket_id = session['user']['sirket_id']
        
        # 1. Yeni ve güçlü RPC fonksiyonumuzu çağırıyoruz
        response = g.supabase.rpc('get_supplier_distribution', {'p_sirket_id': sirket_id}).execute()
        
        # 2. Veritabanından zaten işlenmiş olarak gelen veriyi alıyoruz
        dagilim_verisi = response.data
        
        # 3. Veriyi Chart.js'in beklediği formata dönüştürüyoruz
        labels = [item['name'] for item in dagilim_verisi]
        data = [float(item['litre']) for item in dagilim_verisi]
        
        return jsonify({'labels': labels, 'data': data})
        
    except Exception as e:
        print(f"Tedarikçi dağılımı (RPC) hatası: {e}") # Hata takibi için loglama ekledik
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
            return jsonify({"error": "Geçersiz tarih aralığı. En fazla 90 günlük rapor alabilirsiniz."}), 400

        response = g.supabase.rpc('get_detailed_report_data', {
            'p_sirket_id': sirket_id,
            'p_start_date': start_date_str,
            'p_end_date': end_date_str
        }).execute()
        
        veri = response.data
        if not veri:
             return jsonify({'chartData': {'labels': [], 'data': []}, 'summaryData': {}, 'supplierBreakdown': []})

        daily_totals = veri.get('daily_totals', [])
        supplier_breakdown = veri.get('supplier_breakdown', [])
        total_entry_count = veri.get('total_entry_count', 0)

        turkce_aylar = {"01":"Oca","02":"Şub","03":"Mar","04":"Nis","05":"May","06":"Haz","07":"Tem","08":"Ağu","09":"Eyl","10":"Eki","11":"Kas","12":"Ara"}
        labels = [f"{gun['gun'][8:]} {turkce_aylar.get(gun['gun'][5:7], '')}" for gun in daily_totals]
        data = [float(gun['toplam']) for gun in daily_totals]
        
        total_litre = sum(Decimal(str(item.get('toplam', '0'))) for item in daily_totals)
        day_count = (end_date - start_date).days + 1
        
        summary = {
            'totalLitre': float(total_litre), 
            'averageDailyLitre': float(total_litre / day_count if day_count > 0 else 0), 
            'dayCount': day_count, 
            'entryCount': total_entry_count
        }
        
        return jsonify({
            'chartData': {'labels': labels, 'data': data}, 
            'summaryData': summary, 
            'supplierBreakdown': supplier_breakdown
        })
        
    except Exception as e:
        import traceback
        print(f"Detaylı rapor hatası: {e}")
        traceback.print_exc()
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
        response = g.supabase.table('sut_girdileri').select('litre, taplanma_tarihi, tedarikciler(isim)').eq('sirket_id', sirket_id).gte('taplanma_tarihi', start_utc).lte('taplanma_tarihi', end_utc).execute()
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
        query = g.supabase.table('sut_girdileri').select('taplanma_tarihi,tedarikciler(isim),litre,fiyat,kullanicilar(kullanici_adi)').eq('sirket_id', sirket_id)
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

