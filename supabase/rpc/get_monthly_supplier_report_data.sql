CREATE OR REPLACE FUNCTION get_monthly_supplier_report_data(
    p_sirket_id integer,
    p_tedarikci_id integer,
    p_start_date text,
    p_end_date text
)
RETURNS json
LANGUAGE plpgsql
SET search_path = public -- Güvenlik için arama yolunu kısıtla
AS $$
DECLARE
    start_utc timestamptz;
    end_utc timestamptz;
    sut_girdileri_json json;
    yem_islemleri_json json;
    finansal_islemler_json json;
    ozet_json json;
BEGIN
    -- Tarih aralığını UTC'ye çevir (Türkiye saatine göre başlangıç ve bitiş)
    start_utc := (p_start_date::date)::timestamp AT TIME ZONE 'Europe/Istanbul';
    -- Bitiş tarihini bir sonraki günün başlangıcı olarak alıp < operatörüyle kullanacağız
    end_utc := ((p_end_date::date) + interval '1 day')::timestamp AT TIME ZONE 'Europe/Istanbul';

    -- 1. Süt Girdilerini Topla ve Grupla
    SELECT COALESCE(json_agg(t ORDER BY t.tarih_gunu), '[]'::json) INTO sut_girdileri_json
    FROM (
        SELECT
            (sg.taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date AS tarih_gunu,
            to_char((sg.taplanma_tarihi AT TIME ZONE 'Europe/Istanbul')::date, 'DD.MM.YYYY') as tarih, -- Formatlanmış tarih
            sg.fiyat,
            SUM(sg.litre) AS litre,
            SUM(sg.litre * sg.fiyat) AS toplam_tutar -- PDF'te bu isim kullanılıyor, kalsın
        FROM sut_girdileri sg
        WHERE sg.sirket_id = p_sirket_id
          AND sg.tedarikci_id = p_tedarikci_id
          AND sg.taplanma_tarihi >= start_utc AND sg.taplanma_tarihi < end_utc
        GROUP BY tarih_gunu, sg.fiyat
    ) t;

    -- 2. Yem İşlemlerini Topla
    SELECT COALESCE(json_agg(y ORDER BY yi.islem_tarihi), '[]'::json) INTO yem_islemleri_json
    FROM (
        SELECT
            to_char((yi.islem_tarihi AT TIME ZONE 'Europe/Istanbul'), 'DD.MM.YYYY HH24:MI') AS islem_tarihi_formatted, -- Formatlanmış tarih
            yi.islem_tarihi, -- Sıralama için orijinal tarih
            yi.miktar_kg,
            yi.islem_anindaki_birim_fiyat,
            yi.toplam_tutar,
            yu.yem_adi
        FROM yem_islemleri yi
        JOIN yem_urunleri yu ON yi.yem_urun_id = yu.id
        WHERE yi.sirket_id = p_sirket_id
          AND yi.tedarikci_id = p_tedarikci_id
          AND yi.islem_tarihi >= start_utc AND yi.islem_tarihi < end_utc
    ) y;

    -- 3. Finansal İşlemleri Topla
    SELECT COALESCE(json_agg(f ORDER BY fi.islem_tarihi), '[]'::json) INTO finansal_islemler_json
    FROM (
        SELECT
            to_char((fi.islem_tarihi AT TIME ZONE 'Europe/Istanbul'), 'DD.MM.YYYY HH24:MI') AS islem_tarihi_formatted, -- Formatlanmış tarih
            fi.islem_tarihi, -- Sıralama için orijinal tarih
            fi.islem_tipi, fi.tutar, fi.aciklama
        FROM finansal_islemler fi
        WHERE fi.sirket_id = p_sirket_id
          AND fi.tedarikci_id = p_tedarikci_id
          AND fi.islem_tarihi >= start_utc AND fi.islem_tarihi < end_utc
    ) f;

    -- 4. Özeti Hesapla (Güncellenmiş Mantıkla)
    SELECT json_build_object(
        'toplam_sut_tutari', COALESCE((SELECT SUM((j->>'toplam_tutar')::numeric) FROM json_array_elements(sut_girdileri_json) j), 0),
        'toplam_yem_borcu', COALESCE((SELECT SUM((j->>'toplam_tutar')::numeric) FROM json_array_elements(yem_islemleri_json) j), 0),
        -- Şirketten Çiftçiye Gidenler (Ödeme + Avans)
        'toplam_sirket_odemesi', COALESCE((SELECT SUM((j->>'tutar')::numeric)
                                           FROM json_array_elements(finansal_islemler_json) j
                                           WHERE j->>'islem_tipi' IN ('Ödeme', 'Avans')), 0),
        -- Çiftçiden Şirkete Gelenler (Tahsilat)
        'toplam_tahsilat', COALESCE((SELECT SUM((j->>'tutar')::numeric)
                                     FROM json_array_elements(finansal_islemler_json) j
                                     WHERE j->>'islem_tipi' = 'Tahsilat'), 0)
        -- Net Bakiye burada hesaplanmıyor, PDF servislerinde hesaplanacak
    ) INTO ozet_json;

    -- 5. Tüm verileri birleştirip döndür
    RETURN json_build_object(
        'sut_girdileri', sut_girdileri_json,
        'yem_islemleri', yem_islemleri_json,
        'finansal_islemler', finansal_islemler_json,
        'ozet', ozet_json
    );
END;
$$;
