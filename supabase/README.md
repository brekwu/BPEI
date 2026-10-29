# BPEI — Schéma Supabase versionné

Le projet de préproduction Supabase BPEI (`qmbsfmcotnsxsvbigynz`) comporte **70 migrations appliquées** au 29 octobre 2026, et la branche contient **70 fichiers SQL versionnés**. Les migrations `20261028175736_p1_admin_roster_secure_cross_admin_visibility` et `20261028233020_p1_cover_mission_foreign_keys` sont synchronisées. L'égalité des décomptes ne remplace pas un essai de restauration sur une base vierge.

- Ne pas réappliquer sans préparation ces migrations à la base existante : elles y sont déjà enregistrées.
- Sur une nouvelle base, suivre l'ordre numérique avec les outils officiels de migration Supabase après sauvegarde et contrôle de l'environnement.
- Les migrations ne configurent pas les secrets SMTP, le domaine, le compte administrateur, ni l'activation des Auth Hooks dans le dashboard.
- Les validations juridiques et inscriptions restent fermées jusqu'aux contrôles opérationnels.
- Toujours tester les politiques RLS, les fonctions privilégiées et le parcours client avant l'ouverture publique.

- P1 : une migration ajoute le suivi des incidents de mission et les notifications internes. Les formulaires publics restent fermés tant que les critères d'ouverture P0 ne sont pas vérifiés.

- Un test automatisé vérifie désormais que chaque migration appliquée est représentée une seule fois dans le dépôt, avec son numéro attendu ; vérifier une restauration intégrale reste nécessaire avant publication.

- Performance P1 : six index B-tree simples couvrent les clés étrangères des événements, incidents et notifications. Le contrôle Supabase `unindexed_foreign_keys` ne remonte plus de résultat ; les alertes `unused_index` sont attendues tant que la base est sans trafic réel et ne justifient pas leur suppression.

## MVP commercial (29 octobre 2026)

70 migrations versionnées et appliquées. Les deux dernières ajoutent les coordonnées client, des devis privés et leur validation documentée, puis des factures numérotées séparément pour chaque indépendant par transaction atomique. Les accès sont contrôlés par RLS et des RPC administratifs. L'encaissement Stripe, les factures électroniques structurées et la recette réelle restent à faire ; aucune ouverture publique.

## Stripe Connect — pré-intégration contrôlée

La migration 42 ajoute un registre interne des tentatives de paiement, un rattachement sécurisé à un compte Stripe Connect vérifié, et un journal d'événements webhook unique. **test_checkout_enabled=false** est imposé en base et **test_enabled=false** pour chaque compte marchand. Aucun compte n'est inscrit et aucune clé n'est configurée automatiquement. Les fonctions Edge sont codées sous `supabase/functions` mais il faut vérifier leur déploiement et leurs secrets séparément. Seul un événement Stripe Connect authentifié peut confirmer un paiement de TEST ; aucun versement ni paiement réel n'est possible dans cette version. Le statut interne `payment_status=unpaid` de la facture originale demeure inchangé, conformément à la règle d'immuabilité ; l'affichage de l'éventuelle confirmation test provient séparément du registre.

## Saisie client par téléphone — administration seulement

La migration 44 ajoute une saisie administrateur sécurisée des interventions reçues par téléphone, e-mail ou en personne, avec référence de la preuve d'information et acceptation du client. La route d'administration la propose, mais son RPC **refuse toute collecte tant que les documents de confidentialité ne sont pas réellement publiés**. La migration n'ouvre pas les formulaires publics, ne crée aucun utilisateur ni aucun faux consentement.

## Sécurité du point d'entrée de saisie manuelle

La migration 45 place la fonction privilégiée de saisie manuelle dans `bpei_private`. L'API publique conserve uniquement un wrapper `SECURITY INVOKER` et le contrôle du rôle administrateur est effectué dans la fonction privée. Aucun utilisateur n'a été créé, aucune validation juridique n'a été publiée et les formulaires restent fermés.

## Remboursements et contestations bancaires (préproduction)

La migration 46 ajoute la réconciliation des événements signés de remboursement et de contestation Stripe TEST au moyen de registres privés, de contrôles d'identité du paiement et du montant, et d'un journal d'événements idempotent. Les écrans internes peuvent afficher « remboursement partiel/total » et « contestation » sur la base de ces registres. Cela ne lance **aucun remboursement bancaire**, ne génère pas d'avoir comptable et ne prouve pas que des transactions réelles ont été testées. Les frais, les litiges et les avoirs restent à homologuer avant la production.

## Sécurité supplémentaire des transactions Stripe TEST

La migration 47 impose l'unicité du couple compte Stripe connecté / intention de paiement, et fige l'identité de chaque remboursement ou litige afin de prévenir un rattachement de l'événement à une facture différente.

## Commission BPEI (Stripe Connect TEST)

La migration 48 permet une **commission optionnelle uniquement si un accord explicite du prestataire et un taux vérifié sont enregistrés**. Valeur par défaut : **0 %** ; taux maximal technique 25 % sans présumer du tarif commercial. Calcul exclusivement en centimes entiers dans la fonction privée de préparation Checkout, figé par tentative, transmis à Stripe sur la charge directe via `payment_intent_data[application_fee_amount]`. L'application n'autorise aucune commission non consentie ; l'identité juridique de BPEI et le traitement des frais/avoirs restent à valider avant activation. Aucun compte marchand ni contrat n'a été créé.

## Envoi de devis/facture PDF (préproduction)

La migration 49 introduit une file de livraison d'e-mails privée, à usage unique par document, avec deux verrous `enabled=false` et `validated_legal_sender=false`. Une fonction Edge `bpei-commercial-mail` prépare le PDF côté serveur et le transmet via l'API Resend avec une clé d'idempotence. Elle impose une session d'administrateur, une adresse d'envoi du domaine professionnel, la publication juridique et l'approbation du modèle. **Aucun fournisseur, expéditeur ou secret n'est configuré, et aucun e-mail n'a été envoyé.** L'interface d'administration permet l'envoi uniquement lorsque la variable de préversion `VITE_BPEI_COMMERCIAL_MAIL_ENABLED=true` est explicitement activée, en plus des verrous serveur.

## Factures françaises : champs obligatoires variables

La migration 50 désactive l'ancien RPC d'émission incomplet et crée `mvp_issue_invoice_compliant`. Chaque émission exige les conditions réelles de règlement, les escomptes, les pénalités de retard B2B, le forfait légal 40 EUR de recouvrement pour le B2B, ainsi que l'identification TVA française quand elle est applicable. Le responsable de facturation doit vérifier ces valeurs ; BPEI ne les préremplit pas artificiellement. Ces informations sont figées dans la facture et intégrées au PDF et à l'affichage. La transmission de factures électroniques structurées par plateforme agréée reste distincte, avec ses échéances réglementaires.

## Onboarding Stripe Connect Accounts v2 (2026-10-29)

Une fonction Edge `bpei-test-connect`, **désactivée par défaut**, peut créer à la demande du technicien préalablement validé un compte marchand **Stripe Accounts v2** en mode test. Stripe lui-même collecte l'identité et les informations de règlement, puis le serveur BPEI vérifie `charges_enabled`, `payouts_enabled` et `details_submitted`. L'activation par l'administrateur est distincte et le verrou de paiement général reste fermé sans validation du compte plateforme. Les écrans technicien et administrateur comprennent les actions, sans approbation automatique ni saisie de faux identifiants. Le projet juridique complet est disponible dans `docs/juridique` ; il n'est PAS publié et ne remplace aucune validation réglementaire.

## Bureau des Partenaires et Entrepreneurs de l'Informatique — réseau national

La nouvelle orientation de BPEI est celle d'une **enseigne nationale de techniciens indépendants**, sans boutiques obligatoires. Migrations 51–56 : profil étendu pour débutants sans SIRET, formations/expérience, téléassistance et préférences, **100 questions techniques (25 par niveau)**, corrigés disponibles uniquement aux administrateurs, évaluations motivées (écrit/cas pratique/visio), niveaux Junior/Confirmé/Expert/Master et **activation manuelle distincte de l'évaluation**. Les nouveaux accès à des missions nécessitent désormais un niveau actif, un dossier professionnel validé et les protections préexistantes. Le palier de 50/150/300 interventions est une information indicative, jamais une promotion automatique. Un CRM de prospects documente la base légale et protège contre les doublons ; chaque mission exige une rémunération HT présentée et acceptée par l'indépendant avant qu'il accepte la prestation. **Ces montants ne créent ni encaissement ni virement Stripe**, et les barèmes d'exemple doivent être confirmés contractuellement. Aucune prospection automatisée ni liste de clients fictifs n'a été ajoutée.

## Recherche publique de partenaires actifs (migrations 57–60)

Un intervenant choisit explicitement l'affichage public. Seuls les profils **activés, assurés, immatriculés, ayant accepté les textes juridiques en vigueur**, dont les compétences ont été documentées et validées par l'administration, peuvent être retournés par `search_active_partners`. La recherche couvre la **ville exacte**, le **code postal exact** ou les intervenants acceptant le **travail à distance**. Le rayon géographique en kilomètres n'est pas encore calculé et aucune disponibilité horaire n'est certifiée. Le filtre limite les résultats à 20 et ne renvoie ni adresse privée, ni téléphone, ni coordonnées bancaires. Un contrôle SQL avec rôle `anon` a renvoyé 0 résultat alors que le réseau n'a aucun membre opérationnel. L'entrée publique est en `SECURITY INVOKER` ; un droit limité sur une fonction privée auditée permet une recherche anonyme, sans ouvrir les autres fonctions privilégiées. L'audit sécurité Supabase ne présente plus d'alerte. L'attribution d'un prospect au canal BPEI ou à un apporteur est réservée aux administrateurs ; les indépendants enregistrent leurs propres prospects avec leur base légale et leur référence.

## Finances personnelles de l'indépendant (migration 61)

La saisie d'un registre privé de **recettes réellement encaissées et dépenses payées** est disponible depuis l'espace indépendant. La base n'autorise la lecture qu'au propriétaire ; les montants et justificatifs restent immuables, sauf annulation motivée et tracée. Export CSV sur demande, total indicatif recettes/dépenses HT et simulation de charges sociales sur le taux **saisi par le technicien**, sans taux inventé, sans déduction automatique des frais ni déclaration officielle Urssaf. Les données sont entrées manuellement, indépendamment de Stripe. Un guide pratique de prospection 2026 existe désormais dans `/ressources-prospection`, relié à l'espace. Aucun e-mail de prospection n'est envoyé automatiquement.

## Agenda de rendez-vous et évaluations clients (migrations 62 à 64)

Les indépendants peuvent déclarer librement leurs créneaux jusqu'à 180 jours à l'avance, sans chevauchements. Un administrateur confirme la date d'une **mission déjà acceptée** sur un créneau du bon prestataire ; la confirmation est atomique, évite les doubles réservations et journalise les annulations. Aucun créneau n'est annoncé comme réservé en temps réel sans confirmation, et le consentement du client au rendez-vous reste à vérifier par l'opérateur. Les avis clients exigent une mission terminée et facturée, une invitation à usage unique de 21 jours à token aléatoire stocké seulement sous empreinte SHA-256, une note et un commentaire client, un choix séparé de publication et une modération administrative. Seules les notes autorisées et publiées contribuent aux agrégats publics, et les identités professionnelles homonymes sans attribution unique sont exclues des moyennes. La fonction `bpei-customer-review` est déployée mais **fermée par défaut** : il manque `BPEI_REVIEWS_ENABLED=true` et un domaine d'origine validé. Le lien est à remettre au client sur un canal vérifié, non envoyé automatiquement. Aucune invitation ni aucun avis n'a été fabriqué.

## Apporteur d'affaires interrégional (migration 65)

Une mission réellement attribuée à un prestataire distinct peut bénéficier d'un **apporteur professionnel** vérifié. L'administration documente le contrat, le montant HT et l'origine d'apport, et la somme est obligatoirement couverte par la part BPEI **d'une proposition de rémunération de mission déjà acceptée** et identifiée comme `source=referral`. Le technicien apporteur peut accepter ou refuser librement sa propre proposition. L'accès aux données est limité à l'administration, à l'apporteur et à l'intervenant ; aucune information privée de client ni aucun virement Stripe n'est créé par cette fonction. La commission d'apport, sa TVA, sa facture et ses modalités de paiement restent à faire vérifier juridiquement avant usage réel.

## Rapprochement financier Stripe TEST (migrations 66 à 68)

Le serveur refuse maintenant une création de lien Stripe TEST si la facture n'appartient pas au bon technicien, si la mission n'est pas effectivement terminée, si la rémunération de mission n'est pas acceptée, si le **prix HT du devis et le partage indépendant/BPEI ne correspondent pas exactement**, ou si la commission Stripe est différente de la part BPEI dûment convenue. Un apporteur interrégional doit avoir accepté sa convention. Pour éviter de présumer le traitement fiscal de la commission BPEI, ce parcours de test refuse actuellement les devis comportant de la TVA et garde le plafond de sécurité interne **25 %**. Le barème indicatif 50/40 sur 90 € HT **ne passe donc pas** tant que le modèle de paiement, les frais et la TVA n'ont pas été contractualisés et adaptés ; aucun partage trompeur n'est présenté comme réellement versé. L'administration peut consulter sur chaque facture le diagnostic `mvp_test_checkout_readiness` : prérequis manquants et éventuelles incohérences, **sans créer de paiement**. Les contrôles de clés `sk_test_`, du vendeur marchand, de Checkout et des webhooks restent indépendants de ce diagnostic.

## Factures définitives cohérentes (migration 69)

La création de facture définitive (numéro chronologique immuable) exige désormais que le devis accepté corresponde exactement au prix HT **et** au partage accepté par le technicien dans la mission terminée. Le contrôle se fait avant la réservation d'un numéro définitif. Toute incohérence est refusée, sans falsifier le contenu de la facture ni modifier les événements de paiement. Les factures préexistantes restent immuables et ne sont pas requalifiées. Le circuit de paiement Stripe demeure exclusivement de TEST, verrouillé globalement et conditionné à une validation contractuelle du vrai vendeur et du régime fiscal de la plateforme.

## P0 — preuves et état de lancement (migration 70)

La migration 70 crée un registre privé de **sept attestations documentées**, toutes liées à un administrateur possédant une adresse Auth réellement confirmée, et un RPC `p0_readiness` en lecture seule. Les **six grandes catégories P0** (administrateur, SMTP/notifications, juridique, facturation/commission, Stripe TEST et recette complète) sont contrôlées avec une granularité distincte pour les envois de devis/factures. Le tableau dans `/gestion-independants` montre le statut réel et les preuves manuelles qu'il reste à obtenir, sans inventer d'utilisateurs, de clients ou de paiements. L'authentification Auth SMTP reste un paramètre externe inaccessible à la base : une attestation manuelle **ne vérifie pas automatiquement le fournisseur**. Les preuves peuvent être révoquées ; **aucun RPC de diagnostic ou d'attestation n'active la publication, les encaissements ou le recrutement public**. Un script d'amorçage vérifie explicitement l'existence d'un compte Auth confirmé puis attribue le rôle administrateur une seule fois, uniquement sur décision humaine : `scripts/p0-bootstrap-confirmed-admin.sql`. Des trames non signées CGV et convention de partenariat sont dans `docs/juridique/`. Procédure détaillée : `docs/BPEI-P0-OPERATIONS-RELEASE.md`. Test non destructif sur deux vrais comptes : `node scripts/p0-verify-existing-accounts.mjs` avec variables `BPEI_P0_URL`, `BPEI_P0_PUBLISHABLE_KEY`, `BPEI_P0_ADMIN_EMAIL/PASSWORD` et `BPEI_P0_PARTNER_EMAIL/PASSWORD` ; aucun secret n'est conservé dans GitHub.
