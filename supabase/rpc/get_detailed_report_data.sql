-- dosya: supabase/rpc/get_detailed_report_data.sql

CREATE OR REPLACE FUNCTION get_detailed_report_data(
    p_sirket_id integer,
    p_start_date text,
    p_end_date text
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    daily_summary json;
    supplier_summary json;
    total_entry_count integer;
BEGIN
    -- Günlük Toplamları Hesapla
    WITH date_series AS (
        SELECT generate_series(p_start_date::date, p_end_date::date, '1 day'::interval) AS report_date
    ),
    daily_litres AS (
        SELECT
            (taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date AS day,
            SUM(litre) AS total_litre
        FROM sut_girdileri
        WHERE sirket_id = p_sirket_id
          AND (taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date BETWEEN p_start_date::date AND p_end_date::date
        GROUP BY day
    )
    SELECT json_agg(t) INTO daily_summary FROM (
        SELECT
            to_char(ds.report_date, 'YYYY-MM-DD') AS gun,
            COALESCE(dl.total_litre, 0) AS toplam
        FROM date_series ds
        LEFT JOIN daily_litres dl ON ds.report_date = dl.day
        ORDER BY ds.report_date
    ) t;

    -- Tedarikçi Dökümünü Hesapla
    SELECT json_agg(s) INTO supplier_summary FROM (
        SELECT
            t.isim AS name,
            SUM(sg.litre) AS litre,
            COUNT(sg.id)::integer AS "entryCount"
        FROM sut_girdileri sg
        JOIN tedarikciler t ON sg.tedarikci_id = t.id
        WHERE sg.sirket_id = p_sirket_id
          AND (sg.taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date BETWEEN p_start_date::date AND p_end_date::date
        GROUP BY t.isim
        ORDER BY litre DESC
    ) s;

    -- Toplam Girdi Sayısını Hesapla
    SELECT COUNT(id) INTO total_entry_count
    FROM sut_girdileri
    WHERE sirket_id = p_sirket_id
      AND (taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date BETWEEN p_start_date::date AND p_end_date::date;

    -- Tüm sonuçları tek bir JSON objesi olarak birleştir ve döndür
    RETURN json_build_object(
        'daily_totals', COALESCE(daily_summary, '[]'::json),
        'supplier_breakdown', COALESCE(supplier_summary, '[]'::json),
        'total_entry_count', COALESCE(total_entry_count, 0)
    );
END;
$$;