# services/push_service.py
# RLS ve yeni Auth sistemine göre güncellendi.

import os
import json
from pywebpush import webpush, WebPushException
from flask import g
import logging
# Artık her iki client'a da ihtiyacımız var
from extensions import supabase_client, supabase_service

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY")
VAPID_CLAIMS = { "sub": "mailto:destek@sutaski.com" }

class PushService:

    def save_subscription(self, subscription_data):
        """
        Giriş yapmış kullanıcının bildirim aboneliğini RLS kullanarak kaydeder.
        user_id'yi 'g' objesinden alır.
        """
        if not subscription_data or 'endpoint' not in subscription_data:
            raise ValueError("Geçersiz abonelik verisi.")
        
        try:
            # 1. user_id'yi (UUID) parametreden değil, 'g' objesinden al
            user_id_uuid = g.user.id
            
            # 2. 'supabase_client' (anon) kullanarak RLS'e tabi olarak ekle
            # SQL'de kurduğumuz RLS, 'push_subscriptions' tablosuna
            # sadece user_id'si auth.uid() olanın eklemesine izin verir.
            response = supabase_client.table('push_subscriptions').insert({
                'user_id': user_id_uuid,
                'subscription_data': subscription_data
            }).execute()
            
            return {"message": "Bildirim aboneliği başarıyla kaydedildi."}, None
        
        except Exception as e:
            if 'unique constraint' in str(e).lower():
                # Zaten kayıtlıysa hata vermeden devam et
                return {"message": "Bu cihaz zaten bildirimler için kayıtlı."}, None
            logger.error(f"Abonelik kaydı hatası: {e}", exc_info=True)
            return None, "Abonelik kaydedilirken bir sunucu hatası oluştu."

    def send_notification_to_user(self, user_id_uuid: str, title: str, body: str, url: str):
        """
        Belirli bir kullanıcıya (UUID ile) bildirim gönderir.
        Bu bir sistem işlemi olduğu için 'supabase_service' (admin) kullanır.
        """
        try:
            # g.supabase -> supabase_service
            subscriptions_res = supabase_service.table('push_subscriptions') \
                .select('subscription_data') \
                .eq('user_id', user_id_uuid) \
                .execute()

            return self._send_push_payload(subscriptions_res.data, title, body, url)
        except Exception as e:
            logger.error(f"Kullanıcıya bildirim gönderilirken hata: {e}", exc_info=True)
            raise Exception("Kullanıcıya bildirim gönderilemedi.")

    def send_notification_to_sirket(self, sirket_id: int, title: str, body: str, url: str, excluded_user_id_uuid: str = None):
        """
        Bir şirketteki (belirli bir kullanıcı hariç) herkese bildirim gönderir.
        'supabase_service' (admin) kullanır.
        """
        try:
            # 1. 'kullanicilar' -> 'profiller'
            # g.supabase -> supabase_service
            query = supabase_service.table('profiller') \
                .select('id') \
                .eq('sirket_id', sirket_id)
            
            if excluded_user_id_uuid:
                query = query.neq('id', excluded_user_id_uuid)
                
            user_ids_res = query.execute()
            
            if not user_ids_res.data:
                return 0 # Bildirim gönderilecek kimse yok

            user_ids = [user['id'] for user in user_ids_res.data] # UUID listesi

            # 2. Abonelikleri al
            # g.supabase -> supabase_service
            subscriptions_res = supabase_service.table('push_subscriptions') \
                .select('subscription_data') \
                .in_('user_id', user_ids) \
                .execute()

            return self._send_push_payload(subscriptions_res.data, title, body, url)
        except Exception as e:
            logger.error(f"Şirkete bildirim gönderilirken hata: {e}", exc_info=True)
            raise Exception("Şirkete bildirim gönderilemedi.")

    def _send_push_payload(self, subscriptions_data: list, title: str, body: str, url: str):
        """Yardımcı fonksiyon: Abonelik listesine PUSH payload'unu gönderir."""
        if not subscriptions_data:
            return 0

        sent_count = 0
        for sub in subscriptions_data:
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
                # 404 veya 410 (Gone) hatası, aboneliğin geçersiz olduğunu gösterir
                if ex.response and ex.response.status_code in [404, 410]:
                    # Aboneliği endpoint'e göre sil
                    self._delete_subscription(sub['subscription_data'].get('endpoint'))
            except Exception as e:
                 logger.error(f"Bilinmeyen bildirim gönderim hatası: {e}", exc_info=True)

        return sent_count

    def _delete_subscription(self, endpoint_url: str):
        """Geçersiz bir aboneliği (endpoint'e göre) veritabanından siler."""
        if not endpoint_url:
            return
            
        try:
            # g.supabase -> supabase_service (Admin yetkisiyle sil)
            # 'subscription_data' (JSON) yerine, 'endpoint' (text) alanına göre sil
            # (jsonb->>'endpoint') operatörünü kullan
            supabase_service.table('push_subscriptions') \
                .delete() \
                .eq('subscription_data->>endpoint', endpoint_url) \
                .execute()
            
            logger.info(f"Geçersiz abonelik silindi: {endpoint_url}")
        except Exception as e:
            logger.error(f"Geçersiz abonelik silinirken hata: {e}", exc_info=True)

# Servisin bir örneğini (instance) oluştur
push_service = PushService()