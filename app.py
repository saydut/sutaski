# app.py

import os
import traceback
from flask import Flask, render_template, request, session, g, jsonify, flash, redirect, url_for
from datetime import datetime, date
from functools import lru_cache
import logging

# Config importu
from config import get_config

# Eklentileri ve ana Blueprint'leri içe aktar
from extensions import bcrypt
from supabase import create_client

# Blueprint importları (Aynen kalıyor)
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
    
    app = Flask(__name__, template_folder='templates', static_folder='static')
    
    # --- CONFIG ENTEGRASYONU BAŞLANGICI ---
    config_obj = get_config()
    app.config.from_object(config_obj)
    # --- CONFIG ENTEGRASYONU BİTİŞİ ---

    # === JINJA2 FİLTRELERİ ===
    @app.template_filter('format_tarih')
    def format_tarih(value, format="%d.%m.%Y"):
        if value is None: return ""
        if isinstance(value, str):
            try: value = datetime.strptime(value, '%Y-%m-%d')
            except ValueError: return value
        return value.strftime(format)

    @app.template_filter('format_tarih_str')
    def format_tarih_str(value):
        if not value: return ""
        try:
            if isinstance(value, (datetime, date)): return value.strftime('%d.%m.%Y')
            date_obj = datetime.strptime(value, '%Y-%m-%d') 
            return date_obj.strftime('%d.%m.%Y')
        except: return value

    @app.template_filter('to_date')
    def to_date(value):
        if not value: return None
        if isinstance(value, str):
            try: return datetime.strptime(value, '%Y-%m-%d').date()
            except: return None
        if isinstance(value, datetime): return value.date()
        if isinstance(value, date): return value
        return None

    # === HATA AYIKLAMA (500) ===
    @app.errorhandler(500)
    def internal_error(error):
        error_trace = traceback.format_exc()
        logging.error(f"500 Hatası Detayı: {error_trace}")
        return f"""
        <div style="font-family: monospace; background: #fff3cd; color: #856404; padding: 20px; border: 1px solid #ffeeba; margin: 20px;">
            <h2 style="color: #721c24;">Sistem Hatası (500)</h2>
            <pre style="white-space: pre-wrap; background: #f8f9fa; padding: 15px; border: 1px solid #ddd;">{error_trace}</pre>
        </div>
        """, 500

    @app.before_request
    def setup_supabase_client():
        if 'supabase' not in g:
            # Config'den alıyoruz
            url = app.config.get("SUPABASE_URL")
            key = app.config.get("SUPABASE_KEY")
            try:
                g.supabase = create_client(url, key)
            except Exception as e:
                logging.error(f"Supabase bağlantı hatası: {e}")

    @app.before_request
    def check_for_maintenance():
        if request.path.startswith('/static'): return
        try:
            if 'maintenance_mode' not in g:
                if hasattr(g, 'supabase'):
                    response = g.supabase.table('ayarlar').select('ayar_degeri').eq('ayar_adi', 'maintenance_mode').single().execute()
                    g.maintenance_mode = response.data.get('ayar_degeri', 'false') == 'true' if response.data else False
                else:
                    g.maintenance_mode = False

            if not g.maintenance_mode: return

            user_rol = session.get('user', {}).get('rol')
            if user_rol == 'admin': return 

            exempt_paths = [
                url_for('main.landing_page'),
                url_for('auth.login_page'),
                url_for('auth.login_api'),
                url_for('auth.logout')
            ]
            if request.path in exempt_paths: return

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
            url = app.config.get("SUPABASE_URL")
            key = app.config.get("SUPABASE_KEY")
            temp_supabase_client = create_client(url, key)
            all_versions_res = temp_supabase_client.table('surum_notlari').select('*').order('yayin_tarihi', desc=True).order('id', desc=True).execute()
            if not all_versions_res.data: return "1.0.0", []
            return all_versions_res.data[0]['surum_no'], all_versions_res.data
        except Exception as e:
            logging.error(f"Sürüm bilgileri hatası: {e}")
            return "N/A", []

    @app.context_processor
    def inject_global_vars():
        app_version, surum_notlari = get_version_info()
        return {'APP_VERSION': app_version, 'SURUM_NOTLARI': surum_notlari, 'today': date.today()}
    
    bcrypt.init_app(app)

    # Blueprint Register işlemleri (Aynen kalıyor)
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