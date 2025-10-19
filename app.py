# app.py

import os
from flask import Flask, render_template, request, session, g, jsonify
from dotenv import load_dotenv
from datetime import datetime
from functools import lru_cache
import logging # <-- YENİ: Loglama kütüphanesini içe aktarıyoruz

# Eklentileri ve ana Blueprint'leri içe aktar
from extensions import bcrypt
from supabase import create_client

from blueprints.auth import auth_bp
from blueprints.main import main_bp
from blueprints.admin import admin_bp
from blueprints.yem import yem_bp
from blueprints.finans import finans_bp
from blueprints.profil import profil_bp
from blueprints.push import push_bp
from blueprints.tedarikci import tedarikci_bp
from blueprints.sut import sut_bp
from blueprints.rapor import rapor_bp

# YENİ: Proje genelinde kullanılacak temel loglama yapılandırması.
# Hatalar artık terminalde/log dosyasında daha düzenli görünecek.
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')

def create_app():
    """Flask uygulama fabrikası."""
    load_dotenv()
    
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "varsayilan-cok-guvenli-bir-anahtar")
    app.config['JSON_AS_ASCII'] = False

    @app.before_request
    def setup_supabase_client():
        if 'supabase' not in g:
            url = os.environ.get("SUPABASE_URL")
            key = os.environ.get("SUPABASE_KEY")
            g.supabase = create_client(url, key)

    @app.before_request
    def check_for_maintenance():
        exempt_paths = [
            '/static', 
            '/admin', 
            '/api/admin', 
            '/login', 
            '/logout', 
            '/register', 
            '/api/login', 
            '/api/register',
            '/'
        ]
        
        for path in exempt_paths:
            if request.path.startswith(path):
                return

        if session.get('user', {}).get('rol') == 'admin':
            return
            
        try:
            if 'maintenance_mode' not in g:
                response = g.supabase.table('ayarlar').select('ayar_degeri').eq('ayar_adi', 'maintenance_mode').single().execute()
                g.maintenance_mode = response.data.get('ayar_degeri', 'false') == 'true' if response.data else False
            
            if g.maintenance_mode:
                if request.path.startswith('/api/'):
                    return jsonify({"error": "Uygulama şu anda bakımda. Lütfen daha sonra tekrar deneyin."}), 503
                return render_template('maintenance.html'), 503
        except Exception as e:
            # DÜZENLEME: print() yerine logging kullanarak hatayı daha standart bir şekilde kaydediyoruz.
            logging.warning(f"Bakım modu kontrolü sırasında bir hata oluştu: {e}")
            pass

    @lru_cache(maxsize=None)
    def get_version_info():
        try:
            url = os.environ.get("SUPABASE_URL")
            key = os.environ.get("SUPABASE_KEY")
            temp_supabase_client = create_client(url, key)
            all_versions_res = temp_supabase_client.table('surum_notlari').select('*').order('yayin_tarihi', desc=True).order('id', desc=True).execute()
            if not all_versions_res.data:
                return "1.0.0", []
            surum_notlari = all_versions_res.data
            app_version = surum_notlari[0]['surum_no']
            return app_version, surum_notlari
        except Exception as e:
            # DÜZENLEME: print() yerine logging kullanarak hatayı kaydediyoruz.
            logging.error(f"Sürüm bilgileri çekilirken hata oluştu: {e}")
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
