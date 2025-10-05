from flask import Blueprint, render_template, session, request
from decorators import login_required, lisans_kontrolu
from flask import Response
from extensions import supabase

main_bp = Blueprint(
    'main',
    __name__,
    template_folder='../../templates',
    static_folder='../../static'
)

# --- ARAYÜZ SAYFALARI ---
@main_bp.route('/')
@login_required
@lisans_kontrolu
def anasayfa():
    # Service Worker'ın uygulama kabuğunu önbelleğe alması için
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('index.html', session={})
    return render_template('index.html', session=session)

@main_bp.route('/raporlar')
@login_required
@lisans_kontrolu
def raporlar_page():
    # BU BLOK EKLENDİ
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('raporlar.html', session={})
    return render_template('raporlar.html')

@main_bp.route('/tedarikciler')
@login_required
@lisans_kontrolu
def tedarikciler_sayfasi():
    # BU BLOK EKLENDİ
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
        # Veritabanından en güncel cache versiyonunu çek
        response = supabase.table('ayarlar').select('ayar_degeri').eq('ayar_adi', 'cache_version').single().execute()
        version = response.data.get('ayar_degeri', '1') if response.data else '1'
    except Exception:
        version = '1' # Hata olursa varsayılan sürümü kullan

    # Jinja2 şablonunu render et ve JavaScript olarak sun
    template = render_template('service-worker.js.jinja', cache_version=version)
    return Response(template, mimetype='application/javascript')