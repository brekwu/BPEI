-- =============== Cash sessions & movements ===============
CREATE TYPE public.cash_session_status AS ENUM ('open','closed');
CREATE TYPE public.cash_movement_kind AS ENUM (
  'opening_float','sale','refund','cash_in','cash_out','pickup','adjustment','closing'
);

CREATE TABLE public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  status public.cash_session_status NOT NULL DEFAULT 'open',
  opening_float_cents INTEGER NOT NULL DEFAULT 0,
  expected_cash_cents INTEGER NOT NULL DEFAULT 0,
  counted_cash_cents INTEGER,
  variance_cents INTEGER,
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_notes TEXT,
  closing_notes TEXT,
  register_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cash_sessions_one_open_per_shop
  ON public.cash_sessions(shop_id) WHERE status = 'open';
CREATE INDEX idx_cash_sessions_shop_opened ON public.cash_sessions(shop_id, opened_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.cash_sessions TO authenticated;
GRANT ALL ON public.cash_sessions TO service_role;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_sessions_read ON public.cash_sessions FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY cash_sessions_write ON public.cash_sessions FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

CREATE TRIGGER trg_cash_sessions_updated BEFORE UPDATE ON public.cash_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  kind public.cash_movement_kind NOT NULL,
  amount_cents INTEGER NOT NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  reason TEXT,
  note TEXT,
  performed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_movements_session ON public.cash_movements(session_id, created_at);
CREATE INDEX idx_cash_movements_shop ON public.cash_movements(shop_id, created_at DESC);

GRANT SELECT, INSERT ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY cash_movements_read ON public.cash_movements FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id) OR public.is_admin_bpei(auth.uid()));
CREATE POLICY cash_movements_insert ON public.cash_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));

-- Immutable movements (audit)
CREATE OR REPLACE FUNCTION public.prevent_cash_movement_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'cash movements are immutable';
END $$;
CREATE TRIGGER trg_cash_movements_immutable
  BEFORE UPDATE OR DELETE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cash_movement_mutation();

-- Helper: get active session id for a shop (or NULL)
CREATE OR REPLACE FUNCTION public.get_active_cash_session_id(_shop UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.cash_sessions WHERE shop_id=_shop AND status='open' LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_active_cash_session_id(UUID) TO authenticated;

-- Helper: recompute expected cash from movements
CREATE OR REPLACE FUNCTION public.recalc_cash_session_expected(_session UUID)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _sum INT;
BEGIN
  SELECT COALESCE(SUM(
    CASE kind
      WHEN 'opening_float' THEN amount_cents
      WHEN 'sale' THEN amount_cents
      WHEN 'cash_in' THEN amount_cents
      WHEN 'refund' THEN -amount_cents
      WHEN 'cash_out' THEN -amount_cents
      WHEN 'pickup' THEN -amount_cents
      WHEN 'adjustment' THEN amount_cents
      ELSE 0
    END), 0) INTO _sum
  FROM public.cash_movements WHERE session_id=_session;
  UPDATE public.cash_sessions SET expected_cash_cents=_sum WHERE id=_session;
END $$;

-- Auto-recompute after each movement
CREATE OR REPLACE FUNCTION public.after_cash_movement_recalc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_cash_session_expected(NEW.session_id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cash_movement_recalc
  AFTER INSERT ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.after_cash_movement_recalc();

-- RPC: open a session
CREATE OR REPLACE FUNCTION public.open_cash_session(
  _shop UUID,
  _opening_float_cents INTEGER DEFAULT 0,
  _register_label TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.cash_sessions WHERE shop_id=_shop AND status='open') THEN
    RAISE EXCEPTION 'a session is already open';
  END IF;
  INSERT INTO public.cash_sessions(shop_id, opening_float_cents, opened_by, register_label, opening_notes)
    VALUES (_shop, GREATEST(COALESCE(_opening_float_cents,0),0), auth.uid(), _register_label, _notes)
    RETURNING id INTO _id;
  IF _opening_float_cents IS NOT NULL AND _opening_float_cents > 0 THEN
    INSERT INTO public.cash_movements(shop_id, session_id, kind, amount_cents, reason, performed_by)
      VALUES (_shop, _id, 'opening_float', _opening_float_cents, 'Fond de caisse', auth.uid());
  END IF;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.open_cash_session(UUID, INTEGER, TEXT, TEXT) TO authenticated;

-- RPC: add a manual movement (in/out/pickup/adjustment)
CREATE OR REPLACE FUNCTION public.add_cash_movement(
  _session UUID,
  _kind public.cash_movement_kind,
  _amount_cents INTEGER,
  _reason TEXT DEFAULT NULL,
  _note TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop UUID; _status public.cash_session_status; _id UUID;
BEGIN
  IF _kind NOT IN ('cash_in','cash_out','pickup','adjustment') THEN
    RAISE EXCEPTION 'manual movement kind must be cash_in, cash_out, pickup or adjustment';
  END IF;
  SELECT shop_id, status INTO _shop, _status FROM public.cash_sessions WHERE id=_session;
  IF _shop IS NULL THEN RAISE EXCEPTION 'session not found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _status <> 'open' THEN RAISE EXCEPTION 'session is closed'; END IF;
  IF _amount_cents <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  INSERT INTO public.cash_movements(shop_id, session_id, kind, amount_cents, reason, note, performed_by)
    VALUES (_shop, _session, _kind, _amount_cents, _reason, _note, auth.uid())
    RETURNING id INTO _id;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.add_cash_movement(UUID, public.cash_movement_kind, INTEGER, TEXT, TEXT) TO authenticated;

-- RPC: close a session
CREATE OR REPLACE FUNCTION public.close_cash_session(
  _session UUID,
  _counted_cash_cents INTEGER,
  _pickup_cents INTEGER DEFAULT 0,
  _notes TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop UUID; _status public.cash_session_status; _expected INT; _variance INT;
BEGIN
  SELECT shop_id, status INTO _shop, _status FROM public.cash_sessions WHERE id=_session FOR UPDATE;
  IF _shop IS NULL THEN RAISE EXCEPTION 'session not found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _status <> 'open' THEN RAISE EXCEPTION 'session already closed'; END IF;
  IF _counted_cash_cents IS NULL OR _counted_cash_cents < 0 THEN
    RAISE EXCEPTION 'counted cash required';
  END IF;

  IF COALESCE(_pickup_cents,0) > 0 THEN
    INSERT INTO public.cash_movements(shop_id, session_id, kind, amount_cents, reason, performed_by)
      VALUES (_shop, _session, 'pickup', _pickup_cents, 'Prélèvement de clôture', auth.uid());
  END IF;

  PERFORM public.recalc_cash_session_expected(_session);
  SELECT expected_cash_cents INTO _expected FROM public.cash_sessions WHERE id=_session;
  _variance := _counted_cash_cents - _expected;

  INSERT INTO public.cash_movements(shop_id, session_id, kind, amount_cents, reason, performed_by)
    VALUES (_shop, _session, 'closing', _counted_cash_cents, 'Comptage de clôture', auth.uid());

  UPDATE public.cash_sessions SET
    status='closed',
    counted_cash_cents=_counted_cash_cents,
    variance_cents=_variance,
    closed_by=auth.uid(),
    closed_at=now(),
    closing_notes=_notes
  WHERE id=_session;

  RETURN jsonb_build_object('expected_cents', _expected, 'counted_cents', _counted_cash_cents, 'variance_cents', _variance);
END $$;
GRANT EXECUTE ON FUNCTION public.close_cash_session(UUID, INTEGER, INTEGER, TEXT) TO authenticated;

-- Hook: auto-insert cash_movement 'sale' when payment cash is inserted on an open session
CREATE OR REPLACE FUNCTION public.after_payment_cash_hook()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _session UUID;
BEGIN
  IF NEW.method = 'cash' AND NEW.status IN ('confirmed','partially_refunded') AND NEW.amount_cents > 0 THEN
    _session := public.get_active_cash_session_id(NEW.shop_id);
    IF _session IS NOT NULL THEN
      INSERT INTO public.cash_movements(shop_id, session_id, kind, amount_cents, sale_id, payment_id, reason, performed_by)
        VALUES (NEW.shop_id, _session, 'sale', NEW.amount_cents, NEW.sale_id, NEW.id, 'Vente en espèces', auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_payment_cash_hook ON public.payments;
CREATE TRIGGER trg_payment_cash_hook
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.after_payment_cash_hook();

-- =============== Refund a sale (creates credit note) ===============
-- Line-level restock action
CREATE TYPE public.refund_restock_action AS ENUM ('restock','damaged','not_returned');

CREATE OR REPLACE FUNCTION public.refund_sale(
  _sale_id UUID,
  _lines JSONB,   -- [{ sale_line_id, quantity, restock: 'restock'|'damaged'|'not_returned' }]
  _refund_method public.payment_method,
  _reason TEXT DEFAULT NULL,
  _reference TEXT DEFAULT NULL,
  _idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sale public.sales%ROWTYPE;
  _line JSONB;
  _sl public.sale_lines%ROWTYPE;
  _qty NUMERIC;
  _restock public.refund_restock_action;
  _cn_id UUID;
  _cn_number TEXT;
  _refund_total INT := 0;
  _line_refund INT;
  _existing_cn UUID;
  _session UUID;
  _pay_id UUID;
BEGIN
  SELECT * INTO _sale FROM public.sales WHERE id=_sale_id FOR UPDATE;
  IF _sale.id IS NULL THEN RAISE EXCEPTION 'sale not found'; END IF;
  IF NOT public.can_manage_shop(auth.uid(), _sale.shop_id) THEN
    RAISE EXCEPTION 'only managers can refund';
  END IF;
  IF _sale.status NOT IN ('completed','partially_refunded') THEN
    RAISE EXCEPTION 'sale is not refundable (status=%)', _sale.status;
  END IF;
  IF _sale.invoice_id IS NULL THEN
    RAISE EXCEPTION 'sale has no invoice — refund requires invoice';
  END IF;

  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO _existing_cn FROM public.credit_notes
      WHERE shop_id=_sale.shop_id AND reason=_idempotency_key LIMIT 1;
    IF _existing_cn IS NOT NULL THEN
      RETURN jsonb_build_object('credit_note_id', _existing_cn, 'already', true);
    END IF;
  END IF;

  INSERT INTO public.credit_notes(shop_id, invoice_id, customer_id, status, currency, issue_date, reason, refund_method, created_by)
    VALUES (_sale.shop_id, _sale.invoice_id, _sale.customer_id, 'draft', _sale.currency, current_date,
            COALESCE(_reason, _idempotency_key), _refund_method, auth.uid())
    RETURNING id INTO _cn_id;

  IF _lines IS NULL OR jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines)=0 THEN
    RAISE EXCEPTION 'no lines to refund';
  END IF;

  FOR _line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    SELECT * INTO _sl FROM public.sale_lines WHERE id=(_line->>'sale_line_id')::uuid AND sale_id=_sale_id;
    IF _sl.id IS NULL THEN RAISE EXCEPTION 'sale line not found'; END IF;
    _qty := COALESCE((_line->>'quantity')::numeric, _sl.quantity);
    IF _qty <= 0 OR _qty > _sl.quantity THEN RAISE EXCEPTION 'invalid quantity'; END IF;
    _restock := COALESCE((_line->>'restock')::public.refund_restock_action, 'restock');

    _line_refund := ROUND(_sl.unit_price_cents * _qty * (1 - _sl.discount_percent/100.0) * (1 + _sl.tax_rate/100.0))::int;

    INSERT INTO public.credit_note_lines(
      shop_id, credit_note_id, description, quantity, unit_price_cents, tax_rate,
      line_subtotal_cents, line_tax_cents, line_total_cents, display_order
    ) VALUES (
      _sale.shop_id, _cn_id, _sl.name_snapshot, _qty, _sl.unit_price_cents, _sl.tax_rate,
      ROUND(_sl.unit_price_cents * _qty * (1 - _sl.discount_percent/100.0))::int,
      _line_refund - ROUND(_sl.unit_price_cents * _qty * (1 - _sl.discount_percent/100.0))::int,
      _line_refund, _sl.display_order
    );

    _refund_total := _refund_total + _line_refund;

    -- Restock if applicable
    IF _sl.line_type='product' AND _sl.stock_item_id IS NOT NULL AND _restock='restock' THEN
      PERFORM public.apply_stock_movement(
        _sale.shop_id, _sl.stock_item_id, 'in'::public.stock_movement_kind,
        _qty, 'refund', 'credit_note', _cn_id, 'Retour vente ' || COALESCE(_sale.sale_number, _sale.id::text)
      );
    END IF;
  END LOOP;

  -- Recalc credit note totals via engine
  UPDATE public.credit_notes SET
    subtotal_excluding_tax_cents = COALESCE((SELECT SUM(line_subtotal_cents) FROM public.credit_note_lines WHERE credit_note_id=_cn_id), 0),
    tax_total_cents = COALESCE((SELECT SUM(line_tax_cents) FROM public.credit_note_lines WHERE credit_note_id=_cn_id), 0),
    total_including_tax_cents = COALESCE((SELECT SUM(line_total_cents) FROM public.credit_note_lines WHERE credit_note_id=_cn_id), 0),
    refunded_amount_cents = _refund_total
  WHERE id=_cn_id;

  _cn_number := public.issue_credit_note(_cn_id);

  -- Record refund payment
  IF _refund_method IS NOT NULL AND _refund_total > 0 THEN
    INSERT INTO public.payments(
      shop_id, customer_id, invoice_id, sale_id, amount_cents, currency,
      method, status, reference, connector_type, recorded_by, notes
    ) VALUES (
      _sale.shop_id, _sale.customer_id, _sale.invoice_id, _sale.id,
      -_refund_total, _sale.currency, _refund_method, 'refunded'::public.payment_status,
      _reference, 'manual_terminal', auth.uid(), COALESCE(_reason,'Remboursement')
    ) RETURNING id INTO _pay_id;

    -- Cash out if refund method is cash and session open
    IF _refund_method='cash' THEN
      _session := public.get_active_cash_session_id(_sale.shop_id);
      IF _session IS NOT NULL THEN
        INSERT INTO public.cash_movements(shop_id, session_id, kind, amount_cents, sale_id, credit_note_id, payment_id, reason, performed_by)
          VALUES (_sale.shop_id, _session, 'refund', _refund_total, _sale.id, _cn_id, _pay_id, 'Remboursement espèces', auth.uid());
      END IF;
    END IF;
  END IF;

  -- Update sale status
  UPDATE public.sales SET
    status = CASE
      WHEN _refund_total >= (total_including_tax_cents - COALESCE((SELECT SUM(refunded_amount_cents) FROM public.credit_notes WHERE invoice_id=_sale.invoice_id),0) + _refund_total) THEN 'refunded'::public.sale_status
      ELSE 'partially_refunded'::public.sale_status
    END
  WHERE id=_sale_id;

  RETURN jsonb_build_object(
    'credit_note_id', _cn_id,
    'credit_note_number', _cn_number,
    'refunded_amount_cents', _refund_total
  );
END $$;
GRANT EXECUTE ON FUNCTION public.refund_sale(UUID, JSONB, public.payment_method, TEXT, TEXT, TEXT) TO authenticated;