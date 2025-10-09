CREATE OR REPLACE FUNCTION get_detailed_report_data(
    p_sirket_id integer,
    p_start_date text,
    p_end_date text
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    daily_summary json;
    supplier_summary json;
    total_entry_count integer;
BEGIN
    -- 1. ADIM: GÜNLÜK ÖZETLERİ YENİ VE HIZLI VIEW'DAN ÇEK
    WITH date_series AS (
        SELECT generate_series(p_start_date::date, p_end_date::date, '1 day'::interval) AS report_date
    )
    SELECT json_agg(t) INTO daily_summary FROM (
        SELECT
            to_char(ds.report_date, 'YYYY-MM-DD') AS gun,
            COALESCE(v.toplam_litre, 0) AS toplam
        FROM date_series ds
        LEFT JOIN v_gunluk_sut_ozetleri v ON ds.report_date = v.gun AND v.sirket_id = p_sirket_id
        ORDER BY ds.report_date
    ) t;

    -- 2. ADIM: TEDARİKÇİ DÖKÜMÜNÜ HESAPLA (Bu kısım aynı kalıyor)
    SELECT COALESCE(json_agg(s), '[]'::json) INTO supplier_summary FROM (
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

    -- 3. ADIM: TOPLAM GİRDİ SAYISINI HESAPLA (Bu da aynı kalıyor)
    SELECT COALESCE(SUM(v.girdi_sayisi), 0)::integer INTO total_entry_count
    FROM v_gunluk_sut_ozetleri v
    WHERE v.sirket_id = p_sirket_id
      AND v.gun BETWEEN p_start_date::date AND p_end_date::date;

    -- 4. ADIM: SONUÇLARI BİRLEŞTİR
    RETURN json_build_object(
        'daily_totals', COALESCE(daily_summary, '[]'::json),
        'supplier_breakdown', supplier_summary,
        'total_entry_count', total_entry_count
    );
END;
$$;