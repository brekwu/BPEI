# BPEI — premier administrateur (procédure de préproduction)

**Ne pas ouvrir les inscriptions publiques pour créer l'administrateur.** Le portail BPEI est fermé avant validation juridique. La fonction `bpei_private.before_bpei_user_created`, lorsqu'elle est activée dans Supabase Auth, refuse les inscriptions ordinaires et réserve un marqueur à la création via l'API d'administration.

## 1. Préconditions

- Confirmer explicitement l'adresse e-mail administrative BPEI et vérifier indépendamment que son titulaire contrôle la boîte. Ne pas supposer une adresse à partir d'un autre projet.
- Utiliser uniquement le projet Supabase **BPEI** `qmbsfmcotnsxsvbigynz`.
- Ne jamais envoyer de clé `service_role`, mot de passe ou token dans le dépôt, les tickets, les logs, le navigateur ou un chat. Les exécuter depuis un poste de confiance en variables d'environnement privées.
- Vérifier la configuration Auth, notamment la stratégie d'inscriptions fermées et le hook `Before User Created`. La seule existence de la fonction SQL ne démontre pas que le hook est activé.

## 2. Voie recommandée : script privilégié avec garde-fous

Configurer en environnement privé `BPEI_SUPABASE_URL`, `BPEI_SUPABASE_SERVICE_KEY`, `BPEI_ADMIN_EMAIL`, `BPEI_ADMIN_PASSWORD` (minimum 16 caractères, majuscule/minuscule/chiffre/symbole) et `BPEI_ADMIN_EMAIL_VERIFIED=true` **uniquement après contrôle réel de la boîte**.

```bash
node scripts/p0-bootstrap-admin.mjs
node scripts/p0-bootstrap-admin.mjs --execute
```

Le premier appel est **un dry-run** ; le second crée un seul utilisateur via `auth.admin.createUser` puis attribue `independent_admins`, vérifie les droits et retire le marqueur temporaire `bpei_admin_bootstrap`. L'attribution des droits doit être vérifiée en base.

Si la création du compte réussit mais pas l'attribution du rôle, **ne pas créer un deuxième compte**. Vérifier l'identifiant du compte existant, puis reprendre explicitement via :

```bash
node scripts/p0-bootstrap-admin.mjs --execute --resume-user-id <UUID_DU_COMPTE_EXISTANT>
```

Cette procédure est un bootstrap privilégié ; elle **ne prouve pas** la délivrabilité SMTP ni le parcours de confirmation e-mail public.

## 3. Alternative : compte Auth existant et réellement confirmé

Uniquement si un utilisateur BPEI existe déjà, si sa propriété a été vérifiée et si `email_confirmed_at` est renseigné, un opérateur privilégié peut lui attribuer le rôle via SQL :

```sql
INSERT INTO public.independent_admins(user_id)
SELECT id FROM auth.users
WHERE lower(email) = lower('ADRESSE_ADMIN_VALIDEE')
  AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
```

Ce SQL **ne crée pas** de compte et ne contourne pas les inscriptions fermées. L'adresse est à remplacer uniquement après vérification. Ne pas mettre cette valeur dans une migration publique.

## 4. Critères de recette

1. Vérifier dans Supabase qu'un seul compte attendu détient le rôle et qu'aucun marqueur temporaire de bootstrap n'est conservé.
2. Se connecter à `/gestion-independants` avec cet administrateur ; vérifier refus d'accès avec un utilisateur ordinaire.
3. Vérifier séparément un vrai e-mail de confirmation et de récupération, le hook Auth actif, les documents juridiques approuvés/publiés, puis une recette métier à trois comptes.
4. Garder `independent_registration_enabled=false`, les entrées de `bpei_intake_flags` désactivées et `bpei.fr` inchangé jusqu'à homologation complète.

## Révocation

Après vérification de l'identité du titulaire et avec accès opérateur privilégié, supprimer l'entrée correspondante de `public.independent_admins`. Cette opération retire le rôle BPEI, sans supprimer le compte Auth.
