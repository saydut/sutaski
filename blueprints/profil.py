# blueprints/profil.py
# RLS ve yeni profil servisi ile güncellendi.

from flask import Blueprint, jsonify, render_template, request, session, flash, g
from decorators import login_required
from services.profil_service import profil_service
import logging

logger = logging.getLogger(__name__)
profil_bp = Blueprint('profil', __name__)

@profil_bp.route('/profil')
@login_required
def profil_sayfasi():
    """Profil sayfasını render eder."""
    # 'session={}' göndermeye gerek yok.
    return render_template('profil.html')

@profil_bp.route('/api/profil', methods=['GET'])
@login_required
def get_profil_bilgileri_api():
    """
    Giriş yapmış kullanıcının profil ve şirket bilgilerini RLS ile çeker.
    Servis, ID'leri 'g' objesinden alır.
    """
    try:
        # user_id ve sirket_id parametreleri KALDIRILDI
        # Servis artık (data, error) döndürüyor
        data, error = profil_service.get_profil_bilgileri()
        
        if error:
            return jsonify({"error": error}), 404
            
        return jsonify(data)
    except Exception as e:
        logger.error(f"Profil bilgileri API hatası: {e}", exc_info=True)
        return jsonify({"error": "Profil bilgileri alınırken bir sunucu hatası oluştu."}), 500


@profil_bp.route('/api/profil', methods=['PUT'])
@login_required
def update_profil_bilgileri_api():
    """
    Kullanıcının profil, şirket ve (isteğe bağlı) şifre bilgilerini günceller.
    Servis, ID'leri 'g' objesinden alır.
    """
    try:
        data = request.get_json()
        
        # 'yeni_sifre_tekrar' kontrolü (JS tarafında da yapılmalı, ama burada da kalsın)
        sifreler = data.get('sifreler', {})
        if 'yeni_sifre' in sifreler and (sifreler.get('yeni_sifre') != sifreler.get('yeni_sifre_tekrar')):
             return jsonify({"error": "Yeni şifreler eşleşmiyor."}), 400

        # user_id ve sirket_id parametreleri KALDIRILDI
        # Servis artık (yeni_session, error) döndürüyor
        yeni_session, error = profil_service.update_profil_bilgileri(data)
        
        if error:
            return jsonify({"error": error}), 400

        # ÖNEMLİ: Şifre değiştiyse, servis yeni token'ları (session) döndürür.
        # Bu yeni token'ları Flask session'ına kaydetmeliyiz.
        if yeni_session:
            session['access_token'] = yeni_session.access_token
            session['refresh_token'] = yeni_session.refresh_token
            logger.info(f"Kullanıcı {g.profile['eposta']} şifresini değiştirdi, Flask session güncellendi.")
            return jsonify({"message": "Profil bilgileri ve şifreniz başarıyla güncellendi."})

        return jsonify({"message": "Profil bilgileri başarıyla güncellendi."})
        
    except Exception as e:
        logger.error(f"Profil güncelleme API hatası: {e}", exc_info=True)
        return jsonify({"error": f"Profil güncellenirken bir sunucu hatası oluştu: {str(e)}"}), 500