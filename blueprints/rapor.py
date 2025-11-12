# blueprints/rapor.py

from flask import Blueprint, jsonify, request, session, send_file, current_app, render_template, g
# YENİ: firma_yetkilisi_required eklendi
from decorators import login_required, lisans_kontrolu, firma_yetkilisi_required
from extensions import turkey_tz
from utils import parse_supabase_timestamp
from datetime import datetime
import pytz
import io
import csv
import calendar
from weasyprint import HTML
from decimal import Decimal, getcontext
import logging
# GÜNCELLEME: Yeni fonksiyon import edildi
from services.report_service import (
    generate_hesap_ozeti_pdf, 
    generate_mustahsil_makbuzu_pdf, 
    get_profitability_report,
    generate_aylik_rapor_pdf # <-- EKSİK OLAN BUYDU
)

rapor_bp = Blueprint('rapor', __name__, url_prefix='/api/rapor')
logger = logging.getLogger(__name__)
getcontext().prec = 10 

@rapor_bp.route('/gunluk_ozet')
@login_required
def get_gunluk_ozet():
    try:
        sirket_id = session['user']['sirket_id']
        tarih_str = request.args.get('tarih')
        target_date_str = tarih_str if tarih_str else datetime.now(turkey_tz).date().isoformat()

        response = g.supabase.rpc('get_daily_summary_rpc', {
            'target_sirket_id': sirket_id,
            'target_date': target_date_str
        }).execute()
        
        summary = response.data[0] if response.data else {'toplam_litre': 0, 'girdi_sayisi': 0}
        return jsonify(summary)
    except Exception as e:
        logger.error(f"Günlük özet (RPC) alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Özet hesaplanırken sunucuda bir hata oluştu."}), 500
    
@rapor_bp.route('/haftalik_ozet')
@login_required
def get_haftalik_ozet():
    try:
        sirket_id = session['user']['sirket_id']
        response = g.supabase.rpc('get_weekly_summary', {'p_sirket_id': sirket_id}).execute()
        return jsonify(response.data)
    except Exception as e:
        logger.error(f"Haftalık özet (RPC) alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Haftalık özet alınırken bir sunucu hatası oluştu."}), 500



@rapor_bp.route('/tedarikci_dagilimi')
@login_required
def get_tedarikci_dagilimi():
    try:
        sirket_id = session['user']['sirket_id']
        
        # YENİ: URL'den 'period' parametresini al (örn: ?period=daily)
        # Varsayılan olarak 'monthly' (eski davranış) ayarla
        period = request.args.get('period', 'monthly') 
        
        # RPC'yi yeni parametreyle çağır
        response = g.supabase.rpc('get_supplier_distribution', {
            'p_sirket_id': sirket_id,
            'p_period': period  # Parametreyi SQL'e ilet
        }).execute()
        
        dagilim_verisi = response.data
        labels = [item['name'] for item in dagilim_verisi]
        data = [float(item['litre']) for item in dagilim_verisi]
        return jsonify({'labels': labels, 'data': data})
    except Exception as e:
        logger.error(f"Tedarikçi dağılımı (RPC) alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Tedarikçi dağılımı alınırken bir sunucu hatası oluştu."}), 500

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
            'p_sirket_id': sirket_id, 'p_start_date': start_date_str, 'p_end_date': end_date_str
        }).execute()
        
        # GÜNCELLEME: RPC'den gelen veri artık data[0] içinde değil, direkt data'dadır.
        veri = response.data
        if not veri:
             return jsonify({'chartData': {'labels': [], 'data': []}, 'summaryData': {}, 'supplierBreakdown': []})

        daily_totals = veri.get('daily_totals', [])
        turkce_aylar = {"01":"Oca","02":"Şub","03":"Mar","04":"Nis","05":"May","06":"Haz","07":"Tem","08":"Ağu","09":"Eyl","10":"Eki","11":"Kas","12":"Ara"}
        labels = [f"{gun['gun'][8:]} {turkce_aylar.get(gun['gun'][5:7], '')}" for gun in daily_totals]
        data = [float(gun['toplam']) for gun in daily_totals]
        
        total_litre = sum(Decimal(str(item.get('toplam', '0'))) for item in daily_totals)
        day_count = (end_date - start_date).days + 1
        
        summary = {
            'totalLitre': float(total_litre), 
            'averageDailyLitre': float(total_litre / day_count if day_count > 0 else 0), 
            'dayCount': day_count, 
            'entryCount': veri.get('total_entry_count', 0)
        }
        
        return jsonify({
            'chartData': {'labels': labels, 'data': data}, 
            'summaryData': summary, 
            'supplierBreakdown': veri.get('supplier_breakdown', [])
        })
        
    except Exception as e:
        logger.error(f"Detaylı rapor alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Detaylı rapor oluşturulurken bir sunucu hatası oluştu."}), 500

# --- KÂRLILIK RAPORU ENDPOINT'İ ---
@rapor_bp.route('/karlilik', methods=['GET'])
@login_required
@firma_yetkilisi_required # Sadece firma yetkilisi/admin görebilir
def get_karlilik_raporu_api():
    """
    Belirli bir tarih aralığı için şirketin genel kârlılık durumunu
    RPC fonksiyonu (get_profitability_report) aracılığıyla getirir.
    """
    try:
        sirket_id = session['user']['sirket_id']
        start_date_str = request.args.get('baslangic')
        end_date_str = request.args.get('bitis')

        if not start_date_str or not end_date_str:
            return jsonify({"error": "Başlangıç ve bitiş tarihleri zorunludur."}), 400

        # Servis fonksiyonunu çağır (bu fonksiyon zaten RPC'yi çağırıyor)
        report_data = get_profitability_report(sirket_id, start_date_str, end_date_str)

        if not report_data:
            # RPC'den veya servisten veri gelmezse varsayılan boş veriyi döndür
            default_data = {
                "toplam_sut_geliri": "0.00",
                "toplam_finans_tahsilati": "0.00",
                "toplam_yem_gideri": "0.00",
                "toplam_finans_odemesi": "0.00",
                "toplam_genel_masraf": "0.00",
                "toplam_gelir": "0.00",
                "toplam_gider": "0.00",
                "net_kar": "0.00"
            }
            return jsonify(default_data)
            
        # Decimal'leri string'e çevirerek JSON'a uygun hale getir
        json_uyumlu_data = {k: str(v) for k, v in report_data.items()}
        
        return jsonify(json_uyumlu_data)
        
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400 # Geçersiz tarih formatı vb.
    except Exception as e:
        logger.error(f"Kârlılık raporu alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Kârlılık raporu oluşturulurken bir sunucu hatası oluştu."}), 500
# --- YENİ ENDPOINT SONU ---


# --- AYLIK PDF ROTASI GÜNCELLENDİ ---
@rapor_bp.route('/aylik_pdf')
@login_required
@lisans_kontrolu
def aylik_rapor_pdf():
    """
    Aylık genel özet raporu için PDF servisini çağırır.
    """
    try:
        sirket_id = session['user']['sirket_id']
        sirket_adi = session['user'].get('sirket_adi', 'Bilinmeyen Şirket')
        ay = int(request.args.get('ay'))
        yil = int(request.args.get('yil'))
        
        # PDF oluşturma servisini çağır (Artık import edildi)
        return generate_aylik_rapor_pdf(sirket_id, sirket_adi, ay, yil)

    except ValueError as ve: # Servisten gelen hataları yakala (örn: PDF oluşturma hatası)
        logger.error(f"Aylık PDF raporu oluşturulurken (ValueError) hata: {ve}", exc_info=True)
        return jsonify({"error": str(ve)}), 500
    except Exception as e:
        logger.error(f"Aylık PDF raporu oluşturulurken (Genel) hata: {e}", exc_info=True)
        return jsonify({"error": "PDF raporu oluşturulurken bir sunucu hatası oluştu."}), 500
# --- GÜNCELLEME SONU ---

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
            writer.writerow([ formatli_tarih, formatli_saat, tedarikci_adi, str(litre).replace('.',','), str(fiyat).replace('.',','), str(tutar).replace('.',','), toplayan_kisi ])
        output.seek(0)
        filename = f"{secilen_tarih_str}_sut_raporu.csv" if secilen_tarih_str else "toplu_sut_raporu.csv"
        return send_file(io.BytesIO(output.getvalue().encode('utf-8-sig')), mimetype='text/csv', as_attachment=True, download_name=filename)
    except Exception as e:
        logger.error(f"CSV dışa aktarılırken hata: {e}", exc_info=True)
        return jsonify({"error": "CSV dosyası oluşturulurken bir sunucu hatası oluştu."}), 500

# PDF fonksiyonunu `report_service.py`'den düzgün import etmek için
# `aylik_rapor_pdf` fonksiyonunu düzenleyelim (eğer orada değilse).
# NOT: `report_service.py` dosyanı inceledim,
# `generate_aylik_rapor_pdf` adında bir fonksiyon yok, sadece `generate_hesap_ozeti_pdf` var.
# `aylik_rapor_pdf` içindeki mantığı olduğu gibi bırakıyorum, çünkü `report_service.py`
# içinde bu işlevi yapan genel bir fonksiyon yok, sadece tedarikçi bazlı var.
# Bu yüzden yukarıdaki `get_profitability_report` import'u ana değişiklik.