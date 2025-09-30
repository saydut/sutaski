-- dosya: supabase/migrations/001_create_initial_indexes.sql

-- Süt girdilerini şirket ve tarihe göre daha hızlı bulmak için:
CREATE INDEX IF NOT EXISTS idx_sut_girdileri_sirket_tarih ON sut_girdileri (sirket_id, taplanma_tarihi DESC);

-- Tedarikçileri şirkete göre daha hızlı bulmak için:
CREATE INDEX IF NOT EXISTS idx_tedarikciler_sirket_id ON tedarikciler (sirket_id);

-- Yem işlemlerini şirket ve tarihe göre daha hızlı bulmak için:
CREATE INDEX IF NOT EXISTS idx_yem_islemleri_sirket_tarih ON yem_islemleri (sirket_id, islem_tarihi DESC);

-- Finansal işlemleri şirket ve tarihe göre daha hızlı bulmak için:
CREATE INDEX IF NOT EXISTS idx_finansal_islemler_sirket_tarih ON finansal_islemler (sirket_id, islem_tarihi DESC);