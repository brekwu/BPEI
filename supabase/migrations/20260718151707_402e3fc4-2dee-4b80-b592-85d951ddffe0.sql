-- 0) Update trigger to allow controlled owner repoint from SECURITY DEFINER funcs
CREATE OR REPLACE FUNCTION public.shops_prevent_owner_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin_bpei(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Modification du statut réservée à un administrateur BPEI';
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.verification_reviewed_by IS DISTINCT FROM OLD.verification_reviewed_by
     OR NEW.verification_reviewed_at IS DISTINCT FROM OLD.verification_reviewed_at
     OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes THEN
    RAISE EXCEPTION 'Modification de la vérification réservée à un administrateur BPEI';
  END IF;
  IF NEW.legal_status IS DISTINCT FROM OLD.legal_status
     OR NEW.legal_reviewed_by IS DISTINCT FROM OLD.legal_reviewed_by
     OR NEW.legal_reviewed_at IS DISTINCT FROM OLD.legal_reviewed_at
     OR NEW.legal_notes IS DISTINCT FROM OLD.legal_notes THEN
    RAISE EXCEPTION 'Modification du dossier légal réservée à un administrateur BPEI';
  END IF;
  IF NEW.publication_reviewed_by IS DISTINCT FROM OLD.publication_reviewed_by
     OR NEW.publication_reviewed_at IS DISTINCT FROM OLD.publication_reviewed_at
     OR NEW.publication_notes IS DISTINCT FROM OLD.publication_notes THEN
    RAISE EXCEPTION 'Modération de publication réservée à un administrateur BPEI';
  END IF;
  IF NEW.validated_at IS DISTINCT FROM OLD.validated_at
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    RAISE EXCEPTION 'Champ administratif réservé à un administrateur BPEI';
  END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    -- Controlled bypass for internal reconciliation: only accepts values
    -- set within a SECURITY DEFINER function via SET LOCAL.
    IF current_setting('bpei.allow_owner_repoint', true) = 'on' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Transfert de propriété réservé à un administrateur BPEI';
  END IF;

  RETURN NEW;
END;
$function$;

-- 1) owner_validate_application: idempotent + prefer linked_user_id
CREATE OR REPLACE FUNCTION public.owner_validate_application(
  _application_id uuid,
  _activate_beta boolean DEFAULT true,
  _public_name text DEFAULT NULL,
  _internal_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','extensions'
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
  PERFORM set_config('bpei.allow_owner_repoint','on', true);

  SELECT * INTO v_app FROM public.shop_applications WHERE id = _application_id FOR UPDATE;
  IF v_app IS NULL THEN RAISE EXCEPTION 'application not found'; END IF;
  IF v_app.status = 'archivee' THEN RAISE EXCEPTION 'application archived'; END IF;

  IF v_app.linked_user_id IS NOT NULL
     AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id = v_app.linked_user_id) THEN
    v_existing_user := v_app.linked_user_id;
  ELSE
    SELECT id INTO v_existing_user
      FROM auth.users
      WHERE lower(email) = lower(v_app.contact_email)
      LIMIT 1;
  END IF;

  -- Idempotent path
  IF v_app.status = 'acces_active' THEN
    v_shop_id := v_app.shop_id;
    IF v_shop_id IS NOT NULL AND v_existing_user IS NOT NULL THEN
      UPDATE public.shops
         SET owner_user_id = v_existing_user
       WHERE id = v_shop_id
         AND owner_user_id IS DISTINCT FROM v_existing_user
         AND public.is_owner_bpei(owner_user_id);
      INSERT INTO public.shop_memberships (user_id, shop_id, role)
      VALUES (v_existing_user, v_shop_id, 'shop_manager')
      ON CONFLICT DO NOTHING;
      UPDATE public.shop_applications
         SET linked_user_id = v_existing_user
       WHERE id = _application_id
         AND linked_user_id IS DISTINCT FROM v_existing_user;
    END IF;
    RETURN jsonb_build_object('shop_id', v_shop_id, 'auto_attached', v_existing_user IS NOT NULL, 'already_processed', true);
  END IF;

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
    INSERT INTO public.shop_memberships (user_id, shop_id, role)
    VALUES (v_existing_user, v_shop_id, 'shop_manager')
    ON CONFLICT DO NOTHING;

    UPDATE public.shop_applications SET
      status = 'acces_active',
      shop_id = v_shop_id,
      linked_user_id = v_existing_user,
      reviewed_at = now(),
      reviewed_by = v_owner
    WHERE id = _application_id;

    INSERT INTO public.owner_audit_log (actor_user_id, shop_id, application_id, action, meta)
    VALUES (v_owner, v_shop_id, _application_id, 'validate_application',
      jsonb_build_object('activate_beta', _activate_beta, 'auto_attached', true));

    RETURN jsonb_build_object('shop_id', v_shop_id, 'auto_attached', true, 'invitation_url', NULL);
  END IF;

  v_token := encode(extensions.gen_random_bytes(32),'hex');
  INSERT INTO public.shop_invitations (shop_id, email, token, role, invited_by, application_id, status, expires_at)
  VALUES (v_shop_id, v_app.contact_email, v_token, 'shop_manager', v_owner, _application_id, 'pending', now() + interval '30 days');

  UPDATE public.shop_applications SET
    status = 'invitation_envoyee',
    shop_id = v_shop_id,
    reviewed_at = now(),
    reviewed_by = v_owner
  WHERE id = _application_id;

  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, application_id, action, meta)
  VALUES (v_owner, v_shop_id, _application_id, 'validate_application',
    jsonb_build_object('activate_beta', _activate_beta, 'invitation_token', v_token));

  RETURN jsonb_build_object('shop_id', v_shop_id, 'invitation_token', v_token,
    'invitation_url', '/portail/invitation/' || v_token, 'auto_attached', false);
END $function$;

-- 2) Self-heal RPC
CREATE OR REPLACE FUNCTION public.reconcile_my_shop_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email',''));
  v_attached int := 0;
  r record;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('attached', 0); END IF;
  PERFORM set_config('bpei.allow_owner_repoint','on', true);

  FOR r IN
    SELECT sa.id AS app_id, sa.shop_id, s.owner_user_id
      FROM public.shop_applications sa
      JOIN public.shops s ON s.id = sa.shop_id
     WHERE sa.status = 'acces_active'
       AND sa.shop_id IS NOT NULL
       AND (sa.linked_user_id = v_uid OR (v_email <> '' AND lower(sa.contact_email) = v_email))
  LOOP
    IF r.owner_user_id IS DISTINCT FROM v_uid AND public.is_owner_bpei(r.owner_user_id) THEN
      UPDATE public.shops SET owner_user_id = v_uid WHERE id = r.shop_id;
    END IF;
    INSERT INTO public.shop_memberships (user_id, shop_id, role)
    VALUES (v_uid, r.shop_id, 'shop_manager')
    ON CONFLICT DO NOTHING;
    UPDATE public.shop_applications
       SET linked_user_id = v_uid
     WHERE id = r.app_id AND linked_user_id IS DISTINCT FROM v_uid;
    v_attached := v_attached + 1;
  END LOOP;

  RETURN jsonb_build_object('attached', v_attached);
END $function$;

GRANT EXECUTE ON FUNCTION public.reconcile_my_shop_access() TO authenticated;

-- 3) Backfill
DO $$
DECLARE r record; v_user uuid;
BEGIN
  PERFORM set_config('bpei.allow_owner_repoint','on', true);
  FOR r IN
    SELECT sa.id AS app_id, sa.shop_id, sa.linked_user_id, sa.contact_email,
           s.owner_user_id
      FROM public.shop_applications sa
      JOIN public.shops s ON s.id = sa.shop_id
     WHERE sa.status = 'acces_active' AND sa.shop_id IS NOT NULL
  LOOP
    v_user := NULL;
    IF r.linked_user_id IS NOT NULL
       AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id = r.linked_user_id) THEN
      v_user := r.linked_user_id;
    ELSE
      SELECT id INTO v_user FROM auth.users
       WHERE lower(email) = lower(r.contact_email) LIMIT 1;
    END IF;

    IF v_user IS NOT NULL THEN
      IF r.owner_user_id IS DISTINCT FROM v_user AND public.is_owner_bpei(r.owner_user_id) THEN
        UPDATE public.shops SET owner_user_id = v_user WHERE id = r.shop_id;
      END IF;
      INSERT INTO public.shop_memberships (user_id, shop_id, role)
      VALUES (v_user, r.shop_id, 'shop_manager')
      ON CONFLICT DO NOTHING;
      UPDATE public.shop_applications
         SET linked_user_id = v_user
       WHERE id = r.app_id AND linked_user_id IS DISTINCT FROM v_user;
    END IF;
  END LOOP;
END $$;