-- =====================================================================
-- Audit sécurité: verrouille l'exécution des fonctions SECURITY DEFINER.
-- Par défaut Postgres accorde EXECUTE à PUBLIC sur toute fonction créée.
-- On révoque partout, puis on ré-octroie explicitement selon le besoin
-- (anon pour les fonctions réellement publiques, authenticated pour les
-- fonctions internes app, aucune GRANT pour les triggers/helpers internes).
-- =====================================================================

-- 1. Révoquer EXECUTE sur PUBLIC pour toutes les fonctions du schéma public
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated', r.proname, r.args);
  END LOOP;
END $$;

-- 2. GRANT EXECUTE aux authenticated: fonctions app internes appelées par
-- des utilisateurs connectés (membres boutique, admin_bpei, portail client).
GRANT EXECUTE ON FUNCTION public.is_admin_bpei(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_shop_role(uuid, uuid, shop_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_platform_role(uuid, platform_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_shop(uuid, uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.accept_shop_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_customer_records_for_user() TO authenticated;

GRANT EXECUTE ON FUNCTION public.issue_quote(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_credit_note(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_quote_totals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_invoice_totals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, integer, payment_method, text, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_document_number(uuid, document_number_kind) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_or_create_repair_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_appointment_slot(uuid, timestamptz, timestamptz, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_shop_technicians(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_appointment_to_repair(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_portal_invitation(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_customer_portal_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_customer_portal_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_cancel_appointment(uuid, text) TO authenticated;

-- 3. GRANT EXECUTE aux anon: fonctions réellement publiques (boutique
-- pilote, réservation en ligne, avis, suivi QR). Chacune valide déjà
-- son token / son shop_id / son statut et ne retourne que des colonnes
-- non sensibles.
GRANT EXECUTE ON FUNCTION public.public_get_quote(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_accept_quote(text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_refuse_quote(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_repair_status(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_public_appointment(uuid, uuid, timestamptz, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, timestamptz, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_review_stats(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_shop_public_reviews(uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(text, text, smallint, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(text, text, smallint, text, text, text, text, smallint, smallint, smallint) TO anon, authenticated;

-- 4. Fonctions purement internes appelées par triggers (aucune GRANT):
--    set_updated_at, handle_new_user, generate_repair_number,
--    repairs_assign_number, repairs_log_status_change,
--    prevent_delete_issued_invoice, prevent_modify_locked_quote,
--    prevent_modify_locked_invoice.
-- Elles ne sont jamais invoquées via RPC — laissées sans EXECUTE public.

-- 5. Durcissement supplémentaire: bloquer les inscriptions massives au
-- portail en s'assurant que create_customer_portal_invitation reste
-- limitée aux gérants (déjà contrôlé par can_manage_shop dans le corps
-- de la fonction). Rien à changer ici, l'audit valide le contrôle
-- existant.