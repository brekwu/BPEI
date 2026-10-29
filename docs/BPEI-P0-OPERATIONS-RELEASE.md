# BPEI — mise en route P0 : services externes et premières preuves (préproduction)

**Ne pas publier les brouillons juridiques, ouvrir bpei.fr ni activer Stripe LIVE.** La branche `feat/mvp-commercial-foundation` reste séparée de `main`. Le tableau privé `/gestion-independants` affiche les sept contrôles P0 ; il est en lecture seule pour les preuves de base, sauf les attestations demandées à l'administrateur confirmé.

## 1. Véritable administrateur

La base Supabase P0 est vide de comptes Auth. La création d'un compte sans confirmation d'email et sa promotion automatique seraient dangereuses. Après avoir configuré un SMTP authentifié, créer ou inviter le **véritable propriétaire exploitant BPEI** via Supabase Auth, lui faire confirmer personnellement son adresse, puis exécuter à privilèges élevés `scripts/p0-bootstrap-confirmed-admin.sql` avec cette adresse confirmée, ou `node scripts/p0-bootstrap-admin.mjs --execute --user-id UUID_VERIFIE` depuis un environnement de confiance muni de la clé privée et de l'adresse correspondante. Ce script CLI **ne crée plus de compte** et n'accepte plus de déclaration manuelle d'e-mail vérifié ; il lit directement `auth.users.email_confirmed_at`. Ne jamais copier la clé de service dans le navigateur, Vercel public ou GitHub. Ce script est strictement à usage unique et ne fait jamais d'auto-promotion ; sa présence dans GitHub **n'attribue aucun rôle**.

**Première identité Auth avec recrutements encore fermés :** le script privé `scripts/p0-provision-unconfirmed-admin.mjs` fournit une étape préliminaire contrôlée. Exécuté avec `--execute` et les variables privées du projet, il crée UNIQUEMENT le compte prévu avec `email_confirm:false` et le marqueur de bootstrap interne. Il **n'attribue aucun rôle** et **n'envoie pas automatiquement un courriel**. Lorsque l'opérateur a vraiment confirmé son adresse dans un flux Auth autorisé et que `email_confirmed_at` est renseigné, récupérer son UUID Auth et exécuter `scripts/p0-bootstrap-admin.mjs --execute --user-id UUID`. La seconde commande supprime le marqueur de bootstrap après l'attribution vérifiée. Si le SMTP n'est pas configuré, **stopper avant promotion**, ne jamais forcer `email_confirm=true`.

Après la préparation du compte, l'espace `/espace-independant` propose désormais **Renvoyer l'e-mail de confirmation** lorsqu'une inscription est en attente ou que Supabase renvoie `email_not_confirmed`. Cette action appelle exclusivement `supabase.auth.resend({ type: "signup" })` et **n'attribue jamais le rôle administrateur**. Le message « renvoi demandé » ne prouve pas la réception ni la confirmation. Avec un compte créé administrativement, l'opérateur doit contrôler que son vrai prestataire Auth autorise ce renvoi et que le lien est effectivement reçu puis consommé ; sinon utiliser le flux d'invitation approuvé via le tableau Supabase. Référence API : https://supabase.com/docs/reference/javascript/auth-resend. Ne jamais désactiver « Confirm email » pour contourner cette étape.

Ne pas utiliser `raw_user_meta_data` ni une adresse e-mail seule comme autorisation d'accès. Les opérations de l'administration continuent de vérifier `independent_admins`, avec RLS et droits serveur.

## 2. SMTP Auth et confirmations

- Choisir et vérifier un domaine expéditeur professionnel et les DNS SPF/DKIM/DMARC. Obtenir un vrai accès SMTP (hôte, port, utilisateur, mot de passe) auprès d'un prestataire autorisé.
- Configurer **Authentication → SMTP Settings** dans le tableau de bord Supabase avec l'adresse professionnelle vérifiée, sans jamais placer de secret dans les variables `VITE_*` ou GitHub.
- Garder l'option « confirmer l'adresse e-mail » activée ; ne pas la désactiver pour supprimer artificiellement le blocage.
- Envoyer une invitation à une adresse réelle autorisée, vérifier réception (y compris spam), ouvrir et confirmer le lien, puis vérifier l'authentification. Archiver seulement l'identifiant de preuve sans mot de passe ni contenu de boîte privée.
- Enregistrer la preuve dans le tableau P0 sous `smtp_auth_delivery`.

**Référence officielle :** https://supabase.com/docs/guides/auth/auth-smtp

## 3. Envoi des devis et factures PDF

La fonction Edge `bpei-commercial-mail` utilise un fournisseur Resend, déjà codé mais **fermé par défaut**. Après création du domaine et des clés de la bonne société : secrets Supabase `RESEND_API_KEY`, `BPEI_COMMERCIAL_MAIL_FROM`, `BPEI_COMMERCIAL_MAIL_ORIGIN`, `BPEI_COMMERCIAL_MAIL_LEGAL_FOOTER`, `BPEI_COMMERCIAL_MAIL_ENABLED=true`. Les deux colonnes privées `enabled` et `validated_legal_sender` du registre de contrôle doivent être activées uniquement **après** les tests et décisions juridiques. La préversion n'affiche les actions d'envoi que si `VITE_BPEI_COMMERCIAL_MAIL_ENABLED=true` au moment de sa compilation.

Tester une **vraie boîte destinataire autorisée**, vérifier le PDF joint, les champs de facturation et la réception effective. L'ID du fournisseur **ne prouve pas** à lui seul que le client a reçu le document ; archiver la preuve d'une réception et noter les échecs sans envoyer de doublons.

## 4. Cadre juridique du réseau et e-facturation

- Renseigner l'identité juridique réelle de l'exploitant, son immatriculation, son adresse et ses moyens de contact ; vérifier les textes CGU, CGV, rétractation, RGPD, médiation et convention entre indépendants.
- Identifier le **vendeur et émetteur de chaque facture** et qui est autorisé à prélever la commission BPEI. Les taux actuellement montrés dans l'interface sont indicatifs ; ils ne sont pas un accord signé.
- Vérifier TVA de la commission du réseau, indemnités, avoirs, pénalités, et plateforme agréée pour les factures électroniques. Le PDF BPEI actuel **n'est pas** un document e-invoicing structuré.
- Depuis le 1er septembre 2026, les entreprises françaises concernées doivent être capables de **recevoir** des factures électroniques ; l'émission pour les PME et microentreprises intervient à compter du 1er septembre 2027 selon leurs situations. Source : https://www.impots.gouv.fr/professionnel/je-decouvre-la-facturation-electronique
- Faire vérifier et signer les documents par l'exploitant et les prestataires ; archiver la preuve de consentement et de version. Publier via l'écran juridique uniquement après vérification.

## 5. Paiements Stripe TEST et rapprochement

- Utiliser uniquement une **organisation Stripe appartenant effectivement au responsable de BPEI** ; ne rattacher aucun identifiant de marchand découvert sans contrôle de propriété.
- Configurer la clé Stripe TEST, le webhook et les secrets du bon compte dans Supabase Edge Functions. Les fonctions existantes `bpei-test-connect`, `bpei-test-checkout`, `bpei-test-webhook` doivent rester en mode test.
- Créer le compte d'un indépendant réellement identifié et approuvé, lui faire terminer l'onboarding Stripe Accounts v2 ; un administrateur contrôle ses capacités et l'active en mode TEST.
- Vérifier le devis, sa TVA, les commissions réellement acceptées, l'accord de l'apporteur le cas échéant, la facture et le diagnostic `mvp_test_checkout_readiness`. Le Checkout actuel refuse volontairement les montants et cas fiscaux non alignés avec le contrat.
- Payer au moyen des **cartes de test Stripe**, vérifier le webhook signé, l'état de paiement, les doublons, un refus et le chemin remboursement/litige. Ne pas traiter un retour navigateur comme preuve de paiement.
- Ne pas passer en LIVE ou rediriger des fonds bancaires avant choix/validation du modèle de vente/commission, contrat de paiement et conformité.

## 6. Recette réelle sur deux comptes et une mission pilote

Les scripts CI actuels simulent certaines réponses réseau ; leur réussite ne remplace pas une vraie transaction sur comptes Auth contrôlés.

1. Créer un administrateur et un partenaire dont les e-mails sont **réellement confirmés** (l'administrateur ne peut pas s'auto-inscrire en utilisant des données arbitraires).
2. Contrôler la protection du rôle non-admin. Puis faire passer 25 questions, entretien, vérification SIRET/RC Pro, CGU et autorisation.
3. Enregistrer une demande client ayant donné une information RGPD réellement documentée ; vérifier la lecture réservée au technicien affecté.
4. Proposer une mission, afficher prix client, rémunération du technicien, part BPEI et frais ; recueillir son accord, puis accepter la mission.
5. Créer un devis correct et faire constater l'acceptation du client ; terminer la mission avec preuve.
6. Créer une facture numérotée avec les mentions réelles, contrôler son PDF et sa réception, payer en TEST et contrôler l'événement Stripe signé, pas seulement la page de retour.
7. Tester les erreurs : email refusé, doublon d'envoi, autre utilisateur, deux sessions, paiement refusé, webhook rejoué, remboursement partiel/total, signalement et restauration du stockage.
8. Faire un rapport factuel avec preuves, **sans comptes fictifs qui seraient confondus avec de vrais utilisateurs commerciaux**.

## 7. Conditions finales de publication

Revoir le forfait commercial Vercel, les sauvegardes et procédures de restauration, les RLS et le rapport de test. Fusionner le code après revue et **seulement ensuite** activer les inscriptions publiques et les moyens de paiement réellement homologués. Un tableau P0 entièrement vert n'active aucune option automatiquement : il ne remplace pas la validation finale de l'exploitant.

## Diagnostic opérateur consultable sans premier administrateur

La fonction applicative `p0_readiness()` exige déjà une session Auth confirmée avec le rôle BPEI. Tant que la base ne contient aucun administrateur, **ne pas élargir les privilèges de cette fonction** pour consulter le lancement. À la place, exécuter `scripts/p0-owner-readiness.sql` **uniquement dans le SQL Editor Supabase du projet BPEI** avec les droits du titulaire. Ce fichier est en lecture seule, affiche sept rubriques et les observations issues de la vraie base, sans inventer de compte ni d'attestation. Chaque statut positif est une **condition SQL présente**, pas une preuve de réception de mail, d'accord juridique ou de paiement certifié. La sortie SQL peut être conservée comme compte-rendu sans exporter d'identifiants ou de données personnelles.

Le script `tests/bpei-p0-owner-readiness.test.ts` vérifie notamment que ce diagnostic reste non mutateur et couvre les sept dépendances. Les tests de code et les préversions Vercel ne remplacent jamais la recette E2E avec des utilisateurs consentants ni les autorisations réelles de l'exploitant.
