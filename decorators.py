from functools import wraps
from flask import session, flash, redirect, url_for, jsonify, request
from constants import UserRole 
from extensions import turkey_tz
from datetime import datetime

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Service Worker'dan gelen önbellekleme isteğini kontrol et ve atla
        if request.headers.get('X-Cache-Me') == 'true':
            return f(*args, **kwargs)
        
        if 'user' not in session:
            flash("Bu sayfayı görüntülemek için giriş yapmalısınız.", "warning")
            return redirect(url_for('auth.login_page'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if session.get('user', {}).get('rol') != UserRole.ADMIN.value:
            flash("Bu sayfaya erişim yetkiniz yok.", "danger")
            return redirect(url_for('main.anasayfa'))
        return f(*args, **kwargs)
    return decorated_function

def lisans_kontrolu(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # YENİ EKLENEN KONTROL:
        # Service Worker'dan gelen önbellekleme isteğini burada da kontrol et ve atla
        if request.headers.get('X-Cache-Me') == 'true':
            return f(*args, **kwargs)

        user_info = session.get('user')
        if user_info and user_info.get('rol') == UserRole.ADMIN.value:
            return f(*args, **kwargs)

        if not user_info:
            return redirect(url_for('auth.login_page'))

        lisans_bitis = user_info.get('lisans_bitis_tarihi')
        
        if lisans_bitis:
            try:
                lisans_bitis_tarihi_obj = datetime.strptime(lisans_bitis, '%Y-%m-%d').date()
                bugun_tr = datetime.now(turkey_tz).date()
                if bugun_tr >= lisans_bitis_tarihi_obj:
                    flash("Şirketinizin lisans süresi dolmuştur. Lütfen sistem yöneticinizle iletişime geçin.", "danger")
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
            
        return f(*args, **kwargs)
    return decorated_function

def modification_allowed(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_rol = session.get('user', {}).get('rol')
        if user_rol == UserRole.MUHASEBECI.value:
            return jsonify({"error": "Bu işlemi yapma yetkiniz yok."}), 403
        return f(*args, **kwargs)
    return decorated_function