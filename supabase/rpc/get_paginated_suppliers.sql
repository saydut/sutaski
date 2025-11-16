-- Bu fonksiyon, yavaş olan "tedarikci_ozetleri" view'ının yerini alır.
-- Arama, sıralama ve sayfalama işlemlerini veritabanı seviyesinde verimli bir şekilde yapar.
-- YENİ: Kullanıcı ID ve Rol parametreleri eklenerek rol bazlı filtreleme eklendi.

CREATE OR REPLACE FUNCTION get_paginated_suppliers(
    p_sirket_id integer,
    p_user_id bigint,     -- YENİ: İstek yapan kullanıcının ID'si
    p_user_role text,     -- YENİ: İstek yapan kullanıcının rolü ('toplayici', 'firma_yetkilisi' etc.)
    p_limit integer,
    p_offset integer,
    p_search_term text,
    p_sort_column text,
    p_sort_direction text
)
RETURNS json
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    suppliers_data json;
    total_count integer;
    query_str text;
    where_clause text;
BEGIN
    -- Temel WHERE koşulu: Şirket ID'si ve arama terimi
    where_clause := format(
        'td.sirket_id = %L AND (td.isim ILIKE %L OR td.telefon_no ILIKE %L)',
        p_sirket_id,
        '%' || p_search_term || '%',
        '%' || p_search_term || '%'
    );

    -- YENİ: Eğer kullanıcı toplayıcı ise, WHERE koşuluna ek filtre ekle
    IF p_user_role = 'toplayici' THEN
        where_clause := where_clause || format(
            ' AND td.id IN (SELECT DISTINCT tedarikci_id FROM toplayici_tedarikci_atananlari WHERE toplayici_id = %L)',
            p_user_id
        );
    END IF;

    -- Toplam kayıt sayısını hesapla (filtreleri uygulayarak)
    EXECUTE format('SELECT count(*) FROM tedarikciler td WHERE %s', where_clause)
    INTO total_count;

    -- Sayfalama ve sıralama uygulanmış veriyi çekecek sorguyu oluştur
    IF p_sort_column = 'toplam_litre' THEN
        -- Toplam litreye göre sıralarken tüm tedarikçileri hesaplamak gerekiyor
        query_str := format(
            'SELECT json_agg(t) FROM (
                SELECT
                    td.id, td.isim, td.telefon_no, td.tc_no, td.adres,
                    COALESCE(s.toplam_litre, 0) AS toplam_litre
                FROM tedarikciler td
                LEFT JOIN (
                    SELECT tedarikci_id, SUM(litre) as toplam_litre
                    FROM sut_girdileri
                    WHERE sirket_id = %L
                    GROUP BY tedarikci_id
                ) s ON td.id = s.tedarikci_id
                WHERE %s -- Filtreler burada uygulanıyor
                ORDER BY toplam_litre %s
                LIMIT %L OFFSET %L
            ) t',
            p_sirket_id, -- Bu sadece LEFT JOIN için, filtre için değil
            where_clause, -- Dinamik WHERE koşulu
            p_sort_direction, p_limit, p_offset
        );
    ELSE
        -- Diğer sütunlara göre sıralarken önce sayfala, sonra litre hesapla (daha hızlı)
        query_str := format(
            'WITH paginated_suppliers AS (
                SELECT *
                FROM tedarikciler td
                WHERE %s -- Filtreler burada uygulanıyor
                ORDER BY %I %s
                LIMIT %L OFFSET %L
            )
            SELECT json_agg(t) FROM (
                SELECT
                    ps.id, ps.isim, ps.telefon_no, ps.tc_no, ps.adres,
                    COALESCE(s.toplam_litre, 0) AS toplam_litre
                FROM paginated_suppliers ps
                LEFT JOIN (
                    SELECT tedarikci_id, SUM(litre) as toplam_litre
                    FROM sut_girdileri
                    WHERE sirket_id = %L AND tedarikci_id IN (SELECT id FROM paginated_suppliers)
                    GROUP BY tedarikci_id
                ) s ON ps.id = s.tedarikci_id
                ORDER BY %I %s -- Sıralamayı tekrar uygula
            ) t',
            where_clause, -- Dinamik WHERE koşulu
            p_sort_column, p_sort_direction,
            p_limit, p_offset,
            p_sirket_id, -- Bu LEFT JOIN için
            p_sort_column, p_sort_direction -- Tekrar sıralama
        );
    END IF;

    -- Sorguyu çalıştır
    EXECUTE query_str INTO suppliers_data;

    -- Sonucu döndür
    RETURN json_build_object(
        'data', COALESCE(suppliers_data, '[]'::json),
        'count', total_count
    );
END;
$$;
