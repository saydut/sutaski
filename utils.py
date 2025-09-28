# Dosya Adı: utils.py
# Konumu: Projenin ana dizini (/home/saydut/utils.py)

import pytz
from datetime import datetime

def parse_supabase_timestamp(timestamp_str):
    """Supabase'den gelen timestamp string'ini timezone-aware datetime objesine çevirir."""
    if not timestamp_str:
        return None
    # Milisaniye ve timezone bilgisini temizle
    if '.' in timestamp_str:
        timestamp_str = timestamp_str.split('.')[0]
    if '+' in timestamp_str:
        timestamp_str = timestamp_str.split('+')[0]
    
    try:
        dt_obj = datetime.strptime(timestamp_str, '%Y-m-%dT%H:%M:%S')
    except ValueError:
        try:
            dt_obj = datetime.strptime(timestamp_str, '%Y-%m-%d')
        except ValueError:
            return None
            
    # Objenin UTC olduğunu belirt
    return pytz.utc.localize(dt_obj)