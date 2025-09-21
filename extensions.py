import os
from supabase import create_client, Client
from flask_bcrypt import Bcrypt
import pytz
from dotenv import load_dotenv

# .env dosyasındaki bilgileri yükle
load_dotenv()

# Supabase Client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

# Bcrypt
bcrypt = Bcrypt()

# Timezone
turkey_tz = pytz.timezone('Europe/Istanbul')