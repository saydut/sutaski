-- dosyası: supabase/migrations/009_create_sut_listeleme_rpc.sql
-- Performans: Süt girdisi listeleme (sayfalama, filtreleme ve rol kontrolü)
-- mantığını Python'dan veritabanına taşır.

CREATE OR REPLACE FUNCTION get_paginated_sut_girdileri(
    p_sirket_id integer,
    p_kullanici_id bigint,
    p_rol text,
    p_tarih_str text, -- 'YYYY-MM-DD' formatında veya NULL
    p_limit integer,
    p_offset integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    girdiler_data json;
    total_count integer;
    query_str text;
    where_clause text;
BEGIN
    -- 1. Temel WHERE koşulunu oluştur
    where_clause := format('sg.sirket_id = %L', p_sirket_id);

    -- 2. Role göre filtrele (TOPLAYICI)
    IF p_rol = 'toplayici' THEN
        where_clause := where_clause || format(' AND sg.kullanici_id = %L', p_kullanici_id);
    END IF;

    -- 3. Tarihe göre filtrele
    IF p_tarih_str IS NOT NULL AND p_tarih_str != '' THEN
        -- Python'daki UTC dönüşüm mantığının aynısı
        DECLARE
            start_utc timestamptz;
            end_utc timestamptz;
        BEGIN
            start_utc := (p_tarih_str::date)::timestamp AT TIME ZONE 'Europe/Istanbul';
            end_utc := start_utc + interval '1 day';
            
            where_clause := where_clause || format(
                ' AND sg.taplanma_tarihi >= %L AND sg.taplanma_tarihi < %L',
                start_utc,
                end_utc
            );
        EXCEPTION WHEN others THEN
            -- Hatalı tarih formatı gelirse görmezden gel
        END;
    END IF;

    -- 4. Toplam kayıt sayısını (filtreli) hesapla
    EXECUTE format('SELECT COUNT(sg.id) FROM sut_girdileri sg WHERE %s', where_clause)
    INTO total_count;

    -- 5. Sayfalanmış veriyi çek
    query_str := format(
        'SELECT COALESCE(json_agg(t.*), ''[]''::json)
         FROM (
            SELECT
                sg.id, sg.litre, sg.fiyat, sg.taplanma_tarihi, 
                sg.duzenlendi_mi, sg.kullanici_id,
                k.kullanici_adi,
                t.isim AS tedarikci_isim
            FROM sut_girdileri sg
            LEFT JOIN kullanicilar k ON sg.kullanici_id = k.id
            LEFT JOIN tedarikciler t ON sg.tedarikci_id = t.id
            WHERE %s -- Filtreler buraya gelir
            ORDER BY sg.id DESC
            LIMIT %L OFFSET %L
         ) t',
        where_clause,
        p_limit,
        p_offset
    );

    EXECUTE query_str INTO girdiler_data;

    -- 6. Sonucu tek JSON olarak döndür
    RETURN json_build_object(
        'data', girdiler_data,
        'count', total_count
    );
END;
$$;