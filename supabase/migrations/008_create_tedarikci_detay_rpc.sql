-- dosyası: supabase/migrations/008_create_tedarikci_detay_rpc.sql
-- Tedarikçi detay sayfasının ilk yüklemesini hızlandırmak için
-- özet verisini ve süt girdilerinin ilk sayfasını tek bir çağrıda birleştirir.

CREATE OR REPLACE FUNCTION get_tedarikci_detay_page_data(
    p_sirket_id integer,
    p_tedarikci_id integer,
    p_limit integer,
    p_offset integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    ozet_data json;
    girdiler_data json;
    toplam_kayit integer;
BEGIN
    -- 1. Özet verisini almak için mevcut RPC'nizi (get_supplier_summary) çağırın
    SELECT get_supplier_summary(p_sirket_id, p_tedarikci_id)
    INTO ozet_data;

    -- 2. Süt girdilerinin ilk sayfasını alın (paged_data_service.get_sut_girdileri'deki mantık)
    SELECT COALESCE(json_agg(sg.*), '[]'::json), COUNT(sg.id)
    INTO girdiler_data, toplam_kayit
    FROM (
        SELECT
            sut_girdileri.id,
            sut_girdileri.taplanma_tarihi,
            sut_girdileri.litre,
            sut_girdileri.fiyat,
            kullanicilar.kullanici_adi
        FROM sut_girdileri
        LEFT JOIN kullanicilar ON sut_girdileri.kullanici_id = kullanicilar.id
        WHERE sut_girdileri.sirket_id = p_sirket_id
          AND sut_girdileri.tedarikci_id = p_tedarikci_id
        ORDER BY sut_girdileri.taplanma_tarihi DESC
        LIMIT p_limit OFFSET p_offset
    ) sg;

    -- 3. Tüm verileri tek bir JSON nesnesinde birleştirip döndürün
    RETURN json_build_object(
        'ozet', ozet_data,
        'girdiler', girdiler_data,
        'toplam_kayit', toplam_kayit
    );
END;
$$;