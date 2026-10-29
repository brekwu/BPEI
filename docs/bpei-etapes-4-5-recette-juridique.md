# BPEI — Étapes 4 et 5 : recette et publication juridique (préproduction)

Date : 28 octobre 2026. Périmètre : **indépendants uniquement**, projet Supabase qmbsfmcotnsxsvbigynz, Vercel bpei-preview, branche feat/reseau-national-2026-10.

## Étape 4 — recette fonctionnelle et sécurité

- [x] Les tables `independent_profiles`, `independent_applications`, `independent_requests` existent ; RLS activé et audit Supabase sans alerte connue.
- [x] La préproduction Vercel a déjà produit des builds READY. Ce statut ne valide pas la disponibilité HTTP.
- [x] La première erreur SSR a été identifiée : ancienne API `createServerFn().inputValidator()` dans legal.functions.ts.
- [x] Une deuxième occurrence a été corrigée dans legal-public.functions.ts.
- [ ] Vérifier HTTP 200 sur /, /devenir-partenaire, /espace-independant, /confidentialite, /mentions-legales, /cgu.
- [ ] Vérifier les anciennes routes /boutiques, /catalogue, /professionnels : redirections attendues.
- [ ] Vérifier avec deux utilisateurs de test séparés : création de compte, confirmation d'e-mail, création de profil, dépôt d'une candidature, consultation de sa propre candidature, refus d'accès aux données d'autrui.
- [ ] Vérifier le blocage de toute auto-validation professionnelle et de l'attribution/modification non autorisée des interventions.
- [ ] Vérifier mobiles/tablettes, accessibilité, erreurs HTTP, e-mails transactionnels.
- [ ] Retirer ou désactiver les autres modules historiques liés aux boutiques ; les trois principales routes publiques redirigent mais cela ne supprime pas le code historique.
- [ ] Vérifier que les formulaires publics clients restent fermés jusqu'à conformité juridique et opérationnelle.

## Étape 5 — obligations de publication

Les pages /confidentialite, /mentions-legales et /cgu existent déjà dans le code et récupèrent des contenus publiés depuis l'ancienne architecture. Le nouveau Supabase ne contient pas encore le système complet de contenu juridique/versionné. **L'absence de document publié ne doit pas être masquée par du texte fictif.**

À rédiger/vérifier avec des informations exactes avant publication :
- Identité complète de l'éditeur BPEI, statut juridique, immatriculation, coordonnées professionnelles, directeur de publication, hébergeur.
- Politique de confidentialité : responsable(s) des traitements, finalités, bases légales, catégories de données, destinataires, conservation, sécurité, transferts, droits, contact et recours CNIL.
- Conditions d'utilisation du réseau réservé aux indépendants ; contrat de partenariat/missions, vérification SIRET et assurance, absence de salariat et de missions garanties, rémunération et responsabilité.
- Informations de premier niveau sur chaque formulaire de collecte et journal de consentement/acceptation applicable.
- Gestion des cookies, et conditions de vente/paiements si ces fonctions sont effectivement lancées.

Références officielles :
- https://entreprendre.service-public.gouv.fr/vosdroits/F37351
- https://www.cnil.fr/fr/passer-laction/rgpd-les-premieres-etapes
- https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence

**Décision de publication : NON.** Ne pas activer les formulaires grand public, ne pas promouvoir en production, ne pas modifier DNS bpei.fr sans une recette de bout en bout et documents validés.
