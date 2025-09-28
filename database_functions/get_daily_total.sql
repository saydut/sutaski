-- Dosya: database_functions/get_daily_total.sql (GÜNCELLENMİŞ HALİ)

CREATE OR REPLACE FUNCTION get_daily_summary_rpc(target_sirket_id integer, target_date date)
RETURNS TABLE(toplam_litre numeric, girdi_sayisi bigint) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(sut_girdileri.litre), 0) as toplam_litre,
        COUNT(sut_girdileri.id) as girdi_sayisi
    FROM
        sut_girdileri
    WHERE
        sut_girdileri.sirket_id = target_sirket_id AND
        -- DEĞİŞİKLİK: Tarih karşılaştırmasını Türkiye saatine göre (Europe/Istanbul) yapacak şekilde güncelledik.
        (sut_girdileri.taplanma_tarihi AT TIME ZONE 'utc' AT TIME ZONE 'Europe/Istanbul')::date = target_date;
END;
$$ LANGUAGE plpgsql;