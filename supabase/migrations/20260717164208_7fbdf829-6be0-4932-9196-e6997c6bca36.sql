-- =========================================================================
-- IDEMPOTENCE INDEX
-- =========================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notif_partner_entity
  ON public.notifications(shop_id, entity_type, entity_id)
  WHERE entity_type LIKE 'partner_%';

-- =========================================================================
-- HELPER: shop display name (returns coalesce of legal / public / fallback)
-- =========================================================================
CREATE OR REPLACE FUNCTION public._partner_shop_label(_shop_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(s.public_name,''), NULLIF(s.legal_name,''), 'Boutique') FROM public.shops s WHERE s.id = _shop_id
$$;

-- =========================================================================
-- TRIGGER: partner_agreement_events -> notifications (fanout 2 shops)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_notify_partner_agreement_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _a          public.partner_agreements%ROWTYPE;
  _title_shop TEXT;
  _title_indep TEXT;
  _body       TEXT;
  _link_shop  TEXT;
  _link_indep TEXT;
BEGIN
  SELECT * INTO _a FROM public.partner_agreements WHERE id = NEW.agreement_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  _link_shop  := '/app/shop/' || _a.shop_id || '/partners';
  _link_indep := '/app/shop/' || _a.independent_shop_id || '/network';

  CASE NEW.event_type
    WHEN 'created' THEN
      _title_shop  := 'Nouvel accord partenaire créé';
      _title_indep := 'Nouvel accord partenaire à consulter';
      _body := COALESCE(_a.title, 'Accord de partenariat');
    WHEN 'version_proposed' THEN
      _title_shop  := 'Nouvelle version d''accord proposée';
      _title_indep := 'Nouvelle version d''accord proposée';
      _body := 'Version v' || COALESCE((NEW.details->>'version_number'), '?');
    WHEN 'shop_accepted', 'shop_signed' THEN
      _title_shop  := 'Vous avez signé l''accord';
      _title_indep := 'La boutique a signé l''accord';
      _body := COALESCE(_a.title, 'Accord de partenariat');
    WHEN 'independent_accepted', 'independent_signed' THEN
      _title_shop  := 'L''indépendant a signé l''accord';
      _title_indep := 'Vous avez signé l''accord';
      _body := COALESCE(_a.title, 'Accord de partenariat');
    WHEN 'activated' THEN
      _title_shop  := 'Accord activé';
      _title_indep := 'Accord activé';
      _body := 'Version v' || COALESCE((NEW.details->>'version_number'), '?') || ' — les deux parties ont signé.';
    WHEN 'terminated' THEN
      _title_shop  := 'Accord résilié';
      _title_indep := 'Accord résilié';
      _body := COALESCE(NEW.details->>'reason', 'Résiliation');
    WHEN 'owner_suspended' THEN
      _title_shop  := 'Accord suspendu par BPEI';
      _title_indep := 'Accord suspendu par BPEI';
      _body := 'Motif : ' || COALESCE(NEW.details->>'reason', 'non précisé');
    WHEN 'conflict_flagged' THEN
      _title_shop  := 'Conflit d''exclusivité détecté';
      _title_indep := 'Conflit d''exclusivité détecté';
      _body := 'Validation patron requise avant activation.';
    WHEN 'expired' THEN
      _title_shop  := 'Accord expiré';
      _title_indep := 'Accord expiré';
      _body := 'La date de fin de l''accord est dépassée.';
    WHEN 'reactivated' THEN
      _title_shop  := 'Accord réactivé par BPEI';
      _title_indep := 'Accord réactivé par BPEI';
      _body := COALESCE(NEW.details->>'note', 'Suspension levée.');
    ELSE
      _title_shop  := 'Mise à jour de l''accord (' || NEW.event_type || ')';
      _title_indep := _title_shop;
      _body := COALESCE(_a.title, 'Accord de partenariat');
  END CASE;

  INSERT INTO public.notifications(shop_id, category, title, body, link_url, entity_type, entity_id)
  VALUES (_a.shop_id, 'partnership', _title_shop, _body, _link_shop, 'partner_agreement_event', NEW.id)
  ON CONFLICT (shop_id, entity_type, entity_id) WHERE entity_type LIKE 'partner_%' DO NOTHING;

  IF _a.independent_shop_id IS NOT NULL AND _a.independent_shop_id <> _a.shop_id THEN
    INSERT INTO public.notifications(shop_id, category, title, body, link_url, entity_type, entity_id)
    VALUES (_a.independent_shop_id, 'partnership', _title_indep, _body, _link_indep, 'partner_agreement_event', NEW.id)
    ON CONFLICT (shop_id, entity_type, entity_id) WHERE entity_type LIKE 'partner_%' DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_partner_agreement_event ON public.partner_agreement_events;
CREATE TRIGGER trg_notify_partner_agreement_event
  AFTER INSERT ON public.partner_agreement_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_partner_agreement_event();

-- =========================================================================
-- TRIGGER: partner_applications INSERT/UPDATE -> notifications
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_notify_partner_application()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _opp   public.partner_opportunities%ROWTYPE;
  _title TEXT;
  _body  TEXT;
BEGIN
  SELECT * INTO _opp FROM public.partner_opportunities WHERE id = NEW.opportunity_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    -- Notify opportunity owner (shop)
    _title := 'Nouvelle candidature reçue';
    _body  := public._partner_shop_label(NEW.independent_shop_id) || ' — ' || _opp.title;
    INSERT INTO public.notifications(shop_id, category, title, body, link_url, entity_type, entity_id)
    VALUES (_opp.shop_id, 'partnership', _title, _body,
            '/app/shop/' || _opp.shop_id || '/partners', 'partner_application', NEW.id)
    ON CONFLICT (shop_id, entity_type, entity_id) WHERE entity_type LIKE 'partner_%' DO NOTHING;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'accepted' THEN
      _title := 'Votre candidature a été acceptée';
    ELSIF NEW.status = 'rejected' THEN
      _title := 'Votre candidature a été refusée';
    ELSIF NEW.status = 'withdrawn' THEN
      _title := 'Candidature retirée';
    ELSE
      _title := 'Statut de candidature mis à jour';
    END IF;
    _body := _opp.title || COALESCE(' — ' || NULLIF(NEW.review_notes,''), '');
    -- Use event uniqueness by encoding status in a synthetic uuid via md5-hash-of-status is overkill;
    -- Instead vary entity_type to keep insert & each transition idempotent per row.
    INSERT INTO public.notifications(shop_id, category, title, body, link_url, entity_type, entity_id)
    VALUES (NEW.independent_shop_id, 'partnership', _title, _body,
            '/app/shop/' || NEW.independent_shop_id || '/network',
            'partner_application_' || NEW.status, NEW.id)
    ON CONFLICT (shop_id, entity_type, entity_id) WHERE entity_type LIKE 'partner_%' DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_partner_application_ins ON public.partner_applications;
CREATE TRIGGER trg_notify_partner_application_ins
  AFTER INSERT ON public.partner_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_partner_application();

DROP TRIGGER IF EXISTS trg_notify_partner_application_upd ON public.partner_applications;
CREATE TRIGGER trg_notify_partner_application_upd
  AFTER UPDATE OF status ON public.partner_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_partner_application();

-- =========================================================================
-- TRIGGER: partner_missions -> notifications (assignment, transitions)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_notify_partner_mission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _title_shop TEXT;
  _title_indep TEXT;
  _body       TEXT;
  _new_status TEXT;
BEGIN
  _new_status := NEW.status;

  IF TG_OP = 'INSERT' THEN
    IF _new_status IN ('assigned','proposed','pending') THEN
      _title_shop  := 'Mission proposée à ' || public._partner_shop_label(NEW.independent_shop_id);
      _title_indep := 'Nouvelle mission proposée';
      _body := NEW.title;
      INSERT INTO public.notifications(shop_id, category, title, body, link_url, entity_type, entity_id)
      VALUES (NEW.shop_id, 'partnership', _title_shop, _body,
              '/app/shop/' || NEW.shop_id || '/partners', 'partner_mission_created', NEW.id)
      ON CONFLICT (shop_id, entity_type, entity_id) WHERE entity_type LIKE 'partner_%' DO NOTHING;
      INSERT INTO public.notifications(shop_id, category, title, body, link_url, entity_type, entity_id)
      VALUES (NEW.independent_shop_id, 'partnership', _title_indep, _body,
              '/app/shop/' || NEW.independent_shop_id || '/network', 'partner_mission_created', NEW.id)
      ON CONFLICT (shop_id, entity_type, entity_id) WHERE entity_type LIKE 'partner_%' DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    CASE _new_status
      WHEN 'accepted' THEN
        _title_shop  := 'Mission acceptée par ' || public._partner_shop_label(NEW.independent_shop_id);
        _title_indep := 'Vous avez accepté la mission';
      WHEN 'declined' THEN
        _title_shop  := 'Mission refusée';
        _title_indep := 'Vous avez refusé la mission';
      WHEN 'in_progress', 'started' THEN
        _title_shop  := 'Mission démarrée';
        _title_indep := 'Mission démarrée';
      WHEN 'completed' THEN
        _title_shop  := 'Mission terminée';
        _title_indep := 'Mission marquée terminée';
      WHEN 'cancelled' THEN
        _title_shop  := 'Mission annulée';
        _title_indep := 'Mission annulée';
      ELSE
        _title_shop  := 'Statut mission : ' || _new_status;
        _title_indep := _title_shop;
    END CASE;
    _body := NEW.title || COALESCE(' — ' || NULLIF(NEW.cancellation_reason,''), '');

    INSERT INTO public.notifications(shop_id, category, title, body, link_url, entity_type, entity_id)
    VALUES (NEW.shop_id, 'partnership', _title_shop, _body,
            '/app/shop/' || NEW.shop_id || '/partners',
            'partner_mission_' || _new_status, NEW.id)
    ON CONFLICT (shop_id, entity_type, entity_id) WHERE entity_type LIKE 'partner_%' DO NOTHING;
    INSERT INTO public.notifications(shop_id, category, title, body, link_url, entity_type, entity_id)
    VALUES (NEW.independent_shop_id, 'partnership', _title_indep, _body,
            '/app/shop/' || NEW.independent_shop_id || '/network',
            'partner_mission_' || _new_status, NEW.id)
    ON CONFLICT (shop_id, entity_type, entity_id) WHERE entity_type LIKE 'partner_%' DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_partner_mission_ins ON public.partner_missions;
CREATE TRIGGER trg_notify_partner_mission_ins
  AFTER INSERT ON public.partner_missions
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_partner_mission();

DROP TRIGGER IF EXISTS trg_notify_partner_mission_upd ON public.partner_missions;
CREATE TRIGGER trg_notify_partner_mission_upd
  AFTER UPDATE OF status ON public.partner_missions
  FOR EACH ROW EXECUTE FUNCTION public.tg_notify_partner_mission();

-- =========================================================================
-- OWNER ACTIONS: reactivate + force expire + batch expire
-- =========================================================================
CREATE OR REPLACE FUNCTION public.partner_owner_reactivate_agreement(_agreement_id UUID, _note TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a public.partner_agreements%ROWTYPE;
BEGIN
  IF NOT (public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role)
       OR public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role)) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI';
  END IF;
  SELECT * INTO _a FROM public.partner_agreements WHERE id = _agreement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Accord introuvable'; END IF;
  IF _a.status <> 'suspended' THEN RAISE EXCEPTION 'Accord non suspendu'; END IF;

  UPDATE public.partner_agreements
     SET status = 'active', suspended_reason = NULL, suspended_by = NULL, updated_at = now()
     WHERE id = _agreement_id;

  INSERT INTO public.partner_agreement_events(agreement_id, event_type, actor_user_id, details)
    VALUES (_agreement_id, 'reactivated', auth.uid(), jsonb_build_object('note', _note));

  INSERT INTO public.owner_audit_log(actor_user_id, shop_id, action, old_value, new_value, note)
    VALUES (auth.uid(), _a.shop_id, 'partner_agreement.reactivate',
            jsonb_build_object('status','suspended','reason',_a.suspended_reason),
            jsonb_build_object('status','active','agreement_id',_agreement_id),
            _note);
END $$;

CREATE OR REPLACE FUNCTION public.partner_owner_force_expire_agreement(_agreement_id UUID, _reason TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _a public.partner_agreements%ROWTYPE;
BEGIN
  IF NOT (public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role)
       OR public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role)) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI';
  END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'Motif requis'; END IF;
  SELECT * INTO _a FROM public.partner_agreements WHERE id = _agreement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Accord introuvable'; END IF;
  IF _a.status IN ('expired','terminated') THEN RAISE EXCEPTION 'Accord déjà clos'; END IF;

  UPDATE public.partner_agreements
     SET status = 'expired', updated_at = now()
     WHERE id = _agreement_id;

  INSERT INTO public.partner_agreement_events(agreement_id, event_type, actor_user_id, details)
    VALUES (_agreement_id, 'expired', auth.uid(), jsonb_build_object('forced', true, 'reason', _reason));

  INSERT INTO public.owner_audit_log(actor_user_id, shop_id, action, old_value, new_value, reason)
    VALUES (auth.uid(), _a.shop_id, 'partner_agreement.force_expire',
            jsonb_build_object('status', _a.status),
            jsonb_build_object('status','expired','agreement_id',_agreement_id),
            _reason);
END $$;

CREATE OR REPLACE FUNCTION public.partner_owner_expire_due_agreements()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rec RECORD; _count int := 0;
BEGIN
  IF NOT (public.has_platform_role(auth.uid(), 'owner_bpei'::platform_role)
       OR public.has_platform_role(auth.uid(), 'admin_bpei'::platform_role)) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI';
  END IF;

  FOR _rec IN
    SELECT id FROM public.partner_agreements
     WHERE status IN ('active','suspended','proposed','shop_signed','independent_signed')
       AND end_date IS NOT NULL AND end_date < CURRENT_DATE
  LOOP
    UPDATE public.partner_agreements SET status='expired', updated_at=now() WHERE id = _rec.id;
    INSERT INTO public.partner_agreement_events(agreement_id, event_type, actor_user_id, details)
      VALUES (_rec.id, 'expired', auth.uid(), jsonb_build_object('auto', true));
    _count := _count + 1;
  END LOOP;

  IF _count > 0 THEN
    INSERT INTO public.owner_audit_log(actor_user_id, action, new_value)
      VALUES (auth.uid(), 'partner_agreement.batch_expire',
              jsonb_build_object('count', _count));
  END IF;
  RETURN _count;
END $$;

REVOKE ALL ON FUNCTION public.partner_owner_reactivate_agreement(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_owner_force_expire_agreement(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partner_owner_expire_due_agreements() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_owner_reactivate_agreement(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_owner_force_expire_agreement(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_owner_expire_due_agreements() TO authenticated;