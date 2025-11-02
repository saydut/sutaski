# app.py

import os
from flask import Flask, render_template, request, session, g, jsonify, flash, redirect, url_for
from dotenv import load_dotenv
from datetime import datetime
from functools import lru_cache
import logging

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
from blueprints.firma import firma_bp
from blueprints.ciftci import ciftci_bp
from blueprints.tarife import tarife_bp
# YENİ: Masraf blueprint'ini import ediyoruz
from blueprints.masraf import masraf_bp

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')

def create_app():
    """Flask uygulama fabrikası."""
    load_dotenv()

    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "varsayilan-cok-guvenli-bir-anahtar")
    app.config['JSON_AS_ASCII'] = False

    # === DEKORATÖRLER app TANIMLAMASINDAN SONRA, BURAYA TAŞINDI ===
    # ... (app.before_request ve app.context_processor fonksiyonları aynı kalıyor) ...
    @app.before_request
    def setup_supabase_client():
        if 'supabase' not in g:
            url = os.environ.get("SUPABASE_URL")
            key = os.environ.get("SUPABASE_KEY")
            g.supabase = create_client(url, key)

    @app.before_request
    def check_for_maintenance():
        # 1. Statik dosyaları her zaman istisna tut (CSS, JS)
        if request.path.startswith('/static'):
            return

        try:
            # 2. Bakım modu durumunu veritabanından çek
            if 'maintenance_mode' not in g:
                response = g.supabase.table('ayarlar').select('ayar_degeri').eq('ayar_adi', 'maintenance_mode').single().execute()
                g.maintenance_mode = response.data.get('ayar_degeri', 'false') == 'true' if response.data else False

            # 3. Bakım modu AÇIK DEĞİLSE, hiçbir şey yapma, devam et
            if not g.maintenance_mode:
                return

            # 4. Bakım modu AÇIKSA:
            
            # 5. Kullanıcının rolünü kontrol et
            user_rol = session.get('user', {}).get('rol')

            # 6. EĞER KULLANICI ADMİN İSE, her şeye izin ver
            if user_rol == 'admin':
                return # Admin her yere erişebilir

            # 7. EĞER KULLANICI ADMİN DEĞİLSE (veya giriş yapmamışsa):
            
            # Bakım modunda bile erişilebilen yolları (Admin girişi için) tanımla
            exempt_paths = [
                url_for('main.landing_page'),   # '/'
                url_for('auth.login_page'),     # '/login'
                url_for('auth.login_api'),      # '/api/login'
                url_for('auth.logout')          # '/logout'
            ]
            
            # Eğer istek bu temel sayfalardan biriyse, izin ver (Admin de burayı kullanacak)
            if request.path in exempt_paths:
                return

            # Kayıt sayfalarını engelle
            if request.path.startswith(url_for('auth.register_page')) or request.path.startswith(url_for('auth.register_user_api')):
                
                flash("Uygulama şu anda bakımda. Yeni kayıt oluşturulamaz.", "warning")
                
                # Eğer bu bir API isteğiyse (/api/register), JSON ile yönlendirme bildir
                if request.path.startswith(url_for('auth.register_user_api')):
                     return jsonify({"error": "Uygulama bakımda, yeni kayıt yapılamaz.", "redirect_to_landing": True}), 403 # 403 Yasak
                
                # Bu bir sayfa isteğiyse (/register), ana sayfaya yönlendir
                return redirect(url_for('main.landing_page'))

            # Diğer tüm API isteklerini (/api/sut_girdisi vb.) engelle
            if request.path.startswith('/api/'):
                return jsonify({"error": "Uygulama şu anda bakımda. Lütfen daha sonra tekrar deneyin."}), 503
            
            # Diğer tüm sayfa isteklerini (/panel, /tedarikciler vb.) bakım sayfasına yönlendir
            return render_template('maintenance.html'), 503
    
        except Exception as e:
            logging.warning(f"Bakım modu kontrolü sırasında bir hata oluştu: {e}")
            pass

    @lru_cache(maxsize=None)
    def get_version_info():
        try:
            # Bu fonksiyon g objesini kullanmadığı için kendi istemcisini oluşturur
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
            logging.error(f"Sürüm bilgileri çekilirken hata oluştu: {e}")
            return "N/A", []

    @app.context_processor
    def inject_global_vars():
        app_version, surum_notlari = get_version_info()
        return {'APP_VERSION': app_version, 'SURUM_NOTLARI': surum_notlari}
    
    # === DEKORATÖRLERİN SONU ===

    # Eklentileri başlat
    bcrypt.init_app(app)

    # Tüm Blueprint'leri kaydet
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(yem_bp)
    app.register_blueprint(finans_bp)
    app.register_blueprint(profil_bp)
    app.register_blueprint(push_bp)
    app.register_blueprint(tedarikci_bp)
    app.register_blueprint(sut_bp)
    app.register_blueprint(rapor_bp)
    app.register_blueprint(firma_bp)
    app.register_blueprint(ciftci_bp)
    app.register_blueprint(tarife_bp)
    # YENİ: masraf_bp'yi uygulamaya kaydediyoruz
    app.register_blueprint(masraf_bp)

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)


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