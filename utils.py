import pytz
from datetime import datetime

def parse_supabase_timestamp(timestamp_str):
    """
    Supabase'den gelen ve mikrosaniye hassasiyeti değişebilen ISO 8601 formatlarını
    doğru bir şekilde anlayan ve timezone-aware bir datetime objesine çeviren fonksiyon.
    """
    if not timestamp_str:
        return None
    
    try:
        # Timezone bilgisini (+00:00) ve mikrosaniye bölümünü ayır
        if '+' in timestamp_str:
            main_part, timezone_part = timestamp_str.rsplit('+', 1)
            timezone_part = '+' + timezone_part
        elif 'Z' in timestamp_str:
            main_part, timezone_part = timestamp_str.rsplit('Z', 1)
            timezone_part = '+00:00'
        else:
            main_part = timestamp_str
            timezone_part = None

        # Mikrosaniye bölümünün her zaman 6 haneli olmasını sağla
        if '.' in main_part:
            time_part, microsecond_part = main_part.rsplit('.', 1)
            main_part = f"{time_part}.{microsecond_part.ljust(6, '0')}"

        # Parçaları tekrar birleştir
        full_timestamp_str = main_part + (timezone_part if timezone_part else '')
        
        # Standart strptime ile parse et
        # Python'un %f formatı 6 haneli mikrosaniyeyi sorunsuz anlar.
        if timezone_part:
            return datetime.strptime(full_timestamp_str, '%Y-%m-%dT%H:%M:%S.%f%z')
        else:
            # Eğer timezone bilgisi yoksa, UTC olduğunu varsay
            dt_obj = datetime.strptime(full_timestamp_str, '%Y-%m-%dT%H:%M:%S.%f')
            return pytz.utc.localize(dt_obj)

    except (ValueError, TypeError) as e:
        print(f"!!! ZAMAN DAMGASI AYRIŞTIRMA HATASI: '{timestamp_str}' anlaşılamadı. Hata: {e}")
        return None