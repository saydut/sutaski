from enum import Enum

class UserRole(Enum):
    ADMIN = 'admin'
    USER = 'user'
    MUHASEBECI = 'muhasebeci'

class FinansIslemTipi(Enum):
    ODEME = 'Ödeme'
    AVANS = 'Avans'