import os
from flask import (
    Blueprint, render_template, session, redirect, 
    url_for, g, current_app, jsonify, send_from_directory,
    make_response
)
from datetime import datetime, timedelta

# extensions ve decorator'lar
from decorators import login_required, role_required
from extensions import turkey_tz

# Servisler (Backend mantığı)
from services.tedarikci_service import (
    get_supplier_stats, 
    get_recent_actions_for_dashboard, 
    get_dashboard_charts
)

main_bp = Blueprint('main', __name__)


# --- 1. HTML Sayfa Rotaları ---

@main_bp.route('/')
@login_required
def index():
    """
    Ana Dashboard sayfasını render eder.
    @login_required dekoratörü sayesinde sadece giriş yapanlar görebilir.
    """
    # Gerekli rol kontrolleri (eğer lisansı bitmişse vs. decorator'da yapılabilir)
    
    # Eğer kullanıcı 'ciftci' ise, onu kendi paneline yönlendir
    if g.user.rol == 'ciftci':
        return redirect(url_for('ciftci.ciftci_paneli'))
        
    # Eğer kullanıcı 'super_admin' ise, onu admin paneline yönlendir
    if g.user.rol == 'super_admin':
        return redirect(url_for('admin.admin_paneli'))

    # Diğer roller (firma_admin, firma_calisan) normal anasayfayı görür
    return render_template('index.html')


@main_bp.route('/service-worker.js')
def service_worker():
    """
    PWA (Progressive Web App) için service worker dosyasını
    'templates' klasöründen render ederek sunar.
    Bu, Jinja2 şablonlaması (örn: {{ url_for(...) }}) kullanabilmemiz içindir.
    """
    # templates/service-worker.js.jinja dosyasını bulur
    response = make_response(render_template('service-worker.js.jinja'))
    response.headers['Content-Type'] = 'application/javascript'
    return response

# --- 2. GEREKSİZ/HATALI ROTOLAR ---
# Önceki kodda çakışmaya neden olan duplicate '/decorator' rotaları 
# bu temizlenmiş versiyonda kaldırıldı.


# --- 3. DASHBOARD API ROTALARI ---

# DÜZELTME: 
# static/js/main.js script'i tüm dashboard verisini TEK BİR adresten bekliyordu.
# Backend'deki üç ayrı fonksiyonu (summary, charts, recent_actions)
# burada birleştirip '/api/dashboard/all' altında sunuyoruz.

@main_bp.route('/api/dashboard/all', methods=['GET'])
@login_required
@role_required('firma_admin', 'firma_calisan')
def get_dashboard_all_data():
    """
    Anasayfa (index.html) için tüm dashboard verilerini (kartlar, grafikler, son işlemler)
    tek bir JSON objesi olarak döndürür.
    """
    try:
        sirket_id = g.user.sirket_id
        
        # 1. Özet Kart verilerini al (services/tedarikci_service.py'den)
        summary_data = get_supplier_stats(sirket_id)
        
        # 2. Grafik verilerini al (services/tedarikci_service.py'den)
        chart_data = get_dashboard_charts(sirket_id)
        
        # 3. Son İşlemler verisini al (services/tedarikci_service.py'den)
        recent_actions = get_recent_actions_for_dashboard(sirket_id)

        # main.js'in beklediği formatta birleştir
        response_data = {
            "summary": summary_data,
            "charts": chart_data,
            "recent_actions": recent_actions
        }
        
        return jsonify(response_data), 200

    except Exception as e:
        current_app.logger.error(f"Dashboard verileri alınırken hata: {e}", exc_info=True)
        return jsonify(hata=f"Dashboard verileri yüklenirken bir sunucu hatası oluştu: {str(e)}"), 500


# --- ESKİ API ROTALARI (Artık kullanılmıyor, '/all' altında birleştirildi) ---
# @main_bp.route('/api/dashboard/summary', methods=['GET'])
# @login_required
# def get_dashboard_summary():
#     # ... (Eski kod)
#
# @main_bp.route('/api/dashboard/charts', methods=['GET'])
# @login_required
# def get_dashboard_chart_data():
#     # ... (Eski kod)
#
# @main_bp.route('/api/dashboard/recent-actions', methods=['GET'])
# @login_required
# def get_recent_actions():
#     # ... (Eski kod)

