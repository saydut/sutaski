# blueprints/push.py

from flask import Blueprint, jsonify, request, session
from decorators import login_required, admin_required
from services.push_service import push_service, VAPID_PUBLIC_KEY

push_bp = Blueprint('push', __name__, url_prefix='/api/push')

@push_bp.route('/vapid_public_key', methods=['GET'])
@login_required
def get_vapid_public_key():
    return jsonify({"public_key": VAPID_PUBLIC_KEY})

@push_bp.route('/save_subscription', methods=['POST'])
@login_required
def save_subscription():
    try:
        user_id = session['user']['id']
        subscription_data = request.get_json()
        result = push_service.save_subscription(user_id, subscription_data)
        return jsonify(result), 201
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception:
        return jsonify({"error": "Abonelik kaydedilirken bir sunucu hatası oluştu."}), 500

@push_bp.route('/send_test_notification', methods=['POST'])
@login_required
@admin_required
def send_test_notification():
    try:
        user_id = session['user']['id']
        sent_count = push_service.send_notification_to_user(
            user_id,
            title="SütTakip Test Bildirimi",
            body="Bu bir test bildirimidir. Sistem çalışıyor! 🎉"
        )
        return jsonify({"message": f"{sent_count} cihaza test bildirimi gönderildi."})
    except Exception:
        return jsonify({"error": "Test bildirimi gönderilirken bir sunucu hatası oluştu."}), 500
