CREATE OR REPLACE FUNCTION public.submit_shop_application(_data jsonb)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_ref text;
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(_data->>'contact_email',''));
  v_existing uuid;
  v_biz public.business_type := COALESCE(NULLIF(_data->>'business_type','')::public.business_type, 'physical_shop'::public.business_type);
  v_addr text := coalesce(_data->>'address','');
  v_pc text := coalesce(_data->>'postal_code','');
  v_city text := coalesce(_data->>'city','');
  v_cities_len int := CASE WHEN _data ? 'covered_cities' AND jsonb_typeof(_data->'covered_cities') = 'array'
                           THEN jsonb_array_length(_data->'covered_cities') ELSE 0 END;
  v_radius int := NULLIF(_data->>'service_radius_km','')::int;
  v_estab int := NULLIF(_data->>'establishments_count','')::int;
  v_insur text := coalesce(_data->>'insurance_provider','');
BEGIN
  -- Champs communs
  IF coalesce(_data->>'contact_first_name','')='' OR coalesce(_data->>'contact_last_name','')=''
     OR v_email='' OR coalesce(_data->>'contact_phone','')='' OR coalesce(_data->>'commercial_name','')='' THEN
    RAISE EXCEPTION 'Champs requis manquants (identité contact / nom commercial).' USING ERRCODE = 'check_violation';
  END IF;
  IF COALESCE((_data->>'consent_contact')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Le consentement de contact est requis.' USING ERRCODE = 'check_violation';
  END IF;

  -- Validations par type
  IF v_biz IN ('physical_shop','hybrid_business','multi_location_network') THEN
    IF v_addr='' OR v_pc='' OR v_city='' THEN
      RAISE EXCEPTION 'Adresse de la boutique requise (adresse, code postal, ville).' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF v_biz='mobile_independent' THEN
    IF v_addr='' OR v_pc='' OR v_city='' THEN
      RAISE EXCEPTION 'Adresse administrative requise (privée, non publiée).' USING ERRCODE = 'check_violation';
    END IF;
    IF v_cities_len = 0 AND (v_radius IS NULL OR v_radius <= 0) THEN
      RAISE EXCEPTION 'Indiquez au moins une ville couverte ou un rayon d''intervention.' USING ERRCODE = 'check_violation';
    END IF;
    IF v_insur='' THEN
      RAISE EXCEPTION 'Assureur professionnel requis pour un indépendant.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF v_biz='hybrid_business' THEN
    IF v_cities_len = 0 AND (v_radius IS NULL OR v_radius <= 0) THEN
      RAISE EXCEPTION 'Indiquez la zone d''intervention (villes ou rayon).' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF v_biz='multi_location_network' THEN
    IF v_estab IS NULL OR v_estab < 2 THEN
      RAISE EXCEPTION 'Un réseau doit compter au moins 2 établissements.' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Anti-doublon : refuser une nouvelle candidature si une non-terminale existe déjà
  SELECT id INTO v_existing
    FROM public.shop_applications
   WHERE lower(contact_email) = v_email
     AND status NOT IN ('refusee','archivee','acces_active')
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Une candidature est déjà en cours pour cet email (référence existante).'
      USING ERRCODE = 'unique_violation';
  END IF;

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
    users_count,
    linked_user_id
  ) VALUES (
    _data->>'contact_first_name', _data->>'contact_last_name',
    _data->>'contact_email', _data->>'contact_phone',
    _data->>'commercial_name', _data->>'legal_name', _data->>'legal_form',
    _data->>'siren', _data->>'siret', _data->>'vat_number',
    v_addr, v_pc, v_city,
    _data->>'website', _data->>'description',
    v_estab,
    NULLIF(_data->>'employees_count','')::int,
    _data->>'main_services', _data->>'message',
    true,
    v_biz,
    CASE WHEN _data ? 'covered_cities' AND jsonb_typeof(_data->'covered_cities') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(_data->'covered_cities')) ELSE '{}'::text[] END,
    CASE WHEN _data ? 'covered_postal_codes' AND jsonb_typeof(_data->'covered_postal_codes') = 'array'
      THEN ARRAY(SELECT jsonb_array_elements_text(_data->'covered_postal_codes')) ELSE '{}'::text[] END,
    v_radius,
    _data->>'travel_fee_policy',
    NULLIF(_data->>'travel_fee_amount_cents','')::int,
    v_insur,
    _data->>'insurance_policy_number',
    NULLIF(_data->>'professional_experience_years','')::int,
    COALESCE((_data->>'wants_partnerships')::boolean, false),
    COALESCE((_data->>'wants_subcontracting')::boolean, false),
    COALESCE((_data->>'wants_maintenance_contracts')::boolean, false),
    NULLIF(_data->>'users_count','')::int,
    v_uid
  )
  RETURNING reference INTO v_ref;
  RETURN v_ref;
END
$function$;