# BPEI — P0 : preuve de lancement (30 octobre 2026)

Ce dossier est un **état factuel**, pas une autorisation de lancement. Les vérifications sont en lecture seule. Conserver les formulaires publics et Stripe LIVE fermés jusqu'à la recette.

## Vérifications effectuées

- Projet Supabase `qmbsfmcotnsxsvbigynz` : `ACTIVE_HEALTHY`.
- Base : `auth.users = 0`, `independent_admins = 0`, `bpei_stripe_connected_accounts = 0`.
- `scripts/p0-owner-readiness.sql` exécuté en lecture seule : **sept contrôles NON PRÊTS** (admin, SMTP, juridique, envoi commercial, conventions/e-facturation, Stripe TEST, pilote intégral).
- Dernier commit contrôlé de `feat/mvp-commercial-foundation` : `e46845f66cf82f47c0e4556f469134165adf91aa`. Ses deux workflows GitHub ont réussi ; cela ne vaut pas recette externe.
- La branche `main` ne contient pas la version développée. Ne pas fusionner ni publier sur cette seule base.

## Suite de recette obligatoire

1. **Auth :** vérifier dans Supabase hébergé l'activation effective du hook `Before User Created`. Le `supabase/config.toml` versionné ne suffit pas. Exécuter le test SQL de lecture seule `tests/p0-auth-hook-gate.sql`. Ne pas ouvrir l'inscription si le hook n'est pas activé.
2. **SMTP :** configurer un expéditeur autorisé SPF/DKIM/DMARC, envoyer une vraie confirmation et constater la réception et la validation. Ne jamais simuler `email_confirmed_at`.
3. **Admin :** utiliser exclusivement un compte réel confirmé, puis la procédure `docs/BOOTSTRAP_ADMIN_BPEI.md`. Ne pas promouvoir automatiquement un premier inscrit.
4. **Juridique :** identité de l'exploitant, conventions, CGU/CGV, confidentialité, médiateur et émetteur des factures approuvés et versionnés, avant toute publication.
5. **Documents :** vérifier numérotation, mentions, consentement, envoi PDF et preuve de réception ; valider la plateforme de facturation électronique adaptée.
6. **Stripe TEST :** confirmer le compte BPEI, l'identité du marchand, l'onboarding Connect, les secrets serveur et un webhook signé. Payer, échouer, expirer, rejouer un événement et vérifier l'isolation. Aucun paiement live.
7. **Pilote :** deux comptes confirmés avec rôles distincts ; dossier client, devis accepté, facture et paiement test rapprochés. Vérifier les refus d'accès RLS.

## Critère de sortie

Rejouer `scripts/p0-owner-readiness.sql` : conserver les sept résultats et les preuves externes indépendantes. Une ligne « conditions SQL présentes » ne prouve jamais à elle seule un mail livré, une signature, une validation KYC, ni un paiement réel. **Ne pas activer la publicité ou les paiements réels tant que le pilote et le cadre légal ne sont pas prouvés.**
