DO $$
DECLARE v_id uuid := '00d9c5c9-0be4-4538-a77a-ea25eb607d8f';
BEGIN
  SET LOCAL session_replication_role = 'replica';
  DELETE FROM public.user_platform_roles WHERE user_id = v_id;
  DELETE FROM public.profiles WHERE id = v_id;
  DELETE FROM public.notifications WHERE user_id = v_id;
  DELETE FROM auth.identities WHERE user_id = v_id;
  DELETE FROM auth.sessions WHERE user_id = v_id;
  DELETE FROM auth.users WHERE id = v_id AND email = 'test.patron@bpei.test';
END $$;