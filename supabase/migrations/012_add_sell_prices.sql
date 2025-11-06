-- dosyası: supabase/migrations/012_add_sell_prices.sql
-- Adım 1: Süt ve Yem için Alış/Satış Fiyatı Altyapısı

-- 1. Süt fiyat tarifesi tablosunu güncelle
-- Mevcut 'fiyat' kolonunu 'alis_fiyati' olarak yeniden adlandır
ALTER TABLE public.sut_fiyat_tarifesi
RENAME COLUMN fiyat TO alis_fiyati;

-- 'satis_fiyati' kolonunu ekle (varsayılan 0.00, NOT NULL)
ALTER TABLE public.sut_fiyat_tarifesi
ADD COLUMN satis_fiyati NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

-- 2. Yem ürünleri tablosunu güncelle
-- (Mevcut 'birim_fiyat' ve 'cuval_fiyati' ALIS fiyatları olarak kabul edilecek)
-- Sadece 'satis_fiyati' kolonunu ekle
ALTER TABLE public.yem_urunleri
ADD COLUMN satis_fiyati NUMERIC(10, 2) NOT NULL DEFAULT 0.00;