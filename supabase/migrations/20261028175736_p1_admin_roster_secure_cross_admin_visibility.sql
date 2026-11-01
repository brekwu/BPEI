-- P1 admin roster read policy, already applied on BPEI staging as 20261028175736.
-- Private membership check avoids recursive evaluation of admin roster RLS.
CREATE OR REPLACE FUNCTION bpei_private.is_bpei_admin(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT p_user_id IS NOT NULL
  AND p_user_id=(SELECT auth.uid())
  AND EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=p_user_id);
$$;
REVOKE ALL ON FUNCTION bpei_private.is_bpei_admin(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.is_bpei_admin(uuid) TO authenticated;
DROP POLICY independent_admin_read_self ON public.independent_admins;
CREATE POLICY independent_admin_read_roster ON public.independent_admins
 FOR SELECT TO authenticated
 USING (
   user_id=(SELECT auth.uid())
   OR bpei_private.is_bpei_admin((SELECT auth.uid()))
 );
