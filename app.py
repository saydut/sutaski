import os
from flask import Flask, session, g, render_template, redirect, url_for, flash
from flask_cors import CORS
from dotenv import load_dotenv
import logging

# extensions.py dosyasını import et (içindeki fonksiyonları kullanmak için)
import extensions 

# Blueprint'leri import et
from blueprints.main import main_bp
from blueprints.auth import auth_bp
from blueprints.tedarikci import tedarikci_bp
from blueprints.sut import sut_bp
from blueprints.yem import yem_bp
from blueprints.finans import finans_bp
from blueprints.firma import firma_bp
from blueprints.profil import profil_bp
from blueprints.admin import admin_bp
from blueprints.rapor import rapor_bp
from blueprints.push import push_bp
from blueprints.ciftci import ciftci_bp
from blueprints.masraf import masraf_bp
from blueprints.tanker import tanker_bp
from blueprints.tarife import tarife_bp

# Logging yapılandırması
# Hata mesajlarını daha okunaklı hale getirmek için
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s %(levelname)s %(name)s: %(message)s')
logger = logging.getLogger(__name__)


def create_app():
    """
    Flask uygulama fabrikası (Application Factory)
    """
    app = Flask(__name__)
    
    # .env dosyasını yükle (Bu, extensions.py'de de yapılıyor ama burada olması
    # Gunicorn gibi dış servisler için garanti sağlar)
    load_dotenv() 

    # --- DÜZELTME BAŞLANGICI ---
    # 'app.py' içerisindeki eski SECRET_KEY kontrolünü kaldırıyoruz.
    # Bu kontrol artık extensions.py tarafından merkezi olarak yapılıyor.
    
    # (Eski kod - SATIR 48-51)
    # app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', os.environ.get('SECRET_KEY')) 
    # if not app.config['SECRET_KEY']:
    #     logger.error("FLASK_SECRET_KEY bulunamadı. Uygulama çalışmayacak.")
    #     raise ValueError("FLASK_SECRET_KEY ortam değişkeni ayarlanmalıdır.")
    
    # --- DÜZELTME SONU ---

    # CORS (Cross-Origin Resource Sharing) ayarları
    # Gerekirse (örn: mobil uygulama API'si için) burası düzenlenebilir
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # 2. Veritabanı ve Eklentileri Başlat
    # extensions.py'deki init_app fonksiyonunu çağır
    # BU FONKSİYON TÜM AYARLARI (.env) YÜKLEYECEK VE KONTROL EDECEK
    try:
        extensions.init_app(app)
    except EnvironmentError as e:
        logger.critical(f"Ortam değişkenleri (Environment variables) yüklenemedi: {e}")
        # Uygulamayı burada durdur
        raise SystemExit(f"Kritik Hata: {e}")

    # 3. Blueprint'leri (Modülleri) Kaydet
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(tedarikci_bp, url_prefix='/tedarikci')
    app.register_blueprint(sut_bp, url_prefix='/sut')
    app.register_blueprint(yem_bp, url_prefix='/yem')
    app.register_blueprint(finans_bp, url_prefix='/finans')
    app.register_blueprint(firma_bp, url_prefix='/firma')
    app.register_blueprint(profil_bp, url_prefix='/profil')
    app.register_blueprint(admin_bp, url_prefix='/admin')
    app.register_blueprint(rapor_bp, url_prefix='/rapor')
    app.register_blueprint(push_bp, url_prefix='/push')
    app.register_blueprint(ciftci_bp, url_prefix='/ciftci')
    app.register_blueprint(masraf_bp, url_prefix='/masraf')
    app.register_blueprint(tanker_bp, url_prefix='/tanker')
    app.register_blueprint(tarife_bp, url_prefix='/tarife')

    # 4. Hata Sayfaları (Error Handlers)
    @app.errorhandler(404)
    def page_not_found(e):
        # Giriş yapmış kullanıcılar için 'base.html' kullan
        if g.user:
            return render_template('404.html'), 404
        # Giriş yapmamışsa, 'login' sayfasındaki stile benzer bir 404 göster
        return render_template('404_public.html'), 404

    @app.errorhandler(500)
    def internal_server_error(e):
        logger.error(f"Sunucu Hatası (500): {e}", exc_info=True)
        if g.user:
            return render_template('500.html'), 500
        return render_template('500_public.html'), 500

    return app

# --- Uygulamayı Çalıştırma ---
if __name__ == '__main__':
    try:
        app = create_app()
        # Debug modu (geliştirme için)
        app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
    except Exception as e:
        # create_app() içinde bir hata (örn: .env hatası) olursa burada yakala
        logger.critical(f"Uygulama başlatılamadı: {e}")

#local için#
#if __name__ == '__main__':
    #app = create_app()
    #app.run(host='0.0.0.0', port=5000, debug=True)
#local için#
####3###
##sunucu için
#if __name__ == '__main__':
#    app = create_app()
#    app.run(debug=True)
##sjunucu için