# BPEI — passage de la préproduction au premier client (octobre 2026)

**État de cette édition : PREPRODUCTION UNIQUEMENT.** Le domaine `bpei.fr` ne doit pas recevoir de commandes ou paiements clients tant que les contrôles ci-dessous ne sont pas authentiquement validés.

## 1. Responsable légal et documents
- [ ] Confirmer l'**identité exacte de l'exploitant de BPEI**, sa structure, son adresse professionnelle, son SIREN/SIRET, sa situation TVA, son domaine d'envoi, sa responsabilité et la qualification juridique de BPEI.
- [ ] Compléter les trois brouillons `docs/juridique/MENTIONS-LEGALES-BPEI-BROUILLON.md`, `CONFIDENTIALITE-BPEI-BROUILLON.md` et `CGU-BPEI-BROUILLON.md`, en plus de la convention et des conditions de vente des indépendants. Vérification juridique nécessaire notamment pour rétractation B2C, médiation, RGPD, assurances et part de commission.
- [ ] Faire approuver **les vrais textes** par le responsable habilité et conserver des preuves d'approbation. L'ancien SQL `bpei_launch_controls` bloque publication sans trois documents approuvés de la même version.
- [ ] Choisir une **plateforme agréée de facturation électronique** appropriée au statut et aux factures B2B de chaque émetteur. Depuis le **1er septembre 2026**, toutes les entreprises concernées doivent pouvoir recevoir leurs e-factures ; les PME et microentreprises devront émettre à compter du **1er septembre 2027**, sous réserve des cas spécifiques. Un PDF envoyé par e-mail n'est **pas** une facture électronique structurée.
  Sources : https://www.impots.gouv.fr/professionnel/questions/partir-de-quand-suis-je-concerne-par-la-reforme-de-la-facturation
  https://www.impots.gouv.fr/professionnel/je-decouvre-la-facturation-electronique
  https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/mentions-obligatoires-dune-facture-tout-savoir

## 2. Premier compte administrateur — jamais de fausse identité
- [ ] Configurer le **SMTP transactionnel Auth** de Supabase avec un expéditeur vérifié.
- [ ] Créer/inviter **une véritable adresse e-mail professionnelle appartenant à l'administrateur**, puis confirmer effectivement le lien e-mail dans Auth.
- [ ] Après confirmation, ajouter **uniquement son identifiant Auth vérifié** à `public.independent_admins` via une opération d'administration de base contrôlée. La table est vide actuellement. Ne pas promouvoir automatiquement le premier inscrit, ni se fonder sur un simple `user_metadata` / e-mail non confirmé.
- [ ] Tester ensuite un second compte standard pour vérifier qu'il n'accède ni à l'administration, ni aux informations privées des clients.

## 3. Stripe Connect du prestataire indépendant
- [ ] Vérifier auprès du propriétaire du compte **quelle organisation Stripe appartient à BPEI**. Le compte de test « New business » n'est pas une preuve d'appartenance.
- [ ] Activer Connect pour la plateforme appropriée et vérifier sa capacité à faciliter des **direct charges** de vendeurs français. Mettre une clé `sk_test_...` dans Supabase Edge Functions ; ne jamais placer une clé secrète dans Vercel `VITE_*`, les captures ou GitHub.
- [ ] Configurer les secrets serveur `BPEI_TEST_CONNECT_ENABLED=true`, `BPEI_TEST_CONNECT_ORIGIN=https://[vraie-préversion]` et `STRIPE_SECRET_KEY` en mode test. L'interface exige `VITE_BPEI_TEST_CONNECT_ENABLED=true` pour exposer le parcours. Les secrets ne sont **pas** configurés par ce dépôt.
- [ ] L'indépendant ayant un compte Auth réel confirmé, un SIRET, une vérification professionnelle et une assurance active et ayant accepté les CGU publiées peut **démarrer Stripe Accounts v2** depuis son espace. Il remplit ses données réelles directement chez Stripe.
- [ ] Vérifier côté serveur `charges_enabled`, `payouts_enabled` et `details_submitted`. L'administrateur approuve séparément le **TEST** depuis `/gestion-commerciale`. Ne pas confondre le retour navigateur et la validation.
- [ ] Si BPEI retient une commission : faire signer la convention, consigner son taux et sa référence après validation. Le taux technique vaut **0 % par défaut**.
- [ ] Configurer l'endpoint webhook **Connect** Stripe test, son secret `whsec_...`, le serveur Checkout `BPEI_TEST_CHECKOUT_ENABLED` et le contrôle SQL `test_checkout_enabled` **uniquement en préproduction, après tests**. Le frontend n'affiche les actions test que si `VITE_BPEI_TEST_CHECKOUT_ENABLED=true`. Ne jamais supposer qu'un moyen de paiement Apple Pay/Google Pay est disponible sans vérification du terminal et du compte.

## 4. E-mail et factures
- [ ] Vérifier l'identité du domaine expéditeur et configurer une clé fournisseur Resend de la bonne organisation, ainsi que `BPEI_COMMERCIAL_MAIL_FROM`, `BPEI_COMMERCIAL_MAIL_ORIGIN`, `BPEI_COMMERCIAL_MAIL_LEGAL_FOOTER`.
- [ ] Valider le modèle de facture de chaque prestataire : nom légal, SIRET, TVA éventuelle, numéro chronologique, dates de prestation/émission/échéance, client, désignation, taxes, escompte, pénalités B2B, éventuel bon de commande, indemnité légale de recouvrement B2B de 40 EUR. Le nouveau RPC `mvp_issue_invoice_compliant` **bloque les champs manquants** ; l'ancien RPC refuse toute émission.
- [ ] Configurer l'envoi seulement après validation via `BPEI_COMMERCIAL_MAIL_ENABLED=true`, validation de `bpei_commercial_mail_controls` et `VITE_BPEI_COMMERCIAL_MAIL_ENABLED=true`. La file impose **un seul envoi automatique par document** ; les échecs nécessitent un contrôle humain avant un renvoi.
- [ ] Tester la réception dans une boîte réelle, le PDF, le classement indésirable, la réconciliation avec la facture et le traitement des avoirs et paiements partiels. Le système ne délivre pas encore de **facture électronique française structurée** via plateforme agréée.

## 5. Trois scénarios pilotes préproduction
- [ ] **Client particulier** : demande, fiche et numéro, attribution au technicien vérifié, devis, preuve d'acceptation, intervention terminée, facture n°, lien Checkout test, webhook payé, e-mail client.
- [ ] **Client professionnel** : identité et SIRET si communiqué, TVA et mentions, pénalités, 40 EUR de recouvrement, audit du calendrier de facture électronique.
- [ ] **Incident** : carte refusée, page de retour simulée, doublon webhook, montant erroné, remboursement total/partiel, litige et déconnexion multi-onglets ; vérifier qu'aucun de ces scénarios ne falsifie un statut acquitté.

## 6. Conditions du vrai lancement
- [ ] Confirmer les contrats de Stripe, les obligations de l'émetteur de facture, l'identité des vendeurs, les fonds et les règles fiscales. Construire/tester **le flux Stripe live distinct du flux test** avant tout règlement réel. Le dépôt actuel n'autorise **que le TEST**.
- [ ] Vérifier que l'abonnement Vercel et les contrats d'hébergement autorisent l'usage commercial envisagé.
- [ ] Lancer les audits de sécurité, d'accès et sauvegarde/restauration. Valider la capacité opérationnelle du service client, les délais de réponse, la procédure d'incident, le médiateur et le service de remboursement.
- [ ] Fusionner la PR après revue, déployer la production, puis seulement ouvrir les formulaires publics et la publicité.

**Aucune case n'est cochée arbitrairement.** Tout ce qui nécessite un document signé, une identité, un compte d'entreprise, une vraie carte/test client ou un service de paiement externe doit être attesté par sa preuve avant validation.
