# BPEI — Procédure d'activation du premier administrateur

**Préproduction uniquement.** Aucun administrateur ne doit être créé à partir d'une adresse supposée. Ne jamais écrire de mot de passe dans GitHub ou SQL.

## Pré-requis
1. Le propriétaire confirme explicitement l'adresse e-mail à utiliser pour l'administration BPEI.
2. Cette adresse crée un compte depuis `/espace-independant` et confirme son e-mail.
3. Vérifier dans Supabase Auth que l'adresse correspond exactement à l'utilisateur attendu et que `email_confirmed_at` n'est pas NULL.

## Action SQL réservée à l'opérateur Supabase

Remplacer `ADRESSE_ADMIN_VALIDEE` par l'adresse expressément approuvée, uniquement après les vérifications ci-dessus :

```sql
INSERT INTO public.independent_admins(user_id)
SELECT id FROM auth.users
WHERE lower(email) = lower('ADRESSE_ADMIN_VALIDEE')
  AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
```

La table `independent_admins` n'autorise pas l'ajout par un utilisateur ordinaire. Le rôle ne repose pas sur des métadonnées utilisateur modifiables.

Tester ensuite le tableau `/gestion-independants` avec le compte admin et avec un compte non-admin, puis valider les opérations sur une candidature fictive en environnement de préproduction.

## Désactivation

Depuis l'interface d'administration Supabase, après vérification de l'identité, supprimer l'entrée correspondant à cet utilisateur dans `independent_admins`. Cela ne supprime pas son compte Auth.

## Conditions de sortie de recette
- Un utilisateur non-admin ne peut consulter les candidatures ni les coordonnées clients.
- Un admin peut examiner, approuver ou refuser une candidature (vérification documentaire requise).
- Seuls les indépendants approuvés et vérifiés peuvent recevoir une mission.
- Les demandes publiques restent désactivées jusqu'à publication des documents juridiques validés, recette e-mail et protections anti-spam.
