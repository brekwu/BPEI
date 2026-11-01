-- Prelaunch transactional quote/invoice email outbox. No sending until explicit legal/provider activation.
CREATE TABLE public.bpei_commercial_mail_controls(
 id boolean PRIMARY KEY DEFAULT true CHECK(id=true),
 enabled boolean NOT NULL DEFAULT false,
 validated_legal_sender boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (NOT enabled OR validated_legal_sender=true)
);
INSERT INTO public.bpei_commercial_mail_controls(id,enabled,validated_legal_sender)
 VALUES(true,false,false);
ALTER TABLE public.bpei_commercial_mail_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_commercial_mail_controls FROM PUBLIC,anon,authenticated;
CREATE POLICY bpei_mail_controls_no_client_read
 ON public.bpei_commercial_mail_controls FOR SELECT TO anon,authenticated USING(false);

CREATE TABLE public.bpei_commercial_mail_outbox(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN ('quote','invoice')),
 document_id uuid NOT NULL,
 recipient text NOT NULL CHECK(char_length(btrim(recipient)) BETWEEN 5 AND 254 AND recipient LIKE '%@%'),
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','sent','failed','unknown')),
 provider_message_id text,
 reserved_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 UNIQUE(kind,document_id),
 CHECK((status='sent' AND provider_message_id IS NOT NULL AND completed_at IS NOT NULL)
 OR (status<>'sent' AND provider_message_id IS NULL))
);
CREATE INDEX bpei_mail_outbox_creator_idx ON public.bpei_commercial_mail_outbox(created_by);
ALTER TABLE public.bpei_commercial_mail_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_commercial_mail_outbox FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_commercial_mail_outbox TO authenticated;
CREATE POLICY bpei_mail_outbox_admin_read ON public.bpei_commercial_mail_outbox
 FOR SELECT TO authenticated USING(EXISTS(
  SELECT 1 FROM public.independent_admins WHERE user_id=(SELECT auth.uid())
 ));
