-- Dosya: supabase/rpc/get_weekly_summary.sql

CREATE OR REPLACE FUNCTION get_weekly_summary(p_sirket_id integer)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    -- Türkçe ay kısaltmaları için bir dizi
    turkce_aylar text[] := ARRAY['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
BEGIN
    RETURN (
        WITH date_series AS (
            -- Son 7 günü (bugün dahil) geriye doğru oluşturan sanal bir tablo
            SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date - i AS report_date
            FROM generate_series(0, 6) i
        ),
        daily_litres AS (
            -- Her gün için toplanan süt miktarını hesaplayan sorgu
            SELECT
                (taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date AS day,
                SUM(litre) AS total_litre
            FROM sut_girdileri
            WHERE sirket_id = p_sirket_id
              AND (taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date >= (now() AT TIME ZONE 'Europe/Istanbul')::date - interval '6 days'
            GROUP BY day
        )
        -- Sanal tabloları birleştirip Chart.js'in istediği formata çeviren son sorgu
        SELECT json_build_object(
            'labels', json_agg(t.label ORDER BY t.report_date ASC),
            'data', json_agg(t.total_litre ORDER BY t.report_date ASC)
        )
        FROM (
            SELECT
                ds.report_date,
                -- Tarihi '09 Eki' formatına çeviriyoruz
                to_char(ds.report_date, 'DD') || ' ' || turkce_aylar[extract(month from ds.report_date)] AS label,
                COALESCE(dl.total_litre, 0)::numeric(10, 2) AS total_litre
            FROM date_series ds
            LEFT JOIN daily_litres dl ON ds.report_date = dl.day
        ) t
    );
END;
$$;