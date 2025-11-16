-- dosyası: supabase/migrations/007_add_role_filter_indexes.sql
-- Performans İyileştirmesi: Toplayıcı (kullanici_id) rolüne göre
-- yapılan filtrelemeleri hızlandırmak için bileşik indeksler ekler.

-- Süt girdilerini toplayıcıya ve tarihe göre hızla bulmak için:
CREATE INDEX IF NOT EXISTS idx_sut_girdileri_sirket_kullanici_tarih
ON public.sut_girdileri (sirket_id, kullanici_id, taplanma_tarihi DESC);

-- Yem işlemlerini toplayıcıya ve tarihe göre hızla bulmak için:
CREATE INDEX IF NOT EXISTS idx_yem_islemleri_sirket_kullanici_tarih
ON public.yem_islemleri (sirket_id, kullanici_id, islem_tarihi DESC);

-- Finansal işlemleri toplayıcıya ve tarihe göre hızla bulmak için:
CREATE INDEX IF NOT EXISTS idx_finansal_islemleri_sirket_kullanici_tarih
ON public.finansal_islemler (sirket_id, kullanici_id, islem_tarihi DESC);