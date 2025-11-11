# constants.py
from enum import Enum

class UserRole(Enum):
    ADMIN = "admin"
    # 'firma_yetkilisi' olan rol adını, veritabanı (SQL) ile 
    # eşleşmesi için 'firma_admin' olarak güncelliyoruz.
    FIRMA_ADMIN = "firma_admin" 
    # MUHASEBECI rolünü SQL'de tanımlamadık, şimdilik yorum satırı yapıyorum.
    # MUHASEBECI = "muhasebeci" 
    TOPLAYICI = "toplayici"
    CIFCI = "ciftci"

class FinansIslemTipi(Enum):
    # Değerleri, 'finansal_islemler' tablosundaki 'islem_tipi'
    # sütununun beklediği değerlerle (gelir, gider, odeme, tahsilat)
    # tam olarak eşleşecek şekilde güncelliyoruz.
    ODEME = "odeme"       # Tedarikçiye yapılan ödeme (Gider)
    TAHSILAT = "tahsilat" # Tedarikçiden alınan (Yem borcu vb.) (Gelir)
    GELIR = "gelir"       # Süt satışı, Yem satışı (Otomatik)
    GIDER = "gider"       # Yem alışı, Genel Masraf (Otomatik)