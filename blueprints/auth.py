from flask import Blueprint, jsonify, render_template, request, redirect, url_for, session, flash
from extensions import supabase, bcrypt
from decorators import login_required

# Blueprint'i oluşturuyoruz. url_prefix kullanmıyoruz çünkü /login gibi kök yolları kullanacağız.
auth_bp = Blueprint('auth', __name__)

# --- ARAYÜZ SAYFALARI (AUTH) ---

@auth_bp.route('/register')
def register_page():
    return render_template('register.html')

@auth_bp.route('/login')
def login_page():
    return render_template('login.html')
    
@auth_bp.route('/logout')
def logout():
    session.pop('user', None)
    flash("Başarıyla çıkış yaptınız.", "success")
    return redirect(url_for('auth.login_page'))

# --- API ADRESLERİ (AUTH) ---

@auth_bp.route('/api/register', methods=['POST'])
def register_user():
    try:
        data = request.get_json()
        kullanici_adi = data['kullanici_adi']
        sifre = data['sifre']
        sirket_adi = data['sirket_adi']

        kullanici_var_mi = supabase.table('kullanicilar').select('id', count='exact').eq('kullanici_adi', kullanici_adi).execute()
        if kullanici_var_mi.count > 0:
            return jsonify({"error": "Bu kullanıcı adı zaten mevcut."}), 400

        sirket_response = supabase.table('sirketler').select('id').eq('sirket_adi', sirket_adi).execute()
        sirket_id = None
        if len(sirket_response.data) > 0:
            sirket_id = sirket_response.data[0]['id']
        else:
            yeni_sirket_response = supabase.table('sirketler').insert({'sirket_adi': sirket_adi}).execute()
            if len(yeni_sirket_response.data) > 0:
                sirket_id = yeni_sirket_response.data[0]['id']
        
        hashed_sifre = bcrypt.generate_password_hash(sifre).decode('utf-8')
        
        yeni_kullanici = supabase.table('kullanicilar').insert({
            'kullanici_adi': kullanici_adi, 
            'sifre': hashed_sifre,
            'sirket_id': sirket_id
        }).execute()

        return jsonify({"message": "Kayıt başarılı!"}), 201
    except Exception as e:
        print(f"Kayıt Hatası: {e}")
        return jsonify({"error": "Kayıt sırasında bir sunucu hatası oluştu."}), 500


@auth_bp.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        kullanici_adi = data['kullanici_adi']
        sifre = data['sifre']

        user_response = supabase.table('kullanicilar').select('*, sirketler(sirket_adi, lisans_bitis_tarihi)').eq('kullanici_adi', kullanici_adi).execute()
        
        if not user_response.data:
            return jsonify({"error": "Bu kullanıcı adına sahip bir hesap bulunamadı."}), 404

        user = user_response.data[0]
        
        if bcrypt.check_password_hash(user['sifre'], sifre):
            session['user'] = {
                'id': user['id'],
                'kullanici_adi': user['kullanici_adi'],
                'sirket_id': user['sirket_id'],
                'rol': user['rol'],
                'sirket_adi': user['sirketler']['sirket_adi'] if user.get('sirketler') else 'Atanmamış',
                'lisans_bitis_tarihi': user['sirketler']['lisans_bitis_tarihi'] if user.get('sirketler') else None
            }
            return jsonify({"message": "Giriş başarılı!"}), 200
        else:
            return jsonify({"error": "Yanlış şifre."}), 401
    except Exception as e:
        print(f"Giriş Hatası: {e}")
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

        user_response = supabase.table('kullanicilar').select('sifre').eq('id', user_id).single().execute()
        user_data = user_response.data
        
        if not bcrypt.check_password_hash(user_data['sifre'], mevcut_sifre):
            return jsonify({"error": "Mevcut şifreniz yanlış."}), 401

        hashed_yeni_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')
        supabase.table('kullanicilar').update({'sifre': hashed_yeni_sifre}).eq('id', user_id).execute()

        return jsonify({"message": "Şifreniz başarıyla güncellendi."})

    except Exception as e:
        print(f"Kullanıcı şifre değiştirme hatası: {e}")
        return jsonify({"error": "Şifre değiştirilirken bir hata oluştu."}), 500
