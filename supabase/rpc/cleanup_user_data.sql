CREATE OR REPLACE FUNCTION public.cleanup_user_data(p_auth_user_id uuid)
RETURNS text
LANGUAGE plpgsql
-- BU ÇOK ÖNEMLİ: 'security definer' olmak yerine,
-- bu fonksiyonu çağıran Python servisinin (admin) yetkilerine güvenir.
SECURITY INVOKER
AS $$
DECLARE
  v_kullanici_id_bigint bigint;
BEGIN
  -- 1. Adım: Verilen UUID'ye karşılık gelen BIGINT (numeric) ID'yi bulun.
  -- Tüm veri tablolarınız (sut_girdileri vb.) bu BIGINT ID'yi kullanıyor.
  SELECT id INTO v_kullanici_id_bigint
  FROM public.kullanicilar
  WHERE user_id = p_auth_user_id;

  -- Eğer bir ID bulunamazsa, hata vermeden işlemi bitir.
  IF v_kullanici_id_bigint IS NULL THEN
    RETURN 'Kullanici (bigint) bulunamadi, ancak devam ediliyor.';
  END IF;

  -- 2. Adım: Doğrudan atamaları sil (SET NULL anlamsızdır).
  -- Bu kayıtlar veri değil, sadece ilişki tutar.
  DELETE FROM public.toplayici_tedarikci_atananlari
  WHERE toplayici_id = v_kullanici_id_bigint;

  DELETE FROM public.toplayici_tanker_atama
  WHERE toplayici_user_id = v_kullanici_id_bigint;

  -- 3. Adım: Veri kayıtlarındaki ilişkiyi kopar (SET NULL).
  -- Bu sayede eski raporlar bozulmaz, veri kaybı yaşanmaz.
  UPDATE public.sut_girdileri
  SET kullanici_id = NULL
  WHERE kullanici_id = v_kullanici_id_bigint;

  UPDATE public.yem_kayitlari
  SET kullanici_id = NULL
  WHERE kullanici_id = v_kullanici_id_bigint;

  UPDATE public.finansal_islemler
  SET kullanici_id = NULL
  WHERE kullanici_id = v_kullanici_id_bigint;
  
  UPDATE public.genel_masraflar
  SET kullanici_id = NULL
  WHERE kullanici_id = v_kullanici_id_bigint;

  -- 4. Adım: 'kullanicilar' (BIGINT) tablosundan ana kaydı sil.
  -- Artık hiçbir tablo bu kayda bağlı değil.
  DELETE FROM public.kullanicilar
  WHERE id = v_kullanici_id_bigint;

  RETURN 'Kullanici verileri basariyla temizlendi.';
  
EXCEPTION
  WHEN OTHERS THEN
    -- Bir hata olursa, hatayı döndür ve işlemi durdur (Python'da yakalanacak)
    RETURN 'SQL cleanup hatasi: ' || SQLERRM;
END;
$$;