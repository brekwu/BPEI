# BPEI — P0 : ouverture contrôlée

Ce document décrit des **contrôles réels**, pas une déclaration de mise en production. Projet Supabase BPEI : `qmbsfmcotnsxsvbigynz` (Paris). Branche de travail : `feat/bpei-independent-release-clean`.

## État vérifié le 28 octobre 2026

- Base Supabase ACTIVE_HEALTHY ; tables métier sous RLS ; audit sécurité Supabase sans alerte.
- Au contrôle : **aucun utilisateur, aucun administrateur, aucun document juridique approuvé et aucune version publiée**.
- `bpei_launch_controls` : `legal_documents_published=false`, `independent_registration_enabled=false`, `legal_version=null`.
- `bpei_intake_flags` : `contact=false` et `intervention=false`.
- Les droits SQL sont **scindés par colonne** (notamment INSERT des demandes, candidatures, acceptations, UPDATE du profil). Ne pas se fier à `has_table_privilege` ou `role_table_grants` pour conclure qu'ils sont absents.
- La fonction `bpei_private.before_bpei_user_created(jsonb)` retourne un refus 403 sur une inscription normale et autorise le marqueur `app_metadata.bpei_admin_bootstrap=true` réservé à l'API Admin. Elle **n'est pas nécessairement activée** dans la configuration Auth.
- Vercel `bpei-preview` fournit une préproduction READY, mais cela ne démontre pas la dernière révision ni la recette de bout en bout. Le domaine `bpei.fr` chez OVH n'est pas basculé.

## 1. Installer le premier administrateur (sans ouvrir les inscriptions)

Depuis un ordinateur de confiance uniquement : configurer les variables d'environnement `BPEI_SUPABASE_URL`, `BPEI_SUPABASE_SERVICE_KEY`, `BPEI_ADMIN_EMAIL`, `BPEI_ADMIN_PASSWORD` (mot de passe fort, 16 caractères minimum) et `BPEI_ADMIN_EMAIL_VERIFIED=true` **uniquement après vérification personnelle** de l'adresse.

Exécuter `node scripts/p0-bootstrap-admin.mjs` pour voir le mode sans modification ; puis `node scripts/p0-bootstrap-admin.mjs --execute` après contrôle des valeurs. Le script refuse tout projet autre que BPEI, crée un seul compte Auth, puis ajoute une ligne dans `independent_admins` et vérifie sa présence. Une seconde création d'un compte déjà existant n'est pas automatique. Ne jamais mettre la clé secrète dans Git, le navigateur, des logs, des messages, ou les variables préfixées `VITE_`.

Un administrateur ainsi confirmé constitue un **bootstrap privilégié**, et **ne prouve PAS** que le parcours public de confirmation e-mail fonctionne.

## 2. Auth et livraison e-mail

- Dans Supabase > Authentication > Hooks : activer le hook **Before User Created** et sélectionner la fonction Postgres `bpei_private.before_bpei_user_created`. Confirmer la fonction active par un essai réel d'inscription non privilégiée pendant la fermeture : elle doit être refusée et aucun compte ne doit apparaître.
- Dans Supabase > Authentication > SMTP : configurer un prestataire SMTP autorisé, l'adresse expéditrice et les identifiants ; vérifier SPF, DKIM et DMARC du domaine d'envoi. Ne pas compter sur le SMTP Supabase par défaut pour les destinataires extérieurs à l'équipe.
- Dans Supabase > Authentication > URL Configuration : définir `SITE_URL` et les URL de retour explicitement autorisées pour la préproduction, puis pour `https://bpei.fr` au moment du basculement. Valider la confirmation et la réinitialisation de mot de passe depuis une vraie boîte externe.
- Garder les inscriptions fermées tant que cette recette n'est pas probante.

## 3. Documents juridiques réels

- Identifier l'éditeur réel, son SIREN/SIRET et les coordonnées légales, les coordonnées de contact, l'hébergeur, le responsable de traitement et le cadre exact de la collaboration. Faire valider les **mentions légales**, la **confidentialité** et les **CGU** (version commune).
- Se connecter à `/gestion-independants` avec le compte administrateur autorisé ; coller les documents juridiques intégralement vérifiés dans l'interface ; approuver chacun puis publier les trois de la même version. La publication est versionnée et les versions publiées sont immuables.
- Vérifier les trois pages publiques, l'affichage des consentements, l'historique et l'interdiction de valider des candidatures sans acceptation en vigueur. Aucun texte provisoire ou factuellement inventé ne doit être publié.

## 4. Recette réelle puis ouverture

Faire une recette de préproduction avec des **personnes et adresses de test contrôlées** :
1. Inscription publique volontairement refusée tant que le portail est fermé, après activation du hook.
2. Une fois SMTP/CGU validés : ouverture temporaire et contrôlée pour le test, inscription, réception d'e-mail, confirmation, connexion, déconnexion et réinitialisation du mot de passe.
3. Acceptation juridique enregistrée dans `bpei_legal_acceptances`, création puis modification du profil propriétaire, dépôt et lecture d'une candidature.
4. Vérifier qu'un second indépendant ne lit pas/modifie pas le premier ; qu'un non-admin ne consulte pas l'administration ; qu'aucun utilisateur ne s'auto-approuve ni ne falsifie `verified_at`.
5. Pour les validations de production, ne pas inventer de vérification professionnelle : contrôler réellement SIRET, établissement, identité et justificatifs avant toute approbation, selon les règles BPEI.
6. Ouvrir `contact` et `intervention` seulement après publication juridique et tests : contrôler l'insertion, le consentement et le versionnement ; vérifier qu'aucune information privée n'est lisible anonymement.
7. Répéter les tests sur le **commit réellement déployé**, consulter les logs d'échecs et recontrôler les advisors Supabase.

La configuration des interrupteurs `bpei_launch_controls` et `bpei_intake_flags` doit être réalisée explicitement et en dernier. Ne pas la faire pour contourner les tests.

## 5. Commercialisation

Conserver `bpei.fr` sur OVH tant que la recette n'est pas acquise. Avant une exploitation commerciale, vérifier une offre Vercel conforme aux conditions applicables, le domaine, le certificat HTTPS, les redirections, la version de production et les tests de bout en bout.

**Règle de sortie P0** : pas de « P0 terminé » sans SMTP livré à une adresse externe, Auth Hook activé, administrateur fonctionnel, documents approuvés et publiés, recette positive et commit réellement déployé.
