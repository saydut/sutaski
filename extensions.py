# Dosya Adı: extensions.py
# Yapılacak: İçindeki fonksiyonu silerek bu hale getir.

import os
from supabase import create_client, Client
from flask_bcrypt import Bcrypt
import pytz
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

bcrypt = Bcrypt()

turkey_tz = pytz.timezone('Europe/Istanbul')