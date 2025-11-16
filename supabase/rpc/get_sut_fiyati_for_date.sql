-- Fonksiyonu, 'alis_fiyati' sütununu 'fiyat' olarak adlandırarak döndürecek şekilde güncelliyoruz.
-- Bu, Python kodunun (ve ana panelin) 'fiyat' alanını beklemesiyle uyumludur.

CREATE OR REPLACE FUNCTION public.get_sut_fiyati_for_date(p_sirket_id integer, p_target_date date)
 RETURNS TABLE(fiyat numeric) -- Dönen sütun adını 'fiyat' olarak bırakıyoruz
 LANGUAGE sql
AS $function$
  select 
    sft.alis_fiyati as fiyat -- Gerçek sütun 'alis_fiyati', ancak 'fiyat' olarak adlandırılıyor
  from sut_fiyat_tarifesi sft
  where sft.sirket_id = p_sirket_id
    and p_target_date >= sft.baslangic_tarihi
    and (p_target_date <= sft.bitis_tarihi or sft.bitis_tarihi is null)
  order by sft.baslangic_tarihi desc
  limit 1;
$function$;