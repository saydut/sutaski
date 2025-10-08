import os
from flask import Blueprint, render_template, session, request, flash, redirect, url_for, Response
from decorators import login_required, lisans_kontrolu
from extensions import supabase, turkey_tz
from datetime import datetime

main_bp = Blueprint(
    'main',
    __name__,
    template_folder='../../templates',
    static_folder='../../static'
)

# --- ARAYÜZ SAYFALARI ---
@main_bp.route('/')
def anasayfa():
    # Service Worker'ın uygulama kabuğunu önbelleğe alması için özel kontrol
    # Eğer istek Service Worker'dan geliyorsa, giriş kontrolü yapmadan boş şablonu döndür
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('index.html', session={})

    # Eğer normal bir kullanıcı isteğiyse ve giriş yapılmamışsa, login sayfasına yönlendir
    if 'user' not in session:
        return redirect(url_for('auth.login_page'))

    # Lisans kontrolünü manuel olarak yap
    user_info = session.get('user')
    if user_info and user_info.get('rol') != 'admin':
        lisans_bitis = user_info.get('lisans_bitis_tarihi')
        if lisans_bitis:
            try:
                lisans_bitis_tarihi_obj = datetime.strptime(lisans_bitis, '%Y-%m-%d').date()
                bugun_tr = datetime.now(turkey_tz).date()
                if bugun_tr >= lisans_bitis_tarihi_obj:
                    flash("Şirketinizin lisans süresi dolmuştur.", "danger")
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
        response = supabase.table('ayarlar').select('ayar_degeri').eq('ayar_adi', 'cache_version').limit(1).single().execute()
        version = response.data.get('ayar_degeri', '1') if response.data else '1'
    except Exception:
        version = '1' # Hata olursa varsayılan sürümü kullan

    template = render_template('service-worker.js.jinja', cache_version=version)
    return Response(template, mimetype='application/javascript')