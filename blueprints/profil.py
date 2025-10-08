# blueprints/profil.py

from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required
from extensions import supabase, bcrypt
from postgrest import APIError

profil_bp = Blueprint('profil', __name__)

@profil_bp.route('/profil')
@login_required
def profil_sayfasi():
    """Kullanıcının profil bilgilerini düzenleyebileceği sayfayı gösterir."""
    # Service Worker'ın uygulama kabuğunu önbelleğe alması için özel kontrol eklendi
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('profil.html', session={})
    return render_template('profil.html')

# --- API ENDPOINT'LERİ ---

@profil_bp.route('/api/profil', methods=['GET'])
@login_required
def get_profil_bilgileri():
    """Giriş yapmış kullanıcının ve şirketinin bilgilerini döndürür."""
    try:
        user_id = session['user']['id']
        sirket_id = session['user']['sirket_id']

        user_res = supabase.table('kullanicilar').select('kullanici_adi, eposta, telefon_no').eq('id', user_id).single().execute()
        sirket_res = supabase.table('sirketler').select('sirket_adi, vergi_kimlik_no, adres').eq('id', sirket_id).single().execute()

        if not user_res.data or not sirket_res.data:
            return jsonify({"error": "Kullanıcı veya şirket bilgileri bulunamadı."}), 404

        # Frontend'in bekledeği gibi iç içe bir yapı oluşturup gönderiyoruz
        return jsonify({
            "kullanici": user_res.data,
            "sirket": sirket_res.data
        })
    except Exception as e:
        print(f"Profil bilgileri alınırken hata: {e}")
        return jsonify({"error": "Sunucuda bir hata oluştu."}), 500


@profil_bp.route('/api/profil', methods=['PUT'])
@login_required
def update_profil_bilgileri():
    """Kullanıcının profil ve şirket bilgilerini günceller."""
    try:
        data = request.get_json()
        user_id = session['user']['id']
        sirket_id = session['user']['sirket_id']
        
        # 1. Gelen 'kullanici' paketini aç ve veritabanını güncelle
        kullanici_data = data.get('kullanici', {})
        if kullanici_data:
            supabase.table('kullanicilar').update(kullanici_data).eq('id', user_id).execute()

        # 2. Gelen 'sirket' paketini aç ve veritabanını güncelle
        sirket_data = data.get('sirket', {})
        if sirket_data:
            supabase.table('sirketler').update(sirket_data).eq('id', sirket_id).execute()

        # 3. Gelen 'sifreler' paketini aç ve şifre değiştirme işlemini yap
        sifre_data = data.get('sifreler', {})
        if sifre_data and sifre_data.get('yeni_sifre'):
            mevcut_sifre = sifre_data.get('mevcut_sifre')
            yeni_sifre = sifre_data.get('yeni_sifre')
            
            if not mevcut_sifre:
                return jsonify({"error": "Yeni şifre için mevcut şifrenizi girmelisiniz."}), 400
            
            user_res = supabase.table('kullanicilar').select('sifre').eq('id', user_id).single().execute()
            if not bcrypt.check_password_hash(user_res.data['sifre'], mevcut_sifre):
                return jsonify({"error": "Mevcut şifreniz yanlış."}), 401
            
            hashed_sifre = bcrypt.generate_password_hash(yeni_sifre).decode('utf-8')
            supabase.table('kullanicilar').update({'sifre': hashed_sifre}).eq('id', user_id).execute()

        return jsonify({"message": "Profil bilgileri başarıyla güncellendi."})

    except APIError as e:
        print(f"Profil güncellenirken API hatası: {e.message}")
        return jsonify({"error": f"Veritabanı hatası: {e.message}"}), 500
    except Exception as e:
        print(f"Profil güncellenirken genel hata: {e}")
        return jsonify({"error": "Güncelleme sırasında bir sunucu hatası oluştu."}), 500