# blueprints/main.py
# RLS ve yeni servis yapısına göre güncellendi.

import os
from flask import (
    Blueprint, render_template, session, request, flash, 
    redirect, url_for, Response, g, jsonify, make_response, current_app
)
# 'lisans_kontrolu' kaldırıldı, 'role_required' eklendi
from decorators import login_required, role_required
# Hem anon (client) hem de service (service) istemcilerini import et
from extensions import turkey_tz, supabase_client, supabase_service
from datetime import datetime, timedelta
from constants import UserRole # Güncellenmiş UserRole
import pytz
import io
import csv
from decimal import Decimal
import logging

# RLS'e uyumlu servisleri import et
from services.report_service import report_service 
from services.tedarikci_service import tedarikci_service
from services.tanker_service import tanker_service # Toplayıcı listesi için
from utils import parse_supabase_timestamp

logger = logging.getLogger(__name__)
main_bp = Blueprint('main', __name__)

@main_bp.app_template_filter('format_tarih_str')
def format_tarih_filter(value):
    """String formatındaki 'YYYY-MM-DD' tarihini 'DD.MM.YYYY' formatına çevirir."""
    if not value:
        return ''
    try:
        dt_obj = datetime.strptime(value, '%Y-%m-%d')
        return dt_obj.strftime('%d.%m.%Y')
    except (ValueError, TypeError):
        return value

# --- ARAYÜZ SAYFALARI ---

@main_bp.route('/')
def landing_page():
    """
    Uygulamanın ana tanıtım sayfasını (landing page) gösterir.
    """
    # 'user' in session -> 'access_token' in session
    if 'access_token' in session:
        return redirect(url_for('main.panel'))
    return render_template('landing.html')


@main_bp.route('/panel')
@login_required
# '@lisans_kontrolu' kaldırıldı (artık RLS ve rollerle yönetiliyor)
def panel():
    """
    Kullanıcının rolüne göre ana paneli veya ilgili sayfayı gösterir.
    @login_required decorator'ı 'g.profile' objesini doldurur.
    """
    
    # session['user']['rol'] -> g.profile['rol']
    user_role = g.profile.get('rol')

    if user_role == UserRole.CIFCI.value:
        # Çiftçi rolü 'ciftci' olarak ayarlandıysa
        # 'ciftci.py' blueprint'indeki 'ciftci_paneli' rotasına yönlendir
        return redirect(url_for('ciftci.ciftci_paneli'))
    
    if user_role == UserRole.ADMIN.value:
        # Süper admin rolü 'admin' ise
        # 'admin.py' blueprint'indeki 'admin_paneli' rotasına yönlendir
        return redirect(url_for('admin.admin_paneli'))

    # Diğer roller (firma_admin, toplayici) normal ana paneli görür
    # 'session=session' kaldırıldı. 'base.html' g.profile'ı kullanacak.
    return render_template('index.html')

@main_bp.route('/raporlar')
@login_required
@role_required('firma_admin') # 'lisans_kontrolu' kaldırıldı
def raporlar_page():
    """Raporlar ana sayfasını render eder."""
    try:
        # Rapor filtreleri için toplayıcı ve tedarikçi listelerini RLS ile al
        # sirket_id parametresi GEREKMEZ
        tedarikciler, error1 = tedarikci_service.get_all_for_dropdown()
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

@main_bp.route('/tedarikciler')
@login_required
@role_required('firma_admin', 'toplayici') # 'lisans_kontrolu' kaldırıldı
def tedarikciler_sayfasi():
    return render_template('tedarikciler.html')


@main_bp.route('/tedarikci/<int:tedarikci_id>')
@login_required
@role_required('firma_admin', 'toplayici') # 'lisans_kontrolu' kaldırıldı
def tedarikci_detay_sayfasi(tedarikci_id):
    # 'tedarikci_detay.html' bu ID'yi alıp JS ile API'dan veri çekecek
    return render_template('tedarikci_detay.html', tedarikci_id=tedarikci_id)

@main_bp.route('/offline')
def offline_page():
    return render_template('offline.html')

# --- ANA PANEL API ROTALARI ---
# (Eski rapor.py dosyasından buraya taşındı ve RLS'e uyarlandı)

@main_bp.route('/api/gunluk_ozet')
@login_required
@role_required('firma_admin', 'toplayici') # Ana paneli gören herkes
def get_gunluk_ozet():
    """Günlük özet verisini RLS kullanarak RPC ile çeker."""
    try:
        tarih_str = request.args.get('tarih')
        target_date_str = tarih_str if tarih_str else datetime.now(turkey_tz).date().isoformat()

        # sirket_id parametresi KALDIRILDI
        summary, error = report_service.get_daily_summary(target_date_str)
        if error:
            return jsonify({"error": error}), 500
            
        return jsonify(summary)
    except Exception as e:
        logger.error(f"Günlük özet (API) alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Özet hesaplanırken sunucuda bir hata oluştu."}), 500
    
@main_bp.route('/api/haftalik_ozet')
@login_required
@role_required('firma_admin', 'toplayici')
def get_haftalik_ozet():
    """Haftalık özet verisini (grafik) RLS kullanarak RPC ile çeker."""
    try:
        # Tarih aralığını belirle
        end_date = datetime.now(turkey_tz).date()
        start_date = end_date - timedelta(days=6) # Son 7 gün
        
        # sirket_id parametresi KALDIRILDI
        data, error = report_service.get_weekly_summary(start_date.isoformat(), end_date.isoformat())
        if error:
             return jsonify({"error": error}), 500
        return jsonify(data)
    except Exception as e:
        logger.error(f"Haftalık özet (API) alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Haftalık özet alınırken bir sunucu hatası oluştu."}), 500

@main_bp.route('/api/tedarikci_dagilimi')
@login_required
@role_required('firma_admin', 'toplayici')
def get_tedarikci_dagilimi():
    """Tedarikçi dağılımı (pasta grafik) verisini RLS kullanarak RPC ile çeker."""
    try:
        # Tarih aralığı (ana paneldeki gibi)
        end_date = datetime.now(turkey_tz).date()
        start_date = end_date - timedelta(days=6) # Son 7 gün
        
        # sirket_id parametresi KALDIRILDI
        data, error = report_service.get_supplier_distribution(start_date.isoformat(), end_date.isoformat())
        if error:
             return jsonify({"error": error}), 500

        labels = [item['name'] for item in data]
        data = [float(item['litre']) for item in data]
        return jsonify({'labels': labels, 'data': data})
    except Exception as e:
        logger.error(f"Tedarikçi dağılımı (API) alınırken hata: {e}", exc_info=True)
        return jsonify({"error": "Tedarikçi dağılımı alınırken bir sunucu hatası oluştu."}), 500

@main_bp.route('/service-worker.js')
def service_worker():
    """Service worker dosyasını cache versiyonu ile birlikte sunar."""
    cache_version = "1.0.0" # Varsayılan
    try:
        # 'ayarlar' tablosu RLS'e tabi olmadığı ve global olduğu için,
        # bu ayarı okumak için 'service_role' anahtarına sahip
        # 'supabase_service' istemcisini kullanmalıyız.
        response = supabase_service.table('ayarlar') \
            .select('ayar_degeri') \
            .eq('ayar_adi', 'cache_version') \
            .limit(1) \
            .single() \
            .execute()
        
        if response.data:
            cache_version = response.data['ayar_degeri']
        else:
             logger.warning("Service worker için 'cache_version' ayarı bulunamadı.")
        
    except Exception as e:
        logger.error(f"Service worker için cache_version alınırken hata: {e}", exc_info=True)
        # Hata durumunda varsayılan (eski) cache versiyonu ile devam et
        pass
    
    template = render_template('service-worker.js.jinja', cache_version=cache_version)
    response = make_response(template)
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Cache-Control'] = 'no-cache'
    return response

# Eski /sut_girisleri ve /sut_listesi rotaları
# 'blueprints/sut.py' dosyasına taşınmıştı, buradan kaldırıldı.