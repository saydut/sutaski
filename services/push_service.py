# services/push_service.py

import os
import json
from pywebpush import webpush, WebPushException
from flask import g
import logging

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
VAPID_CLAIMS = { "sub": "mailto:destek@sutaski.com" }

class PushService:
    def save_subscription(self, user_id, subscription_data):
        """Kullanıcının bildirim aboneliğini veritabanına kaydeder."""
        if not subscription_data or 'endpoint' not in subscription_data:
            raise ValueError("Geçersiz abonelik verisi.")
        
        try:
            g.supabase.table('push_subscriptions').insert({
                'user_id': user_id,
                'subscription_data': subscription_data
            }).execute()
            return {"message": "Bildirim aboneliği başarıyla kaydedildi."}
        except Exception as e:
            if 'unique constraint' in str(e).lower():
                return {"message": "Bu cihaz zaten bildirimler için kayıtlı."}
            logger.error(f"Abonelik kaydı hatası: {e}", exc_info=True)
            raise Exception("Abonelik kaydedilirken bir sunucu hatası oluştu.")

    def send_notification_to_user(self, user_id, title, body, url="/panel"):
        """Belirli bir kullanıcıya bildirim gönderir."""
        try:
            subscriptions_res = g.supabase.table('push_subscriptions').select('subscription_data').eq('user_id', user_id).execute()
            if not subscriptions_res.data:
                logger.warning(f"{user_id} ID'li kullanıcının aboneliği bulunamadı.")
                return 0

            sent_count = 0
            for sub in subscriptions_res.data:
                try:
                    payload = { "title": title, "body": body, "icon": "/static/images/icon.png", "data": {"url": url} }
                    webpush(
                        subscription_info=sub['subscription_data'],
                        data=json.dumps(payload),
                        vapid_private_key=VAPID_PRIVATE_KEY,
                        vapid_claims=VAPID_CLAIMS.copy()
                    )
                    sent_count += 1
                except WebPushException as ex:
                    logger.error(f"Bildirim gönderim hatası: {ex}")
                    if ex.response and ex.response.status_code in [404, 410]:
                        self._delete_subscription(sub['subscription_data'])

            return sent_count
        except Exception as e:
            logger.error(f"Bildirim gönderme sürecinde genel hata: {e}", exc_info=True)
            raise Exception("Bildirim gönderilirken bir hata oluştu.")

    def _delete_subscription(self, subscription_data):
        """Geçersiz bir aboneliği veritabanından siler."""
        try:
            g.supabase.table('push_subscriptions').delete().eq('subscription_data', subscription_data).execute()
            logger.info("Geçersiz abonelik silindi.")
        except Exception as e:
            logger.error(f"Geçersiz abonelik silinirken hata: {e}", exc_info=True)

push_service = PushService()
