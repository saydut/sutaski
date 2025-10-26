from enum import Enum

class UserRole(Enum):
    ADMIN = 'admin'
    FIRMA_YETKILISI = 'firma_yetkilisi'
    TOPLAYICI = 'toplayici'
    MUHASEBECI = 'muhasebeci'
    CIFCI = 'ciftci'


class FinansIslemTipi(Enum):
    ODEME = 'Ödeme'
    AVANS = 'Avans'
