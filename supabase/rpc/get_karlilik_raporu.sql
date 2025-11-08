-- Kârlılık Raporu Fonksiyonu (RPC)
-- Süt Geliri, Süt Maliyeti, Yem Geliri, Yem Maliyeti ve Diğer kalemleri hesaplar.

CREATE OR REPLACE FUNCTION public.get_karlilik_raporu (
  p_sirket_id integer,
  p_start_date text,
  p_end_date text
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_date date;
    v_end_date date;
    
    toplam_sut_maliyeti numeric;
    toplam_sut_geliri numeric; -- Süt Satışları
    
    toplam_yem_maliyeti numeric;
    toplam_yem_geliri numeric;
    
    toplam_masraf numeric;
    toplam_diger_gelirler numeric;
    toplam_prim numeric;
BEGIN
    v_start_date := p_start_date::date;
    v_end_date := p_end_date::date;

    -- 1. Süt Maliyeti (GİDER - 'Süt Alımı')
    SELECT COALESCE(SUM(tutar), 0)
    INTO toplam_sut_maliyeti
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND islem_tipi = 'Süt Alımı'
      AND islem_tarihi BETWEEN v_start_date AND (v_end_date + interval '1 day');

    -- 2. Süt Geliri (GELİR - 'Süt Satışı')
    SELECT COALESCE(SUM(tutar), 0)
    INTO toplam_sut_geliri
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND islem_tipi = 'Süt Satışı'
      AND islem_tarihi BETWEEN v_start_date AND (v_end_date + interval '1 day');

    -- 3. Yem Geliri (GELİR - 'Yem Satışı')
    SELECT COALESCE(SUM(tutar), 0)
    INTO toplam_yem_geliri
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND islem_tipi = 'Yem Satışı'
      AND islem_tarihi BETWEEN v_start_date AND (v_end_date + interval '1 day');

    -- 4. Yem Maliyeti (GİDER - 'Yem Alımı')
    SELECT COALESCE(SUM(tutar), 0)
    INTO toplam_yem_maliyeti
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND islem_tipi = 'Yem Alımı'
      AND islem_tarihi BETWEEN v_start_date AND (v_end_date + interval '1 day');

    -- 5. Diğer Giderler (Masraf, Prim, Diğer Gider)
    SELECT COALESCE(SUM(tutar), 0)
    INTO toplam_masraf
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND (islem_tipi = 'Masraf' OR islem_tipi = 'Diğer Gider')
      AND islem_tarihi BETWEEN v_start_date AND (v_end_date + interval '1 day');
      
    SELECT COALESCE(SUM(tutar), 0)
    INTO toplam_prim
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND islem_tipi = 'Prim'
      AND islem_tarihi BETWEEN v_start_date AND (v_end_date + interval '1 day');

    -- 6. Diğer Gelirler ('Diğer Gelir')
    SELECT COALESCE(SUM(tutar), 0)
    INTO toplam_diger_gelirler
    FROM public.finansal_islemler
    WHERE sirket_id = p_sirket_id
      AND islem_tipi = 'Diğer Gelir'
      AND islem_tarihi BETWEEN v_start_date AND (v_end_date + interval '1 day');

    -- Sonuçları JSON olarak döndür
    RETURN json_build_object(
        'sut_geliri', toplam_sut_geliri,
        'sut_maliyeti', toplam_sut_maliyeti,
        'sut_kari', (toplam_sut_geliri - toplam_sut_maliyeti),
        
        'yem_geliri', toplam_yem_geliri,
        'yem_maliyeti', toplam_yem_maliyeti, 
        'yem_kari', (toplam_yem_geliri - toplam_yem_maliyeti),
        
        'diger_gelirler', toplam_diger_gelirler,
        'diger_giderler', (toplam_masraf + toplam_prim),
        
        'toplam_gelir', (toplam_sut_geliri + toplam_yem_geliri + toplam_diger_gelirler),
        'toplam_gider', (toplam_sut_maliyeti + toplam_yem_maliyeti + toplam_masraf + toplam_prim),
        
        'net_kar', (
            (toplam_sut_geliri - toplam_sut_maliyeti) +
            (toplam_yem_geliri - toplam_yem_maliyeti) +
            toplam_diger_gelirler -
            (toplam_masraf + toplam_prim)
        )
    );
END;
$$;