-- Helper is_owner_bpei
CREATE OR REPLACE FUNCTION public.is_owner_bpei(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_platform_role(_user, 'owner_bpei') $$;

-- Colonnes shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS public_name text,
  ADD COLUMN IF NOT EXISTS internal_name text,
  ADD COLUMN IF NOT EXISTS public_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS public_logo_url text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS public_description text,
  ADD COLUMN IF NOT EXISTS public_email text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_public_status_chk;
ALTER TABLE public.shops ADD CONSTRAINT shops_public_status_chk
  CHECK (public_status IN ('draft','published'));

-- Candidatures
CREATE TABLE IF NOT EXISTS public.shop_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT ('CAND-' || to_char(now(), 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  status text NOT NULL DEFAULT 'nouvelle',
  contact_first_name text NOT NULL,
  contact_last_name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  legal_name text,
  legal_form text,
  commercial_name text NOT NULL,
  siren text, siret text, vat_number text,
  address text, postal_code text, city text,
  website text, description text,
  establishments_count integer, employees_count integer,
  main_services text, message text,
  consent_contact boolean NOT NULL DEFAULT false,
  internal_notes text,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status IN ('nouvelle','verification','info_manquante','validee','refusee','invitation_envoyee','acces_active','archivee'))
);
CREATE INDEX IF NOT EXISTS idx_shop_applications_status ON public.shop_applications(status);
CREATE INDEX IF NOT EXISTS idx_shop_applications_email ON public.shop_applications(lower(contact_email));

GRANT SELECT, INSERT, UPDATE ON public.shop_applications TO authenticated;
GRANT SELECT, INSERT ON public.shop_applications TO anon;
GRANT ALL ON public.shop_applications TO service_role;
ALTER TABLE public.shop_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon submit application" ON public.shop_applications
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth submit application" ON public.shop_applications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner read applications" ON public.shop_applications
  FOR SELECT TO authenticated
  USING (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "owner update applications" ON public.shop_applications
  FOR UPDATE TO authenticated
  USING (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));

CREATE TRIGGER shop_applications_updated_at BEFORE UPDATE ON public.shop_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit patron
CREATE TABLE IF NOT EXISTS public.owner_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.shop_applications(id) ON DELETE SET NULL,
  action text NOT NULL,
  old_value jsonb, new_value jsonb,
  reason text, note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_owner_audit_created ON public.owner_audit_log(created_at DESC);
GRANT SELECT, INSERT ON public.owner_audit_log TO authenticated;
GRANT ALL ON public.owner_audit_log TO service_role;
ALTER TABLE public.owner_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read audit" ON public.owner_audit_log
  FOR SELECT TO authenticated
  USING (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));

-- Abonnements
DO $$ BEGIN CREATE TYPE public.subscription_plan AS ENUM ('starter','pro','network');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.subscription_status AS ENUM ('trial','active','expired','suspended','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.shop_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'pro',
  status public.subscription_status NOT NULL DEFAULT 'trial',
  price_cents_current integer NOT NULL DEFAULT 0,
  price_cents_future integer NOT NULL DEFAULT 15000,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  auto_renew boolean NOT NULL DEFAULT false,
  origin text,
  activated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shop_subscriptions TO authenticated;
GRANT ALL ON public.shop_subscriptions TO service_role;
ALTER TABLE public.shop_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members read subscription" ON public.shop_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));
CREATE TRIGGER shop_subscriptions_updated_at BEFORE UPDATE ON public.shop_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.shop_subscription_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  old_state jsonb, new_state jsonb, note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sub_history_shop ON public.shop_subscription_history(shop_id, created_at DESC);
GRANT SELECT ON public.shop_subscription_history TO authenticated;
GRANT ALL ON public.shop_subscription_history TO service_role;
ALTER TABLE public.shop_subscription_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members read sub history" ON public.shop_subscription_history
  FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));

CREATE TABLE IF NOT EXISTS public.shop_enabled_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, module_key)
);
GRANT SELECT ON public.shop_enabled_modules TO authenticated;
GRANT ALL ON public.shop_enabled_modules TO service_role;
ALTER TABLE public.shop_enabled_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members read modules" ON public.shop_enabled_modules
  FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));

-- App settings (simulated_now)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read app settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()));

-- Fonctions
CREATE OR REPLACE FUNCTION public.effective_now()
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT (value #>> '{}')::timestamptz FROM public.app_settings WHERE key='simulated_now'), now()); $$;

CREATE OR REPLACE FUNCTION public.shop_has_module_access(_shop uuid, _module text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sub public.shop_subscriptions; v_enabled boolean; v_now timestamptz := public.effective_now();
BEGIN
  IF public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid()) THEN RETURN true; END IF;
  SELECT * INTO v_sub FROM public.shop_subscriptions WHERE shop_id = _shop;
  IF v_sub IS NULL THEN RETURN false; END IF;
  IF v_sub.status IN ('expired','suspended','cancelled') THEN RETURN false; END IF;
  IF v_sub.ends_at IS NOT NULL AND v_sub.ends_at < v_now THEN RETURN false; END IF;
  SELECT enabled INTO v_enabled FROM public.shop_enabled_modules WHERE shop_id = _shop AND module_key = _module;
  RETURN COALESCE(v_enabled, true);
END $$;

CREATE OR REPLACE FUNCTION public.shop_subscription_state(_shop uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sub public.shop_subscriptions; v_now timestamptz := public.effective_now(); v_eff text; v_days int;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop) OR public.is_owner_bpei(auth.uid()) OR public.is_admin_bpei(auth.uid())) THEN RETURN NULL; END IF;
  SELECT * INTO v_sub FROM public.shop_subscriptions WHERE shop_id = _shop;
  IF v_sub IS NULL THEN RETURN NULL; END IF;
  v_eff := v_sub.status::text;
  IF v_sub.ends_at IS NOT NULL AND v_sub.ends_at < v_now AND v_sub.status IN ('trial','active') THEN v_eff := 'expired'; END IF;
  v_days := CASE WHEN v_sub.ends_at IS NULL THEN NULL ELSE GREATEST(0, EXTRACT(DAY FROM (v_sub.ends_at - v_now))::int) END;
  RETURN jsonb_build_object('plan', v_sub.plan, 'status', v_sub.status, 'effective_status', v_eff,
    'started_at', v_sub.started_at, 'ends_at', v_sub.ends_at, 'days_remaining', v_days,
    'price_cents_current', v_sub.price_cents_current, 'price_cents_future', v_sub.price_cents_future,
    'auto_renew', v_sub.auto_renew, 'origin', v_sub.origin, 'note', v_sub.note, 'now', v_now);
END $$;

-- RPC patron
CREATE OR REPLACE FUNCTION public.owner_validate_application(
  _application_id uuid, _activate_beta boolean DEFAULT true,
  _public_name text DEFAULT NULL, _internal_name text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_app public.shop_applications; v_shop_id uuid; v_token text;
  v_beta_end timestamptz := timestamptz '2026-08-31 23:59:59+02';
  v_modules text[] := ARRAY['dashboard','clients','devices','repairs','appointments','quotes','invoices','credit_notes','payments','services','catalog','stock','quarantine','suppliers','purchase_orders','restock','orders','messaging','portal','public_page','reviews','team','search'];
  m text;
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_app FROM public.shop_applications WHERE id = _application_id FOR UPDATE;
  IF v_app IS NULL THEN RAISE EXCEPTION 'application not found'; END IF;
  IF v_app.status IN ('acces_active','archivee') THEN RAISE EXCEPTION 'application already processed'; END IF;

  INSERT INTO public.shops (name, legal_name, legal_form, siren, siret, vat_number,
    address, city, postal_code, phone, email, website, description,
    status, public_name, internal_name, public_status)
  VALUES (v_app.commercial_name, v_app.legal_name, v_app.legal_form, v_app.siren, v_app.siret, v_app.vat_number,
    v_app.address, v_app.city, v_app.postal_code, v_app.contact_phone, v_app.contact_email, v_app.website, v_app.description,
    'validated', COALESCE(_public_name, v_app.commercial_name), COALESCE(_internal_name, v_app.commercial_name), 'draft')
  RETURNING id INTO v_shop_id;
  UPDATE public.shops SET validated_at = now() WHERE id = v_shop_id;

  IF _activate_beta THEN
    INSERT INTO public.shop_subscriptions (shop_id, plan, status, price_cents_current, price_cents_future,
      started_at, ends_at, auto_renew, origin, activated_by, note)
    VALUES (v_shop_id, 'pro', 'trial', 0, 15000, now(), v_beta_end, false, 'owner_beta_activation', auth.uid(), 'Bêta Pro gratuite');
    FOREACH m IN ARRAY v_modules LOOP
      INSERT INTO public.shop_enabled_modules (shop_id, module_key, enabled, updated_by)
      VALUES (v_shop_id, m, true, auth.uid()) ON CONFLICT (shop_id, module_key) DO NOTHING;
    END LOOP;
    INSERT INTO public.shop_subscription_history (shop_id, actor_user_id, action, new_state, note)
    VALUES (v_shop_id, auth.uid(), 'activate_beta_pro',
      jsonb_build_object('plan','pro','status','trial','ends_at',v_beta_end), 'Activation bêta Pro');
  END IF;

  v_token := replace(replace(replace(encode(extensions.gen_random_bytes(24),'base64'),'/','_'),'+','-'),'=','');
  INSERT INTO public.shop_invitations (shop_id, email, role, token, invited_by, expires_at)
  VALUES (v_shop_id, v_app.contact_email, 'shop_manager', v_token, auth.uid(), now() + interval '30 days');

  UPDATE public.shop_applications SET
    status = CASE WHEN _activate_beta THEN 'invitation_envoyee' ELSE 'validee' END,
    shop_id = v_shop_id
  WHERE id = _application_id;

  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, application_id, action, new_value)
  VALUES (auth.uid(), v_shop_id, _application_id, 'validate_application',
    jsonb_build_object('activate_beta', _activate_beta, 'invitation_token', v_token));

  RETURN jsonb_build_object('shop_id', v_shop_id, 'invitation_token', v_token,
    'invitation_url', '/portail/invitation/' || v_token);
END $$;

CREATE OR REPLACE FUNCTION public.owner_refuse_application(_application_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.shop_applications SET status='refusee',
    internal_notes = COALESCE(internal_notes,'') || E'\nRefus: ' || COALESCE(_reason,'')
    WHERE id = _application_id;
  INSERT INTO public.owner_audit_log (actor_user_id, application_id, action, reason)
  VALUES (auth.uid(), _application_id, 'refuse_application', _reason);
END $$;

CREATE OR REPLACE FUNCTION public.owner_archive_application(_application_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.shop_applications SET status='archivee' WHERE id = _application_id;
  INSERT INTO public.owner_audit_log (actor_user_id, application_id, action) VALUES (auth.uid(), _application_id, 'archive_application');
END $$;

CREATE OR REPLACE FUNCTION public.owner_update_application_notes(_application_id uuid, _notes text, _new_status text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.shop_applications SET internal_notes = _notes,
    status = COALESCE(_new_status, status) WHERE id = _application_id;
  INSERT INTO public.owner_audit_log (actor_user_id, application_id, action, new_value)
  VALUES (auth.uid(), _application_id, 'update_application', jsonb_build_object('status', _new_status));
END $$;

CREATE OR REPLACE FUNCTION public.owner_regenerate_invitation(_shop_id uuid, _email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_token text;
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.shop_invitations SET status='expired'
    WHERE shop_id = _shop_id AND lower(email)=lower(_email) AND status='pending';
  v_token := replace(replace(replace(encode(extensions.gen_random_bytes(24),'base64'),'/','_'),'+','-'),'=','');
  INSERT INTO public.shop_invitations (shop_id, email, role, token, invited_by, expires_at)
  VALUES (_shop_id, _email, 'shop_manager', v_token, auth.uid(), now() + interval '30 days');
  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, action) VALUES (auth.uid(), _shop_id, 'regenerate_invitation');
  RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public.owner_extend_subscription(_shop_id uuid, _new_end timestamptz, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old timestamptz;
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT ends_at INTO v_old FROM public.shop_subscriptions WHERE shop_id = _shop_id FOR UPDATE;
  UPDATE public.shop_subscriptions SET ends_at=_new_end, status='trial', note=COALESCE(_note,note) WHERE shop_id=_shop_id;
  INSERT INTO public.shop_subscription_history (shop_id, actor_user_id, action, old_state, new_state, note)
  VALUES (_shop_id, auth.uid(), 'extend', jsonb_build_object('ends_at', v_old), jsonb_build_object('ends_at', _new_end), _note);
  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, action, old_value, new_value, note)
  VALUES (auth.uid(), _shop_id, 'extend_subscription', jsonb_build_object('ends_at', v_old), jsonb_build_object('ends_at', _new_end), _note);
END $$;

CREATE OR REPLACE FUNCTION public.owner_activate_paid(_shop_id uuid, _plan public.subscription_plan, _ends_at timestamptz, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.shop_subscriptions (shop_id, plan, status, price_cents_current, price_cents_future, started_at, ends_at, origin, activated_by, note)
  VALUES (_shop_id, _plan, 'active', 15000, 15000, now(), _ends_at, 'owner_paid_activation', auth.uid(), _note)
  ON CONFLICT (shop_id) DO UPDATE SET plan=EXCLUDED.plan, status='active', price_cents_current=15000,
    started_at=now(), ends_at=_ends_at, origin='owner_paid_activation', activated_by=auth.uid(), note=_note;
  INSERT INTO public.shop_subscription_history (shop_id, actor_user_id, action, new_state, note)
  VALUES (_shop_id, auth.uid(), 'activate_paid', jsonb_build_object('plan',_plan,'ends_at',_ends_at), _note);
  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, action, new_value, note)
  VALUES (auth.uid(), _shop_id, 'activate_paid', jsonb_build_object('plan',_plan,'ends_at',_ends_at), _note);
END $$;

CREATE OR REPLACE FUNCTION public.owner_suspend_subscription(_shop_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.shop_subscriptions SET status='suspended' WHERE shop_id=_shop_id;
  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, action, reason) VALUES (auth.uid(), _shop_id, 'suspend', _reason);
END $$;

CREATE OR REPLACE FUNCTION public.owner_reactivate_subscription(_shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.shop_subscriptions SET status = CASE WHEN ends_at IS NOT NULL AND ends_at > now() THEN 'trial'::public.subscription_status ELSE 'active'::public.subscription_status END WHERE shop_id=_shop_id;
  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, action) VALUES (auth.uid(), _shop_id, 'reactivate');
END $$;

CREATE OR REPLACE FUNCTION public.owner_toggle_module(_shop_id uuid, _module text, _enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  INSERT INTO public.shop_enabled_modules (shop_id, module_key, enabled, updated_by)
  VALUES (_shop_id, _module, _enabled, auth.uid())
  ON CONFLICT (shop_id, module_key) DO UPDATE SET enabled=_enabled, updated_by=auth.uid(), updated_at=now();
  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, action, new_value)
  VALUES (auth.uid(), _shop_id, 'toggle_module', jsonb_build_object('module',_module,'enabled',_enabled));
END $$;

CREATE OR REPLACE FUNCTION public.owner_update_shop_names(_shop_id uuid, _public_name text, _internal_name text, _public_status text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old jsonb;
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object('public_name',public_name,'internal_name',internal_name,'public_status',public_status)
    INTO v_old FROM public.shops WHERE id = _shop_id;
  UPDATE public.shops SET
    public_name=COALESCE(_public_name, public_name),
    internal_name=COALESCE(_internal_name, internal_name),
    public_status=COALESCE(_public_status, public_status)
  WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log (actor_user_id, shop_id, action, old_value, new_value)
  VALUES (auth.uid(), _shop_id, 'update_shop_names', v_old, jsonb_build_object('public_name',_public_name,'internal_name',_internal_name,'public_status',_public_status));
END $$;

CREATE OR REPLACE FUNCTION public.owner_set_simulated_now(_ts timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner_bpei(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _ts IS NULL THEN
    DELETE FROM public.app_settings WHERE key='simulated_now';
  ELSE
    INSERT INTO public.app_settings (key, value, updated_by) VALUES ('simulated_now', to_jsonb(_ts::text), auth.uid())
    ON CONFLICT (key) DO UPDATE SET value=to_jsonb(_ts::text), updated_by=auth.uid(), updated_at=now();
  END IF;
  INSERT INTO public.owner_audit_log (actor_user_id, action, new_value) VALUES (auth.uid(), 'set_simulated_now', jsonb_build_object('simulated_now', _ts));
END $$;

-- Bootstrap owner_bpei sur admin_bpei existants
INSERT INTO public.user_platform_roles (user_id, role)
SELECT user_id, 'owner_bpei'::public.platform_role FROM public.user_platform_roles WHERE role='admin_bpei'
ON CONFLICT DO NOTHING;

-- Backfill subscriptions
INSERT INTO public.shop_subscriptions (shop_id, plan, status, price_cents_current, price_cents_future, started_at, ends_at, origin, note)
SELECT s.id, 'pro', 'trial', 0, 15000, COALESCE(s.validated_at, s.created_at),
  timestamptz '2026-08-31 23:59:59+02', 'backfill', 'Boutique existante rattachée à la bêta Pro'
FROM public.shops s
WHERE s.status='validated'
  AND NOT EXISTS (SELECT 1 FROM public.shop_subscriptions WHERE shop_id=s.id);

INSERT INTO public.shop_enabled_modules (shop_id, module_key, enabled)
SELECT s.id, m.k, true FROM public.shops s
CROSS JOIN (VALUES ('dashboard'),('clients'),('devices'),('repairs'),('appointments'),
  ('quotes'),('invoices'),('credit_notes'),('payments'),('services'),('catalog'),('stock'),
  ('quarantine'),('suppliers'),('purchase_orders'),('restock'),('orders'),('messaging'),
  ('portal'),('public_page'),('reviews'),('team'),('search')) AS m(k)
WHERE s.status='validated'
ON CONFLICT (shop_id, module_key) DO NOTHING;

UPDATE public.shops SET public_name=name WHERE public_name IS NULL;
UPDATE public.shops SET internal_name=name WHERE internal_name IS NULL;