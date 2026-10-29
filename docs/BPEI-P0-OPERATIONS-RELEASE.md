# BPEI — mise en route P0 : services externes et premières preuves (préproduction)

**Ne pas publier les brouillons juridiques, ouvrir bpei.fr ni activer Stripe LIVE.** La branche `feat/mvp-commercial-foundation` reste séparée de `main`. Le tableau privé `/gestion-independants` affiche les sept contrôles P0 ; il est en lecture seule pour les preuves de base, sauf les attestations demandées à l'administrateur confirmé.

## 1. Véritable administrateur

La base Supabase P0 est vide de comptes Auth. La création d'un compte sans confirmation d'email et sa promotion automatique seraient dangereuses. Après avoir configuré un SMTP authentifié, créer ou inviter le **véritable propriétaire exploitant BPEI** via Supabase Auth, lui faire confirmer personnellement son adresse, puis exécuter à privilèges élevés `scripts/p0-bootstrap-confirmed-admin.sql` avec cette adresse confirmée, ou `node scripts/p0-bootstrap-admin.mjs --execute --user-id UUID_VERIFIE` depuis un environnement de confiance muni de la clé privée et de l'adresse correspondante. Ce script CLI **ne crée plus de compte** et n'accepte plus de déclaration manuelle d'e-mail vérifié ; il lit directement `auth.users.email_confirmed_at`. Ne jamais copier la clé de service dans le navigateur, Vercel public ou GitHub. Ce script est strictement à usage unique et ne fait jamais d'auto-promotion ; sa présence dans GitHub **n'attribue aucun rôle**.

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
