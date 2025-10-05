import os
from flask import Blueprint, jsonify, request, session
from decorators import login_required
from extensions import supabase
from pywebpush import webpush, WebPushException

subscription_bp = Blueprint('subscription', __name__, url_prefix='/api/subscription')

@subscription_bp.route('/save', methods=['POST'])
@login_required
def save_subscription():
    """Kullanıcının anlık bildirim aboneliğini veritabanına kaydeder."""
    subscription_data = request.get_json()
    if not subscription_data:
        return jsonify({'error': 'Abonelik verisi bulunamadı.'}), 400

    user_id = session['user']['id']

    try:
        # Önce bu endpoint'e ait mevcut bir kayıt var mı diye kontrol et
        existing_sub = supabase.table('push_subscriptions').select('id').eq('subscription_data->>endpoint', subscription_data['endpoint']).execute()

        if existing_sub.data:
            # Eğer varsa, sadece user_id'yi güncelle (kullanıcı değişmiş olabilir)
            supabase.table('push_subscriptions').update({'user_id': user_id}).eq('id', existing_sub.data[0]['id']).execute()
            print(f"Mevcut abonelik güncellendi: {subscription_data['endpoint']}")
        else:
            # Eğer yoksa, yeni bir kayıt oluştur
            supabase.table('push_subscriptions').insert({
                'user_id': user_id,
                'subscription_data': subscription_data
            }).execute()
            print(f"Yeni abonelik kaydedildi: {subscription_data['endpoint']}")

        return jsonify({'message': 'Abonelik başarıyla kaydedildi/güncellendi.'}), 201

    except Exception as e:
        print(f"Abonelik kaydedilirken hata oluştu: {e}")
        return jsonify({'error': 'Sunucu hatası nedeniyle abonelik kaydedilemedi.'}), 500