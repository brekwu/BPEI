CREATE TABLE public.bpei_intake_flags(
 kind text PRIMARY KEY CHECK(kind IN ('contact','intervention')),
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.bpei_intake_flags(kind,enabled) VALUES ('contact',false),('intervention',false);
ALTER TABLE public.bpei_intake_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_intake_flags FROM anon, authenticated;
GRANT SELECT ON public.bpei_intake_flags TO anon, authenticated;
CREATE POLICY bpei_intake_flags_public_read ON public.bpei_intake_flags
 FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.bpei_inquiries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN ('contact','intervention')),
 client_name text NOT NULL CHECK (char_length(btrim(client_name)) BETWEEN 2 AND 120),
 email text NOT NULL CHECK (char_length(email) BETWEEN 5 AND 254 AND email LIKE '%@%'),
 phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
 city text CHECK (city IS NULL OR char_length(city) <= 120),
 subject text NOT NULL CHECK(char_length(btrim(subject)) BETWEEN 3 AND 160),
 description text NOT NULL CHECK(char_length(btrim(description)) BETWEEN 15 AND 3000),
 consent_accepted boolean NOT NULL DEFAULT false CHECK(consent_accepted=true),
 consent_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','assigned','closed')),
 assigned_to uuid REFERENCES public.independent_profiles(user_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bpei_inquiries_status_created_idx ON public.bpei_inquiries(status,created_at DESC);
CREATE INDEX bpei_inquiries_assigned_idx ON public.bpei_inquiries(assigned_to) WHERE assigned_to IS NOT NULL;
ALTER TABLE public.bpei_inquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_inquiries FROM anon, authenticated;
GRANT INSERT(kind,client_name,email,phone,city,subject,description,consent_accepted)
 ON public.bpei_inquiries TO anon, authenticated;
GRANT SELECT ON public.bpei_inquiries TO authenticated;
CREATE POLICY bpei_inquiries_create_if_open ON public.bpei_inquiries
 FOR INSERT TO anon, authenticated
 WITH CHECK (
   status='new' AND assigned_to IS NULL AND consent_accepted=true
   AND EXISTS(SELECT 1 FROM public.bpei_intake_flags f WHERE f.kind=bpei_inquiries.kind AND f.enabled=true)
 );
CREATE POLICY bpei_inquiries_admin_read ON public.bpei_inquiries
 FOR SELECT TO authenticated USING(
   EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
 );

ALTER TABLE public.independent_requests
 ADD COLUMN inquiry_id uuid REFERENCES public.bpei_inquiries(id);
CREATE UNIQUE INDEX independent_requests_unique_active_inquiry_idx
 ON public.independent_requests(inquiry_id) WHERE inquiry_id IS NOT NULL AND status<>'cancelled';

CREATE OR REPLACE FUNCTION public.assign_bpei_inquiry(p_inquiry_id uuid, p_independent_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
 AS $$
 DECLARE v_row public.bpei_inquiries%ROWTYPE; v_id uuid;
 BEGIN
   IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=auth.uid()) THEN
     RAISE EXCEPTION 'BPEI admin required' USING ERRCODE='42501';
   END IF;
   IF NOT EXISTS (
      SELECT 1 FROM public.independent_profiles p
      JOIN public.independent_applications a ON a.user_id=p.user_id
      WHERE p.user_id=p_independent_id AND p.verified_at IS NOT NULL AND a.status='approved'
   ) THEN RAISE EXCEPTION 'Independent must be approved and verified' USING ERRCODE='22023';
   END IF;
   SELECT * INTO v_row FROM public.bpei_inquiries
    WHERE id=p_inquiry_id FOR UPDATE;
   IF NOT FOUND OR v_row.kind<>'intervention' OR v_row.status<>'new' THEN
      RAISE EXCEPTION 'Intervention request unavailable' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.independent_requests(independent_id,inquiry_id,title,description,status)
   VALUES(p_independent_id,p_inquiry_id,v_row.subject,concat_ws(' — ',v_row.city,v_row.description),'new')
   RETURNING id INTO v_id;
   UPDATE public.bpei_inquiries SET status='assigned',assigned_to=p_independent_id,updated_at=now()
    WHERE id=p_inquiry_id;
   RETURN v_id;
 END
 $$;
REVOKE ALL ON FUNCTION public.assign_bpei_inquiry(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_bpei_inquiry(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_independent_request(p_request_id uuid, p_response text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
 AS $$
 DECLARE v_request public.independent_requests%ROWTYPE;
 BEGIN
   IF auth.uid() IS NULL OR p_response NOT IN ('accepted','declined') THEN
      RAISE EXCEPTION 'Invalid response or not authenticated' USING ERRCODE='42501';
   END IF;
   SELECT * INTO v_request FROM public.independent_requests
    WHERE id=p_request_id FOR UPDATE;
   IF NOT FOUND OR v_request.independent_id<>auth.uid() OR v_request.status<>'new' THEN
      RAISE EXCEPTION 'Mission unavailable' USING ERRCODE='42501';
   END IF;
   UPDATE public.independent_requests
    SET status=CASE WHEN p_response='accepted' THEN 'accepted' ELSE 'cancelled' END,updated_at=now()
    WHERE id=p_request_id;
   IF p_response='declined' AND v_request.inquiry_id IS NOT NULL THEN
     UPDATE public.bpei_inquiries SET status='new',assigned_to=NULL,updated_at=now()
       WHERE id=v_request.inquiry_id;
   END IF;
   RETURN p_response;
 END
 $$;
REVOKE ALL ON FUNCTION public.respond_independent_request(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_independent_request(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_bpei_inquiry(p_inquiry_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
 AS $$
 BEGIN
   IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=auth.uid()) THEN
     RAISE EXCEPTION 'BPEI admin required' USING ERRCODE='42501';
   END IF;
   UPDATE public.bpei_inquiries SET status='closed',updated_at=now()
     WHERE id=p_inquiry_id AND status='new';
   IF NOT FOUND THEN RAISE EXCEPTION 'Cannot close request' USING ERRCODE='22023'; END IF;
 END
 $$;
REVOKE ALL ON FUNCTION public.close_bpei_inquiry(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.close_bpei_inquiry(uuid) TO authenticated;
