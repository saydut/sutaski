# blueprints/main.py

import os
from flask import Blueprint, render_template, session, request, flash, redirect, url_for, Response, g
from decorators import login_required, lisans_kontrolu
from extensions import turkey_tz
from datetime import datetime

main_bp = Blueprint(
    'main',
    __name__
)

# YENİ EKLENEN FİLTRE FONKSİYONU
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
# --- YENİ: Tanıtım Sayfası Rotası ---
@main_bp.route('/')
def landing_page():
    """
    Uygulamanın ana tanıtım sayfasını (landing page) gösterir.
    Bu sayfa herkese açıktır, giriş yapmak gerekmez.
    """
    # Eğer kullanıcı zaten giriş yapmışsa, onu doğrudan panele yönlendir.
    if 'user' in session:
        return redirect(url_for('main.panel'))
    # Henüz giriş yapmamışsa, yeni tanıtım sayfamızı göster.
    return render_template('landing.html')


# --- GÜNCELLENDİ: Ana Panel Rotası ---
# Adı "anasayfa" yerine "panel" oldu ve yolu "/panel" olarak değişti.
@main_bp.route('/panel')
@login_required
@lisans_kontrolu
def panel():
    # Service Worker'ın uygulama kabuğunu önbelleğe alması için özel kontrol
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('index.html', session={})

    # @login_required ve @lisans_kontrolu decorator'ları giriş ve lisans
    # kontrollerini zaten yaptığı için buradaki manuel kod blokları kaldırıldı.

    # Tüm kontrollerden geçtiyse, normal anasayfayı göster
    return render_template('index.html', session=session)

@main_bp.route('/raporlar')
@login_required
@lisans_kontrolu
def raporlar_page():
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('raporlar.html', session={})
    return render_template('raporlar.html')

@main_bp.route('/tedarikciler')
@login_required
@lisans_kontrolu
def tedarikciler_sayfasi():
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('tedarikciler.html', session={})
    return render_template('tedarikciler.html')


@main_bp.route('/tedarikci/<int:tedarikci_id>')
@login_required
@lisans_kontrolu
def tedarikci_detay_sayfasi(tedarikci_id):
    return render_template('tedarikci_detay.html', tedarikci_id=tedarikci_id)

@main_bp.route('/offline')
def offline_page():
    return render_template('offline.html')

@main_bp.route('/service-worker.js')
def service_worker():
    try:
        response = g.supabase.table('ayarlar').select('ayar_degeri').eq('ayar_adi', 'cache_version').limit(1).single().execute()
        version = response.data.get('ayar_degeri', '1') if response.data else '1'
    except Exception:
        version = '1' # Hata olursa varsayılan sürümü kullan

    template = render_template('service-worker.js.jinja', cache_version=version)
    return Response(template, mimetype='application/javascript')