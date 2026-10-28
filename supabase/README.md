# BPEI — Schéma Supabase versionné

Ce dossier reproduit **dans l'ordre** les 31 migrations effectivement appliquées au projet de préproduction Supabase BPEI (`qmbsfmcotnsxsvbigynz`) le 28 octobre 2026. Il sert de base à une reconstruction et à des revues de code.

- Ne pas réappliquer sans préparation ces migrations à la base existante : elles y sont déjà enregistrées.
- Sur une nouvelle base, suivre l'ordre numérique avec les outils officiels de migration Supabase après sauvegarde et contrôle de l'environnement.
- Les migrations ne configurent pas les secrets SMTP, le domaine, le compte administrateur, ni l'activation des Auth Hooks dans le dashboard.
- Les validations juridiques et inscriptions restent fermées jusqu'aux contrôles opérationnels.
- Toujours tester les politiques RLS, les fonctions privilégiées et le parcours client avant l'ouverture publique.

- P1 : une migration ajoute le suivi des incidents de mission et les notifications internes. Les formulaires publics restent fermés tant que les critères d'ouverture P0 ne sont pas vérifiés.
