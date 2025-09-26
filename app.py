import os
from flask import Flask
from dotenv import load_dotenv

# Eklentileri ve Blueprint'leri içe aktar
from extensions import bcrypt
from blueprints.auth import auth_bp
from blueprints.main import main_bp
from blueprints.admin import admin_bp
from blueprints.yem import yem_bp # YEM BLUEPRINT'İNİ İÇE AKTAR
from blueprints.finans import finans_bp # FİNANS BLUEPRINT'İNİ İÇE AKTAR

def create_app():
    """Flask uygulama fabrikası."""
    load_dotenv()
    
    # templates ve static klasörlerinin ana dizinde olduğunu belirtiyoruz
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY")
    
    # JSON cevaplarında Türkçe karakterlerin doğru gösterilmesini sağlar.
    # Bu satırın burada olması testlerin doğru çalışması için kritiktir.
    app.config['JSON_AS_ASCII'] = False

    # Uygulama genelinde kullanılacak değişkenleri context'e ekle
    @app.context_processor
    def inject_global_vars():
        return {
            'APP_VERSION': '1.3.1' # Sürümü 1.3.1 olarak güncelledik
        }

    # Eklentileri başlat
    bcrypt.init_app(app)

    # Blueprint'leri kaydet
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(yem_bp) # YEM BLUEPRINT'İNİ KAYDET
    app.register_blueprint(finans_bp) # FİNANS BLUEPRINT'İNİ KAYDET

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
