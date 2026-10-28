-- Auto-attach the shop to the applicant when their email already matches an auth user.
-- No invitation needed in that case: they get immediate owner access.
CREATE OR REPLACE FUNCTION public.owner_validate_application(
  _application_id uuid,
  _activate_beta boolean DEFAULT true,
  _public_name text DEFAULT NULL::text,
  _internal_name text DEFAULT NULL::text
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
  v_existing_user uuid;
  v_shop_owner uuid;
BEGIN
  IF NOT public.is_owner_bpei(v_owner) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_app FROM public.shop_applications WHERE id = _application_id FOR UPDATE;
  IF v_app IS NULL THEN RAISE EXCEPTION 'application not found'; END IF;
  IF v_app.status IN ('acces_active','archivee') THEN RAISE EXCEPTION 'application already processed'; END IF;

  -- Look up an existing auth user by email
  SELECT id INTO v_existing_user
  FROM auth.users
  WHERE lower(email) = lower(v_app.contact_email)
  LIMIT 1;

  -- Shop owner: the applicant if they already have an account, else the patron (provisional)
  v_shop_owner := COALESCE(v_existing_user, v_owner);

  INSERT INTO public.shops (owner_user_id, name, legal_name, legal_form, siren, siret, vat_number,
    address, city, postal_code, phone, email, website, description,
    status, public_name, internal_name, public_status)
  VALUES (v_shop_owner, v_app.commercial_name, v_app.legal_name, v_app.legal_form, v_app.siren, v_app.siret, v_app.vat_number,
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

  IF v_existing_user IS NOT NULL THEN
    -- Direct attachment: no invitation needed
    INSERT INTO public.shop_memberships (user_id, shop_id, role)
    VALUES (v_existing_user, v_shop_id, 'shop_manager')
    ON CONFLICT DO NOTHING;

    UPDATE public.shop_applications SET
      status = 'acces_active',
      shop_id = v_shop_id
    WHERE id = _application_id;

    INSERT INTO public.owner_audit_log (actor_user_id, shop_id, application_id, action, new_value)
    VALUES (v_owner, v_shop_id, _application_id, 'validate_application',
      jsonb_build_object('activate_beta', _activate_beta, 'auto_attached_user', v_existing_user));

    RETURN jsonb_build_object('shop_id', v_shop_id, 'auto_attached', true, 'user_id', v_existing_user);
  END IF;

  -- No matching account: fall back to invitation
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
    'invitation_url', '/portail/invitation/' || v_token, 'auto_attached', false);
END $function$;

-- Backfill: for any pending invitation whose email already matches an existing auth user,
-- attach the user as shop_manager immediately, transfer shop ownership if it was the patron,
-- mark the invitation accepted, and update the linked application status.
DO $$
DECLARE
  r RECORD;
  v_user uuid;
BEGIN
  FOR r IN
    SELECT si.id AS inv_id, si.shop_id, si.email, si.invited_by
    FROM public.shop_invitations si
    WHERE si.status = 'pending' AND si.revoked_at IS NULL AND si.expires_at > now()
  LOOP
    SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(r.email) LIMIT 1;
    IF v_user IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.shop_memberships (user_id, shop_id, role)
    VALUES (v_user, r.shop_id, 'shop_manager')
    ON CONFLICT DO NOTHING;

    -- If the shop owner is still the patron (provisional), transfer to the real user
    UPDATE public.shops
      SET owner_user_id = v_user
      WHERE id = r.shop_id
        AND owner_user_id = r.invited_by
        AND public.is_owner_bpei(owner_user_id);

    UPDATE public.shop_invitations
      SET status = 'accepted', accepted_at = now(), accepted_by = v_user
      WHERE id = r.inv_id;

    UPDATE public.shop_applications
      SET status = 'acces_active'
      WHERE shop_id = r.shop_id AND status IN ('validee','invitation_envoyee');
  END LOOP;
END $$;