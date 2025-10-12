-- Bu fonksiyon, yavaş olan "tedarikci_ozetleri" view'ının yerini alır.
-- Arama, sıralama ve sayfalama işlemlerini veritabanı seviyesinde verimli bir şekilde yapar.

CREATE OR REPLACE FUNCTION get_paginated_suppliers(
    p_sirket_id integer,
    p_limit integer,
    p_offset integer,
    p_search_term text,
    p_sort_column text,
    p_sort_direction text
)
RETURNS json 
LANGUAGE plpgsql
-- GÜVENLİK GÜNCELLEMESİ: Arama yolunu sadece 'public' şeması ile kısıtlar.
SET search_path = public
AS $$
DECLARE
    suppliers_data json;
    total_count integer;
    query_str text;
BEGIN
    -- İlk olarak, arama kriterine uyan toplam tedarikçi sayısını buluyoruz.
    -- Bu, sayfalama (pagination) için gereklidir.
    EXECUTE format(
        'SELECT count(*) FROM tedarikciler WHERE sirket_id = %L AND (isim ILIKE %L OR telefon_no ILIKE %L)',
        p_sirket_id,
        '%' || p_search_term || '%',
        '%' || p_search_term || '%'
    ) INTO total_count;

    -- Şimdi, sayfalama ve sıralama uygulanmış veriyi çekecek sorguyu oluşturuyoruz.
    -- Eğer kullanıcı "toplam_litre" sütununa göre sıralama yapmak isterse,
    -- tüm tedarikçiler için bu hesaplamayı yapıp sonra sıralamak zorundayız. Bu daha yavaştır.
    IF p_sort_column = 'toplam_litre' THEN
        query_str := format(
            'SELECT json_agg(t) FROM (
                SELECT
                    td.id,
                    td.isim,
                    td.telefon_no,
                    td.tc_no,
                    td.adres,
                    COALESCE(s.toplam_litre, 0) AS toplam_litre
                FROM tedarikciler td
                LEFT JOIN (
                    SELECT tedarikci_id, SUM(litre) as toplam_litre
                    FROM sut_girdileri
                    WHERE sirket_id = %L
                    GROUP BY tedarikci_id
                ) s ON td.id = s.tedarikci_id
                WHERE td.sirket_id = %L AND (td.isim ILIKE %L OR td.telefon_no ILIKE %L)
                ORDER BY toplam_litre %s
                LIMIT %L OFFSET %L
            ) t',
            p_sirket_id,
            p_sirket_id,
            '%' || p_search_term || '%',
            '%' || p_search_term || '%',
            p_sort_direction,
            p_limit,
            p_offset
        );
    ELSE
        -- Eğer isim, telefon gibi bir alana göre sıralama yapılıyorsa, önce tedarikçileri sayfalayıp
        -- SONRA sadece o sayfadaki tedarikçiler için süt toplamını hesaplarız. Bu çok daha hızlıdır.
        query_str := format(
            'WITH paginated_suppliers AS (
                SELECT *
                FROM tedarikciler
                WHERE sirket_id = %L AND (isim ILIKE %L OR telefon_no ILIKE %L)
                ORDER BY %I %s
                LIMIT %L OFFSET %L
            )
            SELECT json_agg(t) FROM (
                SELECT
                    ps.id,
                    ps.isim,
                    ps.telefon_no,
                    ps.tc_no,
                    ps.adres,
                    COALESCE(s.toplam_litre, 0) AS toplam_litre
                FROM paginated_suppliers ps
                LEFT JOIN (
                    SELECT tedarikci_id, SUM(litre) as toplam_litre
                    FROM sut_girdileri
                    WHERE sirket_id = %L AND tedarikci_id IN (SELECT id FROM paginated_suppliers)
                    GROUP BY tedarikci_id
                ) s ON ps.id = s.tedarikci_id
                ORDER BY %I %s
            ) t',
            p_sirket_id,
            '%' || p_search_term || '%',
            '%' || p_search_term || '%',
            p_sort_column, p_sort_direction,
            p_limit, p_offset,
            p_sirket_id,
            p_sort_column, p_sort_direction
        );
    END IF;

    EXECUTE query_str INTO suppliers_data;

    -- Hem veri listesini hem de toplam kayıt sayısını tek bir JSON nesnesinde birleştirip döndürüyoruz.
    RETURN json_build_object(
        'data', COALESCE(suppliers_data, '[]'::json),
        'count', total_count
    );
END;
$$;
