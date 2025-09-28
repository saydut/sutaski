import os
from supabase import create_client, Client
from flask_bcrypt import Bcrypt
import pytz
from dotenv import load_dotenv
from datetime import datetime

# .env dosyasındaki bilgileri yükle
load_dotenv()

# Supabase Client (Güncel ve Doğru Hali)
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Bcrypt
bcrypt = Bcrypt()

# Timezone
turkey_tz = pytz.timezone('Europe/Istanbul')

# --- YENİ EKLENEN YARDIMCI FONKSİYON ---
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
        # Standart formatları dene
        dt_obj = datetime.strptime(timestamp_str, '%Y-%m-%dT%H:%M:%S')
    except ValueError:
        try:
            # Sadece tarih içeren formatı dene
            dt_obj = datetime.strptime(timestamp_str, '%Y-%m-%d')
        except ValueError:
            # Hata durumunda None dön
            return None
            
    # Objenin UTC olduğunu belirt
    return pytz.utc.localize(dt_obj)
