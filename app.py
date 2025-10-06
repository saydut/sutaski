import os
from flask import Flask
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

    @lru_cache(maxsize=None) # Basit bir bellek içi önbellekleme
    def get_version_info():
        try:
            # Tek bir sorgu ile tüm notları çek
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
