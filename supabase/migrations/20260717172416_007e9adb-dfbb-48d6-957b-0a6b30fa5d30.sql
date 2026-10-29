-- Fix 1: qualify digest() with extensions schema in accept_application
CREATE OR REPLACE FUNCTION public.partner_accept_application(_application_id uuid, _title text, _scope text DEFAULT NULL::text, _compensation_model text DEFAULT NULL::text, _compensation_details text DEFAULT NULL::text, _requires_exclusivity boolean DEFAULT false, _start_date date DEFAULT NULL::date, _end_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _app RECORD; _agreement_id uuid; _snapshot jsonb;
BEGIN
  SELECT pa.*, po.shop_id AS opp_shop_id INTO _app
    FROM public.partner_applications pa
    JOIN public.partner_opportunities po ON po.id = pa.opportunity_id
    WHERE pa.id = _application_id;
  IF _app.id IS NULL THEN RAISE EXCEPTION 'Candidature introuvable'; END IF;
  IF NOT public.is_shop_member(auth.uid(), _app.opp_shop_id) THEN
    RAISE EXCEPTION 'Réservé à la boutique propriétaire';
  END IF;
  IF NOT public.shop_partnership_capable(_app.opp_shop_id, 'shop') THEN
    RAISE EXCEPTION 'Boutique non éligible aux accords (profil/abonnement)';
  END IF;

  UPDATE public.partner_applications
    SET status='accepted', reviewed_at=now(), updated_at=now()
    WHERE id=_application_id;

  INSERT INTO public.partner_agreements
    (shop_id, independent_shop_id, opportunity_id, application_id,
     title, scope, compensation_model, compensation_details,
     requires_exclusivity, start_date, end_date, status, created_by, current_version,
     exclusivity_kind)
  VALUES (_app.opp_shop_id, _app.independent_shop_id, _app.opportunity_id, _application_id,
     _title, _scope, _compensation_model, _compensation_details,
     _requires_exclusivity, _start_date, _end_date, 'draft', auth.uid(), 1,
     CASE WHEN _requires_exclusivity THEN 'preferred' ELSE 'none' END)
  RETURNING id INTO _agreement_id;

  _snapshot := jsonb_build_object(
    'title', _title, 'scope', _scope,
    'compensation_model', _compensation_model, 'compensation_details', _compensation_details,
    'requires_exclusivity', _requires_exclusivity,
    'exclusivity_kind', CASE WHEN _requires_exclusivity THEN 'preferred' ELSE 'none' END,
    'start_date', _start_date, 'end_date', _end_date,
    'shop_id', _app.opp_shop_id, 'independent_shop_id', _app.independent_shop_id
  );

  INSERT INTO public.partner_agreement_versions
    (agreement_id, version_number, snapshot, content_hash, change_summary, created_by)
  VALUES (_agreement_id, 1, _snapshot, encode(extensions.digest(_snapshot::text, 'sha256'), 'hex'),
          'Version initiale (brouillon)', auth.uid());

  INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
    VALUES (_agreement_id, 'created', auth.uid(), jsonb_build_object('application_id', _application_id));
  RETURN _agreement_id;
END $function$;

-- Fix 2: qualify digest() in propose_agreement_version
CREATE OR REPLACE FUNCTION public.partner_propose_agreement_version(_agreement_id uuid, _snapshot jsonb, _change_summary text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _agr RECORD; _next_ver integer; _caller_side text;
BEGIN
  SELECT * INTO _agr FROM public.partner_agreements WHERE id = _agreement_id;
  IF _agr.id IS NULL THEN RAISE EXCEPTION 'Accord introuvable'; END IF;
  IF public.is_shop_member(auth.uid(), _agr.shop_id) THEN _caller_side := 'shop';
  ELSIF public.is_shop_member(auth.uid(), _agr.independent_shop_id) THEN _caller_side := 'independent';
  ELSE RAISE EXCEPTION 'Non autorisé'; END IF;

  SELECT COALESCE(MAX(version_number),0)+1 INTO _next_ver
    FROM public.partner_agreement_versions WHERE agreement_id = _agreement_id;

  INSERT INTO public.partner_agreement_versions
    (agreement_id, version_number, snapshot, content_hash, change_summary, created_by)
  VALUES (_agreement_id, _next_ver, _snapshot,
          encode(extensions.digest(_snapshot::text, 'sha256'), 'hex'), _change_summary, auth.uid());

  UPDATE public.partner_agreements
    SET current_version = _next_ver,
        status = 'negotiation',
        shop_signed_at = NULL,
        independent_signed_at = NULL,
        updated_at = now()
    WHERE id = _agreement_id;

  INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
    VALUES (_agreement_id, 'version_proposed', auth.uid(),
            jsonb_build_object('version_number', _next_ver, 'by_side', _caller_side));
  RETURN _next_ver;
END $function$;

-- Fix 3: on activation of an exclusive version, propagate to agreement row
-- and improve conflict detection to look at other agreements' current versions.
CREATE OR REPLACE FUNCTION public.partner_accept_agreement_version(_agreement_id uuid, _version_number integer, _content_hash text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _agr RECORD; _ver RECORD; _side text; _both boolean; _has_conflict boolean;
        _snap_start date; _snap_end date;
BEGIN
  SELECT * INTO _agr FROM public.partner_agreements WHERE id = _agreement_id;
  IF _agr.id IS NULL THEN RAISE EXCEPTION 'Accord introuvable'; END IF;
  SELECT * INTO _ver FROM public.partner_agreement_versions
    WHERE agreement_id = _agreement_id AND version_number = _version_number;
  IF _ver.id IS NULL THEN RAISE EXCEPTION 'Version introuvable'; END IF;
  IF _ver.content_hash <> _content_hash THEN
    RAISE EXCEPTION 'Le contenu a changé, rechargez la version';
  END IF;
  IF _agr.current_version <> _version_number THEN
    RAISE EXCEPTION 'Cette version n''est plus la version courante';
  END IF;

  IF public.is_shop_member(auth.uid(), _agr.shop_id) THEN _side := 'shop';
  ELSIF public.is_shop_member(auth.uid(), _agr.independent_shop_id) THEN _side := 'independent';
  ELSE RAISE EXCEPTION 'Non autorisé'; END IF;

  IF _side = 'shop' THEN
    UPDATE public.partner_agreement_versions
      SET shop_accepted_at = now(), shop_accepted_by = auth.uid()
      WHERE id = _ver.id;
    UPDATE public.partner_agreements
      SET shop_signed_at = now(),
          status = CASE WHEN independent_signed_at IS NOT NULL THEN status ELSE 'shop_signed' END,
          updated_at = now()
      WHERE id = _agreement_id;
  ELSE
    UPDATE public.partner_agreement_versions
      SET independent_accepted_at = now(), independent_accepted_by = auth.uid()
      WHERE id = _ver.id;
    UPDATE public.partner_agreements
      SET independent_signed_at = now(),
          status = CASE WHEN shop_signed_at IS NOT NULL THEN status ELSE 'independent_signed' END,
          updated_at = now()
      WHERE id = _agreement_id;
  END IF;

  SELECT (shop_accepted_at IS NOT NULL AND independent_accepted_at IS NOT NULL)
    INTO _both FROM public.partner_agreement_versions WHERE id = _ver.id;

  IF _both THEN
    IF (_ver.snapshot->>'exclusivity_kind') = 'exclusive' THEN
      IF (_ver.snapshot->>'end_date') IS NULL OR (_ver.snapshot->>'start_date') IS NULL THEN
        RAISE EXCEPTION 'Exclusivité : dates début/fin requises';
      END IF;
      IF COALESCE(jsonb_array_length(_ver.snapshot->'covered_cities'),0)
       + COALESCE(jsonb_array_length(_ver.snapshot->'covered_postal_codes'),0) = 0 THEN
        RAISE EXCEPTION 'Exclusivité : zone requise';
      END IF;
      IF COALESCE(jsonb_array_length(_ver.snapshot->'specialties'),0) = 0 THEN
        RAISE EXCEPTION 'Exclusivité : au moins une catégorie de service requise';
      END IF;
      IF (_ver.snapshot->>'compensation_details') IS NULL AND (_ver.snapshot->>'compensation_model') IS NULL THEN
        RAISE EXCEPTION 'Exclusivité : rémunération requise';
      END IF;

      _snap_start := (_ver.snapshot->>'start_date')::date;
      _snap_end := (_ver.snapshot->>'end_date')::date;

      -- Improved conflict detection: check other active agreements for same independent,
      -- either via the agreement row (exclusive) or via any active version snapshot exclusive
      -- with overlapping dates.
      SELECT EXISTS (
        SELECT 1
        FROM public.partner_agreements a2
        LEFT JOIN LATERAL (
          SELECT v.snapshot FROM public.partner_agreement_versions v
          WHERE v.agreement_id = a2.id AND v.version_number = a2.current_version
        ) vv ON true
        WHERE a2.id <> _agreement_id
          AND a2.independent_shop_id = _agr.independent_shop_id
          AND a2.status = 'active'
          AND (
            (a2.exclusivity_kind = 'exclusive'
             AND COALESCE(a2.end_date, 'infinity'::date) >= _snap_start
             AND COALESCE(a2.start_date, '-infinity'::date) <= _snap_end)
            OR
            ((vv.snapshot->>'exclusivity_kind') = 'exclusive'
             AND COALESCE((vv.snapshot->>'end_date')::date, 'infinity'::date) >= _snap_start
             AND COALESCE((vv.snapshot->>'start_date')::date, '-infinity'::date) <= _snap_end)
          )
      ) INTO _has_conflict;
      IF _has_conflict THEN
        INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
          VALUES (_agreement_id, 'conflict_flagged', auth.uid(), jsonb_build_object('reason','exclusive overlap'));
        RAISE EXCEPTION 'Conflit d''exclusivité détecté avec un accord actif — validation patron requise';
      END IF;

      -- Propagate exclusive kind + dates to the agreement row so subsequent checks work
      UPDATE public.partner_agreements
        SET exclusivity_kind = 'exclusive',
            start_date = _snap_start,
            end_date = _snap_end
        WHERE id = _agreement_id;
    END IF;

    UPDATE public.partner_agreement_versions
      SET became_active_at = now() WHERE id = _ver.id AND became_active_at IS NULL;
    UPDATE public.partner_agreements
      SET status = 'active', became_active_at = now(), updated_at = now()
      WHERE id = _agreement_id AND status <> 'active';
    INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
      VALUES (_agreement_id, 'activated', auth.uid(),
              jsonb_build_object('version_number', _version_number));
    RETURN 'active';
  END IF;

  INSERT INTO public.partner_agreement_events (agreement_id, event_type, actor_user_id, details)
    VALUES (_agreement_id, _side || '_accepted', auth.uid(),
            jsonb_build_object('version_number', _version_number));
  RETURN _side || '_accepted';
END $function$;