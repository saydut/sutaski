import pytz
from datetime import datetime
import bleach # <-- YENİ: Güvenlik için HTML temizleme kütüphanesi

def parse_supabase_timestamp(timestamp_str):
    """
    Supabase'den gelen ve mikrosaniye hassasiyeti değişebilen ISO 8601 formatlarını
    doğru bir şekilde anlayan ve timezone-aware bir datetime objesine çeviren fonksiyon.
    """
    if not timestamp_str:
        return None
    
    try:
        if '+' in timestamp_str:
            main_part, timezone_part = timestamp_str.rsplit('+', 1)
            timezone_part = '+' + timezone_part
        elif 'Z' in timestamp_str:
            main_part, timezone_part = timestamp_str.rsplit('Z', 1)
            timezone_part = '+00:00'
        else:
            main_part = timestamp_str
            timezone_part = None

        if '.' in main_part:
            time_part, microsecond_part = main_part.rsplit('.', 1)
            main_part = f"{time_part}.{microsecond_part.ljust(6, '0')}"

        full_timestamp_str = main_part + (timezone_part if timezone_part else '')
        
        if timezone_part:
            return datetime.strptime(full_timestamp_str, '%Y-%m-%dT%H:%M:%S.%f%z')
        else:
            dt_obj = datetime.strptime(full_timestamp_str, '%Y-%m-%dT%H:%M:%S.%f')
            return pytz.utc.localize(dt_obj)

    except (ValueError, TypeError) as e:
        print(f"!!! ZAMAN DAMGASI AYRIŞTIRMA HATASI: '{timestamp_str}' anlaşılamadı. Hata: {e}")
        return None

# YENİ: Gelen metin girdilerini XSS saldırılarına karşı temizleyen fonksiyon
def sanitize_input(text):
    """
    Kullanıcıdan gelen metin girdilerindeki potansiyel zararlı HTML'i temizler.
    Sadece metnin kendisini bırakır, etiketleri kaldırır.
    """
    if text is None:
        return None
    # bleach.clean() fonksiyonu tüm HTML etiketlerini kaldırır.
    return bleach.clean(str(text))
