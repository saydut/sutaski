# app.py

import os
import traceback  # Hatayı detaylı görmek için gerekli
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
from blueprints.tanker import tanker_bp
from blueprints.masraf import masraf_bp

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')

def create_app():
    """Flask uygulama fabrikası."""
    load_dotenv()

    app = Flask(__name__, template_folder='templates', static_folder='static')
    app.config['SECRET_KEY'] = os.environ.get("SECRET_KEY", "varsayilan-cok-guvenli-bir-anahtar")
    app.config['JSON_AS_ASCII'] = False

    # === HATA AYIKLAMA (500) MODU ===
    # Bu blok, 'Internal Server Error' hatasının nedenini ekrana basar.
    @app.errorhandler(500)
    def internal_error(error):
        error_trace = traceback.format_exc()
        logging.error(f"500 Hatası Detayı: {error_trace}")
        
        return f"""
        <div style="font-family: monospace; background: #fff3cd; color: #856404; padding: 20px; border: 1px solid #ffeeba; margin: 20px;">
            <h2 style="color: #721c24;">Sistem Hatası (500)</h2>
            <p>Aşağıdaki hata kodunu kopyalayıp geliştiriciye iletin:</p>
            <hr>
            <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 15px; border: 1px solid #ddd;">{error_trace}</pre>
        </div>
        """, 500
    # =================================

    @app.before_request
    def setup_supabase_client():
        if 'supabase' not in g:
            url = os.environ.get("SUPABASE_URL")
            key = os.environ.get("SUPABASE_KEY")
            # Hata durumunda boş client oluşturmayı dene veya logla
            try:
                g.supabase = create_client(url, key)
            except Exception as e:
                logging.error(f"Supabase bağlantı hatası: {e}")
                # Burada hata fırlatmıyoruz, view içinde patlarsa errorhandler yakalayacak

    @app.before_request
    def check_for_maintenance():
        # 1. Statik dosyaları her zaman istisna tut
        if request.path.startswith('/static'):
            return

        try:
            # 2. Bakım modu durumunu veritabanından çek
            if 'maintenance_mode' not in g:
                # Supabase bağlantısı yoksa varsayılan False olsun
                if hasattr(g, 'supabase'):
                    response = g.supabase.table('ayarlar').select('ayar_degeri').eq('ayar_adi', 'maintenance_mode').single().execute()
                    g.maintenance_mode = response.data.get('ayar_degeri', 'false') == 'true' if response.data else False
                else:
                    g.maintenance_mode = False

            # 3. Bakım modu AÇIK DEĞİLSE, devam et
            if not g.maintenance_mode:
                return

            # 4. Bakım modu AÇIKSA:
            user_rol = session.get('user', {}).get('rol')

            # Admin ise geç
            if user_rol == 'admin':
                return 

            # İzin verilen yollar
            exempt_paths = [
                url_for('main.landing_page'),
                url_for('auth.login_page'),
                url_for('auth.login_api'),
                url_for('auth.logout')
            ]
            
            if request.path in exempt_paths:
                return

            if request.path.startswith(url_for('auth.register_page')) or request.path.startswith(url_for('auth.register_user_api')):
                flash("Uygulama şu anda bakımda. Yeni kayıt oluşturulamaz.", "warning")
                if request.path.startswith(url_for('auth.register_user_api')):
                     return jsonify({"error": "Uygulama bakımda.", "redirect_to_landing": True}), 403
                return redirect(url_for('main.landing_page'))

            if request.path.startswith('/api/'):
                return jsonify({"error": "Uygulama bakımda."}), 503
            
            return render_template('maintenance.html'), 503
    
        except Exception as e:
            logging.warning(f"Bakım modu kontrolü hatası: {e}")
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
            logging.error(f"Sürüm bilgileri hatası: {e}")
            return "N/A", []

    @app.context_processor
    def inject_global_vars():
        app_version, surum_notlari = get_version_info()
        return {'APP_VERSION': app_version, 'SURUM_NOTLARI': surum_notlari}
    
    # Eklentileri başlat
    bcrypt.init_app(app)

    # Blueprint'leri kaydet
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
    app.register_blueprint(tanker_bp)
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