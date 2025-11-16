-- dosyası: supabase/migrations/011_create_finans_listeleme_rpc.sql
-- Performans: Finansal işlem listeleme (sayfalama, rol, tarih ve tip filtreleme)
-- mantığını Python'dan veritabanına taşır.

CREATE OR REPLACE FUNCTION get_paginated_finansal_islemleri(
    p_sirket_id integer,
    p_kullanici_id bigint,
    p_rol text,
    p_tarih_str text, -- 'YYYY-MM-DD' formatında veya NULL
    p_tip text,       -- İşlem tipi (örn: 'Ödeme') veya NULL
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
    where_clause := format('fi.sirket_id = %L', p_sirket_id);

    -- 2. Role göre filtrele (TOPLAYICI)
    IF p_rol = 'toplayici' THEN
        where_clause := where_clause || format(' AND fi.kullanici_id = %L', p_kullanici_id);
    END IF;

    -- 3. Tarihe göre filtrele (sut_service'teki mantığın aynısı)
    IF p_tarih_str IS NOT NULL AND p_tarih_str != '' THEN
        DECLARE
            start_utc timestamptz;
            end_utc timestamptz;
        BEGIN
            start_utc := (p_tarih_str::date)::timestamp AT TIME ZONE 'Europe/Istanbul';
            end_utc := start_utc + interval '1 day';
            
            where_clause := where_clause || format(
                ' AND fi.islem_tarihi >= %L AND fi.islem_tarihi < %L',
                start_utc,
                end_utc
            );
        EXCEPTION WHEN others THEN
            -- Hatalı tarih formatı gelirse görmezden gel
        END;
    END IF;

    -- 4. İşlem tipine göre filtrele
    IF p_tip IS NOT NULL AND p_tip != '' THEN
        where_clause := where_clause || format(' AND fi.islem_tipi = %L', p_tip);
    END IF;

    -- 5. Toplam kayıt sayısını (filtreli) hesapla
    EXECUTE format('SELECT COUNT(fi.id) FROM finansal_islemler fi WHERE %s', where_clause)
    INTO total_count;

    -- 6. Sayfalanmış veriyi çek (JOIN'ler ile birlikte)
    query_str := format(
        'SELECT COALESCE(json_agg(t.*), ''[]''::json)
         FROM (
            SELECT
                fi.id, fi.islem_tarihi, fi.islem_tipi, fi.tutar,
                fi.aciklama, fi.kullanici_id, fi.tedarikci_id,
                t.isim AS tedarikci_isim,
                k.kullanici_adi AS kullanici_adi
            FROM finansal_islemler fi
            LEFT JOIN tedarikciler t ON fi.tedarikci_id = t.id
            LEFT JOIN kullanicilar k ON fi.kullanici_id = k.id
            WHERE %s -- Tüm filtreler buraya gelir
            ORDER BY fi.islem_tarihi DESC
            LIMIT %L OFFSET %L
         ) t',
        where_clause,
        p_limit,
        p_offset
    );

    EXECUTE query_str INTO islemler_data;

    -- 7. Sonucu tek JSON olarak döndür
    RETURN json_build_object(
        'data', islemler_data,
        'count', total_count
    );
END;
$$;