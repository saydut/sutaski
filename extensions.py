# extensions.py
import os
from supabase import create_client, Client
from dotenv import load_dotenv

# .env dosyasındaki ortam değişkenlerini yükle
load_dotenv()

# Ortam değişkenlerini al
SUPABASE_URL = os.environ.get("https://qghlefwfrmqvgcivkwtk.supabase.co")
SUPABASE_ANON_KEY = os.environ.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnaGxlZndmcm1xdmdjaXZrd3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgyMjM2NDgsImV4cCI6MjA3Mzc5OTY0OH0.5hEhIhB1sTYzIGnQNoyeimnOTbA0wdfCy67cxdrG68U")
SUPABASE_SERVICE_KEY = os.environ.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnaGxlZndmcm1xdmdjaXZrd3RrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODIyMzY0OCwiZXhwIjoyMDczNzk5NjQ4fQ.svH9DbeVVnT8LObVj0LSnkFb8KYi4rRetq0cYxLU0xo")

if not SUPABASE_URL or not SUPABASE_ANON_KEY or not SUPABASE_SERVICE_KEY:
    raise EnvironmentError("SUPABASE_URL, SUPABASE_ANON_KEY, ve SUPABASE_SERVICE_KEY ortam değişkenleri ayarlanmalıdır.")

# 1. Kullanıcı İstemcisi (ANON KEY ile)
# Bu istemci, RLS (Satır Seviyesi Güvenlik) politikalarına tabidir.
# Decorator'lar aracılığıyla kullanıcının token'ı ile yetkilendirilecektir.
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# 2. Servis İstemcisi (SERVICE ROLE KEY ile)
# Bu istemci, RLS politikalarını bypass eder (görmezden gelir).
# Sadece backend'de, admin yetkisi gerektiren işlemler (yeni firma kaydı gibi) için kullanılmalıdır.
supabase_service: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)