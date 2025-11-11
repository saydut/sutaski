# blueprints/push.py
# RLS ve yeni Auth (g objesi) sistemine göre güncellendi.

from flask import Blueprint, jsonify, request, session, g, url_for
# 'admin_required' decorator'ını 'role_required' ile değiştiriyoruz
from decorators import login_required, role_required
from services.push_service import push_service, VAPID_PUBLIC_KEY
from constants import UserRole # Rol sabitlerini kullanmak için
import logging

logger = logging.getLogger(__name__)
push_bp = Blueprint('push', __name__, url_prefix='/api/push')

@push_bp.route('/vapid_public_key', methods=['GET'])
@login_required
def get_vapid_public_key():
    """WebPush için VAPID public key'i döndürür."""
    # Bu anahtarın RLS ile bir ilgisi yok, o yüzden güvenli.
    return jsonify({"public_key": VAPID_PUBLIC_KEY})

@push_bp.route('/save_subscription', methods=['POST'])
@login_required
def save_subscription():
    """
    Giriş yapmış kullanıcının bildirim aboneliğini RLS kullanarak kaydeder.
    Servis, user_id'yi 'g' objesinden alır.
    """
    try:
        # user_id'yi session'dan okumaya GEREK YOK
        # user_id = session['user']['id'] (KALDIRILDI)
        
        subscription_data = request.get_json()
        
        # Servise user_id göndermeye gerek yok
        # Servis artık (data, error) döndürüyor
        result, error = push_service.save_subscription(subscription_data)
        
        if error:
            return jsonify({"error": error}), 400
            
        return jsonify(result), 201
    except Exception as e:
        logger.error(f"Abonelik kaydı API hatası: {e}", exc_info=True)
        return jsonify({"error": "Abonelik kaydedilirken bir sunucu hatası oluştu."}), 500

@push_bp.route('/send_test_notification', methods=['POST'])
@login_required
# '@admin_required' yerine '@role_required'
# Hem süper admin ('admin') hem de firma admini ('firma_admin') test gönderebilsin
@role_required(UserRole.ADMIN.value, UserRole.FIRMA_ADMIN.value) 
def send_test_notification():
    """Adminlerin, GİRİŞ YAPTIKLARI KENDİ CİHAZLARINA test bildirimi göndermesini sağlar."""
    try:
        # user_id'yi session'dan değil, 'g' objesinden al (artık UUID)
        user_id_uuid = g.user.id 
        
        # Servis fonksiyonu (data, error) döndürüyor
        sent_count, error = push_service.send_notification_to_user(
            user_id_uuid,
            title="SütTakip Test Bildirimi",
            body="Bu bir test bildirimidir. Bildirimler çalışıyor!",
            url=url_for('main.panel', _external=True)
        )
        
        if error:
             return jsonify({"error": str(error)}), 500

        if sent_count > 0:
            return jsonify({"message": f"Test bildirimi {sent_count} cihaza gönderildi."})
        else:
            return jsonify({"error": "Bildirim gönderilecek kayıtlı cihaz bulunamadı."}), 404
            
    except Exception as e:
        logger.error(f"Test bildirimi API hatası: {e}", exc_info=True)
        return jsonify({"error": "Test bildirimi gönderilemedi."}), 500