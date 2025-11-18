from enum import Enum

class UserRole(Enum):
    ADMIN = 'admin'
    FIRMA_YETKILISI = 'firma_yetkilisi'
    TOPLAYICI = 'toplayici'
    MUHASEBECI = 'muhasebeci'
    CIFCI = 'ciftci'


class FinansIslemTipi(Enum):
    ODEME = 'Ödeme'         # Şirket -> Çiftçi (Hakediş)
    AVANS = 'Avans'         # Şirket -> Çiftçi (Ön Ödeme)
    TAHSILAT = 'Tahsilat'   # Çiftçi -> Şirket (Borç ödeme)
    
    # Yeni Eklenen Tipler (Sistemin geri kalanıyla uyum için)
    SUT_SATISI = 'Süt Satışı' # Tankerden Fabrikaya Satış (Gelir)
    SUT_ALIMI = 'Süt Alımı'   # Çiftçiden Alım (Gider/Borçlanma)
    YEM_SATISI = 'Yem Satışı' # Çiftçiye Yem Satışı (Gelir/Alacak)
    YEM_ALIMI = 'Yem Alımı'   # Tedarikçiden Yem Alımı (Gider)
    MASRAF = 'Masraf'         # Genel Giderler
    DIGER_GIDER = 'Diğer Gider'
    DIGER_GELIR = 'Diğer Gelir'
    PRIM = 'Prim'