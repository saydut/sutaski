-- Bu fonksiyon, bir tedarikçinin süt girdilerinin ortalamasını ve standart sapmasını hesaplar.
-- YENİ VERSİYON: Yeterli veri olmasa bile her zaman bir sonuç döndürür.

CREATE OR REPLACE FUNCTION get_supplier_stats(
    p_sirket_id integer,
    p_tedarikci_id integer
)
RETURNS TABLE(ortalama_litre numeric, standart_sapma numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    entry_count integer;
BEGIN
    -- Önce, bu tedarikçi için toplam girdi sayısını bulalım.
    SELECT COUNT(*)
    INTO entry_count
    FROM sut_girdileri
    WHERE sirket_id = p_sirket_id AND tedarikci_id = p_tedarikci_id;

    -- Eğer 3 veya daha fazla girdi varsa, istatistikleri hesapla.
    IF entry_count >= 3 THEN
        RETURN QUERY
        SELECT
            COALESCE(AVG(litre), 0)::numeric,
            COALESCE(STDDEV(litre), 0)::numeric
        FROM sut_girdileri
        WHERE sirket_id = p_sirket_id AND tedarikci_id = p_tedarikci_id;
    ELSE
        -- Eğer yeterli girdi yoksa, istatistikleri 0 olarak döndür.
        -- Bu, arayüzün doğru çalışması için kritik öneme sahiptir.
        RETURN QUERY
        SELECT 0::numeric, 0::numeric;
    END IF;
END;
$$;

