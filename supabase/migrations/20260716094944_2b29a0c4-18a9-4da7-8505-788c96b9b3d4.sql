CREATE OR REPLACE FUNCTION public.submit_shop_application(_data jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ref text;
BEGIN
  INSERT INTO public.shop_applications (
    contact_first_name, contact_last_name, contact_email, contact_phone,
    commercial_name, legal_name, legal_form, siren, siret, vat_number,
    address, postal_code, city, website, description,
    establishments_count, employees_count, main_services, message, consent_contact
  ) VALUES (
    _data->>'contact_first_name', _data->>'contact_last_name',
    _data->>'contact_email', _data->>'contact_phone',
    _data->>'commercial_name', _data->>'legal_name', _data->>'legal_form',
    _data->>'siren', _data->>'siret', _data->>'vat_number',
    _data->>'address', _data->>'postal_code', _data->>'city',
    _data->>'website', _data->>'description',
    NULLIF(_data->>'establishments_count','')::int,
    NULLIF(_data->>'employees_count','')::int,
    _data->>'main_services', _data->>'message',
    COALESCE((_data->>'consent_contact')::boolean, false)
  )
  RETURNING reference INTO v_ref;
  RETURN v_ref;
END $$;

REVOKE ALL ON FUNCTION public.submit_shop_application(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_shop_application(jsonb) TO anon, authenticated;