# Dosya Adı: utils.py (GÜÇLENDİRİLMİŞ VERSİYON)

import pytz
from datetime import datetime

def parse_supabase_timestamp(timestamp_str):
    """
    Supabase'den gelen çeşitli ISO 8601 formatlarını (timezone'lu, timezone'suz, mikrosaniyeli veya değil)
    doğru bir şekilde anlayan ve timezone-aware bir datetime objesine çeviren daha güçlü bir fonksiyon.
    """
    if not timestamp_str:
        return None
    
    try:
        # Python 3.7+ için fromisoformat en esnek yöntemdir.
        # "+00:00" gibi timezone uzantılarını otomatik olarak anlar.
        # "Z" (Zulu/UTC) formatını da anlayabilmesi için küçük bir ayar yapıyoruz.
        if timestamp_str.endswith('Z'):
            timestamp_str = timestamp_str[:-1] + '+00:00'
        
        return datetime.fromisoformat(timestamp_str)

    except (ValueError, TypeError):
        # Eğer fromisoformat başarısız olursa, daha basit formatları deneriz.
        # Bu, eski veya farklı formatta girilmiş veriler için bir geri dönüş yoludur.
        try:
            # Örneğin: '2025-09-28T20:00:00'
            dt_obj = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S')
            return pytz.utc.localize(dt_obj) # Bunun UTC olduğunu varsayıyoruz
        except (ValueError, TypeError):
            print(f"!!! ZAMAN DAMGASI AYRIŞTIRMA HATASI: '{timestamp_str}' anlaşılamadı.")
            return None