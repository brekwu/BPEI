-- Route la fonction héritée `is_ai_import_enabled()` vers les nouveaux flags
-- par environnement. Elle renvoie true si Preview OU Production est activé.
-- Le contrôle strict par environnement reste appliqué côté serveur via
-- `assertAiImportEnabledForRuntime`. Cela supprime toute dépendance
-- sensible à l'ancien réglage `app_settings.ai_import_enabled`.
CREATE OR REPLACE FUNCTION public.is_ai_import_enabled()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(public.is_ai_import_enabled_env('preview'), false)
      OR COALESCE(public.is_ai_import_enabled_env('production'), false)
$function$;

COMMENT ON FUNCTION public.is_ai_import_enabled() IS
  'Compat: true si au moins un environnement (preview|production) est activé. La véritable garde par environnement est côté serveur (assertAiImportEnabledForRuntime).';