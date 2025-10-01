-- supabase/rpc/get_detailed_report_data.sql DOSYASININ YENİ İÇERİĞİ

CREATE OR REPLACE FUNCTION get_detailed_report_data(
    p_sirket_id integer,
    p_start_date text,
    p_end_date text
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER --<<-- BU SATIR BURAYA DA EKLENDİ.
AS $$
DECLARE
    daily_summary json;
    supplier_summary json;
    total_entry_count integer;
BEGIN
    WITH date_series AS (
        SELECT generate_series(p_start_date::date, p_end_date::date, '1 day'::interval) AS report_date
    ),
    daily_litres AS (
        SELECT
            (taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date AS day,
            SUM(litre) AS total_litre
        FROM public.sut_girdileri --<<-- "public" BURAYA DA EKLENDİ.
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

    SELECT json_agg(s) INTO supplier_summary FROM (
        SELECT
            t.isim AS name,
            SUM(sg.litre) AS litre,
            COUNT(sg.id)::integer AS "entryCount"
        FROM public.sut_girdileri sg --<<-- "public" BURAYA DA EKLENDİ.
        JOIN public.tedarikciler t ON sg.tedarikci_id = t.id --<<-- "public" BURAYA DA EKLENDİ.
        WHERE sg.sirket_id = p_sirket_id
          AND (sg.taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date BETWEEN p_start_date::date AND p_end_date::date
        GROUP BY t.isim
        ORDER BY litre DESC
    ) s;

    SELECT COUNT(id) INTO total_entry_count
    FROM public.sut_girdileri --<<-- "public" BURAYA DA EKLENDİ.
    WHERE sirket_id = p_sirket_id
      AND (taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date BETWEEN p_start_date::date AND p_end_date::date;

    RETURN json_build_object(
        'daily_totals', COALESCE(daily_summary, '[]'::json),
        'supplier_breakdown', COALESCE(supplier_summary, '[]'::json),
        'total_entry_count', COALESCE(total_entry_count, 0)
    );
END;
$$;