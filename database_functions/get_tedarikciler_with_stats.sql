CREATE OR REPLACE FUNCTION get_tedarikciler_with_stats(p_sirket_id integer) -- Parametre adını p_sirket_id olarak değiştirdik
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
        t.sirket_id = p_sirket_id -- Koşulu yeni parametre adıyla güncelledik
    GROUP BY
        t.id, t.isim, t.telefon_no, t.tc_no, t.adres
    ORDER BY
        t.isim;
END;
$$ LANGUAGE plpgsql;