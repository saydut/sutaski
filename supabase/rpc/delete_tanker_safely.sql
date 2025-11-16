CREATE OR REPLACE FUNCTION public.delete_tanker_safely(p_tanker_id bigint)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  
  -- 1. Adım: Doğrudan atamaları sil.
  DELETE FROM public.toplayici_tanker_atama
  WHERE tanker_id = p_tanker_id;

  -- 2. Adım: Veri kayıtlarındaki ilişkiyi kopar (SET NULL).
  UPDATE public.sut_girdileri
  SET tanker_id = NULL
  WHERE tanker_id = p_tanker_id;

  UPDATE public.sut_satis_islemleri
  SET tanker_id = NULL
  WHERE tanker_id = p_tanker_id;

  -- 3. Adım: Ana 'tankerler' kaydını sil.
  -- Artık hiçbir tablo bu kayda bağlı değil.
  DELETE FROM public.tankerler
  WHERE id = p_tanker_id;

  RETURN 'Tanker basariyla silindi.';
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'SQL tanker silme hatasi: ' || SQLERRM;
END;
$$;