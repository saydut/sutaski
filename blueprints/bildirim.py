import os
from flask import Blueprint, jsonify, request
from pywebpush import webpush, WebPushException

from extensions import supabase
from decorators import admin_required, login_required

bildirim_bp = Blueprint('bildirim', __name__, url_prefix='/api/bildirim')

@bildirim_bp.route('/gonder', methods=['POST'])
@login_required
@admin_required
def toplu_bildirim_gonder():
    data = request.get_json()
    baslik = data.get('baslik')
    mesaj = data.get('mesaj')

    if not baslik or not mesaj:
        return jsonify({'error': 'Başlık ve mesaj alanları zorunludur.'}), 400

    try:
        # 1. Veritabanındaki TÜM abonelikleri çek
        response = supabase.table('push_subscriptions').select('subscription_data').execute()
        subscriptions = response.data

        if not subscriptions:
            return jsonify({'message': 'Bildirim gönderilecek abone bulunamadı.'}), 200

        # VAPID anahtarlarını ortam değişkenlerinden oku
        vapid_private_key = os.environ.get("VAPID_PRIVATE_KEY")
        claims = {"sub": "mailto:destek@sutaski.com"} # Buraya kendi emailini yazabilirsin

        # 2. Her bir aboneye sırayla bildirim gönder
        for sub in subscriptions:
            try:
                subscription_info = sub['subscription_data']
                webpush(
                    subscription_info=subscription_info,
                    data=f'{{"title": "{baslik}", "body": "{mesaj}"}}',
                    vapid_private_key=vapid_private_key,
                    vapid_claims=claims
                )
            except WebPushException as ex:
                # Eğer abonelik geçersizse (örn: kullanıcı tarayıcı iznini iptal ettiyse)
                # bu hatayı yakalayıp veritabanından silebiliriz.
                if ex.response and ex.response.status_code in [404, 410]:
                    print(f"Geçersiz abonelik bulundu ve siliniyor: {subscription_info['endpoint']}")
                    supabase.table('push_subscriptions').delete().eq('subscription_data', subscription_info).execute()
                else:
                    print(f"Bir aboneye bildirim gönderilemedi: {ex}")

        return jsonify({'message': f'{len(subscriptions)} aboneye bildirim gönderildi.'}), 200

    except Exception as e:
        print(f"Toplu bildirim gönderiminde genel hata: {e}")
        return jsonify({'error': 'Sunucu hatası nedeniyle bildirimler gönderilemedi.'}), 500