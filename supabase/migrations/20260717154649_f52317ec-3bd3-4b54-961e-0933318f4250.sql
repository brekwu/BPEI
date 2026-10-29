CREATE OR REPLACE FUNCTION public.submit_shop_application(_data jsonb)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ref text;
BEGIN
  INSERT INTO public.shop_applications (
    contact_first_name, contact_last_name, contact_email, contact_phone,
    commercial_name, legal_name, legal_form, siren, siret, vat_number,
    address, postal_code, city, website, description,
    establishments_count, employees_count, main_services, message, consent_contact,
    business_type,
    covered_cities, covered_postal_codes, service_radius_km,
    travel_fee_policy, travel_fee_amount_cents,
    insurance_provider, insurance_policy_number,
    professional_experience_years,
    wants_partnerships, wants_subcontracting, wants_maintenance_contracts,
    users_count
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
    COALESCE((_data->>'consent_contact')::boolean, false),
    COALESCE(NULLIF(_data->>'business_type','')::public.business_type, 'physical_shop'::public.business_type),
    CASE WHEN _data ? 'covered_cities' AND jsonb_typeof(_data->'covered_cities') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(_data->'covered_cities')) ELSE '{}'::text[] END,
    CASE WHEN _data ? 'covered_postal_codes' AND jsonb_typeof(_data->'covered_postal_codes') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(_data->'covered_postal_codes')) ELSE '{}'::text[] END,
    NULLIF(_data->>'service_radius_km','')::int,
    _data->>'travel_fee_policy',
    NULLIF(_data->>'travel_fee_amount_cents','')::int,
    _data->>'insurance_provider',
    _data->>'insurance_policy_number',
    NULLIF(_data->>'professional_experience_years','')::int,
    COALESCE((_data->>'wants_partnerships')::boolean, false),
    COALESCE((_data->>'wants_subcontracting')::boolean, false),
    COALESCE((_data->>'wants_maintenance_contracts')::boolean, false),
    NULLIF(_data->>'users_count','')::int
  )
  RETURNING reference INTO v_ref;
  RETURN v_ref;
END
$$;