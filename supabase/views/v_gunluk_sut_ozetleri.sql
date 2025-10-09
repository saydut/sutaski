CREATE OR REPLACE VIEW v_gunluk_sut_ozetleri
WITH (security_invoker = true)
AS
SELECT
    sirket_id,
    (taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date AS gun,
    SUM(litre) AS toplam_litre,
    COUNT(id)::int AS girdi_sayisi
FROM
    sut_girdileri
GROUP BY
    sirket_id,
    gun;