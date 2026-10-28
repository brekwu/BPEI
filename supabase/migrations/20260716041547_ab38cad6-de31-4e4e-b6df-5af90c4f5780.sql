CREATE TYPE public.stock_item_type AS ENUM ('product','part','consumable');
CREATE TYPE public.stock_movement_kind AS ENUM ('in','out','adjust');
CREATE TYPE public.stock_reservation_status AS ENUM ('active','consumed','released');
CREATE TYPE public.stock_inventory_status AS ENUM ('draft','in_progress','closed');

CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sku text,
  barcode text,
  name text NOT NULL,
  description text,
  category text,
  brand text,
  item_type public.stock_item_type NOT NULL DEFAULT 'part',
  unit text NOT NULL DEFAULT 'unité',
  cost_price_cents integer NOT NULL DEFAULT 0 CHECK (cost_price_cents >= 0),
  sell_price_cents integer NOT NULL DEFAULT 0 CHECK (sell_price_cents >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 20 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  reserved_quantity numeric(12,3) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  min_threshold numeric(12,3) NOT NULL DEFAULT 0 CHECK (min_threshold >= 0),
  location text,
  supplier_ref text,
  active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, sku)
);
CREATE INDEX stock_items_shop_idx ON public.stock_items(shop_id) WHERE archived_at IS NULL;
CREATE INDEX stock_items_barcode_idx ON public.stock_items(shop_id, barcode) WHERE barcode IS NOT NULL;
CREATE INDEX stock_items_low_idx ON public.stock_items(shop_id) WHERE archived_at IS NULL AND quantity <= min_threshold;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_items TO authenticated;
GRANT ALL ON public.stock_items TO service_role;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_items_member_select" ON public.stock_items FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "stock_items_manager_insert" ON public.stock_items FOR INSERT TO authenticated
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "stock_items_manager_update" ON public.stock_items FOR UPDATE TO authenticated
  USING (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "stock_items_manager_delete" ON public.stock_items FOR DELETE TO authenticated
  USING (public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()));

CREATE TRIGGER stock_items_updated_at BEFORE UPDATE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ STOCK MOVEMENTS ============
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  kind public.stock_movement_kind NOT NULL,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  balance_after numeric(12,3) NOT NULL,
  reason text,
  reference_type text,
  reference_id uuid,
  note text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_shop_created_idx ON public.stock_movements(shop_id, created_at DESC);
CREATE INDEX stock_movements_item_idx ON public.stock_movements(item_id, created_at DESC);

GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_moves_member_select" ON public.stock_movements FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "stock_moves_member_insert" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

-- ============ STOCK RESERVATIONS ============
CREATE TABLE public.stock_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  quantity numeric(12,3) NOT NULL CHECK (quantity > 0),
  status public.stock_reservation_status NOT NULL DEFAULT 'active',
  reference_type text,
  reference_id uuid,
  note text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
CREATE INDEX stock_reservations_shop_idx ON public.stock_reservations(shop_id, status);
CREATE INDEX stock_reservations_item_idx ON public.stock_reservations(item_id, status);

GRANT SELECT, INSERT, UPDATE ON public.stock_reservations TO authenticated;
GRANT ALL ON public.stock_reservations TO service_role;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_resv_member_select" ON public.stock_reservations FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "stock_resv_member_insert" ON public.stock_reservations FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "stock_resv_member_update" ON public.stock_reservations FOR UPDATE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

-- ============ STOCK INVENTORIES ============
CREATE TABLE public.stock_inventories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.stock_inventory_status NOT NULL DEFAULT 'draft',
  note text,
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_inventories_shop_idx ON public.stock_inventories(shop_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_inventories TO authenticated;
GRANT ALL ON public.stock_inventories TO service_role;
ALTER TABLE public.stock_inventories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_inv_member_select" ON public.stock_inventories FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "stock_inv_manager_write" ON public.stock_inventories FOR ALL TO authenticated
  USING (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()));

CREATE TRIGGER stock_inventories_updated_at BEFORE UPDATE ON public.stock_inventories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.stock_inventory_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES public.stock_inventories(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  expected_qty numeric(12,3) NOT NULL DEFAULT 0,
  counted_qty numeric(12,3),
  variance numeric(12,3) GENERATED ALWAYS AS (COALESCE(counted_qty,0) - expected_qty) STORED,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventory_id, item_id)
);
CREATE INDEX stock_inv_lines_inv_idx ON public.stock_inventory_lines(inventory_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_inventory_lines TO authenticated;
GRANT ALL ON public.stock_inventory_lines TO service_role;
ALTER TABLE public.stock_inventory_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_inv_lines_member_select" ON public.stock_inventory_lines FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY "stock_inv_lines_manager_write" ON public.stock_inventory_lines FOR ALL TO authenticated
  USING (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.has_shop_role(auth.uid(), shop_id, 'shop_manager')
    OR public.has_shop_role(auth.uid(), shop_id, 'network_owner')
    OR public.is_admin_bpei(auth.uid()));

-- ============ RPC atomique : appliquer un mouvement ============
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  _shop_id uuid, _item_id uuid, _kind public.stock_movement_kind,
  _quantity numeric, _reason text DEFAULT NULL,
  _reference_type text DEFAULT NULL, _reference_id uuid DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS public.stock_movements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item public.stock_items;
  v_new_qty numeric;
  v_delta numeric;
  v_row public.stock_movements;
BEGIN
  IF NOT (public.is_shop_member(auth.uid(), _shop_id) OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be > 0';
  END IF;

  SELECT * INTO v_item FROM public.stock_items
    WHERE id = _item_id AND shop_id = _shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;

  v_delta := CASE
    WHEN _kind = 'in' THEN _quantity
    WHEN _kind = 'out' THEN -_quantity
    WHEN _kind = 'adjust' THEN _quantity - v_item.quantity
  END;

  v_new_qty := CASE WHEN _kind = 'adjust' THEN _quantity ELSE v_item.quantity + v_delta END;
  IF v_new_qty < 0 THEN RAISE EXCEPTION 'insufficient stock'; END IF;

  UPDATE public.stock_items SET quantity = v_new_qty WHERE id = _item_id;

  INSERT INTO public.stock_movements(
    shop_id, item_id, kind, quantity, balance_after, reason,
    reference_type, reference_id, note, user_id
  ) VALUES (
    _shop_id, _item_id, _kind, ABS(CASE WHEN _kind='adjust' THEN v_delta ELSE _quantity END),
    v_new_qty, _reason, _reference_type, _reference_id, _note, auth.uid()
  ) RETURNING * INTO v_row;

  RETURN v_row;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement(uuid,uuid,public.stock_movement_kind,numeric,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_stock_movement(uuid,uuid,public.stock_movement_kind,numeric,text,text,uuid,text) TO authenticated;

-- ============ RPC : clôturer un inventaire (ajuste automatiquement les écarts) ============
CREATE OR REPLACE FUNCTION public.close_stock_inventory(_shop_id uuid, _inventory_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_line record; v_count integer := 0;
BEGIN
  IF NOT (public.has_shop_role(auth.uid(), _shop_id, 'shop_manager')
       OR public.has_shop_role(auth.uid(), _shop_id, 'network_owner')
       OR public.is_admin_bpei(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR v_line IN
    SELECT l.* FROM public.stock_inventory_lines l
    WHERE l.inventory_id = _inventory_id AND l.shop_id = _shop_id
      AND l.counted_qty IS NOT NULL
      AND l.counted_qty <> l.expected_qty
  LOOP
    PERFORM public.apply_stock_movement(
      _shop_id, v_line.item_id, 'adjust'::public.stock_movement_kind,
      v_line.counted_qty, 'inventaire', 'inventory', _inventory_id,
      COALESCE(v_line.note, 'ajustement inventaire')
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.stock_inventories
    SET status = 'closed', closed_at = now()
    WHERE id = _inventory_id AND shop_id = _shop_id;
  RETURN v_count;
END $$;
REVOKE EXECUTE ON FUNCTION public.close_stock_inventory(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_stock_inventory(uuid,uuid) TO authenticated;