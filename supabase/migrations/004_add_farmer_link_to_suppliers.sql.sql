-- Tedarikciler tablosuna kullanıcı ID'sini tutacak sütunu ekle (varsa hata verme)
-- Bu sütun, bir tedarikçi kaydının hangi kullanıcı hesabına (eğer varsa) bağlı olduğunu gösterir.
ALTER TABLE public.tedarikciler
ADD COLUMN IF NOT EXISTS kullanici_id BIGINT NULL; -- Boş olabilir (her tedarikçinin kullanıcı hesabı olmayabilir)

-- Bu yeni sütunu kullanicilar tablosuna bağlayan Foreign Key kısıtlamasını ekle
-- Önce mevcut olabilecek aynı isimdeki kısıtlamayı (varsa) silelim ki tekrar çalıştırıldığında hata vermesin
ALTER TABLE public.tedarikciler
DROP CONSTRAINT IF EXISTS tedarikciler_kullanici_id_fkey;

-- Şimdi yeni kısıtlamayı ekleyelim
ALTER TABLE public.tedarikciler
ADD CONSTRAINT tedarikciler_kullanici_id_fkey
FOREIGN KEY (kullanici_id)             -- Bu tablodaki kullanici_id sütunu...
REFERENCES public.kullanicilar (id)    -- ...kullanicilar tablosundaki id sütununa bağlanır.
ON DELETE SET NULL                     -- Eğer ilişkili kullanıcı hesabı silinirse, bu sütunu NULL yap (tedarikçi kaydı kalır).
ON UPDATE NO ACTION;                   -- Kullanıcı ID'si normalde değişmeyeceği için güncellemede bir şey yapma.

-- Bir kullanıcı ID'sinin birden fazla tedarikçiye atanmasını engellemek için UNIQUE kısıtlaması ekle
-- Önce mevcut olabilecek aynı isimdeki kısıtlamayı (varsa) silelim
ALTER TABLE public.tedarikciler
DROP CONSTRAINT IF EXISTS tedarikciler_kullanici_id_unique;

-- Şimdi yeni UNIQUE kısıtlamayı ekleyelim (NULL değerler bu kısıtlamayı ihlal etmez)
ALTER TABLE public.tedarikciler
ADD CONSTRAINT tedarikciler_kullanici_id_unique
UNIQUE (kullanici_id);

-- Bu sütuna hızlı erişim için bir index oluştur (varsa hata verme)
-- Belirli bir kullanıcıya bağlı tedarikçiyi hızlı bulmak için faydalı olabilir.
CREATE INDEX IF NOT EXISTS idx_tedarikciler_kullanici_id ON public.tedarikciler (kullanici_id);

