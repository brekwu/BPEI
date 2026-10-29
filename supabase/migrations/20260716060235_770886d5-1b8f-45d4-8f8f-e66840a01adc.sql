ALTER TABLE public.shop_billing_settings
  ADD COLUMN IF NOT EXISTS purchase_price_variance_warning_pct NUMERIC NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS purchase_price_variance_warning_cents INTEGER NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS purchase_price_variance_require_manager BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.stock_purchase_price_history
  ADD COLUMN IF NOT EXISTS decision TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE OR REPLACE FUNCTION public.consumption_last_days(
  _shop_id uuid, _item_id uuid, _days integer DEFAULT 30
) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(quantity), 0)::numeric
  FROM public.stock_movements
  WHERE shop_id = _shop_id
    AND item_id = _item_id
    AND kind = 'out'
    AND created_at >= now() - (_days || ' days')::interval
$$;

GRANT EXECUTE ON FUNCTION public.consumption_last_days(uuid, uuid, integer) TO authenticated;