-- Documented independent-to-independent lead attribution; no automatic payout.
-- Referrer is a separate verified business and the contracted referral is funded from BPEI's share.
CREATE TABLE public.bpei_partner_referral_agreements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE REFERENCES public.independent_requests(id) ON DELETE RESTRICT,
 referrer_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE RESTRICT,
 performing_partner_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE RESTRICT,
 approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 referral_fee_ht_cents integer NOT NULL CHECK(referral_fee_ht_cents BETWEEN 1 AND 20000000),
 fee_basis text NOT NULL CHECK(char_length(btrim(fee_basis)) BETWEEN 30 AND 500),
 evidence_reference text NOT NULL CHECK(char_length(btrim(evidence_reference)) BETWEEN 20 AND 500),
 state text NOT NULL DEFAULT 'proposed' CHECK(state IN ('proposed','accepted','declined')),
 responded_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(referrer_id<>performing_partner_id),
 CHECK((state='proposed' AND responded_at IS NULL)
  OR (state IN ('accepted','declined') AND responded_at IS NOT NULL))
);
CREATE INDEX bpei_referral_referrer_idx ON public.bpei_partner_referral_agreements(referrer_id);
CREATE INDEX bpei_referral_performer_idx ON public.bpei_partner_referral_agreements(performing_partner_id);
CREATE INDEX bpei_referral_approver_idx ON public.bpei_partner_referral_agreements(approved_by);
ALTER TABLE public.bpei_partner_referral_agreements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_partner_referral_agreements FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_partner_referral_agreements TO authenticated;
CREATE POLICY bpei_referral_private_read ON public.bpei_partner_referral_agreements
 FOR SELECT TO authenticated USING(referrer_id=(SELECT auth.uid())
  OR performing_partner_id=(SELECT auth.uid())
  OR EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())));

CREATE FUNCTION bpei_private.propose_partner_referral(
 p_request_id uuid,p_referrer_id uuid,p_fee_ht_cents integer,
 p_fee_basis text,p_evidence_reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());v_req public.independent_requests%ROWTYPE;
 v_fee public.bpei_partner_compensation_proposals%ROWTYPE;v_id uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_actor)
 THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF p_fee_ht_cents IS NULL OR p_fee_ht_cents<=0 OR
 char_length(btrim(coalesce(p_fee_basis,''))) NOT BETWEEN 30 AND 500
 OR char_length(btrim(coalesce(p_evidence_reference,''))) NOT BETWEEN 20 AND 500
 THEN RAISE EXCEPTION 'Signed and documented referral required' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_req FROM public.independent_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_req.inquiry_id IS NULL OR v_req.status NOT IN ('accepted','in_progress','completed')
 OR v_req.independent_id=p_referrer_id
 THEN RAISE EXCEPTION 'Distinct referring and performing technicians required' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_fee FROM public.bpei_partner_compensation_proposals
 WHERE request_id=p_request_id AND partner_id=v_req.independent_id
 AND source='referral' AND status='accepted' FOR UPDATE;
 IF NOT FOUND OR p_fee_ht_cents>v_fee.bpei_ht_cents
 THEN RAISE EXCEPTION 'No agreed BPEI share available for referral' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.independent_profiles p
  JOIN public.independent_applications a ON a.user_id=p.user_id AND a.status='approved'
  JOIN public.independent_verification_checks v ON v.user_id=p.user_id
   AND v.siret=p.siret AND v.enterprise_active=true AND v.establishment_active=true
   AND v.identity_confirmed=true AND v.checked_at>=now()-interval '30 days'
  WHERE p.user_id=p_referrer_id AND p.verified_at IS NOT NULL
   AND p.siret ~ '^[0-9]{14}$'
 ) THEN RAISE EXCEPTION 'Referrer professional registration and identity must be verified'
  USING ERRCODE='42501'; END IF;
 INSERT INTO public.bpei_partner_referral_agreements(
  request_id,referrer_id,performing_partner_id,approved_by,referral_fee_ht_cents,
  fee_basis,evidence_reference
 ) VALUES(p_request_id,p_referrer_id,v_req.independent_id,v_actor,p_fee_ht_cents,
 btrim(p_fee_basis),btrim(p_evidence_reference)) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION bpei_private.propose_partner_referral(uuid,uuid,integer,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.propose_partner_referral(uuid,uuid,integer,text,text) TO authenticated;
CREATE FUNCTION public.propose_partner_referral(
 p_request_id uuid,p_referrer_id uuid,p_fee_ht_cents integer,
 p_fee_basis text,p_evidence_reference text
) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.propose_partner_referral($1,$2,$3,$4,$5)
$$;
REVOKE ALL ON FUNCTION public.propose_partner_referral(uuid,uuid,integer,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.propose_partner_referral(uuid,uuid,integer,text,text) TO authenticated;

CREATE FUNCTION bpei_private.respond_partner_referral(p_agreement_id uuid,p_decision text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());
BEGIN
 IF v_actor IS NULL OR p_decision NOT IN ('accepted','declined')
 THEN RAISE EXCEPTION 'Invalid referral decision' USING ERRCODE='42501'; END IF;
 UPDATE public.bpei_partner_referral_agreements
 SET state=p_decision,responded_at=now()
 WHERE id=p_agreement_id AND referrer_id=v_actor AND state='proposed';
 IF NOT FOUND THEN RAISE EXCEPTION 'Only the referring business may accept its proposal'
  USING ERRCODE='42501'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bpei_private.respond_partner_referral(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.respond_partner_referral(uuid,text) TO authenticated;
CREATE FUNCTION public.respond_partner_referral(p_agreement_id uuid,p_decision text)
 RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.respond_partner_referral($1,$2)
$$;
REVOKE ALL ON FUNCTION public.respond_partner_referral(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_partner_referral(uuid,text) TO authenticated;
