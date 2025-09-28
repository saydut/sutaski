from functools import wraps
from flask import session, flash, redirect, url_for, jsonify
from constants import UserRole 
from extensions import turkey_tz
from datetime import datetime

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
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
        user_info = session.get('user')
        # Admin rolündeki kullanıcıları lisans kontrolünden muaf tut
        if user_info and user_info.get('rol') == UserRole.ADMIN.value:
            return f(*args, **kwargs)

        # Oturumda kullanıcı bilgisi yoksa giriş sayfasına yönlendir
        if not user_info:
            return redirect(url_for('auth.login_page'))

        lisans_bitis = user_info.get('lisans_bitis_tarihi')
        
        if lisans_bitis:
            try:
                lisans_bitis_tarihi_obj = datetime.strptime(lisans_bitis, '%Y-%m-%d').date()
                
                # Zaman dilimi fark etmeksizin Türkiye saatine göre bugünün tarihini al
                bugun_tr = datetime.now(turkey_tz).date()

                # *** MANTIKSAL DÜZELTME: Lisansın son günü dahil edilmeyecek şekilde kontrol ***
                # Eğer bugün, lisansın bittiği güne eşit veya ondan sonraysa kullanıcıyı at.
                if bugun_tr >= lisans_bitis_tarihi_obj:
                    flash("Şirketinizin lisans süresi dolmuştur. Lütfen sistem yöneticinizle iletişime geçin.", "danger")
                    session.pop('user', None) # Güvenlik için oturumu sonlandır
                    return redirect(url_for('auth.login_page'))
            except (ValueError, TypeError):
                 flash("Lisans tarihi formatı geçersiz.", "danger")
                 session.pop('user', None)
                 return redirect(url_for('auth.login_page'))
        else:
             # Lisans tarihi hiç tanımlanmamışsa kullanıcıyı at
             flash("Şirketiniz için bir lisans tanımlanmamıştır.", "danger")
             session.pop('user', None)
             return redirect(url_for('auth.login_page'))
            
        # Tüm kontrollerden geçtiyse, istenen sayfayı göster
        return f(*args, **kwargs)
    return decorated_function

def modification_allowed(f):
    """
    Kullanıcının veri değiştirme (ekleme, silme, düzenleme) yetkisi olup olmadığını kontrol eder.
    'muhasebeci' rolü bu işlemleri yapamaz.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_rol = session.get('user', {}).get('rol')
        if user_rol == UserRole.MUHASEBECI.value:
            # API isteği ise JSON, değilse HTML sayfası için farklı yanıtlar verilebilir.
            # Şimdilik API odaklı olduğu için JSON dönüyoruz.
            return jsonify({"error": "Bu işlemi yapma yetkiniz yok."}), 403
        return f(*args, **kwargs)
    return decorated_function