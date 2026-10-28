-- Add admin_bpei audit bypass on SELECT for tables that were missing it,
-- to align with invoices/quotes/repairs/orders/payments.

DROP POLICY IF EXISTS "Membres voient RDV" ON public.appointments;
CREATE POLICY "Membres voient RDV" ON public.appointments
  FOR SELECT TO authenticated
  USING (is_shop_member(auth.uid(), shop_id) OR is_admin_bpei(auth.uid()));

-- appointment_blocked_slots: split ALL into per-cmd, add admin SELECT bypass
DROP POLICY IF EXISTS "Membres blocages" ON public.appointment_blocked_slots;
CREATE POLICY "Membres blocages select" ON public.appointment_blocked_slots
  FOR SELECT TO authenticated
  USING (is_shop_member(auth.uid(), shop_id) OR is_admin_bpei(auth.uid()));
CREATE POLICY "Membres blocages write" ON public.appointment_blocked_slots
  FOR ALL TO authenticated
  USING (is_shop_member(auth.uid(), shop_id))
  WITH CHECK (is_shop_member(auth.uid(), shop_id));

-- sale_lines: split ALL into per-cmd, add admin SELECT bypass
DROP POLICY IF EXISTS "sale_lines_all_members" ON public.sale_lines;
CREATE POLICY "sale_lines_read" ON public.sale_lines
  FOR SELECT TO authenticated
  USING (is_shop_member(auth.uid(), shop_id) OR is_admin_bpei(auth.uid()));
CREATE POLICY "sale_lines_write" ON public.sale_lines
  FOR ALL TO authenticated
  USING (is_shop_member(auth.uid(), shop_id))
  WITH CHECK (is_shop_member(auth.uid(), shop_id));