-- BPEI MVP commercial: complete billing/contact identity before a paid intervention.
-- Non-destructive extension. Intake and legal publication gates remain unchanged.
ALTER TABLE public.bpei_inquiries
 ADD COLUMN customer_kind text NOT NULL DEFAULT 'individual'
   CHECK(customer_kind IN ('individual','business')),
 ADD COLUMN address_line1 text CHECK (address_line1 IS NULL OR char_length(btrim(address_line1)) BETWEEN 5 AND 200),
 ADD COLUMN postal_code text CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{5}$'),
 ADD COLUMN company_name text CHECK (company_name IS NULL OR char_length(btrim(company_name)) BETWEEN 2 AND 160),
 ADD COLUMN company_siret text CHECK (company_siret IS NULL OR company_siret ~ '^[0-9]{14}$');

ALTER TABLE public.bpei_inquiries ADD CONSTRAINT bpei_intervention_billing_contact_required
 CHECK (
   kind <> 'intervention' OR
   (phone IS NOT NULL AND char_length(btrim(phone)) BETWEEN 6 AND 40
    AND address_line1 IS NOT NULL AND char_length(btrim(address_line1)) BETWEEN 5 AND 200
    AND postal_code IS NOT NULL AND postal_code ~ '^[0-9]{5}$'
    AND (customer_kind='individual'
         OR (company_name IS NOT NULL AND char_length(btrim(company_name)) BETWEEN 2 AND 160)))
 );

-- No new read permission for anonymous visitors. Insertion remains gated by RLS and legal acceptance.
GRANT INSERT(customer_kind,address_line1,postal_code,company_name,company_siret)
 ON public.bpei_inquiries TO anon,authenticated;
