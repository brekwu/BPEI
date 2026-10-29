-- Ensure pgcrypto is available for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.abuse_event_type AS ENUM ('rate_limit_hit','captcha_failed','manual_block','suspicious_pattern','blocked_ip_attempt');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.abuse_severity AS ENUM ('info','warn','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABLE: abuse_log ============
CREATE TABLE IF NOT EXISTS public.abuse_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  ip_hash TEXT NOT NULL,
  fingerprint TEXT,
  shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  event_type public.abuse_event_type NOT NULL,
  severity public.abuse_severity NOT NULL DEFAULT 'info',
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_abuse_log_occurred ON public.abuse_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_log_ip_hash ON public.abuse_log(ip_hash, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_log_shop ON public.abuse_log(shop_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_log_endpoint ON public.abuse_log(endpoint, occurred_at DESC);

GRANT SELECT ON public.abuse_log TO authenticated;
GRANT ALL ON public.abuse_log TO service_role;

ALTER TABLE public.abuse_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins BPEI lisent tout le journal"
  ON public.abuse_log FOR SELECT TO authenticated
  USING (public.is_admin_bpei(auth.uid()));

CREATE POLICY "Managers de boutique lisent leur journal"
  ON public.abuse_log FOR SELECT TO authenticated
  USING (shop_id IS NOT NULL AND public.can_manage_shop(auth.uid(), shop_id));

-- ============ TABLE: rate_limit_buckets ============
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  id BIGSERIAL PRIMARY KEY,
  scope_type TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT rate_limit_buckets_unique UNIQUE (scope_type, scope_key, endpoint, window_start)
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rate_limit_buckets(window_start);

GRANT ALL ON public.rate_limit_buckets TO service_role;
-- No grants to anon/authenticated: only accessed via SECURITY DEFINER function

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
-- Empty policies = no direct access

-- ============ TABLE: ip_blocks ============
CREATE TABLE IF NOT EXISTS public.ip_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  ip TEXT,
  reason TEXT NOT NULL DEFAULT 'automatic',
  blocked_until TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ip_blocks_hash_until ON public.ip_blocks(ip_hash, blocked_until DESC);

GRANT SELECT ON public.ip_blocks TO authenticated;
GRANT ALL ON public.ip_blocks TO service_role;

ALTER TABLE public.ip_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins BPEI lisent les blocages"
  ON public.ip_blocks FOR SELECT TO authenticated
  USING (public.is_admin_bpei(auth.uid()));

-- ============ FUNCTIONS ============

-- Hash IP with pepper (server-side; pepper injected via GUC set by app or fallback)
CREATE OR REPLACE FUNCTION public.hash_ip(_ip TEXT, _pepper TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(extensions.digest(COALESCE(_ip,'unknown') || COALESCE(_pepper, 'no-pepper'), 'sha256'), 'hex');
$$;

REVOKE ALL ON FUNCTION public.hash_ip(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hash_ip(TEXT, TEXT) TO service_role;

-- Check if IP is currently blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(_ip_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.ip_blocks WHERE ip_hash = _ip_hash AND blocked_until > now());
$$;

REVOKE ALL ON FUNCTION public.is_ip_blocked(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(TEXT) TO service_role;

-- Increment bucket & return new count (atomic)
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  _scope_type TEXT, _scope_key TEXT, _endpoint TEXT, _window_start TIMESTAMPTZ
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _cnt INTEGER;
BEGIN
  INSERT INTO public.rate_limit_buckets(scope_type, scope_key, endpoint, window_start, count)
    VALUES (_scope_type, _scope_key, _endpoint, _window_start, 1)
    ON CONFLICT (scope_type, scope_key, endpoint, window_start)
    DO UPDATE SET count = public.rate_limit_buckets.count + 1
    RETURNING count INTO _cnt;
  RETURN _cnt;
END; $$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- Record an abuse event (also triggers auto-block if threshold reached)
CREATE OR REPLACE FUNCTION public.record_abuse(
  _ip TEXT, _ip_hash TEXT, _fingerprint TEXT, _shop_id UUID,
  _endpoint TEXT, _event_type public.abuse_event_type,
  _severity public.abuse_severity, _ua TEXT, _metadata JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id UUID; _recent INTEGER;
BEGIN
  INSERT INTO public.abuse_log(ip, ip_hash, fingerprint, shop_id, endpoint, event_type, severity, user_agent, metadata)
    VALUES (_ip, _ip_hash, _fingerprint, _shop_id, _endpoint, _event_type, _severity, _ua, COALESCE(_metadata, '{}'::jsonb))
    RETURNING id INTO _id;

  -- Auto-block: 5+ warn/critical events in last hour for same ip_hash and not already blocked
  IF _severity IN ('warn','critical') THEN
    SELECT COUNT(*) INTO _recent FROM public.abuse_log
      WHERE ip_hash = _ip_hash AND occurred_at > now() - INTERVAL '1 hour'
        AND severity IN ('warn','critical');
    IF _recent >= 5 AND NOT public.is_ip_blocked(_ip_hash) THEN
      INSERT INTO public.ip_blocks(ip_hash, ip, reason, blocked_until)
        VALUES (_ip_hash, _ip, 'auto: 5+ events/hour', now() + INTERVAL '1 hour');
      INSERT INTO public.abuse_log(ip, ip_hash, fingerprint, shop_id, endpoint, event_type, severity, user_agent, metadata)
        VALUES (_ip, _ip_hash, _fingerprint, _shop_id, _endpoint, 'suspicious_pattern', 'critical', _ua,
                jsonb_build_object('auto_blocked', true, 'until', now() + INTERVAL '1 hour'));
    END IF;
  END IF;

  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.record_abuse(TEXT, TEXT, TEXT, UUID, TEXT, public.abuse_event_type, public.abuse_severity, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_abuse(TEXT, TEXT, TEXT, UUID, TEXT, public.abuse_event_type, public.abuse_severity, TEXT, JSONB) TO service_role;

-- Admin: manual block
CREATE OR REPLACE FUNCTION public.admin_block_ip(_ip_hash TEXT, _ip TEXT, _minutes INTEGER, _reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id UUID;
BEGIN
  IF NOT public.is_admin_bpei(auth.uid()) THEN RAISE EXCEPTION 'access denied'; END IF;
  INSERT INTO public.ip_blocks(ip_hash, ip, reason, blocked_until, created_by)
    VALUES (_ip_hash, _ip, COALESCE(_reason,'manual'), now() + make_interval(mins => GREATEST(1, LEAST(43200, _minutes))), auth.uid())
    RETURNING id INTO _id;
  RETURN _id;
END; $$;

REVOKE ALL ON FUNCTION public.admin_block_ip(TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_block_ip(TEXT, TEXT, INTEGER, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unblock_ip(_ip_hash TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n INTEGER;
BEGIN
  IF NOT public.is_admin_bpei(auth.uid()) THEN RAISE EXCEPTION 'access denied'; END IF;
  UPDATE public.ip_blocks SET blocked_until = now() WHERE ip_hash = _ip_hash AND blocked_until > now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END; $$;

REVOKE ALL ON FUNCTION public.admin_unblock_ip(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_unblock_ip(TEXT) TO authenticated;

-- Admin: list recent abuse
CREATE OR REPLACE FUNCTION public.admin_list_abuse(_limit INTEGER DEFAULT 200)
RETURNS SETOF public.abuse_log
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.abuse_log
  WHERE public.is_admin_bpei(auth.uid())
  ORDER BY occurred_at DESC
  LIMIT GREATEST(1, LEAST(1000, COALESCE(_limit, 200)));
$$;

REVOKE ALL ON FUNCTION public.admin_list_abuse(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_abuse(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_active_blocks()
RETURNS SETOF public.ip_blocks
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.ip_blocks
  WHERE public.is_admin_bpei(auth.uid()) AND blocked_until > now()
  ORDER BY blocked_until DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_active_blocks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_active_blocks() TO authenticated;