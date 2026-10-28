CREATE OR REPLACE FUNCTION public.owner_validate_application(
  _application_id uuid,
  _activate_beta boolean DEFAULT true,
  _public_name text DEFAULT NULL,
  _internal_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_app public.shop_applications;
  v_shop_id uuid;
  v_token text;
  v_owner uuid := auth.uid();
  v_beta_end timestamptz := timestamptz '2026-08-31 23:59:59+02';
  v_modules text[] := ARRAY['dashboard','clients','devices','repairs','appointments','quotes','invoices','credit_notes','payments','services','catalog','stock','quarantine','suppliers','purchase_orders','restock','orders','messaging','portal','public_page','reviews','team','search'];
  m text;
BEGIN
  IF NOT public.is_owner_bpei(v_owner) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_app FROM public.shop_applications WHERE id = _application_id FOR UPDATE;
  IF v_app IS NULL THEN RAISE EXCEPTION 'application not found'; END IF;
  IF v_app.status IN ('acces_active','archivee') THEN RAISE EXCEPTION 'application already processed'; END IF;

  INSERT INTO public.shops (owner_user_id, name, legal_name, legal_form, siren, siret, vat_number,
    address, city, postal_code, phone, email, website, description,
    status, public_name, internal_name, public_status)
  VALUES (v_owner, v_app.commercial_name, v_app.legal_name, v_app.legal_form, v_app.siren, v_app.siret, v_app.vat_number,
    v_app.address, v_app.city, v_app.postal_code, v_app.contact_phone, v_app.contact_email, v_app.website, v_app.description,
    'validated', COALESCE(_public_name, v_app.commercial_name), COALESCE(_internal_name, v_app.commercial_name), 'draft')
  RETURNING id INTO v_shop_id;
  UPDATE public.shops SET validated_at = now() WHERE id = v_shop_id;

  IF _activate_beta THEN
    INSERT INTO public.shop_subscriptions (shop_id, plan, status, price_cents_current, price_cents_future,
      started_at, ends_at, auto_renew, origin, activated_by, note)
    VALUES (v_shop_id, 'pro', 'trial', 0, 15000, now(), v_beta_end, false, 'owner_beta_activation', v_owner, 'Bêta Pro gratuite');
    FOREACH m IN ARRAY v_modules LOOP
      INSERT INTO public.shop_enabled_modules (shop_id, module_key, enabled, updated_by)
      VALUES (v_shop_id, m, true, v_owner) ON CONFLICT (shop_id, module_key) DO NOTHING;
    END LOOP;
    INSERT INTO public.shop_subscription_history (shop_id, actor_user_id, action, new_state, note)
    VALUES (v_shop_id, v_owner, 'activate_beta_pro',
      jsonb_build_object('plan','pro','status','trial','ends_at',v_beta_end), 'Activation bêta Pro');
  END IF;

  v_token := replace(replace(replace(encode(extensions.gen_random_bytes(24),'base64'),'/','_'),'+','-'),'=','');
  INSERT INTO public.shop_invitations (shop_id, email, role, token, invited_by, expires_at)
  VALUES (v_shop_id, v_app.contact_email, 'shop_manager', v_token, v_owner, now() + interval '30 days');

  UPDATE public.shop_applications SET
    status = CASE WHEN _activate_beta THEN 'invitation_envoyee' ELSE 'validee' END,
    shop_id = v_shop_id
  WHERE id = _application_id;

  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, application_id, action, new_value)
  VALUES (v_owner, v_shop_id, _application_id, 'validate_application',
    jsonb_build_object('activate_beta', _activate_beta, 'invitation_token', v_token));

  RETURN jsonb_build_object('shop_id', v_shop_id, 'invitation_token', v_token,
    'invitation_url', '/portail/invitation/' || v_token);
END $function$;