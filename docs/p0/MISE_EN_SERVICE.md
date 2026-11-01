# BPEI — Dossier de mise en service P0
État contrôlé le 1er novembre 2026. **Ceci n'est pas une attestation de lancement.**

## Déjà réalisé
- Code de l'application : la branche principale est maintenant **`main`**. Les tests unitaires, TypeScript, Chromium et WebKit sont tous réussis au commit `acd22faf1e1054fe5addf8420404214b353224ef` ; les PR #16, #17 et #18 sont intégrées. Les changements de code ultérieurs doivent être revalidés avant mise en service.
- Vercel : déploiement de production technique du commit `acd22faf1e1054fe5addf8420404214b353224ef` **READY**, mais protégé par Vercel Authentication pour toutes les cibles. La production technique n'est pas une ouverture publique commerciale.
- Supabase : projet `qmbsfmcotnsxsvbigynz` sain, 5 Edge Functions actives ; aucune alerte de sécurité dans l'advisor consulté.
- Base au contrôle : 0 utilisateur Auth, 0 admin, 0 document juridique, 0 version publiée, 0 marchand Stripe, 0 devis, 0 facture.
- Indicateurs d'ouverture `independent_registration_enabled=false`, `legal_documents_published=false`, `test_checkout_enabled=false`.

## Actions réelles à exécuter par l'exploitant habilité (dans cet ordre)

### 1. Identité de l'exploitant / textes contractuels
**Décision communiquée par l'exploitant le 1er novembre 2026 :** BPEI doit être exploité au lancement par sa **micro-entreprise existante**, qui utilise déjà l'activité / nom professionnel « HP Informatique ». La micro-entreprise est une **entreprise individuelle (EI)**, pas une société nouvelle. « BPEI » doit rester une marque / un nom commercial et ne doit pas être présenté comme une personne morale indépendante. Il faudra vérifier la disponibilité et la déclaration du nom commercial et, si l'activité d'intermédiation/mise en relation n'a pas été déclarée, effectuer une **modification de l'entreprise individuelle au guichet unique des formalités**. Ne pas créer artificiellement une seconde micro-entreprise sous le même titulaire.

**Éléments encore INCONNUS et non inventés :** identité civile du titulaire EI telle qu'enregistrée, SIREN/SIRET exact, établissement opérateur, adresse de domiciliation publiable, contact professionnel, activité déclarée, situation TVA, médiateur applicable, hébergeur contractuel et rôles de facturation. Demander à l'exploitant de fournir les données et les vérifier avant toute publication. Cette décision **ne valide aucun document juridique** et ne déclenche pas l'ouverture des inscriptions.

Le modèle « intermédiaire » reste un **choix contractuel à finaliser** : déterminer expressément si la facture d'intervention est établie par le technicien et si BPEI facture séparément sa commission au partenaire. Avant de paramétrer Stripe, confirmer auprès d'un professionnel comptable le traitement des sommes encaissées pour compte de tiers et l'assiette du chiffre d'affaires déclaré sous le régime micro-entrepreneur. Ne jamais décider que le chiffre d'affaires de BPEI représente uniquement les commissions sans avoir vérifié le circuit contractuel et les flux réels.

Les trois brouillons modifiables, **non publiables**, figurent dans `docs/p0/legal-drafts/`. La décision « EI actuelle » est prise en compte dans ces brouillons ; l'identité complète, les obligations de consommation, la TVA et le contrat partenaire restent à vérifier. Pour une évolution future (activité, enseigne, nouveau statut juridique) consulter `docs/p0/EVOLUTION-OPERATEUR-EI.md`.
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
Le dépôt GitHub `brekwu/BPEI` est encore **public** au contrôle. Le code déployable se trouve désormais sur `main` et les deux workflows GitHub Actions se déclenchent automatiquement à chaque push. Changer la visibilité GitHub → Settings → General → Danger Zone → Change visibility → Private avant d'y stocker du contenu non public. **Ne jamais mettre les clés Supabase service-role, SMTP ni Stripe dans le dépôt.**

Le domaine `bpei.fr` est attaché au projet Vercel, mais **l'attachement/validation du domaine ne signifie pas que le trafic DNS arrive sur Vercel**. Vérification directe de la configuration Vercel le 1er novembre 2026 : serveurs de noms OVH `ns106.ovh.net` et `dns106.ovh.net`, adresse A observée `185.158.133.1`, `misconfigured=true`. Le contrôle séparé de `www.bpei.fr` indique également `185.158.133.1`, `misconfigured=true`, avec une redirection Vercel configurée `308` vers `bpei.fr` (qui ne sera effective qu'une fois le DNS corrigé). Vercel Authentication reste activée pour toutes les cibles ; conserver ce verrou.

### Bascule DNS OVH — à préparer, mais NE PAS exécuter avant validation du lancement
Après validation des informations légales, de la disponibilité réelle du service, du certificat HTTPS, de la formule Vercel adaptée à l'activité et de la stratégie d'accès public :
1. Dans la zone DNS OVH de `bpei.fr`, identifier les enregistrements existants `A`, `AAAA` ou `CNAME` pour l'apex (`@`) et `www` ; sauvegarder l'état initial, vérifier l'absence de services annexes dépendant de ces entrées. **Ne pas modifier MX, SPF, DKIM, DMARC ou les autres enregistrements d'e-mail.**
2. Pour l'apex `bpei.fr`, le contrôle Vercel du 1er novembre 2026 fournit **`76.76.21.21`** comme adresse A recommandée (et non les anciennes valeurs `216.198.79.1` / `64.29.17.1`). Cette valeur est une **photographie datée**, pas une consigne permanente. Au moment de la bascule, relire `get_domain_config` / l'écran **Vercel → Project → Settings → Domains** pour retenir uniquement la cible alors recommandée ; sauvegarder et remplacer la valeur OVH `185.158.133.1` seulement après l'autorisation d'ouverture du domaine.
3. Pour `www.bpei.fr`, le contrôle de configuration consulté propose **`cname.vercel-dns.com.`** comme CNAME générique recommandé au 1er novembre 2026. La recommandation spécifique du projet affichée le jour de l'intervention prévaut ; vérifier également la redirection de `www` vers `bpei.fr`. Ne pas laisser un enregistrement A/AAAA incompatible sur le même sous-domaine.
4. Attendre la propagation réelle, refaire `Domains → Check DNS Configuration` chez Vercel et confirmer le certificat HTTPS sur les deux noms. Réaliser une visite sans connexion Vercel, vérifier `/`, `/health`, `/mentions-legales`, `/confidentialite`, `/cgu` et `/espace-independant`. **Ne pas désactiver Vercel Authentication pour contourner la recette ni ouvrir les formulaires sans les conditions juridiques.**

Le réglage des DNS ne prouve pas la livraison SMTP, la validation du premier administrateur ou un paiement Stripe TEST. Les indicateurs d'ouverture dans Supabase restent indépendants et fermés jusqu'à preuve réelle.

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

## Contrôle de cohérence GitHub (1er novembre 2026)

Les anciennes PR #3 et #4 ont été fermées comme intégralement reprises dans `main` (comparaison GitHub : aucun commit de leurs branches source en retard sur `main`). Les PR #1 et #2 restent ouvertes, car leurs historiques divergent de `main`. Elles ne doivent pas être fusionnées automatiquement sans analyse de leurs différences. Le chemin canonique de livraison est maintenant `main` → tests GitHub Actions → déploiement automatique Vercel protégé.

## Exploitation — séparer Vercel « READY » du bon fonctionnement de Supabase (1er novembre 2026)

- `GET /health` : **liveness**, retourne 200 si le serveur répond. Il n'inspecte pas la base et ne constitue pas une autorisation de lancement.
- `GET /health/dependencies` : contrôle technique de la connectivité Supabase, côté serveur, à partir des variables `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` de l'environnement Vercel. Une lecture valide, par la clé **publique**, du verrou `bpei_launch_controls` donne `HTTP 200` et `{"status":"ok","scope":"dependency_only"}`, **même si** inscriptions et paiements sont fermés. Toute erreur de configuration, de réseau, de permissions ou de réponse donne `HTTP 503` et `{"status":"unavailable","scope":"dependency_only"}`.
- Ce contrôle ne teste **ni** les envois SMTP, **ni** le premier administrateur, **ni** l'éligibilité des partenaires, **ni** les documents juridiques, **ni** les flux Stripe, **ni** l'accès public sans SSO. Ne jamais l'interpréter comme un feu vert commercial.
- Les deux chemins doivent être testés après déploiement dans un environnement où le propriétaire est autorisé à passer la protection Vercel. Dans la CI, la clé Supabase est volontairement factice : `/health` doit répondre 200 et `/health/dependencies` doit répondre **503**. Cela vérifie que le contrôle ne prétend pas à tort que les dépendances sont opérationnelles.
- Ne pas stocker de clé `service_role` ou `sb_secret_...` dans les variables publiques Vite, le code source, les journaux du contrôle ou des requêtes HTTP de test. L'URL de production doit être le domaine Supabase réellement autorisé ; le test refuse les autres hôtes.
