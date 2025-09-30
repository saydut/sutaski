CREATE OR REPLACE FUNCTION get_daily_summary_rpc(target_sirket_id bigint, target_date text)
RETURNS TABLE(toplam_litre numeric, girdi_sayisi int) AS $$
DECLARE
    start_utc timestamptz;
    end_utc timestamptz;
BEGIN
    -- Gelen metin tarihini Türkiye saatine göre günün başlangıcı olarak ayarla
    start_utc := (target_date::date)::timestamp AT TIME ZONE 'Europe/Istanbul';
    
    -- Günün bitişini hesapla (başlangıca 1 gün ekle)
    end_utc := start_utc + interval '1 day';

    RETURN QUERY
    SELECT
        COALESCE(SUM(sut_girdileri.litre), 0)::numeric,
        COUNT(sut_girdileri.id)::int
    FROM
        sut_girdileri
    WHERE
        sut_girdileri.sirket_id = target_sirket_id
        AND sut_girdileri.taplanma_tarihi >= start_utc
        AND sut_girdileri.taplanma_tarihi < end_utc;
END;
$$ LANGUAGE plpgsql;