-- supabase/rpc/get_monthly_supplier_report_data.sql DOSYASININ DÜZELTİLMİŞ NİHAİ İÇERİĞİ

CREATE OR REPLACE FUNCTION get_monthly_supplier_report_data(
    p_sirket_id integer,
    p_tedarikci_id integer,
    p_start_date text,
    p_end_date text
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    start_utc timestamptz;
    end_utc timestamptz;
    sut_girdileri_json json;
    yem_islemleri_json json;
    finansal_islemler_json json;
    ozet_json json;
BEGIN
    -- Tarih aralığını Türkiye saatine göre doğru ve kesin bir şekilde belirleyelim
    start_utc := (p_start_date::date)::timestamp AT TIME ZONE 'Europe/Istanbul';
    end_utc := ((p_end_date::date) + interval '1 day')::timestamp AT TIME ZONE 'Europe/Istanbul';

    -- 1. Süt Girdilerini Gruplayarak ve Tarihi Formatlayarak Çek (DÜZELTİLMİŞ SORGU)
    SELECT COALESCE(json_agg(t), '[]'::json) INTO sut_girdileri_json
    FROM (
        SELECT
            to_char(g.tarih_gunu, 'DD.MM.YYYY') as tarih,
            g.fiyat,
            g.litre,
            g.toplam_tutar,
            g.tutar -- Müstahsil şablonu için de ekleyelim
        FROM (
            SELECT
                (sg.taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date AS tarih_gunu,
                sg.fiyat,
                SUM(sg.litre) AS litre,
                SUM(sg.litre * sg.fiyat) AS toplam_tutar,
                SUM(sg.litre * sg.fiyat) AS tutar
            FROM sut_girdileri sg
            WHERE sg.sirket_id = p_sirket_id
              AND sg.tedarikci_id = p_tedarikci_id
              AND sg.taplanma_tarihi >= start_utc AND sg.taplanma_tarihi < end_utc
            GROUP BY tarih_gunu, sg.fiyat
        ) g
        ORDER BY g.tarih_gunu
    ) t;

    -- 2. Yem İşlemlerini Çek (Tarihi formatlayarak)
    SELECT COALESCE(json_agg(y), '[]'::json) INTO yem_islemleri_json
    FROM (
        SELECT
            to_char((yi.islem_tarihi AT TIME ZONE 'Europe/Istanbul'), 'DD.MM.YYYY HH24:MI') AS islem_tarihi,
            yi.miktar_kg,
            yi.islem_anindaki_birim_fiyat,
            yi.toplam_tutar,
            -- DİKKAT: Yem ürünleri tablosunda isim "yem_adi" olarak geçiyor
            yu.yem_adi
        FROM yem_islemleri yi
        -- DİKKAT: Tablo adı "yem_urunleri" olmalı
        JOIN yem_urunleri yu ON yi.yem_urun_id = yu.id
        WHERE yi.sirket_id = p_sirket_id
          AND yi.tedarikci_id = p_tedarikci_id
          AND yi.islem_tarihi >= start_utc AND yi.islem_tarihi < end_utc
        ORDER BY yi.islem_tarihi
    ) y;

    -- 3. Finansal İşlemleri Çek (Tarihi formatlayarak)
    SELECT COALESCE(json_agg(f), '[]'::json) INTO finansal_islemler_json
    FROM (
        SELECT 
            to_char((fi.islem_tarihi AT TIME ZONE 'Europe/Istanbul'), 'DD.MM.YYYY HH24:MI') AS islem_tarihi, 
            fi.islem_tipi, fi.tutar, fi.aciklama
        FROM finansal_islemler fi
        WHERE fi.sirket_id = p_sirket_id
          AND fi.tedarikci_id = p_tedarikci_id
          AND fi.islem_tarihi >= start_utc AND fi.islem_tarihi < end_utc
        ORDER BY fi.islem_tarihi
    ) f;

    -- 4. Özet Toplamları Hesapla
    SELECT json_build_object(
        'toplam_sut_tutari', COALESCE((SELECT SUM((j->>'toplam_tutar')::numeric) FROM json_array_elements(sut_girdileri_json) j), 0),
        'toplam_yem_borcu', COALESCE((SELECT SUM((j->>'toplam_tutar')::numeric) FROM json_array_elements(yem_islemleri_json) j), 0),
        'toplam_odeme', COALESCE((SELECT SUM((j->>'tutar')::numeric) FROM json_array_elements(finansal_islemler_json) j), 0)
    ) INTO ozet_json;

    -- 5. Tüm Sonuçları Tek Bir JSON olarak Döndür
    RETURN json_build_object(
        'sut_girdileri', sut_girdileri_json,
        'yem_islemleri', yem_islemleri_json,
        'finansal_islemler', finansal_islemler_json,
        'ozet', ozet_json
    );
END;
$$;