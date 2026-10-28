-- ============================================================
-- 1. Restrict shop_invitations SELECT to shop managers only.
--    Removing the email-match branch closes the unverified-email
--    escalation. Token-based acceptance still works via
--    accept_shop_invitation(_token) which verifies auth.jwt() email.
-- ============================================================
DROP POLICY IF EXISTS "Managers read invitations" ON public.shop_invitations;
CREATE POLICY "Managers read invitations" ON public.shop_invitations
  FOR SELECT TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));

-- ============================================================
-- 2. Narrow public column access on shop_business_hours.
--    Keep public SELECT for opening hours, but restrict anon
--    to only the columns actually consumed by public booking.
-- ============================================================
REVOKE SELECT ON public.shop_business_hours FROM anon;
GRANT SELECT (shop_id, day_of_week, opens_at, closes_at, is_closed, break_start, break_end)
  ON public.shop_business_hours TO anon;

-- ============================================================
-- 3. shop_closures: hide internal reason/created_by from anon.
--    Public booking flow only needs the time window (already
--    accessed server-side via SECURITY DEFINER get_available_slots).
--    Drop the public policy entirely and restrict to authenticated
--    shop members. get_available_slots keeps working (SECURITY DEFINER).
-- ============================================================
DROP POLICY IF EXISTS "Fermetures publiques" ON public.shop_closures;
REVOKE SELECT ON public.shop_closures FROM anon;
-- If a truly-public column projection is later needed, expose via a view.

-- ============================================================
-- 4. service_catalog: hide internal_reference (SKU) from anon.
-- ============================================================
REVOKE SELECT ON public.service_catalog FROM anon;
GRANT SELECT (
  id, shop_id, name, description, category, line_type,
  default_quantity, unit, unit_price_cents, tax_rate,
  estimated_duration_minutes, active, created_at, updated_at, archived_at
) ON public.service_catalog TO anon;

-- ============================================================
-- 5. SECURITY DEFINER functions: revoke default EXECUTE from
--    PUBLIC, then re-grant only where required. Default posture
--    becomes deny; server code that uses these functions runs as
--    authenticated (via requireSupabaseAuth) or service_role
--    (edge/admin), both of which are granted explicitly below.
-- ============================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, p.proname AS fn,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.fn, r.args);
    -- service_role always keeps execute (used by edge/admin paths).
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',
                   r.fn, r.args);
  END LOOP;
END $$;

-- --- Functions callable by unauthenticated public routes (anon + authenticated)
GRANT EXECUTE ON FUNCTION public.public_get_repair_status(text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_quote(text)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_accept_quote(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_refuse_quote(text, text)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_public_appointment(uuid, uuid, timestamptz, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(text, text, smallint, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(text, text, smallint, text, text, text, text, smallint, smallint, smallint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_shop_public_reviews(uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_review_stats(uuid)            TO anon, authenticated;

-- Anti-abuse helpers used by the anon server publishable client on public endpoints.
GRANT EXECUTE ON FUNCTION public.hash_ip(text, text)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(text)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_abuse(text, text, text, uuid, text, public.abuse_event_type, public.abuse_severity, text, jsonb) TO anon, authenticated;

-- --- Functions callable only by signed-in users (authenticated)
GRANT EXECUTE ON FUNCTION public.accept_shop_invitation(text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_customer_portal_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_cancel_appointment(uuid, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_customer_records_for_user()       TO authenticated;

GRANT EXECUTE ON FUNCTION public.record_payment(uuid, integer, public.payment_method, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_invoice(uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_quote(uuid)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_credit_note(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_invoice(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_appointment_to_repair(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_appointment_slot(uuid, timestamptz, timestamptz, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_invoice_totals(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_quote_totals(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_document_number(uuid, public.document_number_kind) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_repair_number(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_portal_invitation(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_customer_portal_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_repair_token(uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_shop_technicians(uuid)            TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_block_ip(text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unblock_ip(text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_abuse(integer)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_active_blocks()             TO authenticated;

-- Role/permission helpers used inside RLS policies must be callable by every
-- role that ever evaluates a policy (anon evaluates policies too when reading
-- tables with mixed public/authenticated access).
GRANT EXECUTE ON FUNCTION public.has_platform_role(uuid, public.platform_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_shop_role(uuid, uuid, public.shop_role)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_member(uuid, uuid)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_bpei(uuid)                           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_shop(uuid, uuid)                   TO anon, authenticated;

-- Trigger-invoked and purely-internal functions stay execute-restricted to
-- service_role only (already granted above). Triggers run with the table
-- owner's privileges regardless of caller EXECUTE grants.