-- dosyası: supabase/migrations/010_create_yem_listeleme_rpc.sql
-- Performans: Yem işlemi listeleme (sayfalama ve rol kontrolü)
-- mantığını Python'dan veritabanına taşır.

CREATE OR REPLACE FUNCTION get_paginated_yem_islemleri(
    p_sirket_id integer,
    p_kullanici_id bigint,
    p_rol text,
    p_limit integer,
    p_offset integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    islemler_data json;
    total_count integer;
    query_str text;
    where_clause text;
BEGIN
    -- 1. Temel WHERE koşulu
    where_clause := format('yi.sirket_id = %L', p_sirket_id);

    -- 2. Role göre filtrele (TOPLAYICI)
    IF p_rol = 'toplayici' THEN
        where_clause := where_clause || format(' AND yi.kullanici_id = %L', p_kullanici_id);
    END IF;

    -- 3. Toplam kayıt sayısını (filtreli) hesapla
    EXECUTE format('SELECT COUNT(yi.id) FROM yem_islemleri yi WHERE %s', where_clause)
    INTO total_count;

    -- 4. Sayfalanmış veriyi çek (JOIN'ler ile birlikte)
    query_str := format(
        'SELECT COALESCE(json_agg(t.*), ''[]''::json)
         FROM (
            SELECT
                yi.id, yi.islem_tarihi, yi.miktar_kg, yi.islem_anindaki_birim_fiyat,
                yi.toplam_tutar, yi.aciklama,
                t.isim AS tedarikci_isim,
                yu.yem_adi AS yem_adi
            FROM yem_islemleri yi
            LEFT JOIN tedarikciler t ON yi.tedarikci_id = t.id
            LEFT JOIN yem_urunleri yu ON yi.yem_urun_id = yu.id
            WHERE %s -- Filtreler buraya gelir
            ORDER BY yi.islem_tarihi DESC
            LIMIT %L OFFSET %L
         ) t',
        where_clause,
        p_limit,
        p_offset
    );

    EXECUTE query_str INTO islemler_data;

    -- 5. Sonucu tek JSON olarak döndür
    RETURN json_build_object(
        'data', islemler_data,
        'count', total_count
    );
END;
$$;