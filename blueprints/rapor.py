# blueprints/rapor.py
# RLS ve yeni servis yapısına göre güncellendi.

import logging
from flask import (
    Blueprint, jsonify, render_template, request, g, Response,
    make_response, current_app, flash
)
# 'session' import'u kaldırıldı
from decorators import login_required, role_required
from extensions import turkey_tz, supabase_client # Artık g.supabase yerine supabase_client
from utils import parse_supabase_timestamp
from datetime import datetime, timedelta
import pytz
import io
import csv
import calendar
from weasyprint import HTML, CSS
from decimal import Decimal, getcontext

# Güncellenmiş RLS'e uyumlu servisleri import et
from services.report_service import report_service 
from services.tedarikci_service import tedarikci_service
# Toplayıcı listesi için tanker servisini kullanmak daha mantıklı (orada vardı)
from services.tanker_service import tanker_service 
from constants import UserRole # Rol sabitlerini kullanmak için

logger = logging.getLogger(__name__)
rapor_bp = Blueprint('rapor', __name__, url_prefix='/rapor')
getcontext().prec = 10 

@rapor_bp.route('/')
@login_required
@role_required('firma_admin') # Eski decorator'lar yerine
def rapor_sayfasi():
    """Raporlar ana sayfasını render eder."""
    try:
        # Rapor filtreleri için toplayıcı ve tedarikçi listelerini RLS ile al
        # sirket_id parametresi GEREKMEZ
        tedarikciler, error1 = tedarikci_service.get_all_for_dropdown()
        # 'get_collectors_for_assignment' toplayıcıları RLS ile getirir
        toplayicilar, error2 = tanker_service.get_collectors_for_assignment() 
        
        if error1 or error2:
             flash(f"Filtre verileri yüklenemedi: {error1 or ''} {error2 or ''}", "danger")

        return render_template(
            'raporlar.html', 
            tedarikciler=tedarikciler or [], 
            toplayicilar=toplayicilar or []
        )
    except Exception as e:
        logger.error(f"Rapor sayfası (filtreler) yüklenirken hata: {e}", exc_info=True)
        flash(f"Rapor sayfası yüklenirken hata: {str(e)}", "danger")
        return render_template('raporlar.html', tedarikciler=[], toplayicilar=[])

# --- API ENDPOINT'LERİ (JSON VERİ DÖNDÜRENLER) ---
# Not: Ana panelde (index.html) kullanılan /gunluk_ozet, /haftalik_ozet, 
# /tedarikci_dagilimi rotaları blueprints/main.py içinde olmalıdır.
# Bu dosyadaki eski rotaları (bu yüzden) kaldırıyorum.

@rapor_bp.route('/api/karlilik', methods=['GET'])
@login_required
@role_required('firma_admin')
def get_karlilik_raporu_api():
    """Karlılık raporu verilerini RLS kullanarak JSON olarak döndürür."""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not all([start_date, end_date]):
            raise ValueError("Başlangıç ve bitiş tarihleri zorunludur.")
            
        # sirket_id parametresi KALDIRILDI
        rapor_data, error = report_service.get_karlilik_raporu(start_date, end_date)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(rapor_data)
        
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Karlılık raporu API hatası: {e}", exc_info=True)
        return jsonify({"error": "Karlılık raporu alınamadı."}), 500

@rapor_bp.route('/api/tedarikci_ozet', methods=['GET'])
@login_required
@role_required('firma_admin')
def get_tedarikci_ozet_raporu_api():
    """Tedarikçi Özet Raporu (Aylık Rapor) verilerini RLS ile JSON olarak döndürür."""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not all([start_date, end_date]):
            raise ValueError("Başlangıç ve bitiş tarihleri zorunludur.")
            
        # sirket_id parametresi KALDIRILDI
        rapor_data, error = report_service.get_tedarikci_ozet_raporu(start_date, end_date)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(rapor_data)
        
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Tedarikçi Özet Raporu API hatası: {e}", exc_info=True)
        return jsonify({"error": "Tedarikçi özet raporu alınamadı."}), 500

@rapor_bp.route('/api/detayli_sut_raporu', methods=['GET'])
@login_required
@role_required('firma_admin')
def get_detayli_sut_raporu_api():
    """Detaylı Süt Raporu verilerini (filtreli) RLS ile JSON olarak döndürür."""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        tedarikci_id = request.args.get('tedarikci_id', type=int) or None
        toplayici_id = request.args.get('toplayici_id', type=str) or None # Artık UUID (string)
        
        if not all([start_date, end_date]):
            raise ValueError("Başlangıç ve bitiş tarihleri zorunludur.")
            
        # sirket_id parametresi KALDIRILDI
        rapor_data, error = report_service.get_detayli_sut_raporu(start_date, end_date, tedarikci_id, toplayici_id)
        if error:
             return jsonify({"error": error}), 500
             
        return jsonify(rapor_data)
        
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logger.error(f"Detaylı Süt Raporu API hatası: {e}", exc_info=True)
        return jsonify({"error": "Detaylı süt raporu alınamadı."}), 500


# --- PDF İndirme Rotaları ---

@rapor_bp.route('/download/tedarikci_ozet', methods=['GET'])
@login_required
@role_required('firma_admin')
def download_tedarikci_ozet_pdf():
    """Tedarikçi Özet Raporunu (Aylık Rapor) PDF olarak indirir."""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not all([start_date, end_date]):
            return "Başlangıç ve bitiş tarihleri zorunludur.", 400
            
        # 1. Rapor verisini al (sirket_id olmadan)
        rapor_data, error = report_service.get_tedarikci_ozet_raporu(start_date, end_date)
        if error:
            return f"Rapor verisi alınamadı: {error}", 500
        
        # 2. Şirket adını RLS ile al (g.supabase -> supabase_client)
        # RLS politikamız 'sirketler' tablosunda sadece 'id = g.profile['sirket_id']'
        # olan kaydı görmeye izin veriyordu.
        sirket_info = supabase_client.table('sirketler').select('sirket_adi').single().execute()
        sirket_adi = sirket_info.data['sirket_adi'] if sirket_info.data else "Şirket Adı Bulunamadı"
        
        tarih_araligi = f"{datetime.strptime(start_date, '%Y-%m-%d').strftime('%d.%m.%Y')} - {datetime.strptime(end_date, '%Y-%m-%d').strftime('%d.%m.%Y')}"
        
        # 3. PDF için HTML'i render et
        # Bu, eski 'generate_aylik_rapor_pdf' fonksiyonunun mantığıdır
        html = render_template(
            'aylik_rapor_pdf.html', 
            rapor_data=rapor_data, 
            sirket_adi=sirket_adi, 
            tarih_araligi=tarih_araligi
        )
        
        # 4. PDF oluştur
        pdf = HTML(string=html).write_pdf(stylesheets=[CSS(string='@page { size: A4 landscape; margin: 1cm; } body { font-family: sans-serif; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background-color: #f2f2f2; }')])
        
        response = make_response(pdf)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=Tedarikci_Ozet_Raporu_{start_date}_{end_date}.pdf'
        return response
        
    except Exception as e:
        logger.error(f"Tedarikçi Özet PDF indirme hatası: {e}", exc_info=True)
        return f"PDF oluşturulurken hata: {str(e)}", 500


@rapor_bp.route('/download/mustahsil_makbuzu/<int:tedarikci_id>', methods=['GET'])
@login_required
@role_required('firma_admin')
def download_mustahsil_makbuzu(tedarikci_id):
    """Müstahsil Makbuzunu (Detaylı Süt Raporu) PDF olarak indirir."""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        if not all([start_date, end_date]):
            return "Başlangıç ve bitiş tarihleri zorunludur.", 400

        # 1. Rapor verisini al (sirket_id olmadan)
        rapor_data, error = report_service.get_detayli_sut_raporu(start_date, end_date, tedarikci_id, None)
        if error:
             return f"Rapor verisi alınamadı: {error}", 500
        
        # 2. Şirket ve Tedarikçi bilgilerini RLS ile al (g.supabase -> supabase_client)
        sirket_info = supabase_client.table('sirketler').select('sirket_adi, adres, vergi_kimlik_no').single().execute()
        sirket_data = sirket_info.data or {}
        
        tedarikci_info = supabase_client.table('tedarikciler').select('isim, tc_no, adres').eq('id', tedarikci_id).single().execute()
        tedarikci_data = tedarikci_info.data or {}
        
        if not tedarikci_data:
             return "Tedarikçi bilgisi bulunamadı veya görme yetkiniz yok.", 404

        # 3. Tarihleri formatla
        tarih_araligi = f"{datetime.strptime(start_date, '%Y-%m-%d').strftime('%d.%m.%Y')} - {datetime.strptime(end_date, '%Y-%m-%d').strftime('%d.%m.%Y')}"
        
        # 4. Toplamları hesapla (Python'da)
        toplam_litre = sum(Decimal(item.get('litre', 0)) for item in rapor_data)
        toplam_tutar = sum(Decimal(item.get('toplam_tutar', 0)) for item in rapor_data)

        # 5. PDF için HTML'i render et
        # Bu, eski 'generate_mustahsil_makbuzu_pdf' fonksiyonunun mantığıdır
        html = render_template(
            'mustahsil_makbuzu_pdf.html', 
            rapor_data=rapor_data, 
            sirket=sirket_data,
            tedarikci=tedarikci_data,
            tarih_araligi=tarih_araligi,
            toplam_litre=toplam_litre,
            toplam_tutar=toplam_tutar,
            tarih=datetime.now(turkey_tz).strftime('%d.%m.%Y')
        )
        
        # 6. PDF Oluştur
        pdf_file = HTML(string=html).write_pdf(stylesheets=[CSS(string='@page { size: A4 portrait; margin: 1cm; } body { font-family: sans-serif; }')])
        
        response = make_response(pdf_file)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=Mustahsil_{tedarikci_data.get("isim", "Tedarikci")}_{start_date}.pdf'
        return response

    except Exception as e:
        logger.error(f"Müstahsil Makbuzu PDF indirme hatası: {e}", exc_info=True)
        return f"PDF oluşturulurken hata: {str(e)}", 500

@rapor_bp.route('/export_csv')
@login_required
@role_required('firma_admin')
def export_csv():
    """Günlük süt girdilerini CSV olarak dışa aktarır."""
    try:
        secilen_tarih_str = request.args.get('tarih')
        
        # g.supabase -> supabase_client
        # .eq('sirket_id', ...) FİLTRESİ KALDIRILDI
        # 'kullanicilar(kullanici_adi)' -> 'profiller(kullanici_adi)'
        query = supabase_client.table('sut_girdileri').select(
            'taplanma_tarihi, tedarikciler(isim), litre, fiyat, profiller(kullanici_adi)'
        )
        
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
            # 'kullanicilar' -> 'profiller'
            toplayan_kisi = row.get('profiller', {}).get('kullanici_adi', 'Bilinmiyor') 
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

# Eski 'generate_...' PDF fonksiyonları artık servis dosyasında değil,
# bu dosyadaki '/download/...' rotalarının içinde yer alıyor.