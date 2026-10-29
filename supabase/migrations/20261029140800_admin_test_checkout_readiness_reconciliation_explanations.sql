-- Private test-only invoice readiness diagnostics. Read-only, no checkout creation.
CREATE FUNCTION bpei_private.mvp_test_checkout_readiness(p_invoice_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_actor uuid:=(SELECT auth.uid());
 v_invoice record;
 v_mission record;
 v_terms record;
 v_merchant record;
 v_messages text[]:=ARRAY[]::text[];
 v_fee bigint:=0;
 v_allowed boolean;
 v_legal boolean;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.independent_admins a WHERE a.user_id=v_actor
 ) THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 SELECT i.id AS invoice_id,i.issuer_id,i.payment_status,
  q.id AS quote_id,q.inquiry_id,q.status AS quote_status,
  q.net_cents,q.gross_cents,q.vat_basis_points
 INTO v_invoice
 FROM public.bpei_service_invoices i
 JOIN public.bpei_service_quotes q ON q.id=i.quote_id AND q.issuer_id=i.issuer_id
 WHERE i.id=p_invoice_id;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('ready',false,'mode','test',
   'reasons',jsonb_build_array('Facture ou devis émetteur introuvable.'));
 END IF;
 SELECT test_checkout_enabled INTO v_allowed FROM public.bpei_payment_controls WHERE id=true;
 SELECT legal_documents_published INTO v_legal FROM public.bpei_launch_controls WHERE id=true;
 IF v_legal IS DISTINCT FROM true THEN v_messages:=array_append(v_messages,
  'Documents juridiques BPEI non publiés et approuvés.'); END IF;
 IF v_allowed IS DISTINCT FROM true THEN v_messages:=array_append(v_messages,
  'Paiement Stripe TEST désactivé en base.'); END IF;
 IF v_invoice.quote_status<>'accepted' THEN v_messages:=array_append(v_messages,
  'Devis sans acceptation vérifiable du client.'); END IF;
 IF v_invoice.payment_status<>'unpaid' THEN v_messages:=array_append(v_messages,
  'Facture déjà acquittée ou non payable.'); END IF;
 IF v_invoice.gross_cents NOT BETWEEN 100 AND 99999999 THEN v_messages:=array_append(v_messages,
  'Montant de facture hors plage de test.'); END IF;
 IF v_invoice.vat_basis_points<>0 OR v_invoice.net_cents<>v_invoice.gross_cents
 THEN v_messages:=array_append(v_messages,
  'TVA et commission de plateforme non homologuées ensemble : checkout test fermé.'); END IF;
 SELECT r.id,r.status INTO v_mission
 FROM public.independent_requests r
 WHERE r.inquiry_id=v_invoice.inquiry_id AND r.independent_id=v_invoice.issuer_id
 ORDER BY (r.status='completed') DESC,r.created_at DESC LIMIT 1;
 IF NOT FOUND OR v_mission.status<>'completed' THEN
  v_messages:=array_append(v_messages,'Intervention effectivement terminée non confirmée.');
 ELSE
  SELECT p.status,p.client_price_ht_cents,p.technician_ht_cents,
   p.bpei_ht_cents,p.accepted_at,p.contractual_reference,p.source
  INTO v_terms FROM public.bpei_partner_compensation_proposals p
  WHERE p.request_id=v_mission.id AND p.partner_id=v_invoice.issuer_id;
  IF NOT FOUND OR v_terms.status<>'accepted' OR v_terms.accepted_at IS NULL THEN
   v_messages:=array_append(v_messages,'Rémunération HT non acceptée par le technicien.');
  ELSE
   IF v_terms.client_price_ht_cents::bigint<>v_invoice.net_cents OR
    v_terms.technician_ht_cents::bigint+v_terms.bpei_ht_cents::bigint<>v_invoice.net_cents
   THEN v_messages:=array_append(v_messages,
    'Le partage contractuel HT ne correspond pas au devis accepté.'); END IF;
   IF v_terms.source='referral' AND NOT EXISTS(
    SELECT 1 FROM public.bpei_partner_referral_agreements a
    WHERE a.request_id=v_mission.id AND a.performing_partner_id=v_invoice.issuer_id
     AND a.state='accepted'
   ) THEN v_messages:=array_append(v_messages,
    'L’apporteur interrégional n’a pas encore accepté sa convention.'); END IF;
  END IF;
 END IF;
 SELECT m.test_enabled,m.test_verified_at,m.test_application_fee_bps,
  m.fee_agreement_reference,m.fee_agreement_at
 INTO v_merchant FROM public.bpei_stripe_connected_accounts m
 WHERE m.issuer_id=v_invoice.issuer_id;
 IF NOT FOUND OR v_merchant.test_enabled IS DISTINCT FROM true OR
  v_merchant.test_verified_at IS NULL THEN
  v_messages:=array_append(v_messages,'Compte marchand Stripe TEST non vérifié/activé.');
 ELSIF v_terms.status='accepted' THEN
  v_fee:=((v_invoice.gross_cents::bigint*v_merchant.test_application_fee_bps::bigint)+5000)/10000;
  IF v_fee<>v_terms.bpei_ht_cents OR v_fee>((v_invoice.gross_cents::bigint*2500+5000)/10000)
  THEN v_messages:=array_append(v_messages,
   'Frais Stripe TEST différents de la part BPEI contractuelle ou au-dessus du plafond de sécurité de 25 %.'); END IF;
  IF v_terms.bpei_ht_cents>0 AND (
    v_merchant.fee_agreement_at IS NULL OR
    char_length(btrim(coalesce(v_merchant.fee_agreement_reference,'')))<12 OR
    position(btrim(coalesce(v_merchant.fee_agreement_reference,''))
     IN btrim(v_terms.contractual_reference))=0
  ) THEN v_messages:=array_append(v_messages,
   'Référence de la commission Stripe absente de la convention de mission.'); END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.bpei_payment_attempts a
  WHERE a.invoice_id=p_invoice_id AND a.state IN ('pending','open','paid'))
 THEN v_messages:=array_append(v_messages,
  'Un Checkout test existe déjà ou le paiement a été enregistré.'); END IF;
 RETURN jsonb_build_object('ready',coalesce(array_length(v_messages,1),0)=0,
  'mode','test','reasons',to_jsonb(v_messages),
  'invoice_id',v_invoice.invoice_id);
END $$;
REVOKE ALL ON FUNCTION bpei_private.mvp_test_checkout_readiness(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mvp_test_checkout_readiness(uuid) TO authenticated;
CREATE FUNCTION public.mvp_test_checkout_readiness(p_invoice_id uuid)
 RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.mvp_test_checkout_readiness($1)
$$;
REVOKE ALL ON FUNCTION public.mvp_test_checkout_readiness(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_test_checkout_readiness(uuid) TO authenticated;
