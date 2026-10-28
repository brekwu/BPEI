# BPEI P0 — validation finale en conditions réelles

Ce document évite de confondre la réussite des tests SQL transactionnels avec une ouverture fiable du site. La branche `feat/bpei-independent-release-clean` demeure la seule branche P0. **Ne pas fusionner vers main ni changer bpei.fr sans validation de tous les prérequis.**

## 1. Administrateur et identité

- Faire confirmer par l'exploitant légal de BPEI sa raison sociale, son immatriculation, ses coordonnées professionnelles, le directeur de publication et le contact RGPD. **Ne pas réutiliser automatiquement des coordonnées d'une autre entreprise.**
- Faire confirmer l'adresse e-mail du premier administrateur et le contrôle effectif de cette boîte. Ne pas auto-confirmer une adresse non vérifiée.
- Utiliser `scripts/p0-bootstrap-admin.mjs` uniquement en environnement privé avec une clé service Supabase de **ce projet** et une autorisation explicite. Le mode `--resume-user-id` sert à réparer un bootstrap partiel ; ne jamais recréer plusieurs comptes en boucle. Le script vérifie le droit DB et efface le marqueur temporaire.

## 2. Auth / SMTP

- Dans Supabase Authentication > Hooks, confirmer que **Before User Created** exécute `bpei_private.before_bpei_user_created` dans le projet `qmbsfmcotnsxsvbigynz`. La présence et les privilèges de la fonction SQL ne constituent **pas** une preuve d'activation.
- Configurer un expéditeur SMTP adapté, confirmer l'adresse et l'éventuelle configuration SPF/DKIM/DMARC ; régler Site URL et les URL de redirection de récupération / confirmation du domaine de préproduction autorisé.
- Vérifier de bout en bout un e-mail de confirmation reçu par une boîte autorisée, cliquer son lien, tester la connexion et la réinitialisation. Aucun e-mail réel ne doit être envoyé à un destinataire non autorisé.
- Vérifier qu'une inscription non autorisée est refusée alors que les portes légales et publiques sont fermées.

## 3. Documents juridiques

- Finaliser et approuver les trois textes dans `docs/legal/` avec l'identité vérifiée, le modèle contractuel, les coordonnées RGPD, les durées de conservation et les prestataires réels.
- Les publier via les contrôles administrateur ; contrôler version, immutabilité, accès public et refus des acceptations obsolètes. **Ne jamais publier les brouillons comportant [À COMPLÉTER] ou des coordonnées non prouvées.**

## 4. Recette à trois vrais comptes (manuelle, sans mutation en CI)

GitHub Actions > **BPEI P0 - vraie recette Auth et isolation (manuel)**, uniquement après création de trois comptes consentants :
- Placer les onze variables `P0_*` documentées dans `scripts/p0-live-auth-acceptance.mjs` dans les **GitHub Actions Secrets** (jamais dans le dépôt, une issue ou un message).
- Lancer manuellement le workflow. Il échoue si un secret manque, si l'e-mail d'un compte n'est pas confirmé, si les applications ne lui appartiennent pas, si les droits administrateur ne sont pas valides ou si les RLS laissent lire des données tierces.
- Ce test ne valide pas à lui seul la livraison SMTP ou le hook : conserver les preuves séparées.

## 5. Vercel, publication et homologation

- Déployer sur **Vercel Preview** la révision GitHub qui a passé la CI ; vérifier la correspondance exacte des SHA, le statut READY, la protection de Preview et les formulaires désactivés. Ne pas augmenter automatiquement l'abonnement gratuit ni toucher au domaine public.
- Vérifier parcours navigateur et appels Supabase avec de **vrais comptes autorisés** ; la réussite des navigateurs simulés ne suffit pas.
- Ne déclarer **P0 fini** qu'avec : identité et admin vérifiés ; e-mail et hook GoTrue validés ; documents juridiques publiés après approbation ; deux techniciens et un admin testés en réel ; commit Preview exact testé ; inscription publique maintenue fermée jusqu'à autorisation d'ouverture.

À la préparation de ce workflow, le projet Supabase ne disposait d'aucun compte administrateur ni document juridique publié ; l'activation du hook et le SMTP ne pouvaient pas être lus par les connecteurs disponibles. Ces prérequis doivent rester indiqués comme **non vérifiés** et non comme des tests réussis.
