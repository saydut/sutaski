-- Bu fonksiyon, belirtilen bir şirket ve tarih için
-- o güne ait toplam süt litresini tek bir sayı olarak döndürür.
-- Zaman dilimi dönüşümünü doğru bir şekilde yaparak
-- Türkiye saatine göre günün toplamını hesaplar.

SELECT COALESCE(SUM(litre), 0)
from public.sut_girdileri
where
  sirket_id = target_sirket_id and
  -- taplanma_tarihi (utc) -> istanbul saatine çevir -> sadece tarih kısmını al
  (taplanma_tarihi AT TIME ZONE 'utc' AT TIME ZONE 'Europe/Istanbul')::date = 
    -- Eğer fonksiyona bir tarih verildiyse onu kullan, verilmediyse bugünün tarihini kullan
    CASE 
        WHEN target_date IS NOT NULL THEN target_date
        ELSE (NOW() AT TIME ZONE 'Europe/Istanbul')::date
    END;
