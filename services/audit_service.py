# services/audit_service.py

from flask import g, request, session
import logging
import json

logger = logging.getLogger(__name__)

class AuditService:
    """Sistemdeki kritik işlemleri veritabanına kaydeder."""

    def log_islem(self, islem_turu, tablo_adi=None, kayit_id=None, detaylar=None, sirket_id=None):
        """
        Genel loglama fonksiyonu.
        
        Args:
            islem_turu (str): 'INSERT', 'UPDATE', 'DELETE', 'LOGIN_SUCCESS', 'LOGIN_FAIL' vb.
            tablo_adi (str): İşlem yapılan tablo (opsiyonel)
            kayit_id (int): İşlem yapılan kaydın ID'si (opsiyonel)
            detaylar (dict): JSON olarak saklanacak ek bilgiler (eski veri, yeni veri vb.)
            sirket_id (int): Zorunlu değilse session'dan alır.
        """
        try:
            user = session.get('user', {})
            user_id = user.get('id')
            
            # Şirket ID session'dan alınabilir veya parametre olarak gelebilir
            if not sirket_id:
                sirket_id = user.get('sirket_id')

            # IP Adresini al
            ip_adresi = request.remote_addr if request else None

            log_data = {
                'sirket_id': sirket_id,
                'user_id': user_id,
                'islem_turu': islem_turu,
                'tablo_adi': tablo_adi,
                'kayit_id': kayit_id,
                'detaylar': detaylar if detaylar else {},
                'ip_adresi': ip_adresi
            }

            # Supabase'e asenkron yazılabilir ama şimdilik senkron yapıyoruz
            g.supabase.table('audit_logs').insert(log_data).execute()
            
        except Exception as e:
            # Audit log hatası ana işlemi durdurmamalı, sadece loglanmalı
            logger.error(f"Audit Log Kaydı Hatası: {e} - Data: {detaylar}", exc_info=True)

audit_service = AuditService()