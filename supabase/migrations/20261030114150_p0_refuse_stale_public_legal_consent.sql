-- Applied to the BPEI Supabase project on 2026-10-30.
-- A public user must provide exactly the version displayed on their form.
-- Otherwise a publication while the form is open could be incorrectly
-- represented as the user's consent to a newer document.
-- The existing private administrator intake may omit a version, but only
-- when the JWT subject belongs to an explicitly approved administrator.
CREATE OR REPLACE FUNCTION bpei_private.stamp_public_inquiry_legal_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_version text;
  v_actor uuid := (SELECT auth.uid());
BEGIN
  SELECT ctrl.legal_version INTO v_version
  FROM public.bpei_launch_controls ctrl
  WHERE ctrl.id IS TRUE AND ctrl.legal_documents_published IS TRUE;

  IF v_version IS NULL OR NEW.consent_accepted IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Published legal documents and explicit acknowledgement required'
      USING ERRCODE='22023';
  END IF;

  IF NEW.legal_version IS NULL THEN
    IF v_actor IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.independent_admins a WHERE a.user_id=v_actor
    ) THEN
      RAISE EXCEPTION 'Current legal version acknowledgement required'
        USING ERRCODE='22023';
    END IF;
  ELSIF NEW.legal_version IS DISTINCT FROM v_version THEN
    RAISE EXCEPTION 'Legal version changed; refresh and acknowledge current text'
      USING ERRCODE='22023';
  END IF;

  NEW.legal_version := v_version;
  NEW.consent_at := now();
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION bpei_private.stamp_public_inquiry_legal_version() FROM PUBLIC,anon,authenticated;
