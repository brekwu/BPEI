DO $$ BEGIN CREATE TYPE public.partner_opportunity_status AS ENUM ('draft','published','paused','closed','filled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.partner_application_status AS ENUM ('pending','accepted','rejected','withdrawn'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.partner_agreement_status AS ENUM ('proposed','shop_signed','independent_signed','active','suspended','terminated','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.partner_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  covered_cities TEXT[] NOT NULL DEFAULT '{}',
  covered_postal_codes TEXT[] NOT NULL DEFAULT '{}',
  compensation_model TEXT,
  compensation_details TEXT,
  requires_exclusivity BOOLEAN NOT NULL DEFAULT false,
  min_availability TEXT,
  expires_at TIMESTAMPTZ,
  status public.partner_opportunity_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_opportunities TO authenticated;
GRANT ALL ON public.partner_opportunities TO service_role;
ALTER TABLE public.partner_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opp_shop_all" ON public.partner_opportunities FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id)) WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "opp_read_published" ON public.partner_opportunities FOR SELECT TO authenticated
  USING (status = 'published');
CREATE POLICY "opp_owner_all" ON public.partner_opportunities FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'));
CREATE INDEX IF NOT EXISTS partner_opp_shop_idx ON public.partner_opportunities(shop_id);
CREATE INDEX IF NOT EXISTS partner_opp_status_idx ON public.partner_opportunities(status);
CREATE TRIGGER partner_opp_updated BEFORE UPDATE ON public.partner_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.partner_opportunities(id) ON DELETE CASCADE,
  independent_shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  message TEXT, proposed_rate TEXT,
  status public.partner_application_status NOT NULL DEFAULT 'pending',
  applied_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ, review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (opportunity_id, independent_shop_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_applications TO authenticated;
GRANT ALL ON public.partner_applications TO service_role;
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_independent_all" ON public.partner_applications FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), independent_shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), independent_shop_id));
CREATE POLICY "app_shop_read" ON public.partner_applications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partner_opportunities o WHERE o.id = opportunity_id AND public.is_shop_member(auth.uid(), o.shop_id)));
CREATE POLICY "app_shop_update" ON public.partner_applications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partner_opportunities o WHERE o.id = opportunity_id AND public.is_shop_member(auth.uid(), o.shop_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.partner_opportunities o WHERE o.id = opportunity_id AND public.is_shop_member(auth.uid(), o.shop_id)));
CREATE POLICY "app_owner_read" ON public.partner_applications FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'));
CREATE INDEX IF NOT EXISTS partner_app_opp_idx ON public.partner_applications(opportunity_id);
CREATE INDEX IF NOT EXISTS partner_app_indep_idx ON public.partner_applications(independent_shop_id);
CREATE TRIGGER partner_app_updated BEFORE UPDATE ON public.partner_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.partner_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  independent_shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.partner_opportunities(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.partner_applications(id) ON DELETE SET NULL,
  title TEXT NOT NULL, scope TEXT,
  compensation_model TEXT, compensation_details TEXT,
  requires_exclusivity BOOLEAN NOT NULL DEFAULT false,
  start_date DATE, end_date DATE,
  status public.partner_agreement_status NOT NULL DEFAULT 'proposed',
  version INTEGER NOT NULL DEFAULT 1,
  shop_signed_at TIMESTAMPTZ, independent_signed_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ, terminated_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_agreements TO authenticated;
GRANT ALL ON public.partner_agreements TO service_role;
ALTER TABLE public.partner_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agr_shop_all" ON public.partner_agreements FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id)) WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "agr_indep_all" ON public.partner_agreements FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), independent_shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), independent_shop_id));
CREATE POLICY "agr_owner_read" ON public.partner_agreements FOR SELECT TO authenticated
  USING (public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'));
CREATE INDEX IF NOT EXISTS partner_agr_shop_idx ON public.partner_agreements(shop_id);
CREATE INDEX IF NOT EXISTS partner_agr_indep_idx ON public.partner_agreements(independent_shop_id);
CREATE INDEX IF NOT EXISTS partner_agr_status_idx ON public.partner_agreements(status);
CREATE TRIGGER partner_agr_updated BEFORE UPDATE ON public.partner_agreements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.partner_agreement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES public.partner_agreements(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, details JSONB,
  actor_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.partner_agreement_events TO authenticated;
GRANT ALL ON public.partner_agreement_events TO service_role;
ALTER TABLE public.partner_agreement_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agr_ev_read" ON public.partner_agreement_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.partner_agreements a WHERE a.id = agreement_id AND (
    public.is_shop_member(auth.uid(), a.shop_id) OR public.is_shop_member(auth.uid(), a.independent_shop_id)
    OR public.has_platform_role(auth.uid(), 'owner_bpei') OR public.has_platform_role(auth.uid(), 'admin_bpei'))));
CREATE POLICY "agr_ev_insert" ON public.partner_agreement_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.partner_agreements a WHERE a.id = agreement_id AND (
    public.is_shop_member(auth.uid(), a.shop_id) OR public.is_shop_member(auth.uid(), a.independent_shop_id))));
CREATE INDEX IF NOT EXISTS partner_agr_ev_agreement_idx ON public.partner_agreement_events(agreement_id);

CREATE OR REPLACE FUNCTION public.partner_apply(
  _opportunity_id UUID, _independent_shop_id UUID,
  _message TEXT DEFAULT NULL, _proposed_rate TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _app_id UUID; _opp_status public.partner_opportunity_status;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), _independent_shop_id) THEN RAISE EXCEPTION 'Non autorisé pour cette activité'; END IF;
  SELECT status INTO _opp_status FROM public.partner_opportunities WHERE id = _opportunity_id;
  IF _opp_status IS NULL OR _opp_status <> 'published' THEN RAISE EXCEPTION 'Opportunité non disponible'; END IF;
  INSERT INTO public.partner_applications (opportunity_id, independent_shop_id, message, proposed_rate, applied_by)
  VALUES (_opportunity_id, _independent_shop_id, _message, _proposed_rate, auth.uid())
  ON CONFLICT (opportunity_id, independent_shop_id) DO UPDATE
    SET message = EXCLUDED.message, proposed_rate = EXCLUDED.proposed_rate, status = 'pending', updated_at = now()
  RETURNING id INTO _app_id;
  RETURN _app_id;
END $$;

CREATE OR REPLACE FUNCTION public.partner_accept_application(
  _application_id UUID, _title TEXT, _scope TEXT DEFAULT NULL,
  _compensation_model TEXT DEFAULT NULL, _compensation_details TEXT DEFAULT NULL,
  _requires_exclusivity BOOLEAN DEFAULT false,
  _start_date DATE DEFAULT NULL, _end_date DATE DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _app RECORD; _agreement_id UUID;
BEGIN
  SELECT pa.*, po.shop_id AS opp_shop_id INTO _app FROM public.partner_applications pa
    JOIN public.partner_opportunities po ON po.id = pa.opportunity_id WHERE pa.id = _application_id;
  IF _app.id IS NULL THEN RAISE EXCEPTION 'Candidature introuvable'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _app.opp_shop_id) THEN RAISE EXCEPTION 'Réservé à la boutique propriétaire'; END IF;
  UPDATE public.partner_applications SET status='accepted', reviewed_at=now(), updated_at=now() WHERE id=_application_id;
  INSERT INTO public.partner_agreements
    (shop_id, independent_shop_id, opportunity_id, application_id,
     title, scope, compensation_model, compensation_details,
     requires_exclusivity, start_date, end_date, status, created_by, shop_signed_at)
  VALUES (_app.opp_shop_id, _app.independent_shop_id, _app.opportunity_id, _application_id,
     _title, _scope, _compensation_model, _compensation_details,
     _requires_exclusivity, _start_date, _end_date, 'shop_signed', auth.uid(), now())
  RETURNING id INTO _agreement_id;
  INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
    VALUES (_agreement_id, 'created', auth.uid(), jsonb_build_object('application_id', _application_id));
  RETURN _agreement_id;
END $$;

CREATE OR REPLACE FUNCTION public.partner_reject_application(_application_id UUID, _notes TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop_id UUID;
BEGIN
  SELECT po.shop_id INTO _shop_id FROM public.partner_applications pa
    JOIN public.partner_opportunities po ON po.id = pa.opportunity_id WHERE pa.id = _application_id;
  IF _shop_id IS NULL THEN RAISE EXCEPTION 'Introuvable'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop_id) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  UPDATE public.partner_applications SET status='rejected', reviewed_at=now(), review_notes=_notes, updated_at=now() WHERE id=_application_id;
END $$;

CREATE OR REPLACE FUNCTION public.partner_withdraw_application(_application_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _indep UUID;
BEGIN
  SELECT independent_shop_id INTO _indep FROM public.partner_applications WHERE id=_application_id;
  IF _indep IS NULL THEN RAISE EXCEPTION 'Introuvable'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _indep) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  UPDATE public.partner_applications SET status='withdrawn', updated_at=now() WHERE id=_application_id;
END $$;

CREATE OR REPLACE FUNCTION public.partner_sign_agreement(_agreement_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a RECORD; _is_shop BOOLEAN; _is_indep BOOLEAN;
BEGIN
  SELECT * INTO _a FROM public.partner_agreements WHERE id=_agreement_id;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'Introuvable'; END IF;
  _is_shop := public.is_shop_member(auth.uid(), _a.shop_id);
  _is_indep := public.is_shop_member(auth.uid(), _a.independent_shop_id);
  IF NOT (_is_shop OR _is_indep) THEN RAISE EXCEPTION 'Non autorisé'; END IF;
  IF _is_shop AND _a.shop_signed_at IS NULL THEN
    UPDATE public.partner_agreements SET shop_signed_at=now(), updated_at=now() WHERE id=_agreement_id;
    INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id) VALUES (_agreement_id,'shop_signed',auth.uid());
  END IF;
  IF _is_indep AND _a.independent_signed_at IS NULL THEN
    UPDATE public.partner_agreements SET independent_signed_at=now(), updated_at=now() WHERE id=_agreement_id;
    INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id) VALUES (_agreement_id,'independent_signed',auth.uid());
  END IF;
  UPDATE public.partner_agreements SET status='active', updated_at=now()
    WHERE id=_agreement_id AND shop_signed_at IS NOT NULL AND independent_signed_at IS NOT NULL
      AND status IN ('proposed','shop_signed','independent_signed');
END $$;

CREATE OR REPLACE FUNCTION public.partner_terminate_agreement(_agreement_id UUID, _reason TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a RECORD;
BEGIN
  SELECT * INTO _a FROM public.partner_agreements WHERE id=_agreement_id;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'Introuvable'; END IF;
  IF NOT (public.is_shop_member(auth.uid(), _a.shop_id) OR public.is_shop_member(auth.uid(), _a.independent_shop_id)) THEN
    RAISE EXCEPTION 'Non autorisé'; END IF;
  UPDATE public.partner_agreements SET status='terminated', terminated_at=now(), terminated_reason=_reason, updated_at=now() WHERE id=_agreement_id;
  INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
    VALUES (_agreement_id, 'terminated', auth.uid(), jsonb_build_object('reason', _reason));
END $$;