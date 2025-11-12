import re
from decimal import Decimal, InvalidOperation
from datetime import datetime
import pytz # Zaman dilimi için eklendi

# --- ZAMAN DİLİMİ ---
# Döngüsel import'u engellemek için 'extensions.py'den buraya taşındı
turkey_tz = pytz.timezone('Europe/Istanbul')


def sanitize_input(value):
    """
    Girdiyi basit XSS ve HTML enjeksiyonlarına karşı temizler.
    (Orijinal dosyanızdan alındı)
    """
    if value is None:
        return None
    value = str(value)
    # Temel HTML etiketlerini ve tehlikeli karakterleri kaldır
    value = re.sub(r'<[^>]+>', '', value)
    value = re.sub(r'[;\'"()\[\]{}]', '', value)
    return value.strip()


# --- YENİ EKLENEN YARDIMCI FONKSİYONLAR ---
# (Tüm blueprint'lerin bu fonksiyonlara ihtiyacı var)

def parse_int_or_none(value):
    """
    Bir değeri integer'a çevirmeye çalışır. Başarısız olursa None döndürür.
    """
    if value is None:
        return None
    try:
        return int(str(value))
    except (ValueError, TypeError):
        return None

def parse_decimal_or_none(value):
    """
    Bir değeri Decimal'e (parasal) çevirmeye çalışır. Başarısız olursa None döndürür.
    """
    if value is None:
        return None
    try:
        # String'deki virgülü noktaya çevir (örn: "10,50" -> "10.50")
        value_str = str(value).replace(',', '.')
        return Decimal(value_str)
    except (InvalidOperation, ValueError, TypeError):
        return None

def parse_date_or_none(date_str):
    """
    'YYYY-MM-DD' formatındaki bir string'i datetime objesine çevirir.
    """
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return None