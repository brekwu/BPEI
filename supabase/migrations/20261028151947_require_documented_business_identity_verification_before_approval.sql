CREATE TABLE public.independent_verification_checks (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 siret text NOT NULL CHECK (siret ~ '^[0-9]{14}$'),
 enterprise_active boolean NOT NULL CHECK (enterprise_active=true),
 establishment_active boolean NOT NULL CHECK (establishment_active=true),
 identity_confirmed boolean NOT NULL CHECK (identity_confirmed=true),
 evidence_source text NOT NULL CHECK (evidence_source IN ('annuaire_entreprises','rne_inpi','repertoire_sirene')),
 evidence_reference text NOT NULL CHECK (char_length(btrim(evidence_reference)) BETWEEN 20 AND 700),
 checked_at timestamptz NOT NULL DEFAULT now(),
 checked_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE INDEX independent_verification_checks_reviewer_idx ON public.independent_verification_checks(checked_by);
ALTER TABLE public.independent_verification_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.independent_verification_checks FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.independent_verification_checks TO authenticated;
CREATE POLICY independent_checks_admin_read ON public.independent_verification_checks
 FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.independent_admins adm WHERE adm.user_id=(SELECT auth.uid()))
);

CREATE FUNCTION bpei_private.record_independent_verification(
 p_user_id uuid,p_siret text,p_enterprise_active boolean,p_establishment_active boolean,
 p_identity_confirmed boolean,p_evidence_source text,p_evidence_reference text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_admin uuid:=(SELECT auth.uid());
BEGIN
 IF v_admin IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.independent_admins adm WHERE adm.user_id=v_admin
 ) THEN
  RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501';
 END IF;
 IF p_siret !~ '^[0-9]{14}$' OR p_siret IS NULL OR
    p_enterprise_active IS DISTINCT FROM TRUE OR
    p_establishment_active IS DISTINCT FROM TRUE OR
    p_identity_confirmed IS DISTINCT FROM TRUE OR
    p_evidence_source IS NULL OR
    p_evidence_source NOT IN ('annuaire_entreprises','rne_inpi','repertoire_sirene') OR
    char_length(btrim(coalesce(p_evidence_reference,''))) NOT BETWEEN 20 AND 700
 THEN RAISE EXCEPTION 'Documented official and identity verification required' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.independent_profiles p WHERE p.user_id=p_user_id AND p.siret=p_siret
 ) THEN RAISE EXCEPTION 'SIRET must match candidate profile' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM auth.users u WHERE u.id=p_user_id AND u.email_confirmed_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'Candidate email must be confirmed' USING ERRCODE='22023'; END IF;
 INSERT INTO public.independent_verification_checks(
 user_id,siret,enterprise_active,establishment_active,identity_confirmed,
 evidence_source,evidence_reference,checked_at,checked_by
 )
 VALUES (p_user_id,p_siret,TRUE,TRUE,TRUE,p_evidence_source,btrim(p_evidence_reference),now(),v_admin)
 ON CONFLICT (user_id) DO UPDATE SET
 siret=excluded.siret,enterprise_active=excluded.enterprise_active,
 establishment_active=excluded.establishment_active,identity_confirmed=excluded.identity_confirmed,
 evidence_source=excluded.evidence_source,evidence_reference=excluded.evidence_reference,
 checked_at=now(),checked_by=v_admin;
 RETURN jsonb_build_object('user_id',p_user_id,'verified_evidence_recorded',true);
END;
$$;
REVOKE ALL ON FUNCTION bpei_private.record_independent_verification(uuid,text,boolean,boolean,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.record_independent_verification(uuid,text,boolean,boolean,boolean,text,text) TO authenticated;
CREATE FUNCTION public.record_independent_verification(
 p_user_id uuid,p_siret text,p_enterprise_active boolean,p_establishment_active boolean,
 p_identity_confirmed boolean,p_evidence_source text,p_evidence_reference text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT bpei_private.record_independent_verification(
 p_user_id,p_siret,p_enterprise_active,p_establishment_active,p_identity_confirmed,p_evidence_source,p_evidence_reference) $$;
REVOKE ALL ON FUNCTION public.record_independent_verification(uuid,text,boolean,boolean,boolean,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_independent_verification(uuid,text,boolean,boolean,boolean,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION bpei_private.review_independent_application(
p_application_id uuid,p_new_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_admin uuid:=(SELECT auth.uid());v_app record;v_profile record;
BEGIN
 IF v_admin IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_admin) THEN
  RAISE EXCEPTION 'Not authorized to review applications' USING ERRCODE='42501';
 END IF;
 IF p_new_status IS NULL OR p_new_status NOT IN ('under_review','approved','rejected') THEN
  RAISE EXCEPTION 'Invalid status' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_app FROM public.independent_applications WHERE id=p_application_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application not found' USING ERRCODE='P0002'; END IF;
 IF p_new_status='approved' THEN
  SELECT * INTO v_profile FROM public.independent_profiles
   WHERE user_id=v_app.user_id FOR UPDATE;
  IF NOT FOUND OR v_profile.siret IS NULL OR v_profile.siret !~ '^[0-9]{14}$' THEN
    RAISE EXCEPTION 'A candidate SIRET is required' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.independent_verification_checks c
     WHERE c.user_id=v_app.user_id AND c.siret=v_profile.siret
     AND c.enterprise_active=true AND c.establishment_active=true AND c.identity_confirmed=true
     AND c.checked_at >= now()-interval '30 days'
  ) THEN
    RAISE EXCEPTION 'Official registry, active business and candidate identity checks required before approval'
    USING ERRCODE='22023';
  END IF;
 END IF;
 UPDATE public.independent_applications SET status=p_new_status,reviewed_at=now(),reviewed_by=v_admin
 WHERE id=p_application_id;
 UPDATE public.independent_profiles SET
 verified_at=CASE WHEN p_new_status='approved' THEN now() ELSE NULL END, updated_at=now()
 WHERE user_id=v_app.user_id;
 RETURN jsonb_build_object('id',p_application_id,'status',p_new_status);
END;
$$;

CREATE FUNCTION bpei_private.invalidate_independent_verification_on_identity_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF NEW.siret IS DISTINCT FROM OLD.siret OR NEW.business_name IS DISTINCT FROM OLD.business_name THEN
  NEW.verified_at=NULL;
  DELETE FROM public.independent_verification_checks WHERE user_id=NEW.user_id;
  UPDATE public.independent_applications
  SET status='under_review',reviewed_at=NULL,reviewed_by=NULL
  WHERE user_id=NEW.user_id AND status='approved';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bpei_private.invalidate_independent_verification_on_identity_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_invalidate_on_professional_identity_change
 BEFORE UPDATE OF siret,business_name ON public.independent_profiles
 FOR EACH ROW EXECUTE FUNCTION bpei_private.invalidate_independent_verification_on_identity_change();
