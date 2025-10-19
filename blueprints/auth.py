# blueprints/auth.py

from flask import Blueprint, jsonify, render_template, request, redirect, url_for, session, flash, g
from decorators import login_required
from services.auth_service import auth_service
from extensions import bcrypt
import logging

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register')
def register_page():
    return render_template('register.html')

@auth_bp.route('/login')
def login_page():
    return render_template('login.html')
    
@auth_bp.route('/logout')
@login_required
def logout():
    session.pop('user', None)
    flash("Başarıyla çıkış yaptınız.", "success")
    return redirect(url_for('auth.login_page'))

@auth_bp.route('/api/register', methods=['POST'])
def register_user_api():
    try:
        data = request.get_json()
        result = auth_service.register_user(
            kullanici_adi=data.get('kullanici_adi', '').strip(),
            sifre=data.get('sifre'),
            sirket_adi=data.get('sirket_adi', '').strip()
        )
        return jsonify(result), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "Kayıt sırasında beklenmedik bir sunucu hatası oluştu."}), 500

@auth_bp.route('/api/login', methods=['POST'])
def login_api():
    try:
        data = request.get_json()
        session_data = auth_service.login_user(
            kullanici_adi=data.get('kullanici_adi'),
            sifre=data.get('sifre')
        )
        session['user'] = session_data
        
        return jsonify({ "message": "Giriş başarılı!", "user": session_data }), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 401
    except Exception:
        return jsonify({"error": "Giriş yapılırken bir sunucu hatası oluştu."}), 500

@auth_bp.route('/api/user/change_password', methods=['POST'])
@login_required
def change_password():
    try:
        data = request.get_json()
        mevcut_sifre = data.get('mevcut_sifre')
        yeni_sifre = data.get('yeni_sifre')
        yeni_sifre_tekrar = data.get('yeni_sifre_tekrar')
        user_id = session['user']['id']

        if not mevcut_sifre or not yeni_sifre or not yeni_sifre_tekrar:
            return jsonify({"error": "Lütfen tüm alanları doldurun."}), 400

        if yeni_sifre != yeni_sifre_tekrar:
            return jsonify({"error": "Yeni şifreler eşleşmiyor."}), 400

        user_response = g.supabase.table('kullanicilar').select('sifre').eq('id', user_id).single().execute()
        user_data = user_response.data
        
        if not bcrypt.check_password_hash(user_data['sifre'], mevcut_sifre):
            return jsonify({"error": "Mevcut şifreniz yanlış."}), 401

        hashed_yeni_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')
        g.supabase.table('kullanicilar').update({'sifre': hashed_yeni_sifre}).eq('id', user_id).execute()

        return jsonify({"message": "Şifreniz başarıyla güncellendi."})

    except Exception as e:
        logger.error(f"Kullanıcı şifre değiştirme hatası: {e}", exc_info=True)
        return jsonify({"error": "Şifre değiştirilirken bir hata oluştu."}), 500
