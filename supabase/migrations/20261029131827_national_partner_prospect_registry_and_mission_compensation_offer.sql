-- BPEI nationwide lead register and transparent, explicitly accepted mission remuneration.
-- No actual Stripe charge or payout is triggered by this migration.
CREATE TABLE public.bpei_partner_leads(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 partner_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE CASCADE,
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 client_type text NOT NULL CHECK(client_type IN ('individual','business')),
 client_name text NOT NULL CHECK(char_length(btrim(client_name)) BETWEEN 2 AND 160),
 client_email text NOT NULL CHECK(char_length(btrim(client_email)) BETWEEN 5 AND 254 AND client_email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 client_phone text CHECK(client_phone IS NULL OR char_length(btrim(client_phone)) BETWEEN 6 AND 40),
 city text NOT NULL CHECK(char_length(btrim(city)) BETWEEN 2 AND 120),
 opportunity_title text NOT NULL CHECK(char_length(btrim(opportunity_title)) BETWEEN 5 AND 200),
 source text NOT NULL CHECK(source IN ('partner','bpei','referral')),
 legal_basis text NOT NULL CHECK(legal_basis IN ('incoming_request','explicit_consent','legitimate_interest')),
 legal_evidence text NOT NULL CHECK(char_length(btrim(legal_evidence)) BETWEEN 20 AND 500),
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','qualified','quoted','won','lost')),
 next_follow_up date,
 notes text NOT NULL DEFAULT '' CHECK(char_length(notes)<=1500),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(client_type='business' OR legal_basis<>'legitimate_interest')
);
-- Same customer + opportunity cannot be silently claimed by multiple network partners.
CREATE UNIQUE INDEX bpei_partner_leads_prevent_duplicate
 ON public.bpei_partner_leads(lower(btrim(client_email)),lower(btrim(opportunity_title)))
 WHERE status NOT IN ('lost');
CREATE INDEX bpei_partner_leads_owner_status_idx
 ON public.bpei_partner_leads(partner_id,status,next_follow_up);
CREATE INDEX bpei_partner_leads_creator_idx ON public.bpei_partner_leads(created_by);
ALTER TABLE public.bpei_partner_leads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_partner_leads FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.bpei_partner_leads TO authenticated;
CREATE POLICY bpei_leads_read_scope ON public.bpei_partner_leads
 FOR SELECT TO authenticated USING(partner_id=(SELECT auth.uid()) OR EXISTS(
  SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())
 ));
CREATE POLICY bpei_leads_insert_verified_legal_scope ON public.bpei_partner_leads
 FOR INSERT TO authenticated WITH CHECK(
  created_by=(SELECT auth.uid()) AND
  (partner_id=(SELECT auth.uid()) OR EXISTS(
   SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())
  )) AND EXISTS(
   SELECT 1 FROM public.bpei_launch_controls c
   JOIN public.bpei_legal_acceptances a ON a.legal_version=c.legal_version AND a.user_id=partner_id
   WHERE c.id=true AND c.legal_documents_published=true
  )
 );
CREATE POLICY bpei_leads_update_scope ON public.bpei_partner_leads
 FOR UPDATE TO authenticated USING(
  partner_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid()))
 ) WITH CHECK(
  partner_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid()))
 );
CREATE FUNCTION bpei_private.prevent_lead_identity_change()
 RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.partner_id IS DISTINCT FROM OLD.partner_id
 OR NEW.created_by IS DISTINCT FROM OLD.created_by
 OR NEW.client_email IS DISTINCT FROM OLD.client_email
 OR NEW.source IS DISTINCT FROM OLD.source
 OR NEW.legal_basis IS DISTINCT FROM OLD.legal_basis
 OR NEW.legal_evidence IS DISTINCT FROM OLD.legal_evidence
 OR NEW.opportunity_title IS DISTINCT FROM OLD.opportunity_title
 THEN RAISE EXCEPTION 'Lead ownership, source and documented privacy basis are immutable'
  USING ERRCODE='42501'; END IF;
 NEW.updated_at:=now();
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bpei_private.prevent_lead_identity_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_no_lead_hijack BEFORE UPDATE ON public.bpei_partner_leads
 FOR EACH ROW EXECUTE FUNCTION bpei_private.prevent_lead_identity_change();

CREATE TABLE public.bpei_partner_compensation_proposals(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE REFERENCES public.independent_requests(id) ON DELETE RESTRICT,
 partner_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 source text NOT NULL CHECK(source IN ('bpei','partner','referral')),
 client_price_ht_cents integer NOT NULL CHECK(client_price_ht_cents BETWEEN 100 AND 20000000),
 technician_ht_cents integer NOT NULL CHECK(technician_ht_cents BETWEEN 0 AND 20000000),
 bpei_ht_cents integer NOT NULL CHECK(bpei_ht_cents BETWEEN 0 AND 20000000),
 expense_policy text NOT NULL CHECK(char_length(btrim(expense_policy)) BETWEEN 20 AND 500),
 contractual_reference text NOT NULL CHECK(char_length(btrim(contractual_reference)) BETWEEN 20 AND 500),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','accepted','declined')),
 accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(client_price_ht_cents=technician_ht_cents+bpei_ht_cents),
 CHECK((status='accepted')=(accepted_at IS NOT NULL))
);
CREATE INDEX bpei_partner_compensation_partner_idx
 ON public.bpei_partner_compensation_proposals(partner_id);
CREATE INDEX bpei_partner_compensation_creator_idx
 ON public.bpei_partner_compensation_proposals(created_by);
ALTER TABLE public.bpei_partner_compensation_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_partner_compensation_proposals FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_partner_compensation_proposals TO authenticated;
CREATE POLICY bpei_partner_compensation_private_read ON public.bpei_partner_compensation_proposals
 FOR SELECT TO authenticated USING(
  partner_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid()))
 );
CREATE OR REPLACE FUNCTION bpei_private.propose_partner_compensation(
 p_request_id uuid,p_source text,p_client_price_ht_cents integer,
 p_technician_ht_cents integer,p_bpei_ht_cents integer,p_expense_policy text,
 p_contractual_reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid()); v_req public.independent_requests%ROWTYPE;v_id uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_actor)
 THEN RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_req FROM public.independent_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_req.status<>'new' OR v_req.inquiry_id IS NULL
 THEN RAISE EXCEPTION 'Unaccepted network intervention required' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bpei_technician_levels t
 WHERE t.user_id=v_req.independent_id AND t.authorization_state='active')
 THEN RAISE EXCEPTION 'Only authorized partners may receive offers' USING ERRCODE='42501'; END IF;
 IF p_source NOT IN ('bpei','partner','referral')
 OR p_client_price_ht_cents NOT BETWEEN 100 AND 20000000
 OR p_technician_ht_cents<0 OR p_bpei_ht_cents<0
 OR p_technician_ht_cents+p_bpei_ht_cents<>p_client_price_ht_cents
 OR char_length(btrim(coalesce(p_expense_policy,''))) NOT BETWEEN 20 AND 500
 OR char_length(btrim(coalesce(p_contractual_reference,''))) NOT BETWEEN 20 AND 500
 THEN RAISE EXCEPTION 'Transparent signed pricing and travel policy required' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_partner_compensation_proposals(
  request_id,partner_id,created_by,source,client_price_ht_cents,
  technician_ht_cents,bpei_ht_cents,expense_policy,contractual_reference
 ) VALUES(p_request_id,v_req.independent_id,v_actor,p_source,p_client_price_ht_cents,
  p_technician_ht_cents,p_bpei_ht_cents,btrim(p_expense_policy),btrim(p_contractual_reference))
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION bpei_private.propose_partner_compensation(uuid,text,integer,integer,integer,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.propose_partner_compensation(uuid,text,integer,integer,integer,text,text)
 TO authenticated;
CREATE FUNCTION public.propose_partner_compensation(
 p_request_id uuid,p_source text,p_client_price_ht_cents integer,
 p_technician_ht_cents integer,p_bpei_ht_cents integer,p_expense_policy text,
 p_contractual_reference text
) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.propose_partner_compensation($1,$2,$3,$4,$5,$6,$7)
$$;
REVOKE ALL ON FUNCTION public.propose_partner_compensation(uuid,text,integer,integer,integer,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.propose_partner_compensation(uuid,text,integer,integer,integer,text,text)
 TO authenticated;

CREATE OR REPLACE FUNCTION bpei_private.respond_partner_compensation(p_proposal_id uuid,p_decision text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid()); v_row public.bpei_partner_compensation_proposals%ROWTYPE;
BEGIN
 SELECT * INTO v_row FROM public.bpei_partner_compensation_proposals
 WHERE id=p_proposal_id FOR UPDATE;
 IF v_actor IS NULL OR NOT FOUND OR v_actor<>v_row.partner_id
 OR v_row.status<>'proposed' OR p_decision NOT IN ('accepted','declined')
 THEN RAISE EXCEPTION 'Only the partner can accept or decline an open offer' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.independent_requests WHERE id=v_row.request_id
  AND independent_id=v_actor AND status='new') THEN
  RAISE EXCEPTION 'Mission not awaiting acceptance' USING ERRCODE='22023'; END IF;
 UPDATE public.bpei_partner_compensation_proposals
 SET status=p_decision,accepted_at=CASE WHEN p_decision='accepted' THEN now() ELSE NULL END
 WHERE id=p_proposal_id;
 RETURN p_decision;
END $$;
REVOKE ALL ON FUNCTION bpei_private.respond_partner_compensation(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.respond_partner_compensation(uuid,text) TO authenticated;
CREATE FUNCTION public.respond_partner_compensation(p_proposal_id uuid,p_decision text)
 RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.respond_partner_compensation($1,$2)
$$;
REVOKE ALL ON FUNCTION public.respond_partner_compensation(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_partner_compensation(uuid,text) TO authenticated;
-- Enforce transparent pay disclosure before accepting a mission: no silent unpaid work.
CREATE FUNCTION bpei_private.require_partner_compensation_before_acceptance()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.inquiry_id IS NOT NULL AND NEW.status='accepted'
 AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
 AND NOT EXISTS(SELECT 1 FROM public.bpei_partner_compensation_proposals p
  WHERE p.request_id=NEW.id AND p.partner_id=NEW.independent_id AND p.status='accepted')
 THEN RAISE EXCEPTION 'Technician must accept transparent remuneration before the mission'
  USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION bpei_private.require_partner_compensation_before_acceptance() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bpei_require_transparent_compensation
 BEFORE INSERT OR UPDATE ON public.independent_requests
 FOR EACH ROW EXECUTE FUNCTION bpei_private.require_partner_compensation_before_acceptance();
