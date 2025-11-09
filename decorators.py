# decorators.py
import logging
from functools import wraps
# DÜZELTME: API hata yanıtları için request ve jsonify eklendi
from flask import session, redirect, url_for, g, flash, abort, request, jsonify
from constants import UserRole
from datetime import date # Lisans kontrolü için eklendi

logger = logging.getLogger(__name__)

def login_required(f):
    """
    Kullanıcının giriş yapıp yapmadığını kontrol eder.
    Giriş yapmamışsa login sayfasına yönlendirir.
    Giriş yapmışsa kullanıcı bilgilerini 'g.user'a atar.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            flash('Bu sayfayı görmek için giriş yapmalısınız.', 'warning')
            return redirect(url_for('auth.login'))
        
        g.user = session.get('user')
        
        if g.user is None:
            session.pop('user', None)
            flash('Oturum hatası, lütfen tekrar giriş yapın.', 'danger')
            return redirect(url_for('auth.login'))
            
        return f(*args, **kwargs)
    return decorated_function


def lisans_kontrolu(f):
    """
    Kullanıcının lisansının geçerli olup olmadığını kontrol eder.
    Sadece 'ADMIN' olmayan rolleri kontrol eder.
    MUTLAKA @login_required'dan SONRA kullanılmalıdır.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'user') or g.user is None:
            logger.warning("Lisans decorator'ı 'g.user' olmadan çağrıldı. @login_required eksik.")
            flash('Yetkilendirme için önce giriş yapılmalı.', 'danger')
            return redirect(url_for('auth.login'))

        kullanici_rolu = g.user.get('rol')
        
        # Admin lisans kontrolüne tabi değildir
        if kullanici_rolu == UserRole.ADMIN.value:
            return f(*args, **kwargs)

        lisans_bitis_str = g.user.get('lisans_bitis_tarihi')
        
        if not lisans_bitis_str:
            logger.warning(f"Kullanıcı {g.user.get('email')} için lisans bitiş tarihi bulunamadı.")
            flash('Lisans bilgileriniz eksik. Lütfen yönetici ile iletişime geçin.', 'danger')
            # Giriş yapılmış ama lisans yoksa ana sayfaya yönlendir (login'e değil)
            return redirect(url_for('main.index')) 

        try:
            # Tarihi 'YYYY-MM-DD' formatından parse et
            lisans_bitis_tarihi = date.fromisoformat(lisans_bitis_str)
            bugun = date.today()
            
            if lisans_bitis_tarihi < bugun:
                # Lisans süresi dolmuş
                logger.warning(f"Lisans süresi doldu: Kullanıcı {g.user.get('email')}, Bitiş: {lisans_bitis_tarihi}")
                flash(f"Lisans süreniz {lisans_bitis_tarihi} tarihinde sona erdi. Lütfen lisansınızı yenileyin.", 'danger')
                return redirect(url_for('main.index')) # Ana sayfaya yönlendir
                
        except ValueError:
            logger.error(f"Kullanıcı {g.user.get('email')} için geçersiz lisans tarihi formatı: {lisans_bitis_str}")
            flash('Lisans bilgileriniz okunamadı. Lütfen yönetici ile iletişime geçin.', 'danger')
            return redirect(url_for('main.index'))

        # Lisans geçerli
        return f(*args, **kwargs)
    return decorated_function


def role_required(*roles):
    """
    Kullanıcının belirtilen rollerden birine sahip olmasını gerektiren bir decorator.
    MUTLAKA @login_required'dan SONRA kullanılmalıdır.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(g, 'user') or g.user is None:
                logger.warning(f"Role decorator'ı 'g.user' olmadan çağrıldı. @login_required eksik olabilir.")
                flash('Yetkilendirme için önce giriş yapılmalı.', 'danger')
                return redirect(url_for('auth.login'))
            
            izin_verilen_roller = set()
            for rol in roles:
                if isinstance(rol, UserRole):
                    izin_verilen_roller.add(rol.value)
                else:
                    izin_verilen_roller.add(str(rol))
            
            kullanici_rolu = g.user.get('rol')
            
            if kullanici_rolu not in izin_verilen_roller:
                logger.warning(f"Yetkisiz Erişim Girişimi: Kullanıcı {g.user.get('email')} (Rol: {kullanici_rolu}), '{f.__name__}' fonksiyonuna erişmeye çalıştı. İzin verilen roller: {izin_verilen_roller}")
                if request.path.startswith('/api/'):
                     return jsonify({"error": "Bu işlem için yetkiniz bulunmamaktadır."}), 403
                abort(403)  # 403 Forbidden (Yasak)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def admin_required(f):
    """
    Kullanıcının 'ADMIN' rolüne sahip olmasını gerektiren bir decorator.
    @role_required(UserRole.ADMIN)'in bir kısayoludur.
    MUTLAKA @login_required'dan SONRA kullanılmalıdır.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # @login_required'ın g.user'ı ayarlamış olması gerekir
        if not hasattr(g, 'user') or g.user is None:
            logger.warning(f"Admin decorator'ı 'g.user' olmadan çağrıldı. @login_required eksik olabilir.")
            flash('Yetkilendirme için önce giriş yapılmalı.', 'danger')
            return redirect(url_for('auth.login'))
        
        kullanici_rolu = g.user.get('rol')
        
        if kullanici_rolu != UserRole.ADMIN.value:
            # Kullanıcının rolü 'ADMIN' değilse
            logger.warning(f"Yetkisiz Erişim Girişimi (ADMIN GEREKLİ): Kullanıcı {g.user.get('email')} (Rol: {kullanici_rolu}), '{f.__name__}' fonksiyonuna erişmeye çalıştı.")
            if request.path.startswith('/api/'):
                 return jsonify({"error": "Bu işlem için yetkiniz bulunmamaktadır."}), 403
            abort(403)  # 403 Forbidden (Yasak)
        
        # Yetkisi var, fonksiyona devam et
        return f(*args, **kwargs)
    return decorated_function

def modification_allowed(f):
    """
    Kullanıcının veri girişi/güncelleme/silme yetkisi olup olmadığını kontrol eder.
    Sadece 'ADMIN', 'FIRMA_YETKILISI' ve 'TOPLAYICI' rollerine izin verir.
    (Muhasebeci ve Çiftçi rolleri hariç tutulur).
    MUTLAKA @login_required'dan SONRA kullanılmalıdır.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'user') or g.user is None:
            logger.warning(f"Modification decorator'ı 'g.user' olmadan çağrıldı. @login_required eksik olabilir.")
            # API isteği ise JSON dön
            if request.path.startswith('/api/'):
                return jsonify({"error": "Yetkilendirme için önce giriş yapılmalı."}), 401
            flash('Yetkilendirme için önce giriş yapılmalı.', 'danger')
            return redirect(url_for('auth.login'))
        
        kullanici_rolu = g.user.get('rol')
        
        izin_verilen_roller = {
            UserRole.ADMIN.value,
            UserRole.FIRMA_YETKILISI.value,
            UserRole.TOPLAYICI.value
        }
        
        if kullanici_rolu not in izin_verilen_roller:
            # Kullanıcının rolü izin verilen rollerden biri değilse
            logger.warning(f"Yetkisiz Değişiklik Girişimi: Kullanıcı {g.user.get('email')} (Rol: {kullanici_rolu}), '{f.__name__}' (Path: {request.path}) fonksiyonuna erişmeye çalıştı.")
            
            # API rotası ise JSON dön, değilse 403 sayfası göster
            if request.path.startswith('/api/'):
                    return jsonify({"error": "Bu işlem için yetkiniz bulunmamaktadır."}), 403
            abort(403)  # 403 Forbidden (Yasak)
        
        # Yetkisi var, fonksiyona devam et
        return f(*args, **kwargs)
    return decorated_function

# --- BU FONKSİYON YENİ EKLENDİ ---
def firma_yetkilisi_required(f):
    """
    Kullanıcının 'FIRMA_YETKILISI' rolüne sahip olmasını gerektiren bir decorator.
    @role_required(UserRole.FIRMA_YETKILISI)'nin bir kısayoludur.
    MUTLAKA @login_required'dan SONRA kullanılmalıdır.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'user') or g.user is None:
            logger.warning(f"Firma Yetkilisi decorator'ı 'g.user' olmadan çağrıldı. @login_required eksik olabilir.")
            if request.path.startswith('/api/'):
                return jsonify({"error": "Yetkilendirme için önce giriş yapılmalı."}), 401
            flash('Yetkilendirme için önce giriş yapılmalı.', 'danger')
            return redirect(url_for('auth.login'))
        
        kullanici_rolu = g.user.get('rol')
        
        # Hem Admin hem de Firma Yetkilisi bu alanları görebilir (Genellikle Admin her şeyi görür)
        # Ancak fonksiyon adı 'firma_yetkilisi_required' olduğu için
        # SADECE firma yetkilisini kontrol etmek daha doğru olabilir.
        # Eğer Admin'in de görmesi gerekiyorsa, 'role_required(UserRole.FIRMA_YETKILISI, UserRole.ADMIN)' kullanılmalı.
        # Şimdilik fonksiyonun adına sadık kalıyorum:
        
        if kullanici_rolu != UserRole.FIRMA_YETKILISI.value:
            logger.warning(f"Yetkisiz Erişim Girişimi (FIRMA YETKILISI GEREKLİ): Kullanıcı {g.user.get('email')} (Rol: {kullanici_rolu}), '{f.__name__}' fonksiyonuna erişmeye çalıştı.")
            if request.path.startswith('/api/'):
                 return jsonify({"error": "Bu işlem için sadece Firma Yetkilisi yetkilidir."}), 403
            abort(403)  # 403 Forbidden (Yasak)
        
        # Yetkisi var, fonksiyona devam et
        return f(*args, **kwargs)
    return decorated_function