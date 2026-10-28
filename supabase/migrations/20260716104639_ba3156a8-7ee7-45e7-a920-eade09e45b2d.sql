-- Extend enums
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'pickup';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'manual_received';
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'partially_refunded';

-- Sales
CREATE TYPE public.sale_status AS ENUM ('draft','completed','cancelled','refunded','partially_refunded');
CREATE TYPE public.sale_source AS ENUM ('counter','order','repair','quote');

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  sale_number TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.sale_status NOT NULL DEFAULT 'draft',
  source public.sale_source NOT NULL DEFAULT 'counter',
  linked_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  linked_repair_id UUID REFERENCES public.repairs(id) ON DELETE SET NULL,
  linked_quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  receipt_number TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  subtotal_excluding_tax_cents INTEGER NOT NULL DEFAULT 0,
  discount_total_cents INTEGER NOT NULL DEFAULT 0,
  tax_total_cents INTEGER NOT NULL DEFAULT 0,
  total_including_tax_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  amount_due_cents INTEGER NOT NULL DEFAULT 0,
  billing_identity_snapshot JSONB,
  customer_identity_snapshot JSONB,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, idempotency_key)
);
CREATE INDEX idx_sales_shop_created ON public.sales(shop_id, created_at DESC);
CREATE INDEX idx_sales_status ON public.sales(shop_id, status);
CREATE INDEX idx_sales_invoice ON public.sales(invoice_id);

GRANT SELECT, INSERT, UPDATE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_read_members ON public.sales FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY sales_insert_members ON public.sales FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY sales_update_members ON public.sales FOR UPDATE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

CREATE TRIGGER trg_sales_updated BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sale lines
CREATE TYPE public.sale_line_type AS ENUM ('product','service','free','deposit_refund');

CREATE TABLE public.sale_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  line_type public.sale_line_type NOT NULL,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  service_catalog_id UUID REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  repair_id UUID REFERENCES public.repairs(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  description_snapshot TEXT,
  sku_snapshot TEXT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'unité',
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
  line_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  line_tax_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_lines_sale ON public.sale_lines(sale_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_lines TO authenticated;
GRANT ALL ON public.sale_lines TO service_role;
ALTER TABLE public.sale_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY sale_lines_all_members ON public.sale_lines FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

CREATE TRIGGER trg_sale_lines_updated BEFORE UPDATE ON public.sale_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prevent modification/deletion of lines on completed sales
CREATE OR REPLACE FUNCTION public.prevent_modify_completed_sale_line()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _status public.sale_status;
BEGIN
  SELECT status INTO _status FROM public.sales WHERE id = COALESCE(NEW.sale_id, OLD.sale_id);
  IF _status IS NOT NULL AND _status <> 'draft' THEN
    RAISE EXCEPTION 'sale is not editable (status=%)', _status;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_sale_lines_immutable
  BEFORE UPDATE OR DELETE ON public.sale_lines
  FOR EACH ROW EXECUTE FUNCTION public.prevent_modify_completed_sale_line();

-- Extend payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS terminal_id TEXT,
  ADD COLUMN IF NOT EXISTS card_last4 TEXT,
  ADD COLUMN IF NOT EXISTS mixed_parent_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS connector_type TEXT NOT NULL DEFAULT 'manual_terminal';

CREATE INDEX IF NOT EXISTS idx_payments_sale ON public.payments(sale_id);

-- Prevent payment deletion (audit)
CREATE OR REPLACE FUNCTION public.prevent_delete_confirmed_payment()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('confirmed','partially_refunded') THEN
    RAISE EXCEPTION 'confirmed payment cannot be deleted';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_payments_no_delete ON public.payments;
CREATE TRIGGER trg_payments_no_delete BEFORE DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_confirmed_payment();

-- Checkout settings
CREATE TABLE public.shop_checkout_settings (
  shop_id UUID PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  enabled_methods JSONB NOT NULL DEFAULT '["card_terminal","cash","cheque","bank_transfer","pickup","manual_received"]'::jsonb,
  default_document TEXT NOT NULL DEFAULT 'invoice', -- 'invoice' | 'receipt' | 'ask'
  auto_print BOOLEAN NOT NULL DEFAULT false,
  customer_required BOOLEAN NOT NULL DEFAULT false,
  cash_requires_session BOOLEAN NOT NULL DEFAULT false,
  discount_max_employee NUMERIC(5,2) NOT NULL DEFAULT 5,
  discount_max_technician NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_manager_threshold NUMERIC(5,2) NOT NULL DEFAULT 15,
  allow_free_line BOOLEAN NOT NULL DEFAULT true,
  allow_price_override BOOLEAN NOT NULL DEFAULT false,
  terminal_reference_required BOOLEAN NOT NULL DEFAULT false,
  auto_invoice BOOLEAN NOT NULL DEFAULT true,
  auto_receipt BOOLEAN NOT NULL DEFAULT false,
  manage_stock BOOLEAN NOT NULL DEFAULT true,
  allow_technician_checkout BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.shop_checkout_settings TO authenticated;
GRANT ALL ON public.shop_checkout_settings TO service_role;
ALTER TABLE public.shop_checkout_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY checkout_settings_read ON public.shop_checkout_settings FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY checkout_settings_write ON public.shop_checkout_settings FOR ALL TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));

CREATE TRIGGER trg_checkout_settings_updated BEFORE UPDATE ON public.shop_checkout_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Helper: recalc sale totals
CREATE OR REPLACE FUNCTION public.recalc_sale_totals(_sale_id UUID)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _sub INTEGER; _tax INTEGER; _tot INTEGER;
BEGIN
  UPDATE public.sale_lines SET
    line_subtotal_cents = ROUND(unit_price_cents * quantity * (1 - discount_percent/100.0))::int,
    line_tax_cents = ROUND(unit_price_cents * quantity * (1 - discount_percent/100.0) * (tax_rate/100.0))::int,
    line_total_cents = ROUND(unit_price_cents * quantity * (1 - discount_percent/100.0) * (1 + tax_rate/100.0))::int
  WHERE sale_id = _sale_id;

  SELECT
    COALESCE(SUM(line_subtotal_cents),0),
    COALESCE(SUM(line_tax_cents),0),
    COALESCE(SUM(line_total_cents),0)
  INTO _sub, _tax, _tot
  FROM public.sale_lines WHERE sale_id = _sale_id;

  UPDATE public.sales SET
    subtotal_excluding_tax_cents = _sub,
    tax_total_cents = _tax,
    total_including_tax_cents = _tot,
    amount_due_cents = GREATEST(_tot - amount_paid_cents, 0)
  WHERE id = _sale_id;
END $$;

-- RPC: create sale draft
CREATE OR REPLACE FUNCTION public.create_sale_draft(
  _shop_id UUID,
  _source public.sale_source DEFAULT 'counter',
  _customer_id UUID DEFAULT NULL,
  _idempotency_key TEXT DEFAULT NULL,
  _linked_order_id UUID DEFAULT NULL,
  _linked_repair_id UUID DEFAULT NULL,
  _linked_quote_id UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID; _existing UUID;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), _shop_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO _existing FROM public.sales
      WHERE shop_id=_shop_id AND idempotency_key=_idempotency_key;
    IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  END IF;
  INSERT INTO public.sales(shop_id, seller_id, customer_id, source, linked_order_id, linked_repair_id, linked_quote_id, idempotency_key)
    VALUES (_shop_id, auth.uid(), _customer_id, _source, _linked_order_id, _linked_repair_id, _linked_quote_id, _idempotency_key)
    RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.create_sale_draft(UUID, public.sale_source, UUID, TEXT, UUID, UUID, UUID) TO authenticated;

-- RPC: add sale line
CREATE OR REPLACE FUNCTION public.add_sale_line(
  _sale_id UUID,
  _line_type public.sale_line_type,
  _stock_item_id UUID DEFAULT NULL,
  _service_catalog_id UUID DEFAULT NULL,
  _quantity NUMERIC DEFAULT 1,
  _custom_name TEXT DEFAULT NULL,
  _custom_price_cents INTEGER DEFAULT NULL,
  _custom_tax_rate NUMERIC DEFAULT NULL,
  _discount_percent NUMERIC DEFAULT 0,
  _note TEXT DEFAULT NULL,
  _repair_id UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _shop UUID; _status public.sale_status; _line_id UUID;
  _name TEXT; _desc TEXT; _sku TEXT; _price INT; _tax NUMERIC; _unit TEXT;
  _settings public.shop_checkout_settings%ROWTYPE;
BEGIN
  SELECT shop_id, status INTO _shop, _status FROM public.sales WHERE id=_sale_id FOR UPDATE;
  IF _shop IS NULL THEN RAISE EXCEPTION 'sale not found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _status <> 'draft' THEN RAISE EXCEPTION 'sale is not editable'; END IF;

  SELECT * INTO _settings FROM public.shop_checkout_settings WHERE shop_id=_shop;
  IF _discount_percent > 0 AND _discount_percent > COALESCE(_settings.discount_manager_threshold, 100) THEN
    IF NOT public.can_manage_shop(auth.uid(), _shop) THEN
      RAISE EXCEPTION 'discount above manager threshold';
    END IF;
  END IF;

  IF _line_type = 'product' THEN
    IF _stock_item_id IS NULL THEN RAISE EXCEPTION 'stock_item_id required'; END IF;
    SELECT name, sku, sell_price_cents, tax_rate, unit
      INTO _name, _sku, _price, _tax, _unit
      FROM public.stock_items WHERE id=_stock_item_id AND shop_id=_shop;
    IF _name IS NULL THEN RAISE EXCEPTION 'product not found'; END IF;
  ELSIF _line_type = 'service' THEN
    IF _service_catalog_id IS NULL THEN RAISE EXCEPTION 'service_catalog_id required'; END IF;
    SELECT name, description, price_cents, tax_rate
      INTO _name, _desc, _price, _tax
      FROM public.service_catalog WHERE id=_service_catalog_id AND shop_id=_shop;
    IF _name IS NULL THEN RAISE EXCEPTION 'service not found'; END IF;
    _unit := 'prestation';
  ELSIF _line_type = 'free' THEN
    IF COALESCE(_settings.allow_free_line, true) = false THEN
      IF NOT public.can_manage_shop(auth.uid(), _shop) THEN RAISE EXCEPTION 'free line not allowed'; END IF;
    END IF;
    _name := COALESCE(_custom_name, 'Ligne libre');
    _price := COALESCE(_custom_price_cents, 0);
    _tax := COALESCE(_custom_tax_rate, 20);
    _unit := 'unité';
  ELSE
    RAISE EXCEPTION 'unsupported line type';
  END IF;

  -- Price override control
  IF _custom_price_cents IS NOT NULL AND _line_type <> 'free' THEN
    IF COALESCE(_settings.allow_price_override, false) = false
       AND NOT public.can_manage_shop(auth.uid(), _shop) THEN
      RAISE EXCEPTION 'price override not allowed';
    END IF;
    _price := _custom_price_cents;
  END IF;
  IF _custom_tax_rate IS NOT NULL THEN _tax := _custom_tax_rate; END IF;
  IF _custom_name IS NOT NULL THEN _name := _custom_name; END IF;

  INSERT INTO public.sale_lines(
    sale_id, shop_id, line_type, stock_item_id, service_catalog_id, repair_id,
    name_snapshot, description_snapshot, sku_snapshot,
    quantity, unit, unit_price_cents, discount_percent, tax_rate, note,
    display_order
  ) VALUES (
    _sale_id, _shop, _line_type, _stock_item_id, _service_catalog_id, _repair_id,
    _name, _desc, _sku,
    _quantity, COALESCE(_unit,'unité'), _price, COALESCE(_discount_percent,0), COALESCE(_tax,20), _note,
    (SELECT COALESCE(MAX(display_order),0)+1 FROM public.sale_lines WHERE sale_id=_sale_id)
  ) RETURNING id INTO _line_id;

  PERFORM public.recalc_sale_totals(_sale_id);
  RETURN _line_id;
END $$;
GRANT EXECUTE ON FUNCTION public.add_sale_line(UUID, public.sale_line_type, UUID, UUID, NUMERIC, TEXT, INTEGER, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;

-- RPC: remove sale line
CREATE OR REPLACE FUNCTION public.remove_sale_line(_line_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sale UUID; _shop UUID;
BEGIN
  SELECT sale_id, shop_id INTO _sale, _shop FROM public.sale_lines WHERE id=_line_id;
  IF _sale IS NULL THEN RETURN; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.sale_lines WHERE id=_line_id;
  PERFORM public.recalc_sale_totals(_sale);
END $$;
GRANT EXECUTE ON FUNCTION public.remove_sale_line(UUID) TO authenticated;

-- RPC: update line quantity/discount
CREATE OR REPLACE FUNCTION public.update_sale_line(
  _line_id UUID,
  _quantity NUMERIC DEFAULT NULL,
  _discount_percent NUMERIC DEFAULT NULL,
  _unit_price_cents INTEGER DEFAULT NULL,
  _note TEXT DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sale UUID; _shop UUID; _settings public.shop_checkout_settings%ROWTYPE;
BEGIN
  SELECT sale_id, shop_id INTO _sale, _shop FROM public.sale_lines WHERE id=_line_id;
  IF _sale IS NULL THEN RAISE EXCEPTION 'line not found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO _settings FROM public.shop_checkout_settings WHERE shop_id=_shop;

  IF _unit_price_cents IS NOT NULL
     AND COALESCE(_settings.allow_price_override, false) = false
     AND NOT public.can_manage_shop(auth.uid(), _shop) THEN
    RAISE EXCEPTION 'price override not allowed';
  END IF;
  IF _discount_percent IS NOT NULL
     AND _discount_percent > COALESCE(_settings.discount_manager_threshold, 100)
     AND NOT public.can_manage_shop(auth.uid(), _shop) THEN
    RAISE EXCEPTION 'discount above manager threshold';
  END IF;

  UPDATE public.sale_lines SET
    quantity = COALESCE(_quantity, quantity),
    discount_percent = COALESCE(_discount_percent, discount_percent),
    unit_price_cents = COALESCE(_unit_price_cents, unit_price_cents),
    note = COALESCE(_note, note)
  WHERE id=_line_id;
  PERFORM public.recalc_sale_totals(_sale);
END $$;
GRANT EXECUTE ON FUNCTION public.update_sale_line(UUID, NUMERIC, NUMERIC, INTEGER, TEXT) TO authenticated;

-- RPC: set customer on sale
CREATE OR REPLACE FUNCTION public.set_sale_customer(_sale_id UUID, _customer_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop UUID; _status public.sale_status;
BEGIN
  SELECT shop_id, status INTO _shop, _status FROM public.sales WHERE id=_sale_id FOR UPDATE;
  IF _shop IS NULL THEN RAISE EXCEPTION 'sale not found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _status <> 'draft' THEN RAISE EXCEPTION 'sale not editable'; END IF;
  UPDATE public.sales SET customer_id=_customer_id WHERE id=_sale_id;
END $$;
GRANT EXECUTE ON FUNCTION public.set_sale_customer(UUID, UUID) TO authenticated;

-- RPC: quick create customer with dedup
CREATE OR REPLACE FUNCTION public.quick_create_customer(
  _shop_id UUID,
  _last_name TEXT,
  _first_name TEXT DEFAULT NULL,
  _phone TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _existing UUID; _id UUID; _email_norm TEXT; _phone_norm TEXT;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), _shop_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  _email_norm := NULLIF(lower(trim(_email)), '');
  _phone_norm := NULLIF(regexp_replace(COALESCE(_phone,''), '\s+', '', 'g'), '');

  IF _email_norm IS NOT NULL THEN
    SELECT id INTO _existing FROM public.customers
      WHERE shop_id=_shop_id AND lower(email)=_email_norm AND archived_at IS NULL LIMIT 1;
    IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  END IF;
  IF _phone_norm IS NOT NULL THEN
    SELECT id INTO _existing FROM public.customers
      WHERE shop_id=_shop_id
        AND regexp_replace(COALESCE(phone,''), '\s+', '', 'g')=_phone_norm
        AND archived_at IS NULL LIMIT 1;
    IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  END IF;

  INSERT INTO public.customers(shop_id, customer_type, last_name, first_name, phone, email, created_by)
    VALUES (_shop_id, 'individual', NULLIF(trim(_last_name),''), NULLIF(trim(_first_name),''), _phone_norm, _email_norm, auth.uid())
    RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.quick_create_customer(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- RPC: confirm sale (atomic) — creates invoice/receipt, decrements stock, records payments
CREATE OR REPLACE FUNCTION public.confirm_sale(
  _sale_id UUID,
  _payments JSONB,          -- array: [{method, amount_cents, terminal_id?, card_last4?, reference?, note?}]
  _create_document TEXT DEFAULT 'invoice', -- 'invoice' | 'receipt' | 'none'
  _idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sale public.sales%ROWTYPE;
  _settings public.shop_checkout_settings%ROWTYPE;
  _line RECORD;
  _pay JSONB;
  _paid_total INT := 0;
  _invoice_id UUID;
  _invoice_number TEXT;
  _receipt_number TEXT;
  _stock_qty NUMERIC;
BEGIN
  SELECT * INTO _sale FROM public.sales WHERE id=_sale_id FOR UPDATE;
  IF _sale.id IS NULL THEN RAISE EXCEPTION 'sale not found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _sale.shop_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _sale.status <> 'draft' THEN
    -- idempotency: return existing result
    RETURN jsonb_build_object('sale_id', _sale.id, 'invoice_id', _sale.invoice_id,
                              'receipt_number', _sale.receipt_number, 'already_completed', true);
  END IF;

  IF _idempotency_key IS NOT NULL AND _sale.idempotency_key IS NULL THEN
    UPDATE public.sales SET idempotency_key=_idempotency_key WHERE id=_sale_id;
    _sale.idempotency_key := _idempotency_key;
  END IF;

  SELECT * INTO _settings FROM public.shop_checkout_settings WHERE shop_id=_sale.shop_id;

  IF COALESCE(_settings.customer_required, false) AND _sale.customer_id IS NULL THEN
    RAISE EXCEPTION 'customer required';
  END IF;

  PERFORM public.recalc_sale_totals(_sale_id);
  SELECT * INTO _sale FROM public.sales WHERE id=_sale_id;

  IF _sale.total_including_tax_cents <= 0 THEN RAISE EXCEPTION 'sale has no lines'; END IF;

  -- Verify stock availability
  IF COALESCE(_settings.manage_stock, true) THEN
    FOR _line IN
      SELECT stock_item_id, SUM(quantity) AS qty
      FROM public.sale_lines
      WHERE sale_id=_sale_id AND line_type='product' AND stock_item_id IS NOT NULL
      GROUP BY stock_item_id
    LOOP
      SELECT quantity INTO _stock_qty FROM public.stock_items WHERE id=_line.stock_item_id FOR UPDATE;
      IF _stock_qty IS NULL OR _stock_qty < _line.qty THEN
        RAISE EXCEPTION 'insufficient stock for item %', _line.stock_item_id;
      END IF;
    END LOOP;
  END IF;

  -- Sum payments
  IF _payments IS NOT NULL AND jsonb_typeof(_payments)='array' THEN
    FOR _pay IN SELECT * FROM jsonb_array_elements(_payments) LOOP
      _paid_total := _paid_total + COALESCE((_pay->>'amount_cents')::int, 0);
    END LOOP;
  END IF;
  IF _paid_total > _sale.total_including_tax_cents THEN
    RAISE EXCEPTION 'overpayment not allowed';
  END IF;

  -- Create invoice if requested
  IF _create_document = 'invoice' OR (COALESCE(_settings.auto_invoice, true) AND _create_document IS NULL) THEN
    INSERT INTO public.invoices(shop_id, customer_id, status, currency, created_by, issue_date)
      VALUES (_sale.shop_id, _sale.customer_id, 'draft', _sale.currency, auth.uid(), current_date)
      RETURNING id INTO _invoice_id;

    INSERT INTO public.invoice_lines(
      shop_id, invoice_id, line_type, description, quantity, unit,
      unit_price_cents, discount_percent, tax_rate,
      line_subtotal_cents, line_tax_cents, line_total_cents, display_order,
      catalog_item_id
    )
    SELECT
      sl.shop_id, _invoice_id,
      CASE sl.line_type
        WHEN 'product' THEN 'product'::public.document_line_type
        WHEN 'service' THEN 'service'::public.document_line_type
        ELSE 'other'::public.document_line_type
      END,
      COALESCE(sl.description_snapshot || ' — ' || sl.name_snapshot, sl.name_snapshot),
      sl.quantity, sl.unit,
      sl.unit_price_cents, sl.discount_percent, sl.tax_rate,
      sl.line_subtotal_cents, sl.line_tax_cents, sl.line_total_cents, sl.display_order,
      sl.service_catalog_id
    FROM public.sale_lines sl WHERE sl.sale_id=_sale_id
    ORDER BY sl.display_order;

    PERFORM public.recalc_invoice_totals(_invoice_id);
    _invoice_number := public.issue_invoice(_invoice_id);
    UPDATE public.sales SET invoice_id=_invoice_id WHERE id=_sale_id;
  ELSIF _create_document = 'receipt' THEN
    _receipt_number := 'R-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(_sale_id::text, 1, 4);
    UPDATE public.sales SET receipt_number=_receipt_number WHERE id=_sale_id;
  END IF;

  -- Insert payments
  IF _payments IS NOT NULL AND jsonb_typeof(_payments)='array' THEN
    FOR _pay IN SELECT * FROM jsonb_array_elements(_payments) LOOP
      INSERT INTO public.payments(
        shop_id, customer_id, invoice_id, sale_id, amount_cents, currency,
        method, status, reference, terminal_id, card_last4, connector_type, recorded_by, notes
      ) VALUES (
        _sale.shop_id, _sale.customer_id, _invoice_id, _sale_id,
        (_pay->>'amount_cents')::int, _sale.currency,
        (_pay->>'method')::public.payment_method,
        COALESCE((_pay->>'status')::public.payment_status, 'confirmed'),
        _pay->>'reference', _pay->>'terminal_id', _pay->>'card_last4',
        COALESCE(_pay->>'connector_type', 'manual_terminal'),
        auth.uid(), _pay->>'note'
      );
    END LOOP;
  END IF;

  -- Update invoice amount_paid (existing engine also has recalc, but keep simple)
  IF _invoice_id IS NOT NULL AND _paid_total > 0 THEN
    UPDATE public.invoices SET
      amount_paid_cents = _paid_total,
      amount_due_cents = GREATEST(total_including_tax_cents - _paid_total, 0),
      status = CASE
        WHEN _paid_total >= total_including_tax_cents THEN 'paid'::public.invoice_status
        WHEN _paid_total > 0 THEN 'partially_paid'::public.invoice_status
        ELSE status END,
      paid_at = CASE WHEN _paid_total >= total_including_tax_cents THEN now() ELSE paid_at END
    WHERE id=_invoice_id;
  END IF;

  -- Decrement stock
  IF COALESCE(_settings.manage_stock, true) THEN
    FOR _line IN
      SELECT stock_item_id, SUM(quantity) AS qty
      FROM public.sale_lines
      WHERE sale_id=_sale_id AND line_type='product' AND stock_item_id IS NOT NULL
      GROUP BY stock_item_id
    LOOP
      PERFORM public.apply_stock_movement(
        _sale.shop_id, _line.stock_item_id, 'out'::public.stock_movement_kind,
        _line.qty, 'sale', 'sale', _sale_id, NULL
      );
    END LOOP;
  END IF;

  -- Finalize sale
  UPDATE public.sales SET
    status='completed',
    amount_paid_cents=_paid_total,
    amount_due_cents=GREATEST(total_including_tax_cents - _paid_total, 0),
    completed_at=now()
  WHERE id=_sale_id;

  RETURN jsonb_build_object(
    'sale_id', _sale_id,
    'invoice_id', _invoice_id,
    'invoice_number', _invoice_number,
    'receipt_number', _receipt_number,
    'amount_paid_cents', _paid_total,
    'total_including_tax_cents', _sale.total_including_tax_cents
  );
END $$;
GRANT EXECUTE ON FUNCTION public.confirm_sale(UUID, JSONB, TEXT, TEXT) TO authenticated;

-- RPC: cancel draft sale
CREATE OR REPLACE FUNCTION public.cancel_sale_draft(_sale_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop UUID; _status public.sale_status;
BEGIN
  SELECT shop_id, status INTO _shop, _status FROM public.sales WHERE id=_sale_id FOR UPDATE;
  IF _shop IS NULL THEN RETURN; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _status <> 'draft' THEN RAISE EXCEPTION 'only draft sales can be cancelled'; END IF;
  UPDATE public.sales SET status='cancelled', cancelled_at=now() WHERE id=_sale_id;
END $$;
GRANT EXECUTE ON FUNCTION public.cancel_sale_draft(UUID) TO authenticated;

-- Ensure default checkout settings exist for shops (helper)
CREATE OR REPLACE FUNCTION public.ensure_checkout_settings(_shop_id UUID)
RETURNS public.shop_checkout_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _row public.shop_checkout_settings;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), _shop_id) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO _row FROM public.shop_checkout_settings WHERE shop_id=_shop_id;
  IF _row.shop_id IS NULL THEN
    INSERT INTO public.shop_checkout_settings(shop_id) VALUES (_shop_id) RETURNING * INTO _row;
  END IF;
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_checkout_settings(UUID) TO authenticated;