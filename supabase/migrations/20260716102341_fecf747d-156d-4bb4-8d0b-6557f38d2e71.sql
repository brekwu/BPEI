CREATE OR REPLACE FUNCTION public.shop_request_publication(_shop_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_shop(auth.uid(), _shop_id) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  UPDATE public.shops
     SET public_profile_status = 'pending_review', publication_requested_at = now(),
         publication_notes = _notes, updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, shop_id, note)
  VALUES (auth.uid(), 'shop.publication.request', _shop_id, _notes);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_approve_publication(_shop_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_platform_role(auth.uid(),'owner_bpei') OR public.has_platform_role(auth.uid(),'admin_bpei')) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI'; END IF;
  UPDATE public.shops
     SET public_profile_status = 'published', publication_reviewed_at = now(),
         publication_reviewed_by = auth.uid(), publication_notes = _notes, updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, shop_id, note)
  VALUES (auth.uid(), 'shop.publication.approve', _shop_id, _notes);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_reject_publication(_shop_id uuid, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_platform_role(auth.uid(),'owner_bpei') OR public.has_platform_role(auth.uid(),'admin_bpei')) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI'; END IF;
  IF _notes IS NULL OR length(trim(_notes)) < 5 THEN RAISE EXCEPTION 'Un motif de refus est requis'; END IF;
  UPDATE public.shops
     SET public_profile_status = 'draft', publication_reviewed_at = now(),
         publication_reviewed_by = auth.uid(), publication_notes = _notes, updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, shop_id, reason)
  VALUES (auth.uid(), 'shop.publication.reject', _shop_id, _notes);
END; $$;

CREATE OR REPLACE FUNCTION public.shop_unpublish(_shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_manage_shop(auth.uid(), _shop_id) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  UPDATE public.shops SET public_profile_status = 'draft', updated_at = now() WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, shop_id)
  VALUES (auth.uid(), 'shop.publication.unpublish', _shop_id);
END; $$;

CREATE OR REPLACE FUNCTION public.shop_submit_legal(_shop_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_shop record;
BEGIN
  IF NOT public.can_manage_shop(auth.uid(), _shop_id) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT legal_name, legal_form, siret INTO v_shop FROM public.shops WHERE id = _shop_id;
  IF v_shop.legal_name IS NULL OR v_shop.legal_form IS NULL OR v_shop.siret IS NULL THEN
    RAISE EXCEPTION 'Raison sociale, forme et SIRET requis'; END IF;
  UPDATE public.shops
     SET legal_status = 'submitted', legal_submitted_at = now(), legal_notes = NULL, updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, shop_id)
  VALUES (auth.uid(), 'shop.legal.submit', _shop_id);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_approve_legal(_shop_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_platform_role(auth.uid(),'owner_bpei') OR public.has_platform_role(auth.uid(),'admin_bpei')) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI'; END IF;
  UPDATE public.shops
     SET legal_status = 'approved', legal_reviewed_at = now(),
         legal_reviewed_by = auth.uid(), legal_notes = _notes, updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, shop_id, note)
  VALUES (auth.uid(), 'shop.legal.approve', _shop_id, _notes);
END; $$;

CREATE OR REPLACE FUNCTION public.owner_reject_legal(_shop_id uuid, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_platform_role(auth.uid(),'owner_bpei') OR public.has_platform_role(auth.uid(),'admin_bpei')) THEN
    RAISE EXCEPTION 'Réservé au patron BPEI'; END IF;
  IF _notes IS NULL OR length(trim(_notes)) < 5 THEN RAISE EXCEPTION 'Un motif de refus est requis'; END IF;
  UPDATE public.shops
     SET legal_status = 'rejected', legal_reviewed_at = now(),
         legal_reviewed_by = auth.uid(), legal_notes = _notes, updated_at = now()
   WHERE id = _shop_id;
  INSERT INTO public.owner_audit_log(actor_user_id, action, shop_id, reason)
  VALUES (auth.uid(), 'shop.legal.reject', _shop_id, _notes);
END; $$;