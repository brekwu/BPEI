# BPEI — transfert Lovable → GitHub

Branche : `feat/reseau-national-2026-10`. Source : projet Lovable `2d1ac429-ce2c-45e9-bdc3-dffaa4747e4f`, révision `dffa5f19adcc36c2d0b11da6c14c6a544bd8be19`.

Cette branche contient le code source React/TanStack et l'historique des migrations Supabase importés de Lovable, en excluant les fichiers `.env`, rapports internes, comptes de tests, artefacts binaires et scripts de seeding.

## Fonctionnalités ajoutées
- `/demander-une-intervention` et `/candidature-partenaire`, avec validation des champs, consentement explicite et suivi UTM.
- `/admin/interventions` et `/admin/techniciens` réservés aux rôles administrateur/patron, sans attribution automatique.
- Navigation, sitemap et mentions de tarification publique actualisés.
- Limitation du débit des demandes côté serveur et références uniques.
- Workflow GitHub Actions : installation, tests des schémas, build et lint **sans déploiement**.

## Sécurité
Le dépôt GitHub est **public** : ne jamais y stocker de clés, de fichiers `.env` ni de données de clients. Le transfert est un travail de code, **pas une migration de la base de données**. Les droits RLS et la configuration du serveur doivent être revus avant ouverture.

Le fichier `sql/001_bloquer_insert_direct.sql` est une action de sécurisation **à appliquer manuellement APRÈS** validation des formulaires côté serveur avec `SUPABASE_SERVICE_ROLE_KEY`. Ne pas l'exécuter tant que l'environnement de production ne fournit pas cette variable.

Les assets binaires Lovable n'ont pas été transférés automatiquement (notamment l'icône `public/favicon.ico`). Prévoir leur export avant déploiement indépendant.

## Critères avant publication sur bpei.fr
1. GitHub Actions vertes : tests, compilation, lint.
2. Tester en préproduction avec des variables d'environnement configurées secrètement.
3. Test réel d'une demande client et d'une candidature, suivi en administration, avec suppression des données de test.
4. Vérifier les politiques RLS et l'absence d'accès public à des dossiers clients.
5. Vérifier le rendu mobile, SEO, notices légales, emails et la disponibilité du domaine.
6. Examiner le contrat de partenariat freelance et les conditions financières avant activation des missions.
7. Publier seulement après une validation explicite, avec plan de retour arrière.

Aucun paiement Stripe, aucun virement ou commission n'est activé dans cette branche.
