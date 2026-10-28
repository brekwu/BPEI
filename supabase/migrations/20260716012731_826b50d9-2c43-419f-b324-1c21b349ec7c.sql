DO $$ BEGIN CREATE TYPE public.appointment_status AS ENUM ('pending','confirmed','in_progress','completed','cancelled','no_show'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.appointment_source AS ENUM ('public','manual','phone'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.review_status AS ENUM ('pending','published','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.shop_business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at TIME, closes_at TIME,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  break_start TIME, break_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(shop_id, day_of_week)
);
GRANT SELECT ON public.shop_business_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_business_hours TO authenticated;
GRANT ALL ON public.shop_business_hours TO service_role;
ALTER TABLE public.shop_business_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Horaires publics" ON public.shop_business_hours FOR SELECT USING (true);
CREATE POLICY "Gerants horaires" ON public.shop_business_hours FOR ALL TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE TRIGGER trg_bh_upd BEFORE UPDATE ON public.shop_business_hours FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.shop_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT ON public.shop_closures TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_closures TO authenticated;
GRANT ALL ON public.shop_closures TO service_role;
ALTER TABLE public.shop_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fermetures publiques" ON public.shop_closures FOR SELECT USING (true);
CREATE POLICY "Membres fermetures" ON public.shop_closures FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE TRIGGER trg_sc_upd BEFORE UPDATE ON public.shop_closures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_shop_closures ON public.shop_closures(shop_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.technician_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at TIME NOT NULL, closes_at TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technician_availability TO authenticated;
GRANT ALL ON public.technician_availability TO service_role;
ALTER TABLE public.technician_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres voient dispos" ON public.technician_availability FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Techs et gerants gerent dispos" ON public.technician_availability FOR ALL TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id) OR user_id = auth.uid())
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id) OR user_id = auth.uid());
CREATE TRIGGER trg_ta_upd BEFORE UPDATE ON public.technician_availability FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.technician_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technician_time_off TO authenticated;
GRANT ALL ON public.technician_time_off TO service_role;
ALTER TABLE public.technician_time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres voient conges" ON public.technician_time_off FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Techs et gerants gerent conges" ON public.technician_time_off FOR ALL TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id) OR user_id = auth.uid())
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id) OR user_id = auth.uid());
CREATE TRIGGER trg_tto_upd BEFORE UPDATE ON public.technician_time_off FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.appointment_blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  technician_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_blocked_slots TO authenticated;
GRANT ALL ON public.appointment_blocked_slots TO service_role;
ALTER TABLE public.appointment_blocked_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres blocages" ON public.appointment_blocked_slots FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE TRIGGER trg_abs_upd BEFORE UPDATE ON public.appointment_blocked_slots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_abs_period ON public.appointment_blocked_slots(shop_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.service_catalog(id) ON DELETE SET NULL,
  technician_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  repair_id UUID REFERENCES public.repairs(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'pending',
  source public.appointment_source NOT NULL DEFAULT 'manual',
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  contact_name TEXT, contact_email TEXT, contact_phone TEXT,
  device_description TEXT, problem_description TEXT, internal_notes TEXT,
  cancelled_at TIMESTAMPTZ, cancellation_reason TEXT,
  confirmation_sent_at TIMESTAMPTZ, reminder_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres voient RDV" ON public.appointments FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Membres creent RDV" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Membres modifient RDV" ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Gerants suppriment RDV" ON public.appointments FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));
CREATE TRIGGER trg_appt_upd BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_appt_period ON public.appointments(shop_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_appt_tech ON public.appointments(technician_user_id, starts_at) WHERE technician_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appt_customer ON public.appointments(customer_id) WHERE customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.repair_public_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  repair_id UUID NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  first_viewed_at TIMESTAMPTZ, last_viewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(repair_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_public_tokens TO authenticated;
GRANT ALL ON public.repair_public_tokens TO service_role;
ALTER TABLE public.repair_public_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Membres jetons rep" ON public.repair_public_tokens FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE INDEX IF NOT EXISTS idx_rpt_token ON public.repair_public_tokens(token);

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  repair_id UUID REFERENCES public.repairs(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  submitted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT, comment TEXT,
  status public.review_status NOT NULL DEFAULT 'pending',
  published_at TIMESTAMPTZ,
  reply_text TEXT, replied_at TIMESTAMPTZ, replied_by UUID REFERENCES auth.users(id),
  ip TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avis publies publics" ON public.reviews FOR SELECT USING (status = 'published');
CREATE POLICY "Membres voient avis" ON public.reviews FOR SELECT TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Gerants moderent avis" ON public.reviews FOR UPDATE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id))
  WITH CHECK (public.can_manage_shop(auth.uid(), shop_id));
CREATE POLICY "Gerants suppriment avis" ON public.reviews FOR DELETE TO authenticated
  USING (public.can_manage_shop(auth.uid(), shop_id));
CREATE TRIGGER trg_rev_upd BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS idx_reviews_shop ON public.reviews(shop_id, status, published_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_portal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  linked_via TEXT NOT NULL DEFAULT 'email_match' CHECK (linked_via IN ('email_match','invite','manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, customer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_portal_links TO authenticated;
GRANT ALL ON public.customer_portal_links TO service_role;
ALTER TABLE public.customer_portal_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Utilisateur voit liens" ON public.customer_portal_links FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_shop_member(auth.uid(), shop_id));
CREATE POLICY "Membres gerent liens" ON public.customer_portal_links FOR ALL TO authenticated
  USING (public.is_shop_member(auth.uid(), shop_id))
  WITH CHECK (public.is_shop_member(auth.uid(), shop_id));
CREATE INDEX IF NOT EXISTS idx_cpl_user ON public.customer_portal_links(user_id);
CREATE INDEX IF NOT EXISTS idx_cpl_customer ON public.customer_portal_links(customer_id);

CREATE POLICY "Client ses fiches" ON public.customers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_links l WHERE l.customer_id = customers.id AND l.user_id = auth.uid()));
CREATE POLICY "Client ses appareils" ON public.devices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_links l WHERE l.customer_id = devices.customer_id AND l.user_id = auth.uid()));
CREATE POLICY "Client ses reparations" ON public.repairs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_links l WHERE l.customer_id = repairs.customer_id AND l.user_id = auth.uid()));
CREATE POLICY "Client historique statut" ON public.repair_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.repairs r JOIN public.customer_portal_links l ON l.customer_id = r.customer_id WHERE r.id = repair_status_history.repair_id AND l.user_id = auth.uid()));
CREATE POLICY "Client ses devis" ON public.quotes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_links l WHERE l.customer_id = quotes.customer_id AND l.user_id = auth.uid()));
CREATE POLICY "Client lignes devis" ON public.quote_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q JOIN public.customer_portal_links l ON l.customer_id = q.customer_id WHERE q.id = quote_lines.quote_id AND l.user_id = auth.uid()));
CREATE POLICY "Client ses factures" ON public.invoices FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_links l WHERE l.customer_id = invoices.customer_id AND l.user_id = auth.uid()));
CREATE POLICY "Client lignes factures" ON public.invoice_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i JOIN public.customer_portal_links l ON l.customer_id = i.customer_id WHERE i.id = invoice_lines.invoice_id AND l.user_id = auth.uid()));
CREATE POLICY "Client ses paiements" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_links l WHERE l.customer_id = payments.customer_id AND l.user_id = auth.uid()));
CREATE POLICY "Client ses RDV" ON public.appointments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_portal_links l WHERE l.customer_id = appointments.customer_id AND l.user_id = auth.uid()));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='shops' AND policyname='Boutiques validees publiques') THEN
    CREATE POLICY "Boutiques validees publiques" ON public.shops FOR SELECT USING (status = 'validated');
  END IF;
END $$;
GRANT SELECT ON public.shops TO anon;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='service_catalog' AND policyname='Prestations actives publiques') THEN
    CREATE POLICY "Prestations actives publiques" ON public.service_catalog FOR SELECT USING (active = TRUE);
  END IF;
END $$;
GRANT SELECT ON public.service_catalog TO anon;

CREATE OR REPLACE FUNCTION public.link_customer_records_for_user()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email TEXT; _uid UUID := auth.uid(); _count INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN RETURN 0; END IF;
  _email := lower(coalesce((auth.jwt() ->> 'email'), ''));
  IF _email = '' THEN RETURN 0; END IF;
  INSERT INTO public.customer_portal_links(user_id, shop_id, customer_id, linked_via)
  SELECT _uid, c.shop_id, c.id, 'email_match' FROM public.customers c
  WHERE lower(c.email) = _email
  ON CONFLICT (user_id, customer_id) DO NOTHING;
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END; $$;

CREATE OR REPLACE FUNCTION public.public_get_repair_status(_token TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tok RECORD; _r RECORD; _shop RECORD;
BEGIN
  SELECT * INTO _tok FROM public.repair_public_tokens WHERE token = _token;
  IF _tok IS NULL OR _tok.revoked_at IS NOT NULL THEN RETURN NULL; END IF;
  IF _tok.expires_at IS NOT NULL AND _tok.expires_at < now() THEN RETURN NULL; END IF;
  UPDATE public.repair_public_tokens
    SET view_count = view_count + 1,
        first_viewed_at = COALESCE(first_viewed_at, now()),
        last_viewed_at = now()
    WHERE id = _tok.id;
  SELECT id, repair_number, status, customer_issue, technical_diagnosis,
    customer_visible_notes, estimated_completion_at, completed_at, collected_at,
    created_at, updated_at
    INTO _r FROM public.repairs WHERE id = _tok.repair_id;
  SELECT id, name, city, phone, email INTO _shop FROM public.shops WHERE id = _tok.shop_id;
  RETURN jsonb_build_object(
    'repair', to_jsonb(_r),
    'shop', to_jsonb(_shop),
    'history', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'old_status', h.old_status, 'new_status', h.new_status, 'changed_at', h.created_at
    ) ORDER BY h.created_at)
    FROM public.repair_status_history h WHERE h.repair_id = _tok.repair_id), '[]'::jsonb)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.get_available_slots(
  _shop_id UUID, _service_id UUID, _from TIMESTAMPTZ, _to TIMESTAMPTZ
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _duration INTEGER; _step INTEGER := 15;
  _slots JSONB := '[]'::jsonb;
  _cursor TIMESTAMPTZ; _slot_end TIMESTAMPTZ;
  _day INTEGER; _hours RECORD;
  _local_start TIME; _local_end TIME;
BEGIN
  IF _to <= _from THEN RETURN _slots; END IF;
  IF (_to - _from) > INTERVAL '60 days' THEN RETURN _slots; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND status = 'validated') THEN RETURN _slots; END IF;
  SELECT COALESCE(estimated_duration_minutes, 30) INTO _duration FROM public.service_catalog
    WHERE id = _service_id AND shop_id = _shop_id AND active = TRUE;
  IF _duration IS NULL THEN _duration := 30; END IF;
  _cursor := date_trunc('hour', _from);
  IF _cursor < _from THEN _cursor := _cursor + INTERVAL '15 minutes'; END IF;

  WHILE _cursor + (_duration || ' minutes')::INTERVAL <= _to LOOP
    _slot_end := _cursor + (_duration || ' minutes')::INTERVAL;
    _day := EXTRACT(DOW FROM _cursor)::INTEGER;
    SELECT opens_at, closes_at, is_closed, break_start, break_end INTO _hours
      FROM public.shop_business_hours WHERE shop_id = _shop_id AND day_of_week = _day;
    IF _hours.is_closed IS NOT TRUE AND _hours.opens_at IS NOT NULL AND _hours.closes_at IS NOT NULL THEN
      _local_start := _cursor::TIME; _local_end := _slot_end::TIME;
      IF _local_start >= _hours.opens_at AND _local_end <= _hours.closes_at
         AND NOT (_hours.break_start IS NOT NULL AND _local_start < _hours.break_end AND _local_end > _hours.break_start)
         AND NOT EXISTS (SELECT 1 FROM public.shop_closures sc WHERE sc.shop_id = _shop_id AND sc.starts_at < _slot_end AND sc.ends_at > _cursor)
         AND NOT EXISTS (SELECT 1 FROM public.appointment_blocked_slots b WHERE b.shop_id = _shop_id AND b.starts_at < _slot_end AND b.ends_at > _cursor)
         AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.shop_id = _shop_id
                         AND a.status NOT IN ('cancelled','no_show') AND a.starts_at < _slot_end AND a.ends_at > _cursor)
      THEN
        _slots := _slots || jsonb_build_object('starts_at', _cursor, 'ends_at', _slot_end);
      END IF;
    END IF;
    _cursor := _cursor + (_step || ' minutes')::INTERVAL;
  END LOOP;
  RETURN _slots;
END; $$;

CREATE OR REPLACE FUNCTION public.book_public_appointment(
  _shop_id UUID, _service_id UUID, _starts_at TIMESTAMPTZ,
  _name TEXT, _email TEXT, _phone TEXT,
  _device_description TEXT, _problem_description TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _duration INTEGER; _ends_at TIMESTAMPTZ; _id UUID;
BEGIN
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  IF _phone IS NULL OR length(trim(_phone)) = 0 THEN RAISE EXCEPTION 'phone required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND status = 'validated') THEN RAISE EXCEPTION 'shop not found'; END IF;
  SELECT COALESCE(estimated_duration_minutes, 30) INTO _duration FROM public.service_catalog
    WHERE id = _service_id AND shop_id = _shop_id AND active = TRUE;
  IF _duration IS NULL THEN _duration := 30; END IF;
  _ends_at := _starts_at + (_duration || ' minutes')::INTERVAL;
  IF _starts_at < now() THEN RAISE EXCEPTION 'slot in the past'; END IF;
  IF EXISTS (SELECT 1 FROM public.appointments a WHERE a.shop_id = _shop_id
             AND a.status NOT IN ('cancelled','no_show') AND a.starts_at < _ends_at AND a.ends_at > _starts_at) THEN
    RAISE EXCEPTION 'slot no longer available';
  END IF;
  INSERT INTO public.appointments(
    shop_id, service_id, starts_at, ends_at, status, source,
    contact_name, contact_email, contact_phone, device_description, problem_description
  ) VALUES (
    _shop_id, _service_id, _starts_at, _ends_at, 'pending', 'public',
    _name, _email, _phone, _device_description, _problem_description
  ) RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.submit_review(
  _token TEXT, _author_name TEXT, _rating SMALLINT,
  _title TEXT, _comment TEXT, _ip TEXT DEFAULT NULL, _ua TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _tok RECORD; _r RECORD; _rid UUID;
BEGIN
  IF _rating IS NULL OR _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'rating invalid'; END IF;
  IF _author_name IS NULL OR length(trim(_author_name)) = 0 THEN RAISE EXCEPTION 'name required'; END IF;
  SELECT * INTO _tok FROM public.repair_public_tokens WHERE token = _token;
  IF _tok IS NULL OR _tok.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invalid token'; END IF;
  SELECT id, shop_id, customer_id, status INTO _r FROM public.repairs WHERE id = _tok.repair_id;
  IF _r IS NULL THEN RAISE EXCEPTION 'repair not found'; END IF;
  IF _r.status NOT IN ('repair_completed','ready_for_pickup','customer_notified','device_collected') THEN
    RAISE EXCEPTION 'repair not completed yet';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reviews WHERE repair_id = _r.id) THEN RAISE EXCEPTION 'review already submitted'; END IF;
  INSERT INTO public.reviews(shop_id, repair_id, customer_id, author_name, rating, title, comment, status, ip, user_agent)
  VALUES (_r.shop_id, _r.id, _r.customer_id, _author_name, _rating, _title, _comment, 'pending', _ip, _ua)
  RETURNING id INTO _rid;
  RETURN _rid;
END; $$;

CREATE OR REPLACE FUNCTION public.get_or_create_repair_token(_repair_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _shop UUID; _tok TEXT;
BEGIN
  SELECT shop_id INTO _shop FROM public.repairs WHERE id = _repair_id;
  IF _shop IS NULL THEN RAISE EXCEPTION 'repair not found'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _shop) THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT token INTO _tok FROM public.repair_public_tokens WHERE repair_id = _repair_id;
  IF _tok IS NOT NULL THEN RETURN _tok; END IF;
  _tok := replace(replace(replace(encode(gen_random_bytes(24), 'base64'), '/', '_'), '+', '-'), '=', '');
  INSERT INTO public.repair_public_tokens(shop_id, repair_id, token, created_by)
  VALUES (_shop, _repair_id, _tok, auth.uid());
  RETURN _tok;
END; $$;