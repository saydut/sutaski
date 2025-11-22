# config.py

import os
from dotenv import load_dotenv

# .env dosyasını yükle
load_dotenv()

class Config:
    """Temel konfigürasyon sınıfı."""
    SECRET_KEY = os.environ.get("SECRET_KEY", "varsayilan-cok-guvenli-bir-anahtar")
    JSON_AS_ASCII = False
    
    # Supabase Ayarları
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
    
    # Diğer genel ayarlar buraya eklenebilir
    DEBUG = False
    TESTING = False

class DevelopmentConfig(Config):
    """Geliştirme ortamı ayarları."""
    DEBUG = True
    ENV = 'development'

class ProductionConfig(Config):
    """Canlı ortam ayarları."""
    DEBUG = False
    ENV = 'production'
    # Production'da cookie güvenliği artırılabilir
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True

# Ortam seçimi (Varsayılan: Development)
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig
}

def get_config():
    env_name = os.environ.get('FLASK_ENV', 'development')
    return config_by_name.get(env_name, DevelopmentConfig)