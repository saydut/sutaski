from datetime import datetime

class Sirket:
    """
    'sirketler' tablosundan gelen verileri tutan basit bir sınıf.
    Kullanici sınıfı içinde 'kullanici.sirket' olarak kullanılır.
    """
    def __init__(self, data):
        self.id = data.get('id')
        self.sirket_adi = data.get('sirket_adi')
        self.lisans_bitis_tarihi_str = data.get('lisans_bitis_tarihi')
        self.durum = data.get('durum')
        
    @property
    def lisans_bitis_tarihi(self):
        """
        Tarih string'ini (örn: 2024-10-20T00:00:00) 
        Python'un datetime objesine çevirir.
        """
        if self.lisans_bitis_tarihi_str:
            try:
                # ISO formattaki tarihi parse et
                return datetime.fromisoformat(self.lisans_bitis_tarihi_str)
            except ValueError:
                # Eğer format farklıysa (örn: +00:00 timezone ile)
                try:
                    return datetime.strptime(self.lisans_bitis_tarihi_str, '%Y-%m-%dT%H:%M:%S%z')
                except ValueError:
                     return None
        return None


class Kullanici:
    """
    'profiller' tablosundan ve ilişkili 'sirketler' tablosundan 
    gelen verileri tutan kullanıcı sınıfı.
    Flask'teki 'g.user' ve 'current_user' olarak atanır.
    """
    def __init__(self, data):
        self.id = data.get('id') # UUID
        self.sirket_id = data.get('sirket_id')
        self.rol = data.get('rol')
        self.kullanici_adi = data.get('kullanici_adi')
        self.eposta = data.get('eposta')
        self.durum = data.get('durum')
        
        # 'extensions.py'deki 'select(*, sirketler(*))' sorgusu sayesinde
        # 'sirketler' alanı da 'data' içinde gelir.
        sirket_data = data.get('sirketler')
        self.sirket = Sirket(sirket_data) if sirket_data else None

    # --- Flask-Login uyumluluğu için gereken özellikler ---
    
    @property
    def is_authenticated(self):
        """Oturum açmış bir kullanıcı her zaman 'authenticated'dır."""
        return True

    @property
    def is_active(self):
        """Kullanıcının aktif olup olmadığını kontrol eder."""
        return self.durum == 'aktif'

    @property
    def is_anonymous(self):
        return False

    def get_id(self):
        """Flask-Login için kullanıcı ID'sini string olarak döndürür."""
        return str(self.id)
        
    # --- Rol kontrolü için yardımcı fonksiyonlar ---
    
    def is_super_admin(self):
        return self.rol == 'super_admin'

    def is_firma_admin(self):
        return self.rol == 'firma_admin'
        
    def is_firma_calisan(self):
        return self.rol == 'firma_calisan'

    def is_ciftci(self):
        return self.rol == 'ciftci'