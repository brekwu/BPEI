CREATE TABLE public.bpei_launch_controls (
  id boolean PRIMARY KEY DEFAULT true CHECK(id=true),
  legal_documents_published boolean NOT NULL DEFAULT false,
  independent_registration_enabled boolean NOT NULL DEFAULT false,
  legal_version text,
  legal_published_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signup_requires_legal CHECK(
     independent_registration_enabled=false OR
     (legal_documents_published=true AND legal_version IS NOT NULL AND length(trim(legal_version))>=3 AND legal_published_at IS NOT NULL)
  )
);
INSERT INTO public.bpei_launch_controls(id) VALUES(true);
ALTER TABLE public.bpei_launch_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bpei_launch_controls FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.bpei_launch_controls TO anon,authenticated;
CREATE POLICY bpei_launch_controls_read ON public.bpei_launch_controls FOR SELECT TO anon,authenticated USING(true);
CREATE TABLE public.bpei_legal_acceptances (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 legal_version text NOT NULL CHECK(length(trim(legal_version))>=3 AND length(legal_version)<=90),
 accepted_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,legal_version)
);
ALTER TABLE public.bpei_legal_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_legal_acceptances FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_legal_acceptances TO authenticated;
GRANT INSERT(user_id,legal_version) ON public.bpei_legal_acceptances TO authenticated;
CREATE POLICY bpei_legal_acceptances_owner_read ON public.bpei_legal_acceptances FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
CREATE POLICY bpei_legal_acceptances_owner_insert ON public.bpei_legal_acceptances FOR INSERT TO authenticated
 WITH CHECK(
  user_id=(SELECT auth.uid()) AND
  EXISTS(SELECT 1 FROM public.bpei_launch_controls c
   WHERE c.legal_documents_published AND c.legal_version=bpei_legal_acceptances.legal_version)
 );
