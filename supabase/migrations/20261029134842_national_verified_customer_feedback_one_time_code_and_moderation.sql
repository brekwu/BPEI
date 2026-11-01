-- BPEI customer feedback: one secret invitation per genuinely completed and invoiced mission.
-- No public review or verified badge is created without a customer-held invitation and human moderation.
CREATE TABLE public.bpei_review_invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE REFERENCES public.independent_requests(id) ON DELETE RESTRICT,
 token_sha256 text NOT NULL UNIQUE CHECK(token_sha256 ~ '^[a-f0-9]{64}$'),
 recipient_email text NOT NULL CHECK(char_length(btrim(recipient_email)) BETWEEN 5 AND 254),
 issued_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 issued_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 CHECK(expires_at>issued_at)
);
CREATE INDEX bpei_review_invitation_issuer_idx ON public.bpei_review_invitations(issued_by);
ALTER TABLE public.bpei_review_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_review_invitations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_review_invitations TO authenticated;
CREATE POLICY bpei_review_invitation_admin_read ON public.bpei_review_invitations
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())
 ));
CREATE TABLE public.bpei_customer_reviews(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE REFERENCES public.independent_requests(id) ON DELETE RESTRICT,
 partner_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE RESTRICT,
 rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
 comment text NOT NULL CHECK(char_length(btrim(comment)) BETWEEN 20 AND 1000),
 customer_public_consent boolean NOT NULL DEFAULT false,
 moderation text NOT NULL DEFAULT 'pending'
  CHECK(moderation IN ('pending','published','rejected')),
 moderated_by uuid REFERENCES auth.users(id),
 moderation_note text,
 moderated_at timestamptz,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 CHECK((moderation='pending' AND moderated_by IS NULL AND moderated_at IS NULL)
  OR (moderation<>'pending' AND moderated_by IS NOT NULL AND moderated_at IS NOT NULL
    AND char_length(btrim(moderation_note)) BETWEEN 20 AND 500)),
 CHECK(moderation<>'published' OR customer_public_consent=true)
);
CREATE INDEX bpei_customer_reviews_partner_idx ON public.bpei_customer_reviews(partner_id,moderation);
CREATE INDEX bpei_customer_reviews_moderator_idx ON public.bpei_customer_reviews(moderated_by);
ALTER TABLE public.bpei_customer_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_customer_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_customer_reviews TO authenticated;
CREATE POLICY bpei_review_admin_read ON public.bpei_customer_reviews
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())
 ));
CREATE POLICY bpei_review_partner_published_read ON public.bpei_customer_reviews
 FOR SELECT TO authenticated USING(partner_id=(SELECT auth.uid()) AND moderation='published');

CREATE FUNCTION bpei_private.issue_review_invitation(p_request_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_admin uuid:=(SELECT auth.uid());v_email text;v_token text;
BEGIN
 IF v_admin IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_admin)
 THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bpei_launch_controls c
 WHERE c.id=true AND c.legal_documents_published=true)
 THEN RAISE EXCEPTION 'Legal privacy information must be published first' USING ERRCODE='42501'; END IF;
 SELECT i.email INTO v_email FROM public.independent_requests r
 JOIN public.bpei_inquiries i ON i.id=r.inquiry_id
 WHERE r.id=p_request_id AND r.status='completed'
 AND EXISTS(SELECT 1 FROM public.bpei_service_quotes q
  JOIN public.bpei_service_invoices f ON f.quote_id=q.id
  WHERE q.inquiry_id=i.id AND q.issuer_id=r.independent_id AND q.status='accepted')
 FOR UPDATE OF r;
 IF NOT FOUND OR v_email IS NULL THEN
  RAISE EXCEPTION 'Completed, invoiced and consented mission required' USING ERRCODE='22023'; END IF;
 v_token:=replace(pg_catalog.gen_random_uuid()::text,'-','') ||
          replace(pg_catalog.gen_random_uuid()::text,'-','');
 INSERT INTO public.bpei_review_invitations(
  request_id,token_sha256,recipient_email,issued_by,expires_at
 ) VALUES(p_request_id,
  pg_catalog.encode(extensions.digest(v_token,'sha256'),'hex'),
  v_email,v_admin,now()+interval '21 days');
 RETURN v_token;
END $$;
REVOKE ALL ON FUNCTION bpei_private.issue_review_invitation(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.issue_review_invitation(uuid) TO authenticated;
CREATE FUNCTION public.issue_review_invitation(p_request_id uuid)
 RETURNS text LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.issue_review_invitation($1)
$$;
REVOKE ALL ON FUNCTION public.issue_review_invitation(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_review_invitation(uuid) TO authenticated;

CREATE FUNCTION bpei_private.submit_customer_review(
 p_token_sha256 text,p_rating integer,p_comment text,p_public_consent boolean
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_invite public.bpei_review_invitations%ROWTYPE;v_partner uuid;
BEGIN
 IF (SELECT auth.role())<>'service_role'
 THEN RAISE EXCEPTION 'Service role required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bpei_launch_controls c
 WHERE c.id=true AND c.legal_documents_published=true)
 THEN RAISE EXCEPTION 'Reviews disabled until legal release' USING ERRCODE='42501'; END IF;
 IF p_token_sha256 !~ '^[a-f0-9]{64}$'
 OR p_rating NOT BETWEEN 1 AND 5 OR char_length(btrim(coalesce(p_comment,''))) NOT BETWEEN 20 AND 1000
 OR p_public_consent IS NULL
 THEN RAISE EXCEPTION 'Invalid feedback' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_invite FROM public.bpei_review_invitations
 WHERE token_sha256=p_token_sha256 FOR UPDATE;
 IF NOT FOUND OR v_invite.consumed_at IS NOT NULL OR v_invite.expires_at<=now()
 THEN RAISE EXCEPTION 'Review invitation invalid or already consumed' USING ERRCODE='22023'; END IF;
 SELECT r.independent_id INTO v_partner FROM public.independent_requests r
 WHERE r.id=v_invite.request_id AND r.status='completed';
 IF NOT FOUND THEN RAISE EXCEPTION 'Completed mission required' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_customer_reviews(
  request_id,partner_id,rating,comment,customer_public_consent
 ) VALUES(v_invite.request_id,v_partner,p_rating,btrim(p_comment),p_public_consent);
 UPDATE public.bpei_review_invitations SET consumed_at=now() WHERE id=v_invite.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bpei_private.submit_customer_review(text,integer,text,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.submit_customer_review(text,integer,text,boolean) TO service_role;
CREATE FUNCTION public.submit_customer_review(
 p_token_sha256 text,p_rating integer,p_comment text,p_public_consent boolean
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.submit_customer_review($1,$2,$3,$4)
$$;
REVOKE ALL ON FUNCTION public.submit_customer_review(text,integer,text,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_customer_review(text,integer,text,boolean) TO service_role;

CREATE FUNCTION bpei_private.moderate_customer_review(
 p_review_id uuid,p_decision text,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=v_actor)
 THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF p_decision NOT IN ('published','rejected')
 OR char_length(btrim(coalesce(p_reason,''))) NOT BETWEEN 20 AND 500
 THEN RAISE EXCEPTION 'Moderation requires documented justification' USING ERRCODE='22023'; END IF;
 UPDATE public.bpei_customer_reviews
 SET moderation=p_decision,moderated_by=v_actor,moderated_at=now(),moderation_note=btrim(p_reason)
 WHERE id=p_review_id AND moderation='pending'
 AND (p_decision='rejected' OR customer_public_consent=true);
 IF NOT FOUND THEN RAISE EXCEPTION 'Review unavailable or public consent missing' USING ERRCODE='42501'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bpei_private.moderate_customer_review(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.moderate_customer_review(uuid,text,text) TO authenticated;
CREATE FUNCTION public.moderate_customer_review(
 p_review_id uuid,p_decision text,p_reason text
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.moderate_customer_review($1,$2,$3)
$$;
REVOKE ALL ON FUNCTION public.moderate_customer_review(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_customer_review(uuid,text,text) TO authenticated;

-- Invoker-safe anonymous public stats. No raw comments, e-mail, token or mission IDs exposed.
CREATE FUNCTION bpei_private.review_summary_for_public(
 p_city text,p_postal_code text,p_remote boolean,p_skill text
) RETURNS TABLE(
 display_name text,city text,postal_code text,level smallint,verified_skills text[],
 remote_available boolean,rating_mean numeric,rating_count integer
) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RETURN QUERY
 SELECT p.display_name,p.city,p.postal_code,p.level,p.verified_skills,p.remote_available,
  (SELECT round(avg(r.rating::numeric),1) FROM public.bpei_customer_reviews r
   JOIN public.independent_profiles x ON x.user_id=r.partner_id
   WHERE x.display_name=p.display_name AND x.city IS NOT DISTINCT FROM p.city
    AND r.moderation='published') AS rating_mean,
  (SELECT count(*)::integer FROM public.bpei_customer_reviews r
   JOIN public.independent_profiles x ON x.user_id=r.partner_id
   WHERE x.display_name=p.display_name AND x.city IS NOT DISTINCT FROM p.city
    AND r.moderation='published') AS rating_count
 FROM bpei_private.search_active_partners(p_city,p_postal_code,p_remote,p_skill) p;
END $$;
REVOKE ALL ON FUNCTION bpei_private.review_summary_for_public(text,text,boolean,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.review_summary_for_public(text,text,boolean,text) TO anon,authenticated;
CREATE FUNCTION public.review_summary_for_public(
 p_city text DEFAULT NULL,p_postal_code text DEFAULT NULL,
 p_remote boolean DEFAULT false,p_skill text DEFAULT NULL
) RETURNS TABLE(
 display_name text,city text,postal_code text,level smallint,verified_skills text[],
 remote_available boolean,rating_mean numeric,rating_count integer
) LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM bpei_private.review_summary_for_public($1,$2,$3,$4)
$$;
REVOKE ALL ON FUNCTION public.review_summary_for_public(text,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_summary_for_public(text,text,boolean,text) TO anon,authenticated;
