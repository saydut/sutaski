-- Dosya: supabase/rpc/get_supplier_summary.sql

CREATE OR REPLACE FUNCTION get_supplier_summary(
    p_sirket_id integer,
    p_tedarikci_id integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    total_sut_alacagi numeric;
    total_yem_borcu numeric;
    total_odeme numeric;
BEGIN
    -- 1. Toplam süt alacağını hesapla (litre * fiyat)
    SELECT COALESCE(SUM(litre * fiyat), 0)
    INTO total_sut_alacagi
    FROM sut_girdileri
    WHERE sirket_id = p_sirket_id AND tedarikci_id = p_tedarikci_id;

    -- 2. Toplam yem borcunu hesapla
    SELECT COALESCE(SUM(toplam_tutar), 0)
    INTO total_yem_borcu
    FROM yem_islemleri
    WHERE sirket_id = p_sirket_id AND tedarikci_id = p_tedarikci_id;

    -- 3. Toplam finansal işlemi (ödeme/avans) hesapla
    SELECT COALESCE(SUM(tutar), 0)
    INTO total_odeme
    FROM finansal_islemler
    WHERE sirket_id = p_sirket_id AND tedarikci_id = p_tedarikci_id;

    -- 4. Sonuçları tek bir JSON nesnesi olarak döndür
    RETURN json_build_object(
        'toplam_sut_alacagi', total_sut_alacagi,
        'toplam_yem_borcu', total_yem_borcu,
        'toplam_odeme', total_odeme,
        'net_bakiye', (total_sut_alacagi - total_yem_borcu - total_odeme)
    );
END;
$$;