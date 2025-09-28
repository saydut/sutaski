
  select coalesce(sum(litre), 0)
  from public.sut_girdileri
  where
    sirket_id = target_sirket_id and
    -- Kayıt zamanını Türkiye saatine çevirip, gönderilen tarihle (veya bugünün tarihiyle) karşılaştırır
    (taplanma_tarihi AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul')::date = 
        CASE 
            WHEN target_date IS NOT NULL THEN target_date -- Eğer tarih verildiyse onu kullan
            ELSE (now() AT TIME ZONE 'Europe/Istanbul')::date -- Verilmediyse bugünü kullan
        END;
