# app.py
# Yeni RLS (Satır Seviyesi Güvenlik) ve Auth sistemine göre güncellendi.

import os
import logging
from flask import Flask, render_template, session, g, redirect, url_for
from dotenv import load_dotenv

# --- Tüm Blueprint'leri (Rotaları) import et ---
# (Eski ve yeni, toplam 14 blueprint)
from blueprints.main import main_bp
from blueprints.auth import auth_bp
from blueprints.sut import sut_bp
from blueprints.tedarikci import tedarikci_bp
from blueprints.yem import yem_bp
from blueprints.finans import finans_bp
from blueprints.masraf import masraf_bp
from blueprints.firma import firma_bp
from blueprints.tanker import tanker_bp
from blueprints.tarife import tarife_bp
from blueprints.rapor import rapor_bp
from blueprints.profil import profil_bp
from blueprints.push import push_bp
from blueprints.admin import admin_bp
from blueprints.ciftci import ciftci_bp

# --- Uzantıları (Supabase client'ları) import et ---
# Client'lar artık extensions.py'de başlatılıyor.
# 'bcrypt' artık kullanılmıyor.
from extensions import supabase_client, supabase_service, turkey_tz

# --- Loglama Ayarları ---
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s %(levelname)s %(name)s: %(message)s',
                    handlers=[logging.StreamHandler()])
logger = logging.getLogger(__name__)

def create_app():
    """Flask uygulama fabrikası (factory) fonksiyonu."""
    
    # .env dosyasını yükle
    load_dotenv()

    app = Flask(__name__)

    # --- Gizli Anahtar ---
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY")
    if not SECRET_KEY:
        logger.error("FLASK_SECRET_KEY bulunamadı. Uygulama çalışmayacak.")
        raise ValueError("FLASK_SECRET_KEY ortam değişkeni ayarlanmalıdır.")
    app.secret_key = SECRET_KEY
    
    # --- Blueprint'leri Kaydet ---
    # (Tüm modüllerimizi uygulamaya tanıtıyoruz)
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(sut_bp)
    app.register_blueprint(tedarikci_bp)
    app.register_blueprint(yem_bp)
    app.register_blueprint(finans_bp)
    app.register_blueprint(masraf_bp)
    app.register_blueprint(firma_bp)
    app.register_blueprint(tanker_bp)
    app.register_blueprint(tarife_bp)
    app.register_blueprint(rapor_bp)
    app.register_blueprint(profil_bp)
    app.register_blueprint(push_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(ciftci_bp)

    # --- YENİ: Context Processor (Kullanıcıyı Şablonlara Enjekte Etme) ---
    @app.context_processor
    def inject_user_profile():
        """
        'g.profile' objesini (eğer @login_required tarafından yüklendiyse) 
        tüm template'lere (HTML) otomatik olarak 'user_profile' adıyla enjekte eder.
        
        Bu, 'base.html' içinde 'session['user']['rol']' yerine
        'user_profile.rol' kullanmamızı sağlar.
        """
        if hasattr(g, 'profile'):
            # g.profile (decorator'dan gelir)
            return dict(user_profile=g.profile) 
        return dict(user_profile=None)

    # --- Eski 'before_request' ve 'inject_session' KALDIRILDI ---
    # Artık 'decorators.py' ve 'inject_user_profile' bu işleri yapıyor.

    # --- Hata Sayfaları ---
    @app.errorhandler(404)
    def page_not_found(e):
        """404 Hata sayfası."""
        # Yeni Auth sistemi 'access_token' kullanır
        if 'access_token' in session:
            return render_template('404.html'), 404
        # Giriş yapmamışsa yeni login rotasına yönlendir
        return redirect(url_for('auth.login'))

    @app.errorhandler(500)
    def internal_server_error(e):
        """500 Sunucu hatası sayfası."""
        logger.error(f"500 Sunucu Hatası: {e}", exc_info=True)
        if 'access_token' in session:
            return render_template('500.html'), 500
        return redirect(url_for('auth.login'))

    return app

# --- Uygulamayı Başlat ---
if __name__ == '__main__':
    app = create_app()
    # Debug=True sadece lokal geliştirme içindir.
    # PythonAnywhere'de bu 'if' bloğu çalışmaz.
    app.run(debug=True, host='0.0.0.0', port=os.environ.get('PORT', 5000))

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