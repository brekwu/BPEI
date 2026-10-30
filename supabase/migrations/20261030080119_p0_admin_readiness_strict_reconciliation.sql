-- BPEI P0 security hardening. Replaces only the private readiness diagnostic.
-- Never grants roles, creates accounts, changes release flags, publishes legal
-- documents, sends mail, or enables any Stripe payment.
-- Readiness counts JOIN a paid TEST session to a verified issuer account,
-- an accepted quote and its invoice; a published legal version requires all
-- three approved documents. External attestations remain necessary.
CREATE OR REPLACE FUNCTION bpei_private.p0_readiness() RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_actor uuid:=(SELECT auth.uid());
 v_admins int;
 v_users int;
 v_merchants int;
 v_sent int;
 v_paid int;
 v_accepted_quotes int;
 v_invoices int;
 v_legal boolean;
 v_mail boolean;
 v_sender boolean;
 v_payments boolean;
 v_flags jsonb;
 v_summary jsonb;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.independent_admins a
  JOIN auth.users u ON u.id=a.user_id
  WHERE a.user_id=v_actor AND u.email_confirmed_at IS NOT NULL
   AND u.deleted_at IS NULL AND u.is_anonymous IS NOT TRUE
 ) THEN RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501'; END IF;

 SELECT count(*) INTO v_admins FROM public.independent_admins a
 JOIN auth.users u ON u.id=a.user_id
 WHERE u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
 AND u.is_anonymous IS NOT TRUE;
 SELECT count(*) INTO v_users FROM auth.users u
 WHERE u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
 AND u.is_anonymous IS NOT TRUE;
 SELECT count(*) INTO v_merchants FROM public.bpei_stripe_connected_accounts
 WHERE test_enabled=true AND test_verified_at IS NOT NULL;
 SELECT count(*) INTO v_sent FROM public.bpei_commercial_mail_outbox WHERE status='sent';
 SELECT count(*) INTO v_paid
 FROM public.bpei_payment_attempts p
 JOIN public.bpei_stripe_connected_accounts m
  ON m.issuer_id=p.issuer_id AND m.stripe_account_id=p.connected_account_id
 JOIN public.bpei_service_invoices i
  ON i.id=p.invoice_id AND i.issuer_id=p.issuer_id
 JOIN public.bpei_service_quotes q
  ON q.id=i.quote_id AND q.issuer_id=i.issuer_id
 WHERE p.state='paid' AND p.paid_at IS NOT NULL
  AND p.checkout_session_id LIKE 'cs_test_%'
  AND p.currency='eur' AND p.amount_cents=q.gross_cents
  AND m.test_enabled IS TRUE AND m.test_verified_at IS NOT NULL
  AND q.status='accepted' AND q.accepted_at IS NOT NULL
  AND nullif(btrim(q.acceptance_reference),'') IS NOT NULL;
 SELECT count(*) INTO v_accepted_quotes FROM public.bpei_service_quotes q
 WHERE q.status='accepted' AND q.accepted_at IS NOT NULL
  AND nullif(btrim(q.acceptance_reference),'') IS NOT NULL;
 SELECT count(*) INTO v_invoices FROM public.bpei_service_invoices i
 JOIN public.bpei_service_quotes q ON q.id=i.quote_id AND q.issuer_id=i.issuer_id
 WHERE q.status='accepted' AND q.accepted_at IS NOT NULL
  AND nullif(btrim(q.acceptance_reference),'') IS NOT NULL;
 SELECT (
   c.legal_documents_published IS TRUE
   AND c.legal_version IS NOT NULL
   AND EXISTS(
    SELECT 1 FROM public.bpei_legal_releases r WHERE r.version=c.legal_version
   )
   AND 3=(
    SELECT count(DISTINCT d.kind) FROM public.bpei_legal_documents d
    WHERE d.version=c.legal_version
     AND d.kind IN ('mentions-legales','confidentialite','cgu')
   )
 ) INTO v_legal FROM public.bpei_launch_controls c WHERE c.id=true;
 SELECT enabled,validated_legal_sender INTO v_mail,v_sender FROM public.bpei_commercial_mail_controls WHERE id=true;
 SELECT test_checkout_enabled INTO v_payments FROM public.bpei_payment_controls WHERE id=true;

 SELECT coalesce(jsonb_object_agg(check_key,jsonb_build_object(
  'reference',evidence_reference,'verified_at',verified_at,'verified_by',verified_by
 )),'{}'::jsonb) INTO v_flags FROM public.bpei_p0_attestations;

 v_summary:=jsonb_build_object(
  'admin_account',jsonb_build_object('ready',v_admins>0,'verified_accounts',v_admins),
  'smtp_auth',jsonb_build_object('ready',v_users>0 AND v_flags ? 'smtp_auth_delivery',
   'evidence',v_flags->'smtp_auth_delivery','verification','manual'),
  'legal',jsonb_build_object('ready',v_legal IS TRUE AND v_flags ? 'legal_operator_review',
   'published',coalesce(v_legal,false),'evidence',v_flags->'legal_operator_review','verification','manual_and_database'),
  'commercial_email',jsonb_build_object('ready',v_mail IS TRUE AND v_sender IS TRUE
    AND v_sent>0 AND v_flags ? 'commercial_sender_receipt',
   'outbox_provider_accepted',v_sent,'evidence',v_flags->'commercial_sender_receipt'),
  'commission_and_einvoice',jsonb_build_object('ready',
    v_flags ? 'partner_commission_signed' AND v_flags ? 'e_invoice_platform_receipt',
    'commission_reference',v_flags->'partner_commission_signed',
    'e_invoice_reference',v_flags->'e_invoice_platform_receipt',
    'verification','manual'),
  'stripe_test',jsonb_build_object('ready',v_payments IS TRUE AND v_merchants>0
    AND v_paid>0 AND v_flags ? 'stripe_test_payment',
   'active_test_merchants',v_merchants,'paid_test_attempts',v_paid,
   'evidence',v_flags->'stripe_test_payment'),
  'pilot_e2e',jsonb_build_object('ready',v_users>=2 AND v_accepted_quotes>0
    AND v_invoices>0 AND v_paid>0 AND v_flags ? 'full_pilot_verified',
    'verified_users',v_users,'accepted_quotes',v_accepted_quotes,
    'invoices',v_invoices,'evidence',v_flags->'full_pilot_verified')
 );
 RETURN jsonb_build_object(
  'mode','preproduction','checked_at',now(),
  'checks',v_summary,
  'all_ready',(SELECT bool_and(coalesce((value->>'ready')::boolean,false))
      FROM pg_catalog.jsonb_each(v_summary))
 );
END $$;
