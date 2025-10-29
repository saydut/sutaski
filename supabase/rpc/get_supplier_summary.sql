-- Dosya: supabase/rpc/get_supplier_summary.sql
-- Bu fonksiyon bir tedarikçinin süt, yem, ödeme/avans ve tahsilatlarını toplayıp net bakiyeyi hesaplar.

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
    total_sirket_odemesi numeric; -- Ödeme ve Avans toplamı (Şirketten Çiftçiye)
    total_tahsilat numeric;      -- Tahsilat toplamı (Çiftçiden Şirkete)
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

    -- 3. Şirketin yaptığı toplam ödemeyi (Ödeme + Avans) hesapla
    SELECT COALESCE(SUM(tutar), 0)
    INTO total_sirket_odemesi
    FROM finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND tedarikci_id = p_tedarikci_id
      AND islem_tipi IN ('Ödeme', 'Avans'); -- Sadece Ödeme ve Avans

    -- 4. Çiftçiden alınan toplam tahsilatı hesapla
    SELECT COALESCE(SUM(tutar), 0)
    INTO total_tahsilat
    FROM finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND tedarikci_id = p_tedarikci_id
      AND islem_tipi = 'Tahsilat'; -- Sadece Tahsilat

    -- 5. Sonuçları tek bir JSON nesnesi olarak döndür
    RETURN json_build_object(
        'toplam_sut_alacagi', total_sut_alacagi,
        'toplam_yem_borcu', total_yem_borcu,
        'toplam_sirket_odemesi', total_sirket_odemesi, -- Yeni alan
        'toplam_tahsilat', total_tahsilat,          -- Yeni alan
        -- Yeni Net Bakiye: Alacaklar - Borçlar - Şirket Ödemeleri + Tahsilatlar
        'net_bakiye', (total_sut_alacagi - total_yem_borcu - total_sirket_odemesi + total_tahsilat)
        -- Eski 'toplam_odeme' alanı artık 'toplam_sirket_odemesi' oldu, gerekirse frontend'de uyarlama yapılır.
    );
END;
$$;
