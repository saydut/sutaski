-- Bu fonksiyon, belirtilen bir şirket ID'si için tüm tedarikçileri,
-- o tedarikçilere ait toplam süt litresi ve toplam girdi sayısı ile birlikte döndürür.
-- Bu işlemi tek bir veritabanı sorgusu ile yaparak performansı artırır (N+1 problemini çözer).

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
        -- Eğer bir tedarikçinin hiç süt girdisi yoksa, toplam litreyi 0 olarak ayarla (COALESCE).
        COALESCE(SUM(sg.litre), 0) as toplam_litre,
        -- Eğer bir tedarikçinin hiç süt girdisi yoksa, girdi sayısını 0 olarak say.
        COUNT(sg.id) as girdi_sayisi
    FROM
        tedarikciler t
    -- Tedarikçiler tablosunu, süt girdileri tablosu ile birleştir (LEFT JOIN).
    -- LEFT JOIN kullanıyoruz çünkü hiç süt getirmemiş tedarikçileri de listede görmek istiyoruz.
    LEFT JOIN
        sut_girdileri sg ON t.id = sg.tedarikci_id AND t.sirket_id = sg.sirket_id
    WHERE
        t.sirket_id = sirket_id_param
    -- Sonuçları tedarikçi bazında grupla.
    GROUP BY
        t.id
    -- Son olarak, alfabetik olarak sırala.
    ORDER BY
        t.isim;
END;
$$ LANGUAGE plpgsql;
