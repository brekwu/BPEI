CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link_url TEXT,
  entity_type TEXT,
  entity_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_shop_user ON public.notifications(shop_id, user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(shop_id, user_id) WHERE read_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop members read notifications"
ON public.notifications FOR SELECT TO authenticated
USING (public.is_shop_member(auth.uid(), shop_id) AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "shop members update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (public.is_shop_member(auth.uid(), shop_id) AND (user_id IS NULL OR user_id = auth.uid()))
WITH CHECK (public.is_shop_member(auth.uid(), shop_id) AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "shop members delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (public.is_shop_member(auth.uid(), shop_id) AND (user_id IS NULL OR user_id = auth.uid()));

CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'note',
  subject TEXT,
  body TEXT NOT NULL,
  category TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_templates_shop ON public.message_templates(shop_id) WHERE active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop members read templates"
ON public.message_templates FOR SELECT TO authenticated
USING (public.is_shop_member(auth.uid(), shop_id));

CREATE POLICY "shop admins manage templates"
ON public.message_templates FOR ALL TO authenticated
USING (
  public.has_shop_role(auth.uid(), shop_id, 'shop_manager'::shop_role)
  OR public.has_shop_role(auth.uid(), shop_id, 'network_owner'::shop_role)
)
WITH CHECK (
  public.has_shop_role(auth.uid(), shop_id, 'shop_manager'::shop_role)
  OR public.has_shop_role(auth.uid(), shop_id, 'network_owner'::shop_role)
);

CREATE TRIGGER trg_message_templates_updated
BEFORE UPDATE ON public.message_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE id = p_notification_id
    AND (user_id IS NULL OR user_id = auth.uid())
    AND public.is_shop_member(auth.uid(), shop_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_shop_id UUID)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_shop_member(auth.uid(), p_shop_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  WITH upd AS (
    UPDATE public.notifications
    SET read_at = now()
    WHERE shop_id = p_shop_id
      AND read_at IS NULL
      AND (user_id IS NULL OR user_id = auth.uid())
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_repair_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (shop_id, category, title, body, entity_type, entity_id, link_url)
    VALUES (NEW.shop_id, 'repair', 'Nouvelle réparation',
      COALESCE(NEW.repair_number, '')::text, 'repair', NEW.id,
      '/app/shop/' || NEW.shop_id || '/repairs/' || NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (shop_id, category, title, body, entity_type, entity_id, link_url)
    VALUES (NEW.shop_id, 'repair', 'Statut de réparation mis à jour',
      COALESCE(NEW.repair_number, '') || ' → ' || NEW.status, 'repair', NEW.id,
      '/app/shop/' || NEW.shop_id || '/repairs/' || NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_repair ON public.repairs;
CREATE TRIGGER trg_notify_repair
AFTER INSERT OR UPDATE OF status ON public.repairs
FOR EACH ROW EXECUTE FUNCTION public.notify_repair_events();

CREATE OR REPLACE FUNCTION public.notify_appointment_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (shop_id, category, title, body, entity_type, entity_id, link_url)
    VALUES (NEW.shop_id, 'appointment', 'Nouveau rendez-vous',
      to_char(NEW.starts_at AT TIME ZONE 'Europe/Paris','DD/MM/YYYY HH24:MI'),
      'appointment', NEW.id,
      '/app/shop/' || NEW.shop_id || '/appointments');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_appointment ON public.appointments;
CREATE TRIGGER trg_notify_appointment
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_appointment_events();