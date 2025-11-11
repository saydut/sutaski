# decorators.py

from functools import wraps
from flask import session, redirect, url_for, flash, g
from extensions import supabase_client  # Sadece anon key'li (RLS'e tabi) client'ı import ediyoruz
from gotrue.errors import AuthApiError

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        access_token = session.get('access_token')
        refresh_token = session.get('refresh_token')

        if not access_token:
            flash('Bu sayfayı görmek için giriş yapmalısınız.', 'warning')
            session.clear()
            return redirect(url_for('auth.login'))

        try:
            # 1. RLS'in çalışması için client'a KULLANICININ KİMLİĞİNİ BİLDİR
            # Bu, "supabase_client.auth.set_session(access_token, refresh_token)" komutunun eşdeğeridir
            # ve token'ın geçerliliğini kontrol eder.
            user_response = supabase_client.auth.get_user(access_token)
            
            g.user = user_response.user
            if not g.user:
                raise Exception("Kullanıcı bulunamadı veya token geçersiz")

            # 2. Kullanıcının profil bilgilerini (rol, sirket_id) 'profiller' tablosundan çek
            # Bu bilgiler artık tüm istek boyunca 'g' objesi üzerinden erişilebilir olacak.
            # NOT: Bu sorgu, RLS politikaları (Bölüm 3'te kurduğumuz) sayesinde GÜVENLİDİR.
            # Kullanıcı sadece kendi profilini çekebilir.
            profile_res = supabase_client.table('profiller').select('*').eq('id', g.user.id).single().execute()
            
            if not profile_res.data:
                # Auth kullanıcısı var ama profili yoksa (kayıt olurken bir hata olduysa)
                session.clear()
                flash('Kullanıcı profiliniz bulunamadı. Lütfen yönetici ile iletişime geçin.', 'danger')
                return redirect(url_for('auth.login'))
                
            g.profile = profile_res.data
            
            # 3. (ÖNEMLİ) Client'ı bu kullanıcının token'ı ile kalıcı olarak ayarla
            # Bu sayede bu istek boyunca yapılacak TÜM supabase_client sorguları
            # bu kullanıcı adına yapılır ve RLS'e tabi olur.
            supabase_client.auth.set_session(access_token, refresh_token)


        except (AuthApiError, Exception) as e:
            # Token geçersiz veya süresi dolmuş
            session.clear()
            flash(f'Oturumunuzun süresi doldu veya geçersiz. Lütfen tekrar giriş yapın.', 'danger')
            return redirect(url_for('auth.login'))

        return f(*args, **kwargs)
    return decorated_function

def role_required(*roles):
    """
    Kullanıcının belirtilen rollerden BİRİNE sahip olmasını kontrol eder.
    Örnek kullanım: @role_required('firma_admin')
    Örnek kullanım: @role_required('firma_admin', 'toplayici')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # @login_required zaten çalışmış olmalı ve g.profile'ı doldurmuş olmalı
            if 'profile' not in g:
                flash('Yetki kontrolü için profil bilgisi bulunamadı.', 'danger')
                return redirect(url_for('auth.login'))
                
            # Artık 'rol' sütununu direkt g.profile'dan okuyoruz
            if g.profile.get('rol') not in roles:
                flash('Bu sayfayı görüntüleme yetkiniz yok.', 'danger')
                return redirect(url_for('main.index'))
            
            return f(*args, **kwargs)
        return decorator
    # role_required'ı @login_required'dan SONRA kullanmanız gerekir.
    # Bu yüzden @login_required'ı buraya eklemeye gerek yok.
    return decorator

# 'admin_required' decorator'ını da yeni role_required'ı kullanacak şekilde güncelleyelim
# (Not: Eğer süper-admin rolünüzün adı 'admin' ise bu doğrudur)
def admin_required(f):
    @wraps(f)
    @login_required # Önce login kontrolü
    @role_required('admin') # Sonra rol kontrolü
    def decorated_function(*args, **kwargs):
        # Yetki kontrolü zaten role_required tarafından yapıldı
        return f(*args, **kwargs)
    return decorated_function