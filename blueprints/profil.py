# blueprints/profil.py

from flask import Blueprint, jsonify, render_template, request, session
from decorators import login_required
from services.profil_service import profil_service

profil_bp = Blueprint('profil', __name__)

@profil_bp.route('/profil')
@login_required
def profil_sayfasi():
    if request.headers.get('X-Cache-Me') == 'true':
        return render_template('profil.html', session={})
    return render_template('profil.html')

@profil_bp.route('/api/profil', methods=['GET'])
@login_required
def get_profil_bilgileri_api():
    try:
        user_id = session['user']['id']
        sirket_id = session['user']['sirket_id']
        
        data = profil_service.get_profil_bilgileri(user_id, sirket_id)
        return jsonify(data)
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 404
    except Exception:
        return jsonify({"error": "Profil bilgileri alınırken bir sunucu hatası oluştu."}), 500


@profil_bp.route('/api/profil', methods=['PUT'])
@login_required
def update_profil_bilgileri_api():
    try:
        data = request.get_json()
        user_id = session['user']['id']
        sirket_id = session['user']['sirket_id']
        
        sifreler = data.get('sifreler', {})
        if sifreler.get('yeni_sifre') != sifreler.get('yeni_sifre_tekrar'):
             return jsonify({"error": "Yeni şifreler eşleşmiyor."}), 400

        profil_service.update_profil_bilgileri(user_id, sirket_id, data)
        return jsonify({"message": "Profil bilgileri başarıyla güncellendi."})
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "Profil güncellenirken bir sunucu hatası oluştu."}), 500
