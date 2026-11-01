# BPEI — Dossier de mise en service P0
État contrôlé le 1er novembre 2026. **Ceci n'est pas une attestation de lancement.**

## Déjà réalisé
- Code de l'application : branche `feat/mvp-commercial-foundation`, tests unitaires, build TypeScript, tests navigateur Chromium/WebKit GitHub réussis au commit `164d2f6988a7e8597ae1878dab7d81ac13197589` (avant le présent dossier).
- Vercel : préversion du commit `164d2f6` READY, mais **protégée par Vercel Authentication pour toutes les cibles**. Un déploiement READY n'est pas un site public accessible.
- Supabase : projet `qmbsfmcotnsxsvbigynz` sain, 5 Edge Functions actives ; aucune alerte de sécurité dans l'advisor consulté.
- Base au contrôle : 0 utilisateur Auth, 0 admin, 0 document juridique, 0 version publiée, 0 marchand Stripe, 0 devis, 0 facture.
- Indicateurs d'ouverture `independent_registration_enabled=false`, `legal_documents_published=false`, `test_checkout_enabled=false`.

## Actions réelles à exécuter par l'exploitant habilité (dans cet ordre)

### 1. Identité de l'exploitant / textes contractuels
Préciser si BPEI est exploité juridiquement par l'entreprise individuelle existante ou par une autre structure ; fournir identité, adresse publique légalement utilisable, SIREN/SIRET, TVA, e-mail de contact réel, directeur de publication, hébergeur et médiateur de la consommation conventionné.
Trois brouillons modifiables, **non publiables**, sont disponibles dans `docs/p0/legal-drafts/`. Les compléter et faire vérifier les rôles contractuels (BPEI intermédiaire, prestataire qui facture, CGV clients, convention partenaires, rétractation, assurance).
Ne jamais approuver un document contenant `[À COMPLÉTER]`, `[À VALIDER]` ou une promesse non vérifiée. Le vrai administrateur utilisera ensuite `/gestion-independants` → Documents juridiques pour valider les trois textes puis les publier. Publier les textes ne doit pas ouvrir automatiquement les inscriptions.

### 2. SMTP Supabase Auth et URLs de retour
Dans le Dashboard Supabase du projet BPEI, configurer un fournisseur SMTP réellement autorisé à envoyer depuis le domaine BPEI, avec DNS SPF/DKIM/DMARC contrôlés selon les exigences du prestataire. Tester une réception authentique dans la boîte réelle du futur administrateur ; ne pas marquer le résultat comme validé sur un succès HTTP seulement.
Contrôler les **URL de redirection Auth**. La variable optionnelle `VITE_BPEI_AUTH_ORIGIN` reste volontairement vide sur Vercel : le domaine fixe doit être accessible par un utilisateur non connecté à Vercel et exactement autorisé dans Supabase avant de la renseigner.
Ne jamais déposer un identifiant SMTP ni une clé service-role dans GitHub, dans une variable `VITE_*` ou dans le chat.

### 3. Créer et vérifier le PREMIER administrateur réel
La base ne contient aucun utilisateur. Le script `scripts/p0-provision-unconfirmed-admin.mjs` nécessite, sur un environnement de confiance, les variables privées `BPEI_SUPABASE_URL`, `BPEI_SUPABASE_SERVICE_KEY`, `BPEI_ADMIN_EMAIL`, `BPEI_ADMIN_PASSWORD` (mot de passe fort, secret).
Après `node scripts/p0-provision-unconfirmed-admin.mjs --execute`, le compte reste **non confirmé** et n'a aucun droit admin.
Le titulaire ouvre `/espace-independant`, tente de se connecter puis demande un lien de vérification pour compte existant. L'e-mail doit être reçu et cliqué par son vrai titulaire. Vérifier dans Supabase Auth l'attribut `email_confirmed_at` réellement attribué par le fournisseur.
Seulement ensuite, depuis un environnement privé : `node scripts/p0-bootstrap-admin.mjs --execute --user-id <UUID_CONFIRME>` avec le même e-mail et la clé de service gardée secrète. Vérifier la ligne admin et l'accès à `/gestion-independants`.
Ne jamais : mettre `email_confirm=true` artificiellement, modifier `email_confirmed_at` en SQL, créer une identité avec une adresse fictive, élever le premier inscrit automatiquement.

### 4. S'assurer que le domaine est réellement public et contrôlé
Le dépôt GitHub `brekwu/BPEI` était **public** au contrôle, et `main` ne contient pas le site déployable. Confirmer la visibilité désirée dans GitHub → Settings → General → Danger Zone, puis la stratégie de branche et de déploiement. La branche déployable est `feat/mvp-commercial-foundation`.
Le domaine `bpei.fr` est géré hors du projet Vercel actuel, auprès de l'hébergeur DNS du propriétaire. Ne pas rediriger DNS sans déploiement de production correct, certificat HTTPS, pages légales vérifiées et contrôle de l'hôte. La protection SSO de la préversion Vercel ne doit pas être désactivée simplement pour faire passer un test automatisé.
Valider publiquement `/`, `/health`, `/mentions-legales`, `/confidentialite`, `/cgu`, `/espace-independant`, y compris sur un navigateur sans session Vercel. Vérifier que les formulaires ne collectent rien si les verrous restent fermés.

### 5. Stripe TEST et parcours commercial authentique
Configurer les secrets nécessaires directement dans Supabase Edge Functions, **jamais** avec une clé Stripe LIVE pendant la recette TEST. Les Edge Functions `bpei-test-connect`, `bpei-test-checkout`, `bpei-test-webhook`, `bpei-commercial-mail` et `bpei-customer-review` sont déjà déployées, mais le statut ACTIVE ne prouve pas leur configuration opérationnelle.
Créer un vrai compte professionnel partenaire autorisé et confirmé, vérifier le SIRET/RC Pro, approuver sa candidature, configurer Stripe Connect en TEST selon la politique et la convention signée, vérifier son statut de compte marchand, puis activer explicitement le verrou TEST **après** avoir contrôlé clés, URL retour, webhook signé, source des frais et paiements uniquement en environnement TEST.
Réaliser : demande réelle d'un client test autorisé → attribution → devis → acceptation documentée → mission terminée → facture → Checkout TEST → webhook signé → montant TTC et commission rapprochés → remboursement/contestation TEST si prévu → vérification des accès non autorisés.
Ne jamais fabriquer des tentatives `paid` dans la base. La facture numérotée d'origine est immuable ; le statut Stripe TEST vient d'un registre serveur séparé.

### 6. Autorisation finale de lancement
Compléter les pièces de preuve du tableau `AdminP0Readiness` avec les références de tests réellement réalisés. Vérifier juridiquement le modèle de commission, le responsable de facturation électronique et les droits des consommateurs.
Conserver les inscriptions publiques, le formulaire client et le paiement TEST fermés jusqu'aux contrôles précédents. Ne pas utiliser une simulation CI ou un déploiement READY comme preuve de conformité.

## Documents officiels utiles
- CNIL — premières étapes RGPD : https://www.cnil.fr/fr/passer-laction/rgpd-les-premieres-etapes
- DGCCRF — obligations de médiation : https://www.economie.gouv.fr/mediation-conso/vous-etes-un-professionnel/vos-principales-obligations-0
- Supabase Auth — mot de passe et e-mail : https://supabase.com/docs/guides/auth/passwords

## Limites d'automatisation de cette conversation
Les connecteurs autorisent le code GitHub, les déploiements Vercel et des opérations Supabase contrôlées. Ils ne donnent pas accès à la boîte de réception du futur opérateur via un prestataire SMTP configuré dans Supabase, aux informations juridiques manquantes, à un compte Stripe marchand réellement vérifié, à la zone DNS OVH, ni au changement de visibilité GitHub. Une personne habilitée doit satisfaire ces étapes : ne jamais enregistrer de fausses preuves pour forcer l'indicateur « tout vert ».
