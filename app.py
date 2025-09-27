import os
from flask import Flask
from dotenv import load_dotenv
from datetime import datetime

# Eklentileri ve Blueprint'leri içe aktar
from extensions import bcrypt, supabase
from blueprints.auth import auth_bp
from blueprints.main import main_bp
from blueprints.admin import admin_bp
from blueprints.yem import yem_bp
from blueprints.finans import finans_bp

def create_app():
    """Flask uygulama fabrikası."""
    load_dotenv()
    
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY")
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

    # Uygulama genelinde kullanılacak değişkenleri context'e ekle
    @app.context_processor
    def inject_global_vars():
        try:
            # --- DÜZELTME BURADA: id'ye göre ikinci bir sıralama eklendi ---
            latest_version_res = supabase.table('surum_notlari').select('surum_no').order('yayin_tarihi', desc=True).order('id', desc=True).limit(1).execute()
            
            # --- DÜZELTME BURADA: Liste tutarlılığı için buraya da eklendi ---
            all_versions_res = supabase.table('surum_notlari').select('*').order('yayin_tarihi', desc=True).order('id', desc=True).execute()

            app_version = latest_version_res.data[0]['surum_no'] if latest_version_res.data else "1.0.0"
            surum_notlari = all_versions_res.data if all_versions_res.data else []
            
        except Exception as e:
            print(f"Sürüm bilgileri çekilirken hata oluştu: {e}")
            app_version = "N/A"
            surum_notlari = []
            
        return {
            'APP_VERSION': app_version,
            'SURUM_NOTLARI': surum_notlari
        }

    # Eklentileri başlat
    bcrypt.init_app(app)

    # Blueprint'leri kaydet
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(yem_bp)
    app.register_blueprint(finans_bp)

    return app

# Uygulamayı çalıştırmak için
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
