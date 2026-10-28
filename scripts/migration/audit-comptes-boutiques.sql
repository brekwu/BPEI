-- BPEI / étape 2 : audit post-restauration, sans données personnelles.
-- À exécuter dans le NOUVEAU projet Supabase qmbsfmcotnsxsvbigynz uniquement.
-- Compte les lignes, vérifie les références et l'activation RLS.
-- Ne teste PAS les mots de passe, OAuth, e-mails ni les objets Storage physiques.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE TEMP TABLE bpei_audit_counts (
  metric text PRIMARY KEY, expected bigint NOT NULL, actual bigint, status text NOT NULL
) ON COMMIT DROP;
CREATE TEMP TABLE bpei_audit_checks (
  check_name text PRIMARY KEY, violations bigint, status text NOT NULL
) ON COMMIT DROP;

DO $audit$
DECLARE
  r record;
  found bigint;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('utilisateurs', 'auth', 'users', 6::bigint),
      ('identites', 'auth', 'identities', 6::bigint),
      ('profils', 'public', 'profiles', 6::bigint),
      ('boutiques', 'public', 'shops', 5::bigint),
      ('candidatures_boutiques', 'public', 'shop_applications', 6::bigint),
      ('membres_boutiques', 'public', 'shop_memberships', 9::bigint),
      ('roles_plateforme', 'public', 'user_platform_roles', 9::bigint),
      ('abonnements_boutiques', 'public', 'shop_subscriptions', 4::bigint),
      ('buckets_storage', 'storage', 'buckets', 5::bigint)
    ) AS source_counts(metric, schema_name, table_name, expected)
  LOOP
    IF to_regclass(format('%I.%I', r.schema_name, r.table_name)) IS NULL THEN
      INSERT INTO bpei_audit_counts VALUES (r.metric, r.expected, NULL, 'ABSENT');
    ELSE
      EXECUTE format('SELECT count(*) FROM %I.%I', r.schema_name, r.table_name) INTO found;
      INSERT INTO bpei_audit_counts VALUES
        (r.metric, r.expected, found, CASE WHEN found=r.expected THEN 'OK' ELSE 'ECART' END);
    END IF;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('identites_sans_compte', 'auth.identities', 'auth.users',
       'SELECT count(*) FROM auth.identities i LEFT JOIN auth.users u ON u.id=i.user_id WHERE u.id IS NULL'),
      ('profils_sans_compte', 'public.profiles', 'auth.users',
       'SELECT count(*) FROM public.profiles p LEFT JOIN auth.users u ON u.id=p.id WHERE u.id IS NULL'),
      ('comptes_sans_profil', 'auth.users', 'public.profiles',
       'SELECT count(*) FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id WHERE p.id IS NULL'),
      ('boutiques_proprietaire_invalide', 'public.shops', 'auth.users',
       'SELECT count(*) FROM public.shops s LEFT JOIN auth.users u ON u.id=s.owner_user_id WHERE s.owner_user_id IS NOT NULL AND u.id IS NULL'),
      ('membres_boutique_inconnue', 'public.shop_memberships', 'public.shops',
       'SELECT count(*) FROM public.shop_memberships m LEFT JOIN public.shops s ON s.id=m.shop_id WHERE s.id IS NULL'),
      ('membres_compte_inconnu', 'public.shop_memberships', 'auth.users',
       'SELECT count(*) FROM public.shop_memberships m LEFT JOIN auth.users u ON u.id=m.user_id WHERE u.id IS NULL'),
      ('roles_compte_inconnu', 'public.user_platform_roles', 'auth.users',
       'SELECT count(*) FROM public.user_platform_roles r LEFT JOIN auth.users u ON u.id=r.user_id WHERE u.id IS NULL'),
      ('abonnements_boutique_inconnue', 'public.shop_subscriptions', 'public.shops',
       'SELECT count(*) FROM public.shop_subscriptions a LEFT JOIN public.shops s ON s.id=a.shop_id WHERE s.id IS NULL'),
      ('candidatures_boutique_inconnue', 'public.shop_applications', 'public.shops',
       'SELECT count(*) FROM public.shop_applications a LEFT JOIN public.shops s ON s.id=a.shop_id WHERE a.shop_id IS NOT NULL AND s.id IS NULL'),
      ('candidatures_compte_inconnu', 'public.shop_applications', 'auth.users',
       'SELECT count(*) FROM public.shop_applications a LEFT JOIN auth.users u ON u.id=a.linked_user_id WHERE a.linked_user_id IS NOT NULL AND u.id IS NULL')
    ) AS rels(check_name, first_table, second_table, count_query)
  LOOP
    IF to_regclass(r.first_table) IS NULL OR to_regclass(r.second_table) IS NULL THEN
      INSERT INTO bpei_audit_checks VALUES (r.check_name, NULL, 'EN_ATTENTE');
    ELSE
      EXECUTE r.count_query INTO found;
      INSERT INTO bpei_audit_checks VALUES
        (r.check_name, found, CASE WHEN found=0 THEN 'OK' ELSE 'ERREUR' END);
    END IF;
  END LOOP;

  FOR r IN
    SELECT * FROM (VALUES
      ('profils', 'profiles'), ('boutiques', 'shops'),
      ('membres', 'shop_memberships'), ('roles', 'user_platform_roles'),
      ('candidatures', 'shop_applications'), ('abonnements', 'shop_subscriptions')
    ) AS sensitive(display_name, table_name)
  LOOP
    IF to_regclass(format('%I.%I', 'public', r.table_name)) IS NULL THEN
      INSERT INTO bpei_audit_checks VALUES ('rls_' || r.display_name, NULL, 'EN_ATTENTE');
    ELSE
      SELECT CASE WHEN c.relrowsecurity THEN 0 ELSE 1 END INTO found
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=r.table_name;
      INSERT INTO bpei_audit_checks VALUES
        ('rls_' || r.display_name, found, CASE WHEN found=0 THEN 'OK' ELSE 'ERREUR' END);
    END IF;
  END LOOP;
END
$audit$;

SELECT jsonb_pretty(jsonb_build_object(
  'statut', CASE
    WHEN EXISTS(SELECT 1 FROM bpei_audit_counts WHERE status<>'OK')
      OR EXISTS(SELECT 1 FROM bpei_audit_checks WHERE status<>'OK')
    THEN 'A_VERIFIER'
    ELSE 'VOLUMES_RELATIONS_ET_RLS_OK_TESTS_DE_CONNEXION_RESTANTS'
  END,
  'comptages', (SELECT jsonb_agg(jsonb_build_object('nom',metric,'source',expected,'cible',actual,'etat',status) ORDER BY metric) FROM bpei_audit_counts),
  'verifications', (SELECT jsonb_agg(jsonb_build_object('nom',check_name,'anomalies',violations,'etat',status) ORDER BY check_name) FROM bpei_audit_checks)
)) AS rapport_json;
COMMIT;
