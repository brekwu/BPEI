-- BPEI P0: privileged, explicit bootstrap for the FIRST administrator only.
-- NOT a migration. Run manually in a restricted Supabase SQL session AFTER the first
-- genuine human operator has signed up and confirmed their OWN e-mail address.
-- Do not use a fake user, dummy email, autoconfirm or client-side admin assignment.
-- Replace only the email below with the intended verified BPEI operator.
DO $$
DECLARE
 v_email constant text:='REPLACE_WITH_ACTUAL_CONFIRMED_BPEI_ADMIN_EMAIL';
 v_admin_id uuid;
BEGIN
 IF v_email='REPLACE_WITH_ACTUAL_CONFIRMED_BPEI_ADMIN_EMAIL'
 OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 THEN RAISE EXCEPTION 'Explicit verified operator email required'; END IF;
 IF (SELECT count(*) FROM public.independent_admins)<>0
 THEN RAISE EXCEPTION 'Bootstrap disabled: an administrator already exists'; END IF;
 SELECT u.id INTO STRICT v_admin_id
 FROM auth.users u
 WHERE lower(u.email)=lower(v_email)
   AND u.email_confirmed_at IS NOT NULL
   AND u.deleted_at IS NULL
   AND u.is_anonymous IS NOT TRUE;
 INSERT INTO public.independent_admins(user_id) VALUES(v_admin_id);
 RAISE NOTICE 'First BPEI administrator explicitly promoted after verifying Auth email';
EXCEPTION
 WHEN no_data_found THEN
  RAISE EXCEPTION 'No verified Supabase Auth user for the specified email';
 WHEN too_many_rows THEN
  RAISE EXCEPTION 'Ambiguous Auth account; stop for manual review';
END $$;
-- Immediately sign in with this account and test /gestion-independants.
-- Also sign in with a real ordinary test account and confirm admin access is denied.
