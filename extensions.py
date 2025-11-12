import os
from supabase import create_client, Client
from dotenv import load_dotenv
import pytz  # Hatanın sebebi buydu, bu satır eksikti
from flask import g, session
from models import Kullanici

# .env dosyasını yükle
load_dotenv()

supabase_url = os.environ.get("SUPABASE_URL")
# .env dosyamızdaki 'SUPABASE_KEY'i okuyoruz
supabase_service_key = os.environ.get("SUPABASE_KEY") 
supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY") 
secret_key = os.environ.get("SECRET_KEY")
vapid_public = os.environ.get("VAPID_PUBLIC_KEY")
vapid_private = os.environ.get("VAPID_PRIVATE_KEY")

# Tüm anahtarların .env dosyasında olduğundan emin ol
if not all([
    supabase_url, 
    supabase_service_key, 
    supabase_anon_key, 
    secret_key,
    vapid_public,
    vapid_private
]):
    raise EnvironmentError(
        "Lütfen .env dosyanızda şunların ayarlandığından emin olun: "
        "SUPABASE_URL, SUPABASE_KEY, SUPABASE_ANON_KEY, "
        "SECRET_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY"
    )

# RLS (Row Level Security) için anonim client
# Bu, blueprints/main.py'nin import ettiği 'supabase_client'
supabase_client: Client = create_client(supabase_url, supabase_anon_key)

# RLS'i bypass etmek için service_role client'ı
# Bu, blueprints/main.py'nin import ettiği 'supabase_service'
supabase_service: Client = create_client(supabase_url, supabase_service_key) 

# Bu, blueprints/main.py'nin import ettiği 'turkey_tz'
turkey_tz = pytz.timezone('Europe/Istanbul')

def init_app(app):
    # Flask 'app.config' içerisine anahtarları yükle
    app.config['SECRET_KEY'] = secret_key
    app.config['SUPABASE_URL'] = supabase_url
    app.config['SUPABASE_KEY'] = supabase_service_key # service key
    app.config['SUPABASE_ANON_KEY'] = supabase_anon_key
    app.config['VAPID_PUBLIC_KEY'] = vapid_public
    app.config['VAPID_PRIVATE_KEY'] = vapid_private

    @app.before_request
    def before_request():
        """
        Her istekten önce çalışır ve g.user'ı ayarlar.
        """
        g.user = None
        user_id = session.get('user_id')
        
        if user_id:
            try:
                # Kullanıcıyı 'profiller' tablosundan çekiyoruz
                user_data = supabase_client.table('profiller').select('*, sirketler(*)').eq('id', user_id).single().execute()
                if user_data.data:
                    g.user = Kullanici(user_data.data)
                else:
                    session.clear() # Profil bulunamadıysa session'ı temizle
            except Exception as e:
                print(f"Oturumdaki kullanıcı yüklenirken hata: {e}")
                session.clear()

    @app.context_processor
    def inject_user():
        # Tüm template'lere (HTML) 'current_user' değişkenini gönderir
        return dict(current_user=g.user)