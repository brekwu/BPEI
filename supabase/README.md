# BPEI — Schéma Supabase P0 versionné

Cette branche contient **30 migrations de P0**, allant de `20261028125244` à `20261028170430`.
Elles préparent le socle juridique, les droits RLS, l'authentification et l'administration.

**Attention : la préproduction Supabase partagée `qmbsfmcotnsxsvbigynz` a 37 migrations appliquées** au 28 octobre 2026 : ces 30 migrations P0 plus 7 migrations P1. Les migrations P1 supplémentaires sont versionnées sur `feat/p1-mission-operations`. C'est une superposition intentionnelle de branches, **pas la preuve que P0 seul a été reconstitué et validé sur une base vierge**.

- Ne jamais réappliquer ces migrations sans contrôler leur historique ni réinitialiser cette base.
- Les tests `tests/p0-db-*.sql` s'exécutent sur la préproduction **P0 + P1** et annulent toute création artificielle grâce à `ROLLBACK` ; la base reste intacte.
- Pour obtenir une preuve indépendante du schéma P0 seul, utiliser une base de test isolée et appliquer uniquement ces 30 migrations, puis répéter les tests (sans modifier l'instance partagée).
- Les migrations ne configurent pas GoTrue/Auth Hooks, SMTP, secrets, URL autorisées, identité administrateur ou documents juridiques.
- La publication et les inscriptions restent fermées jusqu'à homologation de ces éléments avec de vrais comptes et réception d'e-mails externes.
- `tests/p0-readiness-inventory.sql` décrit les preuves manquantes : `EXTERNAL_EVIDENCE_REQUIRED` n'est jamais un feu vert.
