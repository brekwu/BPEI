-- Correctif ÉLEVÉ : la validation finale et l'acquisition du verrou de génération
-- doivent être réservées à un membre légitime de la boutique (owner ou manager),
-- jamais à un admin_bpei même assigné à l'assistance.

CREATE OR REPLACE FUNCTION public.confirm_import_validation(_job_id uuid, _digest text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.import_jobs WHERE id = _job_id;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'Import introuvable'; END IF;
  -- Interdit explicitement aux rôles plateforme (admin_bpei / owner_bpei) de valider
  -- à la place de la boutique, même s'ils sont assignés à l'assistance.
  IF NOT (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = v_shop AND s.owner_user_id = auth.uid())
    OR public.has_shop_role(auth.uid(), v_shop, 'shop_manager')
    OR public.has_shop_role(auth.uid(), v_shop, 'network_owner')
  ) THEN
    RAISE EXCEPTION 'Seul un responsable de la boutique peut confirmer la validation';
  END IF;
  UPDATE public.import_jobs
    SET validated_by = auth.uid(),
        validated_at = now(),
        validated_digest = _digest
  WHERE id = _job_id;
END $function$;

CREATE OR REPLACE FUNCTION public.acquire_import_generation_lock(_job_id uuid, _token uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.import_jobs WHERE id = _job_id;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'Import introuvable'; END IF;
  -- Génération réservée aux responsables réels de la boutique.
  IF NOT (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = v_shop AND s.owner_user_id = auth.uid())
    OR public.has_shop_role(auth.uid(), v_shop, 'shop_manager')
    OR public.has_shop_role(auth.uid(), v_shop, 'network_owner')
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  UPDATE public.import_jobs
    SET generation_started_at = now(), generation_lock_token = _token
  WHERE id = _job_id
    AND (generation_lock_token IS NULL OR generation_started_at < now() - interval '10 minutes');
  RETURN FOUND;
END $function$;