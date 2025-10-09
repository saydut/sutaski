CREATE OR REPLACE FUNCTION get_supplier_distribution(p_sirket_id integer)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    start_date timestamptz;
BEGIN
    -- Son 30 günün başlangıç tarihini hesapla
    start_date := (now() AT TIME ZONE 'Europe/Istanbul') - interval '30 days';

    -- Veriyi grupla, topla, sırala ve JSON olarak döndür
    RETURN (
        SELECT COALESCE(json_agg(t), '[]'::json)
        FROM (
            SELECT
                ted.isim AS name,
                SUM(sut.litre)::numeric(10, 2) AS litre -- Sonucu 2 ondalık basamakla sınırla
            FROM sut_girdileri AS sut
            JOIN tedarikciler AS ted ON sut.tedarikci_id = ted.id
            WHERE sut.sirket_id = p_sirket_id
              AND sut.taplanma_tarihi >= start_date
            GROUP BY ted.isim
            ORDER BY litre DESC
        ) t
    );
END;
$$;