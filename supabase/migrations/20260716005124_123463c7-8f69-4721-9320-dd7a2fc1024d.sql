-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE public.device_type AS ENUM (
  'laptop','desktop','mac','phone','tablet','console','printer','server','peripheral','other'
);

CREATE TYPE public.repair_status AS ENUM (
  'request_received','device_dropped_off','awaiting_diagnosis','diagnosis_in_progress',
  'quote_to_prepare','quote_sent','awaiting_response','quote_accepted','quote_rejected',
  'awaiting_part','part_ordered','repair_in_progress','testing_in_progress',
  'repair_completed','ready_for_pickup','customer_notified','device_collected',
  'not_repairable','cancelled','warranty_return'
);

CREATE TYPE public.repair_priority AS ENUM ('low','normal','high','urgent');

CREATE TYPE public.note_visibility AS ENUM ('internal','customer');

CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','revoked','expired');

CREATE TYPE public.customer_type AS ENUM ('individual','business');

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.can_manage_shop(_user uuid, _shop uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_admin_bpei(_user)
    OR EXISTS (SELECT 1 FROM public.shops s WHERE s.id = _shop AND s.owner_user_id = _user)
    OR public.has_shop_role(_user, _shop, 'shop_manager')
    OR public.has_shop_role(_user, _shop, 'network_owner')
$$;

-- ============================================================================
-- CUSTOMERS
-- ============================================================================
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_type public.customer_type NOT NULL DEFAULT 'individual',
  company_name text,
  title text,
  first_name text,
  last_name text,
  email text,
  phone text,
  secondary_phone text,
  address_line_1 text,
  address_line_2 text,
  postal_code text,
  city text,
  country text DEFAULT 'France',
  internal_notes text,
  marketing_email_consent boolean NOT NULL DEFAULT false,
  marketing_sms_consent boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  CONSTRAINT customers_identity_check CHECK (
    (customer_type = 'business' AND company_name IS NOT NULL AND length(trim(company_name)) > 0)
    OR ((first_name IS NOT NULL AND length(trim(first_name)) > 0)
         OR (last_name IS NOT NULL AND length(trim(last_name)) > 0))
  )
);
CREATE INDEX idx_customers_shop ON public.customers(shop_id);
CREATE INDEX idx_customers_shop_archived ON public.customers(shop_id, archived_at);
CREATE INDEX idx_customers_email_lower ON public.customers(shop_id, lower(email));
CREATE INDEX idx_customers_phone ON public.customers(shop_id, phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read customers" ON public.customers FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "Members insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Members update customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Managers delete customers" ON public.customers FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));

CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- DEVICES
-- ============================================================================
CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  device_type public.device_type NOT NULL DEFAULT 'other',
  brand text,
  model text,
  serial_number text,
  imei text,
  color text,
  operating_system text,
  purchase_date date,
  warranty_end_date date,
  customer_description text,
  internal_notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX idx_devices_shop ON public.devices(shop_id);
CREATE INDEX idx_devices_customer ON public.devices(customer_id);
CREATE INDEX idx_devices_shop_archived ON public.devices(shop_id, archived_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read devices" ON public.devices FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "Members insert devices" ON public.devices FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Members update devices" ON public.devices FOR UPDATE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Managers delete devices" ON public.devices FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));

CREATE TRIGGER devices_set_updated_at BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- REPAIR NUMBER COUNTERS
-- ============================================================================
CREATE TABLE public.repair_number_counters (
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  year int NOT NULL,
  next_value int NOT NULL DEFAULT 1,
  PRIMARY KEY (shop_id, year)
);
GRANT SELECT ON public.repair_number_counters TO authenticated;
GRANT ALL ON public.repair_number_counters TO service_role;
ALTER TABLE public.repair_number_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct access counters" ON public.repair_number_counters FOR SELECT TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.generate_repair_number(_shop uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _year int := extract(year from now())::int;
  _val int;
BEGIN
  INSERT INTO public.repair_number_counters(shop_id, year, next_value)
  VALUES (_shop, _year, 2)
  ON CONFLICT (shop_id, year)
  DO UPDATE SET next_value = public.repair_number_counters.next_value + 1
  RETURNING next_value - 1 INTO _val;
  RETURN 'REP-' || _year::text || '-' || lpad(_val::text, 6, '0');
END;
$$;

-- ============================================================================
-- REPAIRS
-- ============================================================================
CREATE TABLE public.repairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE RESTRICT,
  repair_number text NOT NULL,
  status public.repair_status NOT NULL DEFAULT 'request_received',
  priority public.repair_priority NOT NULL DEFAULT 'normal',
  assigned_technician_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  intake_channel text,
  customer_issue text,
  initial_condition text,
  accessories_received text,
  technical_diagnosis text,
  work_performed text,
  internal_notes text,
  customer_visible_notes text,
  estimated_completion_at timestamptz,
  completed_at timestamptz,
  collected_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (shop_id, repair_number)
);
CREATE INDEX idx_repairs_shop ON public.repairs(shop_id);
CREATE INDEX idx_repairs_shop_status ON public.repairs(shop_id, status);
CREATE INDEX idx_repairs_customer ON public.repairs(customer_id);
CREATE INDEX idx_repairs_device ON public.repairs(device_id);
CREATE INDEX idx_repairs_technician ON public.repairs(assigned_technician_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repairs TO authenticated;
GRANT ALL ON public.repairs TO service_role;
ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read repairs" ON public.repairs FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "Members insert repairs" ON public.repairs FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Members update repairs" ON public.repairs FOR UPDATE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Managers delete repairs" ON public.repairs FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));

CREATE TRIGGER repairs_set_updated_at BEFORE UPDATE ON public.repairs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.repairs_assign_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.repair_number IS NULL OR length(trim(NEW.repair_number)) = 0 THEN
    NEW.repair_number := public.generate_repair_number(NEW.shop_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER repairs_before_insert BEFORE INSERT ON public.repairs
  FOR EACH ROW EXECUTE FUNCTION public.repairs_assign_number();

-- ============================================================================
-- REPAIR STATUS HISTORY
-- ============================================================================
CREATE TABLE public.repair_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  repair_id uuid NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
  old_status public.repair_status,
  new_status public.repair_status NOT NULL,
  comment text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_status_history_repair ON public.repair_status_history(repair_id, created_at DESC);

GRANT SELECT, INSERT ON public.repair_status_history TO authenticated;
GRANT ALL ON public.repair_status_history TO service_role;
ALTER TABLE public.repair_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read status history" ON public.repair_status_history FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "Members insert status history" ON public.repair_status_history FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

CREATE OR REPLACE FUNCTION public.repairs_log_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.repair_status_history(shop_id, repair_id, old_status, new_status, changed_by)
    VALUES (NEW.shop_id, NEW.id, NULL, NEW.status, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.repair_status_history(shop_id, repair_id, old_status, new_status, changed_by)
    VALUES (NEW.shop_id, NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER repairs_after_insert AFTER INSERT ON public.repairs
  FOR EACH ROW EXECUTE FUNCTION public.repairs_log_status_change();
CREATE TRIGGER repairs_after_status_update AFTER UPDATE OF status ON public.repairs
  FOR EACH ROW EXECUTE FUNCTION public.repairs_log_status_change();

-- ============================================================================
-- REPAIR NOTES
-- ============================================================================
CREATE TABLE public.repair_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  repair_id uuid NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) > 0),
  visibility public.note_visibility NOT NULL DEFAULT 'internal',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_repair_notes_repair ON public.repair_notes(repair_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_notes TO authenticated;
GRANT ALL ON public.repair_notes TO service_role;
ALTER TABLE public.repair_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read notes" ON public.repair_notes FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "Members insert notes" ON public.repair_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Author update notes" ON public.repair_notes FOR UPDATE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) AND created_by = auth.uid())
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Managers delete notes" ON public.repair_notes FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));

CREATE TRIGGER repair_notes_set_updated_at BEFORE UPDATE ON public.repair_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ACTIVITY LOGS
-- ============================================================================
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_shop ON public.activity_logs(shop_id, created_at DESC);
CREATE INDEX idx_activity_entity ON public.activity_logs(entity_type, entity_id);

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read activity" ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "Members insert activity" ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) AND actor_user_id = auth.uid());

-- ============================================================================
-- SHOP INVITATIONS
-- ============================================================================
CREATE TABLE public.shop_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.shop_role NOT NULL,
  token text NOT NULL UNIQUE,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_shop ON public.shop_invitations(shop_id);
CREATE INDEX idx_invitations_email ON public.shop_invitations(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_invitations TO authenticated;
GRANT ALL ON public.shop_invitations TO service_role;
ALTER TABLE public.shop_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers read invitations" ON public.shop_invitations FOR SELECT TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id) OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));
CREATE POLICY "Managers create invitations" ON public.shop_invitations FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id) AND invited_by = auth.uid() AND role <> 'network_owner');
CREATE POLICY "Managers update invitations" ON public.shop_invitations FOR UPDATE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "Managers delete invitations" ON public.shop_invitations FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));

CREATE TRIGGER invitations_set_updated_at BEFORE UPDATE ON public.shop_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- SHOP MEMBERSHIPS: allow managers to manage team
-- ============================================================================
DROP POLICY IF EXISTS "Managers manage memberships" ON public.shop_memberships;
CREATE POLICY "Managers manage memberships" ON public.shop_memberships FOR ALL TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));

-- ============================================================================
-- ACCEPT INVITATION FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_shop_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _inv public.shop_invitations%ROWTYPE;
  _email text;
BEGIN
  SELECT * INTO _inv FROM public.shop_invitations WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation introuvable'; END IF;
  IF _inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation invalide'; END IF;
  IF _inv.expires_at < now() THEN
    UPDATE public.shop_invitations SET status = 'expired' WHERE id = _inv.id;
    RAISE EXCEPTION 'Invitation expirée';
  END IF;
  _email := lower(coalesce((auth.jwt() ->> 'email'), ''));
  IF _email = '' OR _email <> lower(_inv.email) THEN
    RAISE EXCEPTION 'Cette invitation ne correspond pas à votre compte';
  END IF;

  INSERT INTO public.shop_memberships(user_id, shop_id, role)
  VALUES (auth.uid(), _inv.shop_id, _inv.role)
  ON CONFLICT DO NOTHING;

  UPDATE public.shop_invitations
     SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
   WHERE id = _inv.id;

  RETURN _inv.shop_id;
END;
$$;