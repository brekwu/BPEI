-- BPEI P0: eight authenticated non-admin RPC access checks.
-- READ ONLY, fake JWT subject, no user insertion, no real requests or charges.
-- Run in Supabase SQL Editor with the authorized project operator role.
-- Must raise if ANY operation succeeds or returns a non-permission error.
BEGIN READ ONLY;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',true);
DO $rpc_denials$
DECLARE
 calls text[]:=ARRAY[
  'SELECT public.review_independent_application(NULL::uuid, ''approved'')',
  'SELECT public.approve_bpei_legal_document(''cgu'',''bpei-2026-v1'',repeat(''X'',350))',
  'SELECT public.publish_bpei_legal_documents(''bpei-2026-v1'')',
  'SELECT public.mvp_create_quote(NULL::uuid,''Example'', ''Example address'', ''x@example.invalid'', ''exempt'', ''Test'',1,9000,0)',
  'SELECT public.mvp_issue_invoice_compliant(NULL::uuid,current_date,current_date,''FR12345678901'',''Example payment terms'',''No discount given'',NULL,NULL)',
  'SELECT public.mvp_test_checkout_readiness(NULL::uuid)',
  'SELECT public.record_p0_attestation(''smtp_auth_delivery'',''UNAUTHORIZED TEST: never to be saved'',true)',
  'SELECT public.assign_bpei_inquiry(NULL::uuid,NULL::uuid)'
 ];
 q text;
 denied integer:=0;
 other text:='';
BEGIN
 FOREACH q IN ARRAY calls LOOP
  BEGIN
   EXECUTE q;
   RAISE EXCEPTION 'AUTH FAILURE: unauthorized caller reached %',q;
  EXCEPTION
   WHEN insufficient_privilege THEN denied:=denied+1;
   WHEN OTHERS THEN
    IF sqlstate='P0001' AND sqlerrm LIKE 'AUTH FAILURE:%' THEN RAISE;
    ELSE other:=other||SQLSTATE||':'||left(q,62)||';'; END IF;
  END;
 END LOOP;
 IF denied<>array_length(calls,1) OR other<>'' THEN
  RAISE EXCEPTION 'Unauthorized RPC smoke failed: denied=%/% other=%',denied,array_length(calls,1),other;
 END IF;
END $rpc_denials$;
ROLLBACK;
