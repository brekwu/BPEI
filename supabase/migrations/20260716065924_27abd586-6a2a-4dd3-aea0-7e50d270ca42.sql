-- ORDERS TABLE
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  order_number TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT NOT NULL,
  notes TEXT,
  fulfillment_mode TEXT NOT NULL DEFAULT 'pickup' CHECK (fulfillment_mode IN ('pickup','shipping','onsite')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','paid','ready','delivered','cancelled')),
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','processing','paid','refunded','failed')),
  payment_method TEXT,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  public_token TEXT NOT NULL DEFAULT replace(replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '/', '_'), '+', '-'), '=', ''),
  ip_hash TEXT,
  user_agent TEXT,
  confirmed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX orders_public_token_key ON public.orders(public_token);
CREATE INDEX orders_shop_created_idx ON public.orders(shop_id, created_at DESC);
CREATE INDEX orders_customer_idx ON public.orders(customer_id);
CREATE INDEX orders_stripe_session_idx ON public.orders(stripe_session_id);

GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop members manage their orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));

CREATE POLICY "portal customers view their orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    customer_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.customer_portal_links l
      WHERE l.customer_id = orders.customer_id AND l.user_id = auth.uid()
    )
  );

CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service','product')),
  service_id UUID REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 20,
  line_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  line_tax_cents INTEGER NOT NULL DEFAULT 0,
  line_total_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop members manage order items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));

CREATE POLICY "portal customers view own order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.customer_portal_links l ON l.customer_id = o.customer_id
    WHERE o.id = order_items.order_id AND l.user_id = auth.uid()
  ));

-- ORDER MESSAGES
CREATE TABLE public.order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('shop','customer','system')),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  read_by_shop_at TIMESTAMPTZ,
  read_by_customer_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_messages_order_idx ON public.order_messages(order_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.order_messages TO authenticated;
GRANT ALL ON public.order_messages TO service_role;
ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop members manage order messages" ON public.order_messages
  FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));

CREATE POLICY "portal customers view own order messages" ON public.order_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.customer_portal_links l ON l.customer_id = o.customer_id
    WHERE o.id = order_messages.order_id AND l.user_id = auth.uid()
  ));

-- Recalc totals
CREATE OR REPLACE FUNCTION public.recalc_order_totals(_order_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _sub INTEGER; _tax INTEGER; _tot INTEGER;
BEGIN
  UPDATE public.order_items SET
    line_subtotal_cents = ROUND(quantity * unit_price_cents)::int,
    line_tax_cents = ROUND(quantity * unit_price_cents * tax_rate/100.0)::int,
    line_total_cents = ROUND(quantity * unit_price_cents * (1 + tax_rate/100.0))::int
    WHERE order_id = _order_id;
  SELECT COALESCE(SUM(line_subtotal_cents),0), COALESCE(SUM(line_tax_cents),0), COALESCE(SUM(line_total_cents),0)
    INTO _sub, _tax, _tot FROM public.order_items WHERE order_id = _order_id;
  UPDATE public.orders SET subtotal_cents=_sub, tax_cents=_tax, total_cents=_tot WHERE id = _order_id;
END $$;

CREATE OR REPLACE FUNCTION public.order_items_recalc_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.recalc_order_totals(COALESCE(NEW.order_id, OLD.order_id));
  RETURN NULL;
END $$;

CREATE TRIGGER order_items_recalc AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_recalc_trigger();

-- Public token-based lookup for customer tracking
CREATE OR REPLACE FUNCTION public.public_get_order(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _o RECORD; _shop RECORD;
BEGIN
  SELECT id, shop_id, order_number, contact_name, status, payment_status,
    subtotal_cents, tax_cents, total_cents, currency, fulfillment_mode,
    notes, created_at, confirmed_at, paid_at, ready_at, delivered_at, cancelled_at
    INTO _o FROM public.orders WHERE public_token = _token;
  IF _o IS NULL THEN RETURN NULL; END IF;
  SELECT id, name, city, phone, email INTO _shop FROM public.shops WHERE id = _o.shop_id;
  RETURN jsonb_build_object(
    'order', to_jsonb(_o),
    'shop', to_jsonb(_shop),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'name', name, 'quantity', quantity, 'unit_price_cents', unit_price_cents,
      'tax_rate', tax_rate, 'line_total_cents', line_total_cents, 'kind', kind
    )) FROM public.order_items WHERE order_id = _o.id), '[]'::jsonb),
    'messages', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'author_type', author_type, 'author_name', author_name,
      'body', body, 'created_at', created_at
    ) ORDER BY created_at) FROM public.order_messages WHERE order_id = _o.id AND author_type <> 'system'), '[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.public_post_order_message(_token text, _body text, _author_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _o RECORD; _mid UUID;
BEGIN
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'message required'; END IF;
  IF length(_body) > 4000 THEN RAISE EXCEPTION 'message too long'; END IF;
  SELECT id, shop_id INTO _o FROM public.orders WHERE public_token = _token;
  IF _o IS NULL THEN RAISE EXCEPTION 'order not found'; END IF;
  INSERT INTO public.order_messages(order_id, shop_id, author_type, author_name, body)
    VALUES (_o.id, _o.shop_id, 'customer', COALESCE(NULLIF(trim(_author_name),''), 'Client'), _body)
    RETURNING id INTO _mid;
  RETURN _mid;
END $$;