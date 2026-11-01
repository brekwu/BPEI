-- BPEI P0: public registration must never open based on a legal flag alone.
-- Real SMTP evidence and a confirmed administrator are prerequisites.
-- This does NOT certify SMTP delivery, legal validity, or Auth hook installation.
CREATE OR REPLACE FUNCTION bpei_private.p0_registration_prerequisites_met(p_version text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT COALESCE(
   p_version IS NOT NULL
   AND EXISTS(
     SELECT 1 FROM public.independent_admins a JOIN auth.users u ON u.id=a.user_id
     WHERE u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
       AND u.is_anonymous IS NOT TRUE
   )
   AND EXISTS(
     SELECT 1 FROM public.bpei_p0_attestations e
     JOIN public.independent_admins a ON a.user_id=e.verified_by
     JOIN auth.users u ON u.id=a.user_id
     WHERE e.check_key='smtp_auth_delivery'
       AND length(btrim(e.evidence_reference))>=30
       AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
       AND u.is_anonymous IS NOT TRUE
   )
   AND EXISTS(
     SELECT 1 FROM public.bpei_p0_attestations e
     JOIN public.independent_admins a ON a.user_id=e.verified_by
     JOIN auth.users u ON u.id=a.user_id
     WHERE e.check_key='legal_operator_review'
       AND length(btrim(e.evidence_reference))>=30
       AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
       AND u.is_anonymous IS NOT TRUE
   )
   AND EXISTS(SELECT 1 FROM public.bpei_legal_releases r WHERE r.version=p_version)
   AND (
     SELECT count(DISTINCT d.kind)
     FROM public.bpei_legal_documents d
     JOIN public.independent_admins a ON a.user_id=d.approved_by
     JOIN auth.users u ON u.id=a.user_id
     WHERE d.version=p_version AND d.approved_at IS NOT NULL
       AND d.kind IN ('mentions-legales','confidentialite','cgu')
       AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
       AND u.is_anonymous IS NOT TRUE
   )=3, FALSE);
$$;
REVOKE ALL ON FUNCTION bpei_private.p0_registration_prerequisites_met(text)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION bpei_private.enforce_p0_registration_evidence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
  IF NEW.independent_registration_enabled IS TRUE
     AND (
       NEW.legal_documents_published IS DISTINCT FROM TRUE
       OR NEW.legal_published_at IS NULL
       OR NOT bpei_private.p0_registration_prerequisites_met(NEW.legal_version)
     )
  THEN
    RAISE EXCEPTION 'BPEI signup requires verified administrator, SMTP delivery and reviewed legal release'
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bpei_private.enforce_p0_registration_evidence()
  FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_registration_requires_p0_evidence
  BEFORE INSERT OR UPDATE OF independent_registration_enabled,legal_documents_published,legal_version
  ON public.bpei_launch_controls
  FOR EACH ROW EXECUTE FUNCTION bpei_private.enforce_p0_registration_evidence();

-- Defense in depth: if an attestation is later removed or a confirmed admin
-- becomes unavailable, hosted Auth still rejects new public signups.
-- The privileged bootstrap marker remains restricted to the Auth Admin API.
CREATE OR REPLACE FUNCTION bpei_private.before_bpei_user_created(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=''
AS $$
DECLARE registration_open boolean; current_version text;
BEGIN
  IF event->'user'->'app_metadata'->>'bpei_admin_bootstrap' = 'true' THEN
    RETURN '{}'::jsonb;
  END IF;
  SELECT (
    c.legal_documents_published IS TRUE
    AND c.independent_registration_enabled IS TRUE
    AND c.legal_version IS NOT NULL
    AND length(btrim(c.legal_version))>=3
    AND bpei_private.p0_registration_prerequisites_met(c.legal_version)
  ), c.legal_version
    INTO registration_open,current_version
  FROM public.bpei_launch_controls c WHERE c.id IS TRUE;
  IF registration_open IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('error',jsonb_build_object(
      'http_code',403,'message','BPEI registrations are not open'));
  END IF;
  IF NOT bpei_private.has_current_signup_acknowledgement(event,current_version) THEN
    RETURN jsonb_build_object('error',jsonb_build_object(
      'http_code',403,'message','BPEI current legal version must be acknowledged'));
  END IF;
  RETURN '{}'::jsonb;
END;
$$;
REVOKE ALL ON FUNCTION bpei_private.before_bpei_user_created(jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.before_bpei_user_created(jsonb)
  TO supabase_auth_admin;

COMMENT ON FUNCTION bpei_private.p0_registration_prerequisites_met(text)
IS 'Fail-closed signup prerequisites; human evidence is necessary but is not self-verifying.';
