-- Fix 1: Drop redundant public-role SELECT policy on shops (anon-scoped policy remains,
-- and anon already has column-level grants restricting exposure). Authenticated users
-- will now only see shops via owner/member/admin policy — sensitive columns
-- (admin_notes, insurance_*, private_*, legal_notes, verification_notes, etc.) are
-- no longer readable by arbitrary logged-in users just because status='validated'.
DROP POLICY IF EXISTS "Boutiques validees publiques" ON public.shops;

-- Fix 2: Prevent shop owners from self-approving status / verification / legal / publication
-- fields via a BEFORE UPDATE trigger. Admins (admin_bpei / owner_bpei) are unaffected.
CREATE OR REPLACE FUNCTION public.shops_prevent_owner_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_bpei(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-admin: forbid mutation of moderation / compliance fields.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Modification du statut réservée à un administrateur BPEI';
  END IF;
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.verification_reviewed_by IS DISTINCT FROM OLD.verification_reviewed_by
     OR NEW.verification_reviewed_at IS DISTINCT FROM OLD.verification_reviewed_at
     OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes THEN
    RAISE EXCEPTION 'Modification de la vérification réservée à un administrateur BPEI';
  END IF;
  IF NEW.legal_status IS DISTINCT FROM OLD.legal_status
     OR NEW.legal_reviewed_by IS DISTINCT FROM OLD.legal_reviewed_by
     OR NEW.legal_reviewed_at IS DISTINCT FROM OLD.legal_reviewed_at
     OR NEW.legal_notes IS DISTINCT FROM OLD.legal_notes THEN
    RAISE EXCEPTION 'Modification du dossier légal réservée à un administrateur BPEI';
  END IF;
  IF NEW.publication_reviewed_by IS DISTINCT FROM OLD.publication_reviewed_by
     OR NEW.publication_reviewed_at IS DISTINCT FROM OLD.publication_reviewed_at
     OR NEW.publication_notes IS DISTINCT FROM OLD.publication_notes THEN
    RAISE EXCEPTION 'Modération de publication réservée à un administrateur BPEI';
  END IF;
  IF NEW.validated_at IS DISTINCT FROM OLD.validated_at
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes THEN
    RAISE EXCEPTION 'Champ administratif réservé à un administrateur BPEI';
  END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'Transfert de propriété réservé à un administrateur BPEI';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shops_prevent_owner_privilege_escalation_trg ON public.shops;
CREATE TRIGGER shops_prevent_owner_privilege_escalation_trg
BEFORE UPDATE ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.shops_prevent_owner_privilege_escalation();