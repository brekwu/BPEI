-- Public discovery only for opted-in, reviewed and presently operational partners.
ALTER TABLE public.independent_profiles
 ADD COLUMN public_listing_opt_in boolean NOT NULL DEFAULT false;
CREATE TABLE public.bpei_verified_partner_skills(
 user_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE CASCADE,
 skill text NOT NULL CHECK(char_length(btrim(skill)) BETWEEN 3 AND 80),
 verified_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 evidence_reference text NOT NULL CHECK(char_length(btrim(evidence_reference)) BETWEEN 20 AND 500),
 verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,skill)
);
CREATE INDEX bpei_verified_partner_skills_reviewer_idx ON public.bpei_verified_partner_skills(verified_by);
ALTER TABLE public.bpei_verified_partner_skills ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_verified_partner_skills FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_verified_partner_skills TO authenticated;
CREATE POLICY bpei_verified_skills_private_read ON public.bpei_verified_partner_skills
 FOR SELECT TO authenticated USING(
  user_id=(SELECT auth.uid()) OR EXISTS(
   SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())
 ));
CREATE FUNCTION bpei_private.verify_partner_skill(
 p_user_id uuid,p_skill text,p_evidence_reference text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_actor)
 THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF char_length(btrim(coalesce(p_skill,''))) NOT BETWEEN 3 AND 80
 OR char_length(btrim(coalesce(p_evidence_reference,''))) NOT BETWEEN 20 AND 500
 THEN RAISE EXCEPTION 'Specific evidence-backed skill required' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bpei_technician_levels
  WHERE user_id=p_user_id AND level BETWEEN 1 AND 4)
 THEN RAISE EXCEPTION 'Candidate must be evaluated first' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_verified_partner_skills(user_id,skill,verified_by,evidence_reference)
 VALUES(p_user_id,btrim(p_skill),v_actor,btrim(p_evidence_reference))
 ON CONFLICT(user_id,skill) DO UPDATE SET verified_by=EXCLUDED.verified_by,
  evidence_reference=EXCLUDED.evidence_reference,verified_at=now();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bpei_private.verify_partner_skill(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.verify_partner_skill(uuid,text,text) TO authenticated;
CREATE FUNCTION public.verify_partner_skill(p_user_id uuid,p_skill text,p_evidence_reference text)
 RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.verify_partner_skill($1,$2,$3)
$$;
REVOKE ALL ON FUNCTION public.verify_partner_skill(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_partner_skill(uuid,text,text) TO authenticated;

CREATE FUNCTION bpei_private.search_active_partners(
 p_city text,p_postal_code text,p_remote boolean,p_skill text
) RETURNS TABLE(
 display_name text,city text,postal_code text,level smallint,
 verified_skills text[],remote_available boolean
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.bpei_launch_controls
  WHERE id=true AND legal_documents_published=true) THEN RETURN; END IF;
 IF (p_remote IS DISTINCT FROM true)
  AND char_length(btrim(coalesce(p_city,'')))<2
  AND coalesce(p_postal_code,'') !~ '^[0-9]{5}$'
 THEN RETURN; END IF;
 IF p_city IS NOT NULL AND char_length(btrim(p_city))>120
 OR p_postal_code IS NOT NULL AND p_postal_code<>'' AND p_postal_code!~ '^[0-9]{5}$'
 OR p_skill IS NOT NULL AND char_length(btrim(p_skill))>80
 THEN RETURN; END IF;
 RETURN QUERY
 SELECT p.display_name,p.city,p.postal_code,t.level,
  ARRAY(SELECT s.skill FROM public.bpei_verified_partner_skills s
   WHERE s.user_id=p.user_id ORDER BY s.skill),
  p.remote_available
 FROM public.independent_profiles p
 JOIN public.bpei_technician_levels t
  ON t.user_id=p.user_id AND t.authorization_state='active' AND t.level BETWEEN 1 AND 4
 JOIN public.independent_applications a
  ON a.user_id=p.user_id AND a.status='approved'
 JOIN public.independent_verification_checks c
  ON c.user_id=p.user_id AND c.siret=p.siret
  AND c.enterprise_active=true AND c.establishment_active=true
  AND c.identity_confirmed=true AND c.insurance_confirmed=true
  AND c.insurance_expires_on>=current_date
  AND c.checked_at>=now()-interval '30 days'
 JOIN public.bpei_launch_controls lc
  ON lc.id=true AND lc.legal_documents_published=true
 JOIN public.bpei_legal_acceptances acc
  ON acc.user_id=p.user_id AND acc.legal_version=lc.legal_version
 WHERE p.public_listing_opt_in=true AND p.verified_at IS NOT NULL
  AND p.display_name IS NOT NULL
  AND (CASE WHEN p_remote IS TRUE THEN p.remote_available=true
   ELSE ((p_city IS NOT NULL AND char_length(btrim(p_city))>=2
    AND lower(btrim(p.city))=lower(btrim(p_city)))
    OR (p_postal_code ~ '^[0-9]{5}$' AND p.postal_code=p_postal_code)) END)
  AND (nullif(btrim(coalesce(p_skill,'')),'') IS NULL OR EXISTS(
   SELECT 1 FROM public.bpei_verified_partner_skills s WHERE s.user_id=p.user_id
   AND position(lower(btrim(p_skill)) in lower(s.skill))>0
  ))
 ORDER BY t.level DESC,p.display_name
 LIMIT 20;
END $$;
REVOKE ALL ON FUNCTION bpei_private.search_active_partners(text,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.search_active_partners(text,text,boolean,text) TO anon,authenticated;
CREATE FUNCTION public.search_active_partners(
 p_city text DEFAULT NULL,p_postal_code text DEFAULT NULL,p_remote boolean DEFAULT false,
 p_skill text DEFAULT NULL
) RETURNS TABLE(display_name text,city text,postal_code text,level smallint,
 verified_skills text[],remote_available boolean)
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM bpei_private.search_active_partners($1,$2,$3,$4)
$$;
REVOKE ALL ON FUNCTION public.search_active_partners(text,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.search_active_partners(text,text,boolean,text) TO anon,authenticated;
