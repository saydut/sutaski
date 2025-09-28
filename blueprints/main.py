from flask import Blueprint, render_template, session, request
from decorators import login_required, lisans_kontrolu

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

@main_bp.route('/offline')
def offline_page():
    return render_template('offline.html')