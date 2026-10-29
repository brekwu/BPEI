# BPEI — Schéma Supabase versionné

Le projet de préproduction Supabase BPEI (`qmbsfmcotnsxsvbigynz`) comporte **41 migrations appliquées** au 29 octobre 2026, et la branche contient **41 fichiers SQL versionnés**. Les migrations `20261028175736_p1_admin_roster_secure_cross_admin_visibility` et `20261028233020_p1_cover_mission_foreign_keys` sont synchronisées. L'égalité des décomptes ne remplace pas un essai de restauration sur une base vierge.

- Ne pas réappliquer sans préparation ces migrations à la base existante : elles y sont déjà enregistrées.
- Sur une nouvelle base, suivre l'ordre numérique avec les outils officiels de migration Supabase après sauvegarde et contrôle de l'environnement.
- Les migrations ne configurent pas les secrets SMTP, le domaine, le compte administrateur, ni l'activation des Auth Hooks dans le dashboard.
- Les validations juridiques et inscriptions restent fermées jusqu'aux contrôles opérationnels.
- Toujours tester les politiques RLS, les fonctions privilégiées et le parcours client avant l'ouverture publique.

- P1 : une migration ajoute le suivi des incidents de mission et les notifications internes. Les formulaires publics restent fermés tant que les critères d'ouverture P0 ne sont pas vérifiés.

- Un test automatisé vérifie désormais que chaque migration appliquée est représentée une seule fois dans le dépôt, avec son numéro attendu ; vérifier une restauration intégrale reste nécessaire avant publication.

- Performance P1 : six index B-tree simples couvrent les clés étrangères des événements, incidents et notifications. Le contrôle Supabase `unindexed_foreign_keys` ne remonte plus de résultat ; les alertes `unused_index` sont attendues tant que la base est sans trafic réel et ne justifient pas leur suppression.

## MVP commercial (29 octobre 2026)

41 migrations versionnées et appliquées. Les deux dernières ajoutent les coordonnées client, des devis privés et leur validation documentée, puis des factures numérotées séparément pour chaque indépendant par transaction atomique. Les accès sont contrôlés par RLS et des RPC administratifs. L'encaissement Stripe, les factures électroniques structurées et la recette réelle restent à faire ; aucune ouverture publique.
