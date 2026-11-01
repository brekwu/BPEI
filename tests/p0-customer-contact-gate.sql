-- BPEI P0: no-write customer-contact validation smoke.
-- Tests the deployed PRIVATE SQL helper without creating any customer or Auth user.
BEGIN READ ONLY;
DO $check$
DECLARE bad_count integer;
BEGIN
 WITH cases(email,phone,expected) AS (
  VALUES
  ('client@example.fr','06 12 34 56 78',true),
  ('client+test@company.co.uk','+33 (0)6 12 34 56 78',true),
  ('contact@atelier-informatique.fr','01.23.45.67.89',true),
  ('missing-at.example.fr','06 12 34 56 78',false),
  ('bad@@example.fr','06 12 34 56 78',false),
  ('client@example','06 12 34 56 78',false),
  ('person..dot@example.fr','06 12 34 56 78',false),
  ('client@example..fr','06 12 34 56 78',false),
  ('client@example.fr','ABC123',false),
  ('client@example.fr','123',false),
  ('client@example.fr','+33 6 11 22 33 44 55 66 77 88',false),
  ('','06 12 34 56 78',false)
 ), checked AS (
  SELECT expected,bpei_private.valid_customer_contact(email,phone) actual
  FROM cases
 )
 SELECT count(*) FILTER (WHERE expected IS DISTINCT FROM actual) INTO bad_count
 FROM checked;
 IF bad_count<>0 THEN RAISE EXCEPTION 'P0 contact validator mismatch in % cases',bad_count; END IF;
 IF has_function_privilege('anon','bpei_private.valid_customer_contact(text,text)','EXECUTE')
  OR has_function_privilege('authenticated','bpei_private.valid_customer_contact(text,text)','EXECUTE')
  OR pg_get_functiondef('bpei_private.mvp_admin_create_inquiry(text,text,text,text,text,text,text,text,text,text,text,text,boolean,text)'::regprocedure)
     NOT LIKE '%bpei_private.valid_customer_contact(p_email,p_phone)%'
 THEN
  RAISE EXCEPTION 'Customer contact validator permissions or admin RPC wiring missing';
 END IF;
END $check$;
ROLLBACK;
