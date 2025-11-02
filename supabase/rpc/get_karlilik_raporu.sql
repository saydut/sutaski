-- dosyası: supabase/rpc/get_karlilik_raporu.sql
-- Belirli bir şirket (p_sirket_id) ve tarih aralığı (p_baslangic_tarihi, p_bitis_tarihi) için
-- şirketin genel kârlılık durumunu hesaplayan RPC fonksiyonu.

CREATE OR REPLACE FUNCTION get_karlilik_raporu(
    p_sirket_id integer,
    p_baslangic_tarihi text, -- 'YYYY-MM-DD' formatında
    p_bitis_tarihi text -- 'YYYY-MM-DD' formatında
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    -- Tarih aralığını 'date' tipine çevirelim
    t_baslangic date := p_baslangic_tarihi::date;
    t_bitis date := p_bitis_tarihi::date;
    
    -- Gelir Kalemleri
    v_toplam_sut_geliri numeric := 0;
    v_toplam_finans_tahsilati numeric := 0; -- Tedarikçilerden alınan tahsilatlar
    
    -- Gider Kalemleri
    v_toplam_yem_gideri numeric := 0;
    v_toplam_finans_odemesi numeric := 0; -- Tedarikçilere yapılan ödeme/avanslar
    v_toplam_genel_masraf numeric := 0; -- Maaş, yakıt, kira vb.
    
    -- Sonuç
    v_toplam_gelir numeric := 0;
    v_toplam_gider numeric := 0;
    v_net_kar numeric := 0;
BEGIN
    
    -- 1. Toplam Süt Geliri (Alacağı)
    --    (sut_girdileri tablosundaki kayıtlara göre)
    SELECT COALESCE(SUM(litre * fiyat), 0)
    INTO v_toplam_sut_geliri
    FROM public.sut_girdileri
    WHERE
        sirket_id = p_sirket_id
        AND taplanma_tarihi BETWEEN t_baslangic AND t_bitis;

    -- 2. Toplam Yem Gideri (Borcu)
    --    (yem_islemleri tablosundaki kayıtlara göre)
    SELECT COALESCE(SUM(toplam_tutar), 0)
    INTO v_toplam_yem_gideri
    FROM public.yem_islemleri
    WHERE
        sirket_id = p_sirket_id
        AND islem_tarihi::date BETWEEN t_baslangic AND t_bitis;

    -- 3. Toplam Finansal Ödemeler (Gider)
    --    (Tedarikçilere yapılan 'Ödeme' ve 'Avans'lar)
    SELECT COALESCE(SUM(tutar), 0)
    INTO v_toplam_finans_odemesi
    FROM public.finansal_islemler
    WHERE
        sirket_id = p_sirket_id
        AND islem_tipi IN ('Ödeme', 'Avans')
        AND islem_tarihi::date BETWEEN t_baslangic AND t_bitis;
        
    -- 4. Toplam Finansal Tahsilatlar (Gelir)
    --    (Tedarikçilerden alınan 'Tahsilat'lar)
    SELECT COALESCE(SUM(tutar), 0)
    INTO v_toplam_finans_tahsilati
    FROM public.finansal_islemler
    WHERE
        sirket_id = p_sirket_id
        AND islem_tipi = 'Tahsilat'
        AND islem_tarihi::date BETWEEN t_baslangic AND t_bitis;

    -- 5. Toplam Genel Masraflar (Gider)
    --    (Yeni 'genel_masraflar' tablosundan)
    SELECT COALESCE(SUM(tutar), 0)
    INTO v_toplam_genel_masraf
    FROM public.genel_masraflar
    WHERE
        sirket_id = p_sirket_id
        AND masraf_tarihi BETWEEN t_baslangic AND t_bitis;

    -- 6. Net Kâr/Zarar Hesaplanması
    v_toplam_gelir := v_toplam_sut_geliri + v_toplam_finans_tahsilati;
    v_toplam_gider := v_toplam_yem_gideri + v_toplam_finans_odemesi + v_toplam_genel_masraf;
    v_net_kar := v_toplam_gelir - v_toplam_gider;

    -- Sonucu JSON olarak döndür
    RETURN json_build_object(
        'toplam_sut_geliri', v_toplam_sut_geliri,
        'toplam_finans_tahsilati', v_toplam_finans_tahsilati,
        'toplam_yem_gideri', v_toplam_yem_gideri,
        'toplam_finans_odemesi', v_toplam_finans_odemesi,
        'toplam_genel_masraf', v_toplam_genel_masraf,
        'toplam_gelir', v_toplam_gelir,
        'toplam_gider', v_toplam_gider,
        'net_kar', v_net_kar
    );
END;
$$;