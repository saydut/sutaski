-- dosyası: supabase/rpc/get_sut_fiyati_for_date.sql
-- Belirli bir şirket (p_sirket_id) ve tarih (p_target_date) için
-- geçerli olan süt fiyatını 'sut_fiyat_tarifesi' tablosundan bulan fonksiyon.

CREATE OR REPLACE FUNCTION get_sut_fiyati_for_date(
    p_sirket_id integer,
    p_target_date text -- 'YYYY-MM-DD' formatında bir tarih
)
RETURNS json
LANGUAGE plpgsql
-- Güvenlik, kod katmanında (decorators.py) halledildiği için SECURITY INVOKER kullanıyoruz
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    target_fiyat numeric;
    target_date_real date;
BEGIN
    -- Gelen 'YYYY-MM-DD' metnini 'date' tipine çevirelim
    target_date_real := p_target_date::date;

    -- Fiyatı bulmak için sorgu
    SELECT fiyat
    INTO target_fiyat -- Bulunan fiyatı değişkene ata
    FROM
        public.sut_fiyat_tarifesi
    WHERE
        sirket_id = p_sirket_id
        AND baslangic_tarihi <= target_date_real -- Fiyatın başlangıç tarihi, aradığımız tarihten önce veya o gün olmalı
        AND (
            bitis_tarihi >= target_date_real -- Fiyatın bitiş tarihi, aradığımız tarihten sonra veya o gün olmalı
            OR
            bitis_tarihi IS NULL -- VEYA bitiş tarihi hiç belirlenmemişse (bu fiyat hala geçerli demektir)
        )
    ORDER BY
        baslangic_tarihi DESC -- Eğer birden fazla kural eşleşirse (örn. 1 Ocak'ta 10 TL, 15 Ocak'ta 11 TL ise ve biz 20'sini arıyorsak),
                              -- başlangıç tarihi en yakın olanı (15 Ocak) al.
    LIMIT 1; -- Sadece 1 tane (en uygun) fiyatı al

    -- Sonucu { "fiyat": 15.50 } veya { "fiyat": null } formatında JSON olarak döndür
    RETURN json_build_object('fiyat', target_fiyat);
END;
$$;