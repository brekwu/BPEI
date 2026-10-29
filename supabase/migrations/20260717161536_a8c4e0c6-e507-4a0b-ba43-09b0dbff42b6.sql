-- Sub-lot 5: Partnership network hardening

-- 1. Enum extensions
ALTER TYPE public.partner_application_status ADD VALUE IF NOT EXISTS 'viewed';
ALTER TYPE public.partner_application_status ADD VALUE IF NOT EXISTS 'shortlisted';
ALTER TYPE public.partner_application_status ADD VALUE IF NOT EXISTS 'negotiation';
ALTER TYPE public.partner_application_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TYPE public.partner_application_status ADD VALUE IF NOT EXISTS 'submitted';

ALTER TYPE public.partner_agreement_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE public.partner_agreement_status ADD VALUE IF NOT EXISTS 'negotiation';

-- Additional opportunity/agreement fields (idempotent)
ALTER TABLE public.partner_opportunities
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS invited_partner_shop_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS require_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.partner_agreements
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS became_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS exclusivity_kind text NOT NULL DEFAULT 'none';

-- 2. Agreement versions (snapshot & double signature)
CREATE TABLE IF NOT EXISTS public.partner_agreement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid NOT NULL REFERENCES public.partner_agreements(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  content_hash text NOT NULL,
  change_summary text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  shop_accepted_at timestamptz,
  shop_accepted_by uuid REFERENCES auth.users(id),
  independent_accepted_at timestamptz,
  independent_accepted_by uuid REFERENCES auth.users(id),
  became_active_at timestamptz,
  UNIQUE (agreement_id, version_number)
);

GRANT SELECT, INSERT, UPDATE ON public.partner_agreement_versions TO authenticated;
GRANT ALL ON public.partner_agreement_versions TO service_role;
ALTER TABLE public.partner_agreement_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agr_ver_read" ON public.partner_agreement_versions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.partner_agreements a
  WHERE a.id = agreement_id
    AND (public.is_shop_member(auth.uid(), a.shop_id)
      OR public.is_shop_member(auth.uid(), a.independent_shop_id)
      OR public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role)
      OR public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role))
));

-- versions are only written via SECURITY DEFINER RPCs
CREATE POLICY "agr_ver_no_direct_write" ON public.partner_agreement_versions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "agr_ver_no_direct_update" ON public.partner_agreement_versions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE INDEX IF NOT EXISTS partner_agr_ver_agreement_idx ON public.partner_agreement_versions(agreement_id, version_number DESC);

-- 3. partner_missions (skeleton for next lot)
CREATE TABLE IF NOT EXISTS public.partner_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id uuid REFERENCES public.partner_agreements(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.partner_opportunities(id) ON DELETE SET NULL,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  independent_shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  service_category text,
  customer_reference text,
  city text,
  postal_code text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  response_deadline timestamptz,
  status text NOT NULL DEFAULT 'draft',
  compensation_amount_cents integer,
  compensation_model text,
  travel_fee_cents integer,
  assigned_at timestamptz,
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  shop_notes text,
  independent_notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_missions TO authenticated;
GRANT ALL ON public.partner_missions TO service_role;
ALTER TABLE public.partner_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mis_shop_all" ON public.partner_missions FOR ALL TO authenticated
USING (public.is_shop_member(auth.uid(), shop_id)) WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "mis_indep_read" ON public.partner_missions FOR SELECT TO authenticated
USING (public.is_shop_member(auth.uid(), independent_shop_id));
CREATE POLICY "mis_indep_update" ON public.partner_missions FOR UPDATE TO authenticated
USING (public.is_shop_member(auth.uid(), independent_shop_id))
WITH CHECK (public.is_shop_member(auth.uid(), independent_shop_id));
CREATE POLICY "mis_owner_read" ON public.partner_missions FOR SELECT TO authenticated
USING (public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role) OR public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role));

CREATE TRIGGER partner_missions_updated BEFORE UPDATE ON public.partner_missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Capability helpers
-- side = 'shop' (offers opportunities, hires) or 'independent' (applies, delivers missions)
CREATE OR REPLACE FUNCTION public.shop_partnership_capable(_shop_id uuid, _side text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bt public.business_type;
  _plan public.subscription_plan;
  _status public.subscription_status;
BEGIN
  SELECT business_type INTO _bt FROM public.shops WHERE id = _shop_id;
  SELECT plan, status INTO _plan, _status FROM public.shop_subscriptions WHERE shop_id = _shop_id;
  IF _bt IS NULL THEN RETURN false; END IF;
  IF _status IS NOT NULL AND _status = 'expired' THEN RETURN false; END IF;

  IF _side = 'shop' THEN
    RETURN _bt IN ('physical_shop','hybrid_business','multi_location_network')
      AND COALESCE(_plan::text, '') IN ('shop_pro','shop_network','pro','network');
  ELSIF _side = 'independent' THEN
    RETURN _bt IN ('mobile_independent','hybrid_business')
      AND COALESCE(_plan::text, '') = 'independent_partner';
  END IF;
  RETURN false;
END $$;

GRANT EXECUTE ON FUNCTION public.shop_partnership_capable(uuid, text) TO authenticated;

-- 5. Fix RPCs
-- 5a. partner_apply: eligibility gate + duplicates
CREATE OR REPLACE FUNCTION public.partner_apply(
  _opportunity_id uuid, _independent_shop_id uuid, _message text DEFAULT NULL, _proposed_rate text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _opp RECORD; _existing_id uuid; _new_id uuid;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), _independent_shop_id) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;
  IF NOT public.shop_partnership_capable(_independent_shop_id, 'independent') THEN
    RAISE EXCEPTION 'Cette structure ne peut pas candidater (profil ou abonnement insuffisant)';
  END IF;
  SELECT * INTO _opp FROM public.partner_opportunities WHERE id = _opportunity_id;
  IF _opp.id IS NULL THEN RAISE EXCEPTION 'Opportunité introuvable'; END IF;
  IF _opp.status <> 'published' THEN RAISE EXCEPTION 'Opportunité fermée'; END IF;
  IF _opp.expires_at IS NOT NULL AND _opp.expires_at < now() THEN
    RAISE EXCEPTION 'Opportunité expirée';
  END IF;
  IF _opp.visibility = 'invited_partners_only'
     AND NOT (_independent_shop_id = ANY(_opp.invited_partner_shop_ids)) THEN
    RAISE EXCEPTION 'Opportunité privée : accès non invité';
  END IF;
  IF _opp.require_verified THEN
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _independent_shop_id AND verification_status = 'verified') THEN
      RAISE EXCEPTION 'Vérification BPEI requise pour cette opportunité';
    END IF;
  END IF;

  SELECT id INTO _existing_id FROM public.partner_applications
    WHERE opportunity_id = _opportunity_id AND independent_shop_id = _independent_shop_id
    ORDER BY created_at DESC LIMIT 1;
  IF _existing_id IS NOT NULL THEN
    -- allow re-apply only if previous was withdrawn/rejected
    IF EXISTS (SELECT 1 FROM public.partner_applications WHERE id = _existing_id
               AND status NOT IN ('withdrawn','rejected','expired')) THEN
      RAISE EXCEPTION 'Une candidature active existe déjà';
    END IF;
  END IF;

  INSERT INTO public.partner_applications
    (opportunity_id, independent_shop_id, message, proposed_rate, status, applied_by)
  VALUES (_opportunity_id, _independent_shop_id, _message, _proposed_rate, 'submitted', auth.uid())
  RETURNING id INTO _new_id;
  RETURN _new_id;
END $$;

-- 5b. partner_accept_application: no auto-sign, create draft agreement + version
CREATE OR REPLACE FUNCTION public.partner_accept_application(
  _application_id uuid, _title text, _scope text DEFAULT NULL,
  _compensation_model text DEFAULT NULL, _compensation_details text DEFAULT NULL,
  _requires_exclusivity boolean DEFAULT false,
  _start_date date DEFAULT NULL, _end_date date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _app RECORD; _agreement_id uuid; _snapshot jsonb;
BEGIN
  SELECT pa.*, po.shop_id AS opp_shop_id INTO _app
    FROM public.partner_applications pa
    JOIN public.partner_opportunities po ON po.id = pa.opportunity_id
    WHERE pa.id = _application_id;
  IF _app.id IS NULL THEN RAISE EXCEPTION 'Candidature introuvable'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _app.opp_shop_id) THEN
    RAISE EXCEPTION 'Réservé à la boutique propriétaire';
  END IF;
  IF NOT public.shop_partnership_capable(_app.opp_shop_id, 'shop') THEN
    RAISE EXCEPTION 'Boutique non éligible aux accords (profil/abonnement)';
  END IF;

  UPDATE public.partner_applications
    SET status='accepted', reviewed_at=now(), updated_at=now()
    WHERE id=_application_id;

  INSERT INTO public.partner_agreements
    (shop_id, independent_shop_id, opportunity_id, application_id,
     title, scope, compensation_model, compensation_details,
     requires_exclusivity, start_date, end_date, status, created_by, current_version,
     exclusivity_kind)
  VALUES (_app.opp_shop_id, _app.independent_shop_id, _app.opportunity_id, _application_id,
     _title, _scope, _compensation_model, _compensation_details,
     _requires_exclusivity, _start_date, _end_date, 'draft', auth.uid(), 1,
     CASE WHEN _requires_exclusivity THEN 'preferred' ELSE 'none' END)
  RETURNING id INTO _agreement_id;

  _snapshot := jsonb_build_object(
    'title', _title, 'scope', _scope,
    'compensation_model', _compensation_model, 'compensation_details', _compensation_details,
    'requires_exclusivity', _requires_exclusivity,
    'exclusivity_kind', CASE WHEN _requires_exclusivity THEN 'preferred' ELSE 'none' END,
    'start_date', _start_date, 'end_date', _end_date,
    'shop_id', _app.opp_shop_id, 'independent_shop_id', _app.independent_shop_id
  );

  INSERT INTO public.partner_agreement_versions
    (agreement_id, version_number, snapshot, content_hash, change_summary, created_by)
  VALUES (_agreement_id, 1, _snapshot, encode(digest(_snapshot::text, 'sha256'), 'hex'),
          'Version initiale (brouillon)', auth.uid());

  INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
    VALUES (_agreement_id, 'created', auth.uid(), jsonb_build_object('application_id', _application_id));
  RETURN _agreement_id;
END $$;

-- 5c. Mark application viewed (first read by shop)
CREATE OR REPLACE FUNCTION public.partner_mark_application_viewed(_application_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _opp_shop uuid; _status public.partner_application_status;
BEGIN
  SELECT po.shop_id, pa.status INTO _opp_shop, _status
    FROM public.partner_applications pa
    JOIN public.partner_opportunities po ON po.id = pa.opportunity_id
    WHERE pa.id = _application_id;
  IF _opp_shop IS NULL THEN RAISE EXCEPTION 'Introuvable'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _opp_shop) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  IF _status = 'submitted' THEN
    UPDATE public.partner_applications SET status='viewed', updated_at=now() WHERE id=_application_id;
  END IF;
END $$;

-- 5d. Shortlist
CREATE OR REPLACE FUNCTION public.partner_shortlist_application(_application_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _opp_shop uuid;
BEGIN
  SELECT po.shop_id INTO _opp_shop FROM public.partner_applications pa
    JOIN public.partner_opportunities po ON po.id = pa.opportunity_id WHERE pa.id = _application_id;
  IF _opp_shop IS NULL THEN RAISE EXCEPTION 'Introuvable'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _opp_shop) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  UPDATE public.partner_applications SET status='shortlisted', updated_at=now() WHERE id=_application_id;
END $$;

-- 5e. Propose new agreement version (invalidates prior acceptances)
CREATE OR REPLACE FUNCTION public.partner_propose_agreement_version(
  _agreement_id uuid, _snapshot jsonb, _change_summary text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agr RECORD; _next_ver integer; _caller_side text;
BEGIN
  SELECT * INTO _agr FROM public.partner_agreements WHERE id = _agreement_id;
  IF _agr.id IS NULL THEN RAISE EXCEPTION 'Accord introuvable'; END IF;
  IF public.is_shop_member(auth.uid(), _agr.shop_id) THEN _caller_side := 'shop';
  ELSIF public.is_shop_member(auth.uid(), _agr.independent_shop_id) THEN _caller_side := 'independent';
  ELSE RAISE EXCEPTION 'Non autorisé'; END IF;

  SELECT COALESCE(MAX(version_number),0)+1 INTO _next_ver
    FROM public.partner_agreement_versions WHERE agreement_id = _agreement_id;

  INSERT INTO public.partner_agreement_versions
    (agreement_id, version_number, snapshot, content_hash, change_summary, created_by)
  VALUES (_agreement_id, _next_ver, _snapshot,
          encode(digest(_snapshot::text, 'sha256'), 'hex'), _change_summary, auth.uid());

  UPDATE public.partner_agreements
    SET current_version = _next_ver,
        status = 'negotiation',
        shop_signed_at = NULL,
        independent_signed_at = NULL,
        updated_at = now()
    WHERE id = _agreement_id;

  INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
    VALUES (_agreement_id, 'version_proposed', auth.uid(),
            jsonb_build_object('version_number', _next_ver, 'by_side', _caller_side));
  RETURN _next_ver;
END $$;

-- 5f. Accept current version (per side)
CREATE OR REPLACE FUNCTION public.partner_accept_agreement_version(
  _agreement_id uuid, _version_number integer, _content_hash text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _agr RECORD; _ver RECORD; _side text; _both boolean; _has_conflict boolean;
BEGIN
  SELECT * INTO _agr FROM public.partner_agreements WHERE id = _agreement_id;
  IF _agr.id IS NULL THEN RAISE EXCEPTION 'Accord introuvable'; END IF;
  SELECT * INTO _ver FROM public.partner_agreement_versions
    WHERE agreement_id = _agreement_id AND version_number = _version_number;
  IF _ver.id IS NULL THEN RAISE EXCEPTION 'Version introuvable'; END IF;
  IF _ver.content_hash <> _content_hash THEN
    RAISE EXCEPTION 'Le contenu a changé, rechargez la version';
  END IF;
  IF _agr.current_version <> _version_number THEN
    RAISE EXCEPTION 'Cette version n''est plus la version courante';
  END IF;

  IF public.is_shop_member(auth.uid(), _agr.shop_id) THEN _side := 'shop';
  ELSIF public.is_shop_member(auth.uid(), _agr.independent_shop_id) THEN _side := 'independent';
  ELSE RAISE EXCEPTION 'Non autorisé'; END IF;

  IF _side = 'shop' THEN
    UPDATE public.partner_agreement_versions
      SET shop_accepted_at = now(), shop_accepted_by = auth.uid()
      WHERE id = _ver.id;
    UPDATE public.partner_agreements
      SET shop_signed_at = now(),
          status = CASE WHEN independent_signed_at IS NOT NULL THEN status ELSE 'shop_signed' END,
          updated_at = now()
      WHERE id = _agreement_id;
  ELSE
    UPDATE public.partner_agreement_versions
      SET independent_accepted_at = now(), independent_accepted_by = auth.uid()
      WHERE id = _ver.id;
    UPDATE public.partner_agreements
      SET independent_signed_at = now(),
          status = CASE WHEN shop_signed_at IS NOT NULL THEN status ELSE 'independent_signed' END,
          updated_at = now()
      WHERE id = _agreement_id;
  END IF;

  SELECT (shop_accepted_at IS NOT NULL AND independent_accepted_at IS NOT NULL)
    INTO _both FROM public.partner_agreement_versions WHERE id = _ver.id;

  IF _both THEN
    -- Exclusivity validation on activation
    IF (_ver.snapshot->>'exclusivity_kind') = 'exclusive' THEN
      IF (_ver.snapshot->>'end_date') IS NULL OR (_ver.snapshot->>'start_date') IS NULL THEN
        RAISE EXCEPTION 'Exclusivité : dates début/fin requises';
      END IF;
      IF COALESCE(jsonb_array_length(_ver.snapshot->'covered_cities'),0)
       + COALESCE(jsonb_array_length(_ver.snapshot->'covered_postal_codes'),0) = 0 THEN
        RAISE EXCEPTION 'Exclusivité : zone requise';
      END IF;
      IF COALESCE(jsonb_array_length(_ver.snapshot->'specialties'),0) = 0 THEN
        RAISE EXCEPTION 'Exclusivité : au moins une catégorie de service requise';
      END IF;
      IF (_ver.snapshot->>'compensation_details') IS NULL AND (_ver.snapshot->>'compensation_model') IS NULL THEN
        RAISE EXCEPTION 'Exclusivité : rémunération requise';
      END IF;
      -- naive conflict detection (same independent, exclusive, overlapping dates)
      SELECT EXISTS (
        SELECT 1 FROM public.partner_agreements a2
        WHERE a2.id <> _agreement_id
          AND a2.independent_shop_id = _agr.independent_shop_id
          AND a2.exclusivity_kind = 'exclusive'
          AND a2.status = 'active'
          AND COALESCE(a2.end_date, 'infinity'::date) >= COALESCE(_agr.start_date, now()::date)
          AND COALESCE(a2.start_date, '-infinity'::date) <= COALESCE(_agr.end_date, 'infinity'::date)
      ) INTO _has_conflict;
      IF _has_conflict THEN
        INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
          VALUES (_agreement_id, 'conflict_flagged', auth.uid(), jsonb_build_object('reason','exclusive overlap'));
        RAISE EXCEPTION 'Conflit d''exclusivité détecté avec un accord actif — validation patron requise';
      END IF;
    END IF;

    UPDATE public.partner_agreement_versions
      SET became_active_at = now() WHERE id = _ver.id AND became_active_at IS NULL;
    UPDATE public.partner_agreements
      SET status = 'active', became_active_at = now(), updated_at = now()
      WHERE id = _agreement_id AND status <> 'active';
    INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
      VALUES (_agreement_id, 'activated', auth.uid(),
              jsonb_build_object('version_number', _version_number));
    RETURN 'active';
  END IF;

  INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
    VALUES (_agreement_id, _side || '_accepted', auth.uid(),
            jsonb_build_object('version_number', _version_number));
  RETURN _side || '_accepted';
END $$;

-- 5g. Suspend/unsuspend (owner BPEI)
CREATE OR REPLACE FUNCTION public.partner_owner_suspend_agreement(
  _agreement_id uuid, _reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role)
       OR public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role)) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'Motif requis'; END IF;
  UPDATE public.partner_agreements
    SET status='suspended', suspended_reason=_reason, suspended_by=auth.uid(), updated_at=now()
    WHERE id=_agreement_id;
  INSERT INTO public.partner_agreement_events(agreement_id,event_type,actor_user_id,details)
    VALUES(_agreement_id,'owner_suspended',auth.uid(),jsonb_build_object('reason',_reason));
END $$;

-- 5h. Deprecate old partner_sign_agreement to require version acceptance
CREATE OR REPLACE FUNCTION public.partner_sign_agreement(_agreement_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Utilisez partner_accept_agreement_version (double acceptation versionnée)';
END $$;

-- 6. Publish gate for opportunities
CREATE OR REPLACE FUNCTION public.partner_opportunities_publish_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status <> 'published') THEN
    IF NOT public.shop_partnership_capable(NEW.shop_id, 'shop') THEN
      RAISE EXCEPTION 'Publication réservée aux boutiques Pro/Réseau (profil physique/hybride)';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS partner_opp_publish_gate ON public.partner_opportunities;
CREATE TRIGGER partner_opp_publish_gate
  BEFORE INSERT OR UPDATE ON public.partner_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.partner_opportunities_publish_gate();

GRANT EXECUTE ON FUNCTION public.partner_mark_application_viewed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_shortlist_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_propose_agreement_version(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_accept_agreement_version(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_owner_suspend_agreement(uuid, text) TO authenticated;