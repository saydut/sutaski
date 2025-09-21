import os
from flask import Flask
from dotenv import load_dotenv

# Eklentileri ve Blueprint'leri içe aktar
from extensions import bcrypt
from blueprints.auth import auth_bp
from blueprints.main import main_bp
from blueprints.admin import admin_bp

def create_app():
    """Flask uygulama fabrikası."""
    load_dotenv()
    
    # templates ve static klasörlerinin ana dizinde olduğunu belirtiyoruz
    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY")

    # Eklentileri başlat
    bcrypt.init_app(app)

    # Blueprint'leri kaydet
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)

    return app

# Uygulamayı çalıştırmak için
if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)
