CREATE TYPE public.purchase_order_status AS ENUM ('draft','sent','partial','received','cancelled');

-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  email text,
  phone text,
  website text,
  address text,
  vat_number text,
  payment_terms text,
  default_lead_days integer,
  notes text,
  active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX suppliers_shop_idx ON public.suppliers(shop_id) WHERE archived_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_member_select" ON public.suppliers FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "suppliers_manager_write" ON public.suppliers FOR ALL TO authenticated
  USING (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()));

CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PURCHASE ORDERS ============
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  reference text NOT NULL,
  status public.purchase_order_status NOT NULL DEFAULT 'draft',
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  received_date date,
  supplier_reference text,
  notes text,
  total_ht_cents integer NOT NULL DEFAULT 0,
  total_ttc_cents integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, reference)
);
CREATE INDEX po_shop_idx ON public.purchase_orders(shop_id, created_at DESC);
CREATE INDEX po_supplier_idx ON public.purchase_orders(supplier_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_member_select" ON public.purchase_orders FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "po_manager_write" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()));

CREATE TRIGGER po_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PURCHASE ORDER LINES ============
CREATE TABLE public.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  received_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  unit_price_cents integer NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 20 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pol_po_idx ON public.purchase_order_lines(purchase_order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_lines TO authenticated;
GRANT ALL ON public.purchase_order_lines TO service_role;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pol_member_select" ON public.purchase_order_lines FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "pol_manager_write" ON public.purchase_order_lines FOR ALL TO authenticated
  USING (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()));

-- ============ FONCTIONS ============
-- Recalcule les totaux d'un bon de commande depuis ses lignes
CREATE OR REPLACE FUNCTION public.recompute_purchase_order_totals(_po_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ht bigint; v_ttc bigint;
BEGIN
  SELECT
    COALESCE(SUM(quantity * unit_price_cents), 0),
    COALESCE(SUM(quantity * unit_price_cents * (1 + tax_rate/100)), 0)
  INTO v_ht, v_ttc
  FROM public.purchase_order_lines WHERE purchase_order_id = _po_id;
  UPDATE public.purchase_orders
    SET total_ht_cents = v_ht::integer, total_ttc_cents = v_ttc::integer
    WHERE id = _po_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.recompute_purchase_order_totals(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_purchase_order_totals(uuid) TO authenticated;

-- Réceptionner une ligne : crée un mouvement d'entrée et met à jour received_quantity + statut PO
CREATE OR REPLACE FUNCTION public.receive_purchase_order_line(
  _shop_id uuid, _line_id uuid, _quantity numeric, _note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_line public.purchase_order_lines;
  v_po public.purchase_orders;
  v_all_received boolean;
  v_any_received boolean;
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'quantity must be > 0'; END IF;

  SELECT * INTO v_line FROM public.purchase_order_lines
    WHERE id = _line_id AND shop_id = _shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'line not found'; END IF;

  IF v_line.received_quantity + _quantity > v_line.quantity THEN
    RAISE EXCEPTION 'received quantity exceeds ordered';
  END IF;

  -- Mouvement d'entrée (uniquement si un article de stock est lié)
  IF v_line.item_id IS NOT NULL THEN
    PERFORM public.apply_stock_movement(
      _shop_id, v_line.item_id, 'in'::public.stock_movement_kind,
      _quantity, 'réception commande',
      'purchase_order', v_line.purchase_order_id, _note
    );
  END IF;

  UPDATE public.purchase_order_lines
    SET received_quantity = received_quantity + _quantity
    WHERE id = _line_id;

  -- Recalcule statut PO
  SELECT bool_and(received_quantity >= quantity), bool_or(received_quantity > 0)
    INTO v_all_received, v_any_received
    FROM public.purchase_order_lines WHERE purchase_order_id = v_line.purchase_order_id;

  IF v_all_received THEN
    UPDATE public.purchase_orders
      SET status = 'received', received_date = COALESCE(received_date, CURRENT_DATE)
      WHERE id = v_line.purchase_order_id;
  ELSIF v_any_received THEN
    UPDATE public.purchase_orders SET status = 'partial'
      WHERE id = v_line.purchase_order_id AND status <> 'partial';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order_line(uuid,uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order_line(uuid,uuid,numeric,text) TO authenticated;