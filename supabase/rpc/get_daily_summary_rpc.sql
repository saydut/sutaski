-- supabase/rpc/get_daily_summary_rpc.sql DOSYASININ YENİ İÇERİĞİ

CREATE OR REPLACE FUNCTION get_daily_summary_rpc(target_sirket_id integer, target_date text)
RETURNS TABLE(toplam_litre numeric, girdi_sayisi int)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    start_utc timestamptz;
    end_utc timestamptz;
BEGIN
    start_utc := (target_date::date)::timestamp AT TIME ZONE 'Europe/Istanbul';
    end_utc := start_utc + interval '1 day';

    RETURN QUERY
    SELECT
        COALESCE(SUM(sut_girdileri.litre), 0)::numeric,
        COUNT(sut_girdileri.id)::int
    FROM
        public.sut_girdileri
    WHERE
        sut_girdileri.sirket_id = target_sirket_id
    AND sut_girdileri.toplanma_tarihi >= start_utc
    AND sut_girdileri.toplanma_tarihi < end_utc;
END;
$$;