# blueprints/auth.py

from flask import Blueprint, render_template, request, redirect, url_for, session, flash
from services import auth_service
from decorators import login_required
import logging

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    # Eğer kullanıcı zaten giriş yapmışsa (geçerli bir token'ı varsa), ana sayfaya yönlendir
    if 'access_token' in session:
        return redirect(url_for('main.index'))

    if request.method == 'POST':
        # Formdan 'kullanici_adi' yerine 'email' alıyoruz
        email = request.form.get('email')
        password = request.form.get('password')

        if not email or not password:
            flash('E-posta ve şifre alanları zorunludur.', 'danger')
            return render_template('login.html')

        # Servisi çağır
        user_session, error = auth_service.login_user(email, password)

        if error:
            flash(error, 'danger')
            return render_template('login.html')

        # YENİ OTURUM YÖNETİMİ: Token'ları Flask session'ına kaydet
        session['access_token'] = user_session.access_token
        session['refresh_token'] = user_session.refresh_token
        
        flash('Giriş başarılı!', 'success')
        return redirect(url_for('main.index'))

    # GET isteği için
    return render_template('login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if 'access_token' in session:
        return redirect(url_for('main.index'))
        
    if request.method == 'POST':
        # Yeni form alanlarını al (email eklendi)
        email = request.form.get('email')
        password = request.form.get('password')
        sirket_adi = request.form.get('sirket_adi')
        kullanici_adi = request.form.get('kullanici_adi')

        if not all([email, password, sirket_adi, kullanici_adi]):
            flash('Tüm alanlar zorunludur.', 'danger')
            return render_template('register.html')

        # Yeni servis fonksiyonunu çağır
        data, error = auth_service.register_admin_and_firma(email, password, sirket_adi, kullanici_adi)

        if error:
            flash(error, 'danger')
            return render_template('register.html')

        flash('Kayıt başarılı! Lütfen giriş yapın.', 'success')
        return redirect(url_for('auth.login'))

    # GET isteği için
    return render_template('register.html')

@auth_bp.route('/logout')
@login_required # Çıkış yapmak için bile girişli olmak gerekir (token'ı bilmek için)
def logout():
    # Servisten logout fonksiyonunu çağır
    auth_service.logout_user()
    
    # Flask session'ını temizle
    session.clear()
    
    flash('Başarıyla çıkış yaptınız.', 'info')
    return redirect(url_for('auth.login'))