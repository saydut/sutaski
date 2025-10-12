import os
from flask import Flask, render_template, request, session, g, jsonify
from dotenv import load_dotenv
from datetime import datetime
from functools import lru_cache

# Eklentileri ve ana Blueprint'leri içe aktar
from extensions import bcrypt, supabase
from blueprints.auth import auth_bp
from blueprints.main import main_bp
from blueprints.admin import admin_bp
from blueprints.yem import yem_bp
from blueprints.finans import finans_bp
from blueprints.profil import profil_bp
from blueprints.push import push_bp

# Yeniden yapılandırma sonrası eklenen yeni blueprint'ler
from blueprints.tedarikci import tedarikci_bp
from blueprints.sut import sut_bp
from blueprints.rapor import rapor_bp

def create_app():
    """Flask uygulama fabrikası."""
    load_dotenv()
    
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "varsayilan-cok-guvenli-bir-anahtar")
    app.config['JSON_AS_ASCII'] = False

    @app.before_request
    def check_for_maintenance():
        # Bakım modu kontrolünün uygulanmayacağı yolların listesi
        exempt_paths = [
            '/static', 
            '/admin', 
            '/api/admin', 
            '/login', 
            '/logout', 
            '/register', 
            '/api/login', 
            '/api/register'
        ]
        
        # Eğer istenen yol bu listeki yollardan biriyle başlıyorsa, kontrol yapma
        for path in exempt_paths:
            if request.path.startswith(path):
                return

        # Oturumda kullanıcı 'admin' ise kontrol dışı bırak
        if session.get('user', {}).get('rol') == 'admin':
            return
            
        try:
            # g objesi, tek bir istek boyunca veri saklamak için kullanılır.
            if 'maintenance_mode' not in g:
                response = supabase.table('ayarlar').select('ayar_degeri').eq('ayar_adi', 'maintenance_mode').single().execute()
                g.maintenance_mode = response.data.get('ayar_degeri', 'false') == 'true' if response.data else False
            
            if g.maintenance_mode:
                # API istekleri için JSON, normal sayfa istekleri için HTML döndür
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Uygulama şu anda bakımda. Lütfen daha sonra tekrar deneyin."}), 503
                # 503 HTTP status kodu "Service Unavailable" anlamına gelir, bu durum için daha doğrudur.
                return render_template('maintenance.html'), 503
        except Exception as e:
            # Veritabanına ulaşılamazsa veya başka bir hata olursa bunu sunucu loglarına yazdır.
            print(f"BAKIM MODU KONTROL HATASI: {e}")
            # Hata durumunda, en güvenli varsayım bakım modunun aktif olmadığıdır.
            # 'pass' komutu sayesinde uygulama çökmeyecek ve normal şekilde devam etmeye çalışacaktır.
            pass

    @app.template_filter('format_tarih_str')
    def format_tarih_filter(value):
        """String formatındaki 'YYYY-MM-DD' tarihini 'DD.MM.YYYY' formatına çevirir."""
        if not value:
            return ''
        try:
            dt_obj = datetime.strptime(value, '%Y-%m-%d')
            return dt_obj.strftime('%d.%m.%Y')
        except (ValueError, TypeError):
            return value

#    @lru_cache(maxsize=None)
    def get_version_info():
        try:
            all_versions_res = supabase.table('surum_notlari').select('*').order('yayin_tarihi', desc=True).order('id', desc=True).execute()
            if not all_versions_res.data:
                return "1.0.0", []
            surum_notlari = all_versions_res.data
            app_version = surum_notlari[0]['surum_no']
            return app_version, surum_notlari
        except Exception as e:
            print(f"Sürüm bilgileri çekilirken hata oluştu: {e}")
            return "N/A", []

    @app.context_processor
    def inject_global_vars():
        app_version, surum_notlari = get_version_info()
        return {'APP_VERSION': app_version, 'SURUM_NOTLARI': surum_notlari}

    # Eklentileri başlat
    bcrypt.init_app(app)

    # Tüm Blueprint'leri kaydet
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(yem_bp)
    app.register_blueprint(finans_bp)
    app.register_blueprint(tedarikci_bp)
    app.register_blueprint(sut_bp)
    app.register_blueprint(rapor_bp)
    app.register_blueprint(profil_bp)
    app.register_blueprint(push_bp)

    return app

# Uygulamayı yerel makinede (bilgisayarında) çalıştırmak için
if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)
####3###
#
## Bu dosya PythonAnywhere'in web sunucusu tarafından kullanılır.
#yüklerken app.py ı aşağıdaki gibi değiştir.

#import sys
#import os

# Projenin ana dizininin yolu.
# Dosyalar doğrudan /home/saydut/ içinde olduğu için bu yolu kullanıyoruz.
#project_home = '/home/saydut'
#if project_home not in sys.path:
#    sys.path = [project_home] + sys.path

# app.py dosyasındaki create_app fonksiyonunu kullanarak
# Flask uygulamasını oluşturun ve sunucuya verin.
#from app import create_app

#application = create_app()


#
#
#
