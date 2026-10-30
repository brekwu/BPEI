-- Mandatory issuer-specific payment conditions for invoices; no fabricated tax identity.
-- Legacy issue endpoint remains defined but refuses further invoice issuance.
ALTER TABLE public.bpei_service_invoices
 ADD COLUMN issuer_vat_number text,
 ADD COLUMN payment_terms text,
 ADD COLUMN early_payment_discount text,
 ADD COLUMN late_payment_penalties text,
 ADD COLUMN customer_order_reference text,
 ADD COLUMN b2b_recovery_fee_cents integer,
 ADD CONSTRAINT bpei_invoice_vat_format CHECK (
  issuer_vat_number IS NULL OR issuer_vat_number ~ '^FR[0-9A-Z]{2}[0-9]{9}$'
 ),
 ADD CONSTRAINT bpei_invoice_terms_guard CHECK(
  (payment_terms IS NULL OR char_length(btrim(payment_terms)) BETWEEN 10 AND 500)
  AND (early_payment_discount IS NULL OR char_length(btrim(early_payment_discount)) BETWEEN 10 AND 250)
  AND (late_payment_penalties IS NULL OR char_length(btrim(late_payment_penalties)) BETWEEN 10 AND 400)
  AND (customer_order_reference IS NULL OR char_length(btrim(customer_order_reference)) BETWEEN 2 AND 160)
  AND (b2b_recovery_fee_cents IS NULL OR b2b_recovery_fee_cents=4000)
 );

CREATE OR REPLACE FUNCTION bpei_private.mvp_issue_invoice(p_quote_id uuid,p_service_date date,p_due_date date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 RAISE EXCEPTION 'Old incomplete invoice issue path disabled. Use the compliance-terms version'
 USING ERRCODE='42501';
END $$;

CREATE FUNCTION bpei_private.mvp_issue_invoice_compliant(
 p_quote_id uuid,p_service_date date,p_due_date date,
 p_issuer_vat_number text,p_payment_terms text,p_early_payment_discount text,
 p_late_payment_penalties text,p_customer_order_reference text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());v_quote public.bpei_service_quotes%ROWTYPE;
 v_next integer;v_year integer;v_id uuid;v_b2b boolean;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_actor)
 THEN RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_quote FROM public.bpei_service_quotes WHERE id=p_quote_id FOR UPDATE;
 IF NOT FOUND OR v_quote.status<>'accepted'
 THEN RAISE EXCEPTION 'Accepted quote required' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.independent_requests r
  WHERE r.inquiry_id=v_quote.inquiry_id AND r.independent_id=v_quote.issuer_id
  AND r.status='completed')
 THEN RAISE EXCEPTION 'Completed intervention required' USING ERRCODE='22023'; END IF;
 IF p_service_date IS NULL OR p_due_date IS NULL OR p_service_date>current_date
  OR p_due_date<current_date OR p_due_date>current_date+interval '60 days'
 THEN RAISE EXCEPTION 'Service and due dates must be reviewed' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bpei_service_invoices WHERE quote_id=p_quote_id)
 THEN RAISE EXCEPTION 'Invoice already issued' USING ERRCODE='23505'; END IF;
 IF char_length(btrim(coalesce(p_payment_terms,''))) NOT BETWEEN 10 AND 500
 OR char_length(btrim(coalesce(p_early_payment_discount,''))) NOT BETWEEN 10 AND 250
 THEN RAISE EXCEPTION 'Reviewed payment and early-discount terms required' USING ERRCODE='22023'; END IF;
 v_b2b:=v_quote.customer_kind='business';
 IF v_b2b AND char_length(btrim(coalesce(p_late_payment_penalties,''))) NOT BETWEEN 10 AND 400
 THEN RAISE EXCEPTION 'Documented B2B late payment penalties required' USING ERRCODE='22023'; END IF;
 IF v_quote.vat_basis_points>0 AND coalesce(btrim(p_issuer_vat_number),'') !~ '^FR[0-9A-Z]{2}[0-9]{9}$'
 THEN RAISE EXCEPTION 'Verified French VAT number required for taxed invoice' USING ERRCODE='22023'; END IF;
 IF nullif(btrim(coalesce(p_issuer_vat_number,'')),'') IS NOT NULL
 AND btrim(p_issuer_vat_number) !~ '^FR[0-9A-Z]{2}[0-9]{9}$'
 THEN RAISE EXCEPTION 'Invalid issuer VAT registration number' USING ERRCODE='22023'; END IF;
 IF nullif(btrim(coalesce(p_customer_order_reference,'')),'') IS NOT NULL
 AND char_length(btrim(p_customer_order_reference)) NOT BETWEEN 2 AND 160
 THEN RAISE EXCEPTION 'Invalid purchase order reference' USING ERRCODE='22023'; END IF;
 v_year:=extract(year FROM current_date)::integer;
 INSERT INTO public.bpei_invoice_counters(issuer_id,fiscal_year,latest_number)
 VALUES(v_quote.issuer_id,v_year,1)
 ON CONFLICT(issuer_id,fiscal_year) DO UPDATE
 SET latest_number=bpei_invoice_counters.latest_number+1
 RETURNING latest_number INTO v_next;
 INSERT INTO public.bpei_service_invoices(
  quote_id,issuer_id,fiscal_year,invoice_number,service_date,due_date,
  issuer_vat_number,payment_terms,early_payment_discount,late_payment_penalties,
  customer_order_reference,b2b_recovery_fee_cents
 ) VALUES(
  p_quote_id,v_quote.issuer_id,v_year,v_year::text||'-'||lpad(v_next::text,6,'0'),
  p_service_date,p_due_date,
  nullif(btrim(coalesce(p_issuer_vat_number,'')),''),
  btrim(p_payment_terms),btrim(p_early_payment_discount),
  CASE WHEN v_b2b THEN btrim(p_late_payment_penalties) ELSE NULL END,
  nullif(btrim(coalesce(p_customer_order_reference,'')),''),
  CASE WHEN v_b2b THEN 4000 ELSE NULL END
 ) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION bpei_private.mvp_issue_invoice_compliant(uuid,date,date,text,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mvp_issue_invoice_compliant(uuid,date,date,text,text,text,text,text)
 TO authenticated;

CREATE FUNCTION public.mvp_issue_invoice_compliant(
 p_quote_id uuid,p_service_date date,p_due_date date,
 p_issuer_vat_number text,p_payment_terms text,p_early_payment_discount text,
 p_late_payment_penalties text,p_customer_order_reference text
) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT bpei_private.mvp_issue_invoice_compliant($1,$2,$3,$4,$5,$6,$7,$8)
$$;
REVOKE ALL ON FUNCTION public.mvp_issue_invoice_compliant(uuid,date,date,text,text,text,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_issue_invoice_compliant(uuid,date,date,text,text,text,text,text)
 TO authenticated;
