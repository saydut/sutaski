-- Tedarikçi dağılımını (pasta grafik) hesaplar
-- YENİ: p_period parametresi eklendi ('daily', 'weekly', 'monthly', 'all')
CREATE OR REPLACE FUNCTION public.get_supplier_distribution (
  p_sirket_id integer,
  p_period text DEFAULT 'monthly' -- Varsayılan 'monthly' (Son 30 gün)
)
RETURNS TABLE (
  name text,
  litre numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_date timestamptz;
BEGIN
  -- Döneme göre başlangıç tarihini belirle
  IF p_period = 'daily' THEN
    -- Son 24 saat
    v_start_date := now() - interval '1 day';
  ELSIF p_period = 'weekly' THEN
    -- Son 7 gün
    v_start_date := now() - interval '7 days';
  ELSIF p_period = 'all' THEN
    -- Tüm zamanlar (çok eski bir tarih)
    v_start_date := '2000-01-01'::timestamptz;
  ELSE -- 'monthly' veya tanımsız bir değer gelirse (varsayılan)
    -- Son 30 gün
    v_start_date := now() - interval '30 days';
  END IF;

  -- Veriyi gruplayarak döndür
  RETURN QUERY
  SELECT
    t.isim AS name,
    SUM(sg.litre) AS litre
  FROM
    public.sut_girdileri AS sg
  JOIN
    public.tedarikciler AS t ON sg.tedarikci_id = t.id
  WHERE
    sg.sirket_id = p_sirket_id
    AND sg.taplanma_tarihi >= v_start_date -- Filtreyi uygula
  GROUP BY
    t.isim
  ORDER BY
    litre DESC;
END;
$$;