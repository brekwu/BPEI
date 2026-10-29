-- BPEI commercial MVP: quote, client acceptance proof and immutable invoice issuance.
-- Only authenticated administrators can invoke writes; no Stripe account, live payment or mail is activated.
CREATE TABLE public.bpei_service_quotes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 inquiry_id uuid NOT NULL UNIQUE REFERENCES public.bpei_inquiries(id) ON DELETE RESTRICT,
 issuer_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE RESTRICT,
 created_by uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','accepted')),
 issuer_legal_name text NOT NULL CHECK(char_length(btrim(issuer_legal_name)) BETWEEN 5 AND 180),
 issuer_siret text NOT NULL CHECK(issuer_siret ~ '^[0-9]{14}$'),
 issuer_address text NOT NULL CHECK(char_length(btrim(issuer_address)) BETWEEN 10 AND 300),
 issuer_email text NOT NULL CHECK(char_length(btrim(issuer_email)) BETWEEN 5 AND 254 AND issuer_email LIKE '%@%'),
 tax_mention text NOT NULL DEFAULT '' CHECK(char_length(tax_mention)<=200),
 customer_name text NOT NULL CHECK(char_length(btrim(customer_name)) BETWEEN 2 AND 180),
 customer_email text NOT NULL CHECK(char_length(customer_email) BETWEEN 5 AND 254),
 customer_address text NOT NULL CHECK(char_length(btrim(customer_address)) BETWEEN 10 AND 350),
 customer_kind text NOT NULL CHECK(customer_kind IN ('individual','business')),
 customer_siret text CHECK(customer_siret IS NULL OR customer_siret ~ '^[0-9]{14}$'),
 service_description text NOT NULL CHECK(char_length(btrim(service_description)) BETWEEN 10 AND 1000),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
 unit_price_cents integer NOT NULL CHECK(unit_price_cents BETWEEN 100 AND 20000000),
 vat_basis_points integer NOT NULL CHECK(vat_basis_points IN (0,210,550,1000,2000)),
 net_cents bigint GENERATED ALWAYS AS (quantity::bigint * unit_price_cents::bigint) STORED,
 vat_cents bigint GENERATED ALWAYS AS (pg_catalog.round((quantity::numeric * unit_price_cents::numeric * vat_basis_points::numeric)/10000)::bigint) STORED,
 gross_cents bigint GENERATED ALWAYS AS (
   quantity::bigint * unit_price_cents::bigint +
   pg_catalog.round((quantity::numeric * unit_price_cents::numeric * vat_basis_points::numeric)/10000)::bigint
 ) STORED,
 accepted_at timestamptz,
 accepted_by_method text CHECK(accepted_by_method IS NULL OR accepted_by_method IN ('signed','email')),
 acceptance_reference text CHECK(acceptance_reference IS NULL OR char_length(btrim(acceptance_reference)) BETWEEN 10 AND 300),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT bpei_quote_acceptance_consistency CHECK(
   (status='proposed' AND accepted_at IS NULL AND accepted_by_method IS NULL AND acceptance_reference IS NULL)
   OR (status='accepted' AND accepted_at IS NOT NULL AND accepted_by_method IS NOT NULL AND acceptance_reference IS NOT NULL)
 ),
 CONSTRAINT bpei_quote_tax_exemption CHECK(vat_basis_points<>0 OR char_length(btrim(tax_mention)) BETWEEN 10 AND 200)
);
CREATE INDEX bpei_quote_issuer_created ON public.bpei_service_quotes(issuer_id,created_at DESC);
ALTER TABLE public.bpei_service_quotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_service_quotes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_service_quotes TO authenticated;
CREATE POLICY bpei_quote_read_authorized ON public.bpei_service_quotes
 FOR SELECT TO authenticated USING(
 issuer_id=(SELECT auth.uid())
 OR EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
);

CREATE TABLE public.bpei_invoice_counters(
 issuer_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE RESTRICT,
 fiscal_year integer NOT NULL CHECK(fiscal_year BETWEEN 2020 AND 2100),
 latest_number integer NOT NULL CHECK(latest_number BETWEEN 1 AND 999999),
 PRIMARY KEY(issuer_id,fiscal_year)
);
ALTER TABLE public.bpei_invoice_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_invoice_counters FROM PUBLIC,anon,authenticated;

CREATE TABLE public.bpei_service_invoices(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 quote_id uuid NOT NULL UNIQUE REFERENCES public.bpei_service_quotes(id) ON DELETE RESTRICT,
 issuer_id uuid NOT NULL REFERENCES public.independent_profiles(user_id) ON DELETE RESTRICT,
 fiscal_year integer NOT NULL,
 invoice_number text NOT NULL CHECK(invoice_number ~ '^[0-9]{4}-[0-9]{6}$'),
 issued_at timestamptz NOT NULL DEFAULT now(),
 service_date date NOT NULL,
 due_date date NOT NULL,
 payment_status text NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid')),
 UNIQUE(issuer_id,invoice_number),
 CONSTRAINT bpei_invoice_due_date_guard CHECK(due_date >= service_date)
);
CREATE INDEX bpei_invoice_issuer_issue ON public.bpei_service_invoices(issuer_id,issued_at DESC);
ALTER TABLE public.bpei_service_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bpei_service_invoices FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bpei_service_invoices TO authenticated;
CREATE POLICY bpei_invoice_read_authorized ON public.bpei_service_invoices
 FOR SELECT TO authenticated USING(
 issuer_id=(SELECT auth.uid())
 OR EXISTS(SELECT 1 FROM public.independent_admins a WHERE a.user_id=(SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION bpei_private.mvp_create_quote(
 p_inquiry_id uuid,p_issuer_legal_name text,p_issuer_address text,
 p_issuer_email text,p_tax_mention text,p_service_description text,
 p_quantity integer,p_unit_price_cents integer,p_vat_basis_points integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid()); v_inquiry public.bpei_inquiries%ROWTYPE;
v_issuer record; v_id uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_actor)
 THEN RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_inquiry FROM public.bpei_inquiries WHERE id=p_inquiry_id FOR UPDATE;
 IF NOT FOUND OR v_inquiry.kind<>'intervention' OR v_inquiry.status<>'assigned'
    OR v_inquiry.assigned_to IS NULL OR v_inquiry.address_line1 IS NULL OR v_inquiry.postal_code IS NULL
 THEN RAISE EXCEPTION 'Assigned, complete intervention required' USING ERRCODE='22023'; END IF;
 SELECT p.user_id,p.siret,p.verified_at INTO v_issuer
 FROM public.independent_profiles p
 JOIN public.independent_applications a ON a.user_id=p.user_id AND a.status='approved'
 JOIN public.independent_verification_checks c ON c.user_id=p.user_id
   AND c.insurance_confirmed=true AND c.insurance_expires_on>=current_date
 WHERE p.user_id=v_inquiry.assigned_to AND p.verified_at IS NOT NULL;
 IF NOT FOUND OR v_issuer.siret IS NULL THEN
  RAISE EXCEPTION 'Verified and currently insured issuer required' USING ERRCODE='22023'; END IF;
 IF p_quantity NOT BETWEEN 1 AND 100 OR p_unit_price_cents NOT BETWEEN 100 AND 20000000
 OR p_vat_basis_points NOT IN (0,210,550,1000,2000) THEN
  RAISE EXCEPTION 'Invalid quote amount or tax rate' USING ERRCODE='22023'; END IF;
 IF p_vat_basis_points=0 AND char_length(btrim(coalesce(p_tax_mention,''))) NOT BETWEEN 10 AND 200
 THEN RAISE EXCEPTION 'Validated tax-exemption legal mention required' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bpei_service_quotes(
 inquiry_id,issuer_id,created_by,issuer_legal_name,issuer_siret,issuer_address,issuer_email,tax_mention,
 customer_name,customer_email,customer_address,customer_kind,customer_siret,service_description,
 quantity,unit_price_cents,vat_basis_points
 ) VALUES(
 v_inquiry.id,v_inquiry.assigned_to,v_actor,btrim(p_issuer_legal_name),v_issuer.siret,
 btrim(p_issuer_address),btrim(p_issuer_email),btrim(coalesce(p_tax_mention,'')),
 CASE WHEN v_inquiry.customer_kind='business' THEN v_inquiry.company_name ELSE v_inquiry.client_name END,
 v_inquiry.email,concat_ws(', ',v_inquiry.address_line1,v_inquiry.postal_code,v_inquiry.city),
 v_inquiry.customer_kind,v_inquiry.company_siret,btrim(p_service_description),
 p_quantity,p_unit_price_cents,p_vat_basis_points
 ) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION bpei_private.mvp_create_quote(uuid,text,text,text,text,text,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mvp_create_quote(uuid,text,text,text,text,text,integer,integer,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.mvp_create_quote(
 p_inquiry_id uuid,p_issuer_legal_name text,p_issuer_address text,
 p_issuer_email text,p_tax_mention text,p_service_description text,
 p_quantity integer,p_unit_price_cents integer,p_vat_basis_points integer
) RETURNS uuid LANGUAGE sql SET search_path='' AS $$
 SELECT bpei_private.mvp_create_quote($1,$2,$3,$4,$5,$6,$7,$8,$9) $$;
REVOKE ALL ON FUNCTION public.mvp_create_quote(uuid,text,text,text,text,text,integer,integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_create_quote(uuid,text,text,text,text,text,integer,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION bpei_private.mvp_accept_quote(
 p_quote_id uuid,p_method text,p_evidence_reference text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());v_status text;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_actor)
 THEN RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501'; END IF;
 IF p_method NOT IN ('signed','email') OR
 char_length(btrim(coalesce(p_evidence_reference,''))) NOT BETWEEN 10 AND 300
 THEN RAISE EXCEPTION 'Verifiable customer acceptance required' USING ERRCODE='22023'; END IF;
 SELECT status INTO v_status FROM public.bpei_service_quotes WHERE id=p_quote_id FOR UPDATE;
 IF NOT FOUND OR v_status<>'proposed' THEN
  RAISE EXCEPTION 'Quote not available for acceptance' USING ERRCODE='22023'; END IF;
 UPDATE public.bpei_service_quotes SET
 status='accepted', accepted_at=now(),accepted_by_method=p_method,
 acceptance_reference=btrim(p_evidence_reference)
 WHERE id=p_quote_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION bpei_private.mvp_accept_quote(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mvp_accept_quote(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.mvp_accept_quote(
 p_quote_id uuid,p_method text,p_evidence_reference text
) RETURNS boolean LANGUAGE sql SET search_path='' AS $$
 SELECT bpei_private.mvp_accept_quote($1,$2,$3) $$;
REVOKE ALL ON FUNCTION public.mvp_accept_quote(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_accept_quote(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION bpei_private.mvp_issue_invoice(
 p_quote_id uuid,p_service_date date,p_due_date date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=(SELECT auth.uid());v_quote public.bpei_service_quotes%ROWTYPE;
v_next integer;v_year integer;v_id uuid;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.independent_admins WHERE user_id=v_actor)
 THEN RAISE EXCEPTION 'BPEI administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_quote FROM public.bpei_service_quotes WHERE id=p_quote_id FOR UPDATE;
 IF NOT FOUND OR v_quote.status<>'accepted'
 THEN RAISE EXCEPTION 'Accepted quote required' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.independent_requests r WHERE
  r.inquiry_id=v_quote.inquiry_id AND r.independent_id=v_quote.issuer_id AND r.status='completed')
 THEN RAISE EXCEPTION 'Completed intervention required' USING ERRCODE='22023'; END IF;
 IF p_service_date IS NULL OR p_due_date IS NULL OR p_service_date>current_date
 OR p_due_date < current_date OR p_due_date>current_date+interval '60 days'
 THEN RAISE EXCEPTION 'Service/due dates must be reviewed' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bpei_service_invoices WHERE quote_id=p_quote_id)
 THEN RAISE EXCEPTION 'Invoice already issued' USING ERRCODE='23505'; END IF;
 v_year:=extract(year FROM current_date)::integer;
 INSERT INTO public.bpei_invoice_counters(issuer_id,fiscal_year,latest_number)
 VALUES(v_quote.issuer_id,v_year,1)
 ON CONFLICT(issuer_id,fiscal_year) DO UPDATE SET latest_number=bpei_invoice_counters.latest_number+1
 RETURNING latest_number INTO v_next;
 INSERT INTO public.bpei_service_invoices(
  quote_id,issuer_id,fiscal_year,invoice_number,service_date,due_date
 ) VALUES(
  p_quote_id,v_quote.issuer_id,v_year,
  v_year::text||'-'||lpad(v_next::text,6,'0'),p_service_date,p_due_date
 ) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION bpei_private.mvp_issue_invoice(uuid,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION bpei_private.mvp_issue_invoice(uuid,date,date) TO authenticated;
CREATE OR REPLACE FUNCTION public.mvp_issue_invoice(
 p_quote_id uuid,p_service_date date,p_due_date date
) RETURNS uuid LANGUAGE sql SET search_path='' AS $$
 SELECT bpei_private.mvp_issue_invoice($1,$2,$3) $$;
REVOKE ALL ON FUNCTION public.mvp_issue_invoice(uuid,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mvp_issue_invoice(uuid,date,date) TO authenticated;
