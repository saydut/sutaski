CREATE OR REPLACE FUNCTION get_tedarikciler_with_stats(sirket_id_param integer)
RETURNS TABLE(
    id integer,
    isim text,
    telefon_no text,
    tc_no text,
    adres text,
    toplam_litre numeric,
    girdi_sayisi bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.isim,
        t.telefon_no,
        t.tc_no,
        t.adres,
        COALESCE(SUM(sg.litre), 0) as toplam_litre,
        COUNT(sg.id) as girdi_sayisi
    FROM
        tedarikciler t
    LEFT JOIN
        sut_girdileri sg ON t.id = sg.tedarikci_id AND t.sirket_id = sg.sirket_id
    WHERE
        t.sirket_id = sirket_id_param
    GROUP BY
        t.id
    ORDER BY
        t.isim;
END;
$$ LANGUAGE plpgsql;