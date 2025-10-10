# blueprints/profil.py (SERVİS KATMANINI KULLANACAK ŞEKİLDE GÜNCELLENDİ)

from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required
from services.profil_service import profil_service # <-- YENİ: Servisi import et

profil_bp = Blueprint('profil', __name__)

# --- ARAYÜZ ---
@profil_bp.route('/profil')
@login_required
def profil_sayfasi():
    """Kullanıcının profil bilgilerini düzenleyebileceği sayfayı gösterir."""
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('profil.html', session={})
    return render_template('profil.html')

# --- API UÇ NOKTALARI ---

@profil_bp.route('/api/profil', methods=['GET'])
@login_required
def get_profil_bilgileri_api():
    """Giriş yapmış kullanıcının ve şirketinin bilgilerini döndürür."""
    try:
        user_id = session['user']['id']
        sirket_id = session['user']['sirket_id']
        
        data = profil_service.get_profil_bilgileri(user_id, sirket_id)
        return jsonify(data)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@profil_bp.route('/api/profil', methods=['PUT'])
@login_required
def update_profil_bilgileri_api():
    """Kullanıcının profil ve şirket bilgilerini günceller."""
    try:
        data = request.get_json()
        user_id = session['user']['id']
        sirket_id = session['user']['sirket_id']
        
        # Şifre tekrarı kontrolü burada yapılabilir.
        sifreler = data.get('sifreler', {})
        if sifreler.get('yeni_sifre') != sifreler.get('yeni_sifre_tekrar'):
             return jsonify({"error": "Yeni şifreler eşleşmiyor."}), 400

        profil_service.update_profil_bilgileri(user_id, sirket_id, data)
        return jsonify({"message": "Profil bilgileri başarıyla güncellendi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500