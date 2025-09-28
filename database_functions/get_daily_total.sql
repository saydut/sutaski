-- Bu fonksiyon, belirtilen bir şirket ve tarih için
-- hem toplam süt litresini hem de toplam girdi sayısını
-- tek bir veritabanı sorgusu ile hesaplar ve döndürür.
-- Bu yöntem en yüksek performansı ve doğruluğu sağlar.

CREATE OR REPLACE FUNCTION get_daily_summary_rpc(target_sirket_id integer, target_date date)
RETURNS TABLE(toplam_litre numeric, girdi_sayisi bigint) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(sut_girdileri.litre), 0) as toplam_litre,
        COUNT(sut_girdileri.id) as girdi_sayisi
    FROM
        sut_girdileri
    WHERE
        sut_girdileri.sirket_id = target_sirket_id AND
        (sut_girdileri.taplanma_tarihi AT TIME ZONE 'utc' AT TIME ZONE 'Europe/Istanbul')::date = target_date;
END;
$$ LANGUAGE plpgsql;
