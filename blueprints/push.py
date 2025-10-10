# blueprints/push.py

from flask import Blueprint, jsonify, request, session
from decorators import login_required, admin_required
from services.push_service import push_service, VAPID_PUBLIC_KEY

push_bp = Blueprint('push', __name__, url_prefix='/api/push')

@push_bp.route('/vapid_public_key', methods=['GET'])
@login_required
def get_vapid_public_key():
    """Frontend'in abonelik oluşturmak için ihtiyaç duyduğu VAPID public key'i döndürür."""
    return jsonify({"public_key": VAPID_PUBLIC_KEY})

@push_bp.route('/save_subscription', methods=['POST'])
@login_required
def save_subscription():
    """Frontend'den gelen abonelik bilgisini kaydeder."""
    try:
        user_id = session['user']['id']
        subscription_data = request.get_json()
        result = push_service.save_subscription(user_id, subscription_data)
        return jsonify(result), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Bu endpoint admin panelinden test amaçlı bildirim göndermek için kullanılabilir.
@push_bp.route('/send_test_notification', methods=['POST'])
@login_required
@admin_required
def send_test_notification():
    """Giriş yapmış admin kullanıcısına bir test bildirimi gönderir."""
    try:
        user_id = session['user']['id']
        sent_count = push_service.send_notification_to_user(
            user_id,
            title="SütTakip Test Bildirimi",
            body="Bu bir test bildirimidir. Sistem çalışıyor! 🎉"
        )
        return jsonify({"message": f"{sent_count} cihaza test bildirimi gönderildi."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500