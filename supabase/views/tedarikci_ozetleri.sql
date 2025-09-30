-- dosya: supabase/views/tedarikci_ozetleri.sql

CREATE OR REPLACE VIEW tedarikci_ozetleri AS
SELECT
    t.id,
    t.isim,
    t.telefon_no,
    t.tc_no,
    t.adres,
    t.sirket_id,
    COALESCE(sut_sum.toplam_litre, 0) AS toplam_litre
FROM
    tedarikciler t
LEFT JOIN (
    SELECT
        tedarikci_id,
        SUM(litre) as toplam_litre
    FROM
        sut_girdileri
    GROUP BY
        tedarikci_id
) AS sut_sum ON t.id = sut_sum.tedarikci_id;