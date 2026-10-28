-- Restrict legacy table-level privileges; TRUNCATE is not protected by RLS.
REVOKE ALL PRIVILEGES ON TABLE public.independent_profiles,public.independent_requests,public.independent_applications FROM anon,authenticated;
GRANT SELECT,INSERT ON TABLE public.independent_profiles TO authenticated;
GRANT UPDATE(display_name,business_name,siret,city,postal_code,service_radius_km,skills,bio) ON TABLE public.independent_profiles TO authenticated;
GRANT SELECT ON TABLE public.independent_requests TO authenticated;
GRANT SELECT ON TABLE public.independent_applications TO authenticated;
GRANT INSERT(user_id,message) ON TABLE public.independent_applications TO authenticated;

-- Administrator assignments are created by a privileged operator only.
CREATE TABLE IF NOT EXISTS public.independent_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.independent_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.independent_admins FROM anon,authenticated;
GRANT SELECT ON TABLE public.independent_admins TO authenticated;
CREATE POLICY independent_admin_read_self ON public.independent_admins
  FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));

CREATE POLICY independent_admin_read_profiles ON public.independent_profiles
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
  );
CREATE POLICY independent_admin_read_applications ON public.independent_applications
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
  );

ALTER TABLE public.independent_applications ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.review_independent_application(
 p_application_id uuid, p_new_status text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_admin uuid := (SELECT auth.uid());
 v_app record;
 v_profile record;
BEGIN
 IF v_admin IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_admin) THEN
   RAISE EXCEPTION 'Not authorized to review applications' USING ERRCODE='42501';
 END IF;
 IF p_new_status NOT IN ('under_review','approved','rejected') OR p_new_status IS NULL THEN
   RAISE EXCEPTION 'Invalid status' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_app FROM public.independent_applications
 WHERE id=p_application_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application not found' USING ERRCODE='P0002'; END IF;
 IF p_new_status='approved' THEN
   SELECT * INTO v_profile FROM public.independent_profiles
    WHERE user_id=v_app.user_id FOR UPDATE;
   IF NOT FOUND OR v_profile.siret IS NULL OR v_profile.siret !~ '^[0-9]{14}$' THEN
     RAISE EXCEPTION 'Valid 14-digit SIRET required before approval' USING ERRCODE='22023';
   END IF;
 END IF;
 UPDATE public.independent_applications SET status=p_new_status, reviewed_at=now(), reviewed_by=v_admin
   WHERE id=p_application_id;
 UPDATE public.independent_profiles
   SET verified_at=CASE WHEN p_new_status='approved' THEN now() ELSE NULL END,
       updated_at=now()
   WHERE user_id=v_app.user_id;
 RETURN jsonb_build_object('id',p_application_id,'status',p_new_status);
END;
$$;
REVOKE ALL ON FUNCTION public.review_independent_application(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_independent_application(uuid,text) TO authenticated;
