-- supabase/rpc/get_monthly_company_report_data.sql

CREATE OR REPLACE FUNCTION get_monthly_company_report_data(
    p_sirket_id integer,
    p_start_date text,
    p_end_date text
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    start_utc timestamptz;
    end_utc timestamptz;
    daily_summary json;
    supplier_summary json;
    general_summary json;
BEGIN
    -- Gelen tarih aralığını Türkiye saat dilimine göre UTC'ye çevirerek
    -- doğru zaman aralığını belirliyoruz.
    start_utc := (p_start_date::date)::timestamp AT TIME ZONE 'Europe/Istanbul';
    end_utc := ((p_end_date::date) + interval '1 day')::timestamp AT TIME ZONE 'Europe/Istanbul';

    -- 1. GÜNLÜK DÖKÜM: Belirtilen ayın her günü için toplam litreyi ve girdi sayısını hesapla.
    SELECT COALESCE(json_agg(t), '[]'::json) INTO daily_summary
    FROM (
        SELECT
            to_char((sg.taplanma_tarihi AT TIME ZONE 'Europe/Istanbul'), 'DD.MM.YYYY') AS tarih,
            SUM(sg.litre) AS toplam_litre,
            COUNT(sg.id)::integer AS girdi_sayisi
        FROM public.sut_girdileri sg
        WHERE sg.sirket_id = p_sirket_id
          AND sg.taplanma_tarihi >= start_utc AND sg.taplanma_tarihi < end_utc
        GROUP BY (sg.taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date
        ORDER BY (sg.taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date
    ) t;

    -- 2. TEDARİKÇİ DÖKÜMÜ: Ay boyunca en çok süt getiren tedarikçileri sıralı olarak hesapla.
    SELECT COALESCE(json_agg(s), '[]'::json) INTO supplier_summary
    FROM (
        SELECT
            t.isim,
            SUM(sg.litre) AS toplam_litre,
            COUNT(sg.id)::integer AS girdi_sayisi
        FROM public.sut_girdileri sg
        JOIN public.tedarikciler t ON sg.tedarikci_id = t.id
        WHERE sg.sirket_id = p_sirket_id
          AND sg.taplanma_tarihi >= start_utc AND sg.taplanma_tarihi < end_utc
        GROUP BY t.isim
        ORDER BY toplam_litre DESC
    ) s;

    -- 3. GENEL ÖZET: Ayın genel toplamlarını ve ortalamasını hesapla.
    SELECT json_build_object(
        'toplam_litre', COALESCE(SUM(sg.litre), 0),
        'girdi_sayisi', COUNT(sg.id)::integer,
        'gun_sayisi', EXTRACT(DAY FROM p_end_date::date - p_start_date::date) + 1
    ) INTO general_summary
    FROM public.sut_girdileri sg
    WHERE sg.sirket_id = p_sirket_id
      AND sg.taplanma_tarihi >= start_utc AND sg.taplanma_tarihi < end_utc;

    -- 4. Tüm sonuçları tek bir JSON objesi olarak birleştir ve döndür.
    RETURN json_build_object(
        'gunluk_dokum', daily_summary,
        'tedarikci_dokumu', supplier_summary,
        'ozet', general_summary
    );
END;
$$;