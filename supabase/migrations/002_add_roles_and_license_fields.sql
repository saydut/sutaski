-- dosyası: supabase/migrations/002_add_roles_and_license_fields.sql

-- Kullanıcılar tablosundaki 'rol' sütununun varsayılan değerini 'user' yerine 'toplayici' olarak güncelle.
-- Bu, firma yetkilisi tarafından eklenecek yeni kullanıcıların otomatik olarak toplayıcı rolü almasını sağlar.
-- NOT: Bu ALTER komutu, mevcut 'user' değerli satırları DEĞİŞTİRMEZ. Sadece YENİ eklenecek satırlar için varsayılanı ayarlar.
ALTER TABLE public.kullanicilar ALTER COLUMN rol SET DEFAULT 'toplayici';

-- Şirketler tablosuna toplayıcı limitini tutacak yeni bir sütun ekle.
-- 'NOT NULL' ve 'DEFAULT 3' ile, mevcut tüm şirketlerin otomatik olarak 3 toplayıcı limitine sahip olmasını sağlıyoruz.
ALTER TABLE public.sirketler
ADD COLUMN IF NOT EXISTS max_toplayici_sayisi INT NOT NULL DEFAULT 3;
