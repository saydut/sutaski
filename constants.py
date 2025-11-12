from enum import Enum

class UserRole(Enum):
    ADMIN = 'admin'
    FIRMA_YETKILISI = 'firma_yetkilisi'
    TOPLAYICI = 'toplayici'
    MUHASEBECI = 'muhasebeci'
    CIFCI = 'ciftci'


class FinansIslemTipi(Enum):
    ODEME = 'Ödeme' # Şirket -> Çiftçi (Hakediş)
    AVANS = 'Avans' # Şirket -> Çiftçi (Ön Ödeme)
    TAHSILAT = 'Tahsilat' # Çiftçi -> Şirket (Yeni)
