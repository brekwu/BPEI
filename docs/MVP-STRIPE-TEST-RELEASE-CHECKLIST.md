# BPEI — Stripe Connect, **TEST UNIQUEMENT** (29/10/2026)

## État exact au dépôt
- `bpei-test-checkout` et `bpei-test-webhook` sont deux Edge Functions Supabase (projet BPEI) déployées en préproduction. Checkout garde le JWT actif ; le webhook, sans JWT Stripe, exige une signature HMAC Stripe et une fenêtre temporelle de 5 minutes.
- La base contient les migrations 42–43 (registre de paiements test et politiques de confidentialité), avec `bpei_payment_controls.test_checkout_enabled=false`, 0 marchand lié et 0 paiement.
- Les rôles anonymes et authentifiés ne peuvent exécuter aucune fonction SQL privilégiée de préparation/réconciliation. Seul `service_role` peut créer et réconcilier des tentatives ; les comptes d'administration voient uniquement un registre via RLS.
- Le navigateur ne peut transmettre que `invoice_id` ; montant, devis accepté, facture et identité du destinataire sont récupérés dans la base par le serveur. Impossible d'envoyer directement le montant à débiter.
- Le mode Checkout accepte exclusivement `sk_test_`, des sessions `cs_test_` et des événements Stripe `livemode=false`.
- Le retour visuel `/paiement/retour` ne valide **jamais** le paiement ; seul le webhook signé, puis un RPC transactionnel contrôlant la facture, le compte marchand, le montant, la devise, la session et l'ID d'événement, peut marquer la tentative comme `paid`.
- Les états de paiement en test sont séparés de la facture immuable ; aucun statut réel « acquittée » n'est attribué.
- L'événement `checkout.session.completed` n'est considéré payé que si `payment_status=paid`. Les événements `async_payment_succeeded`, `async_payment_failed` et `expired` sont pris en charge. La gestion des remboursements et rétrofacturations **n'est pas livrée**.

## Configuration obligatoire avant le moindre paiement de TEST (non effectuée)

1. Faire confirmer le **compte Stripe BPEI** : celui actuellement connecté à ChatGPT porte le nom « Environnement de test New business », qui ne prouve pas son appartenance au projet BPEI. Ne pas créer ni rattacher de compte marchand à partir d'une supposition.
2. Choisir précisément l'émetteur de la facture et la structure contractuelle des commissions. Ce prototype utilise des **direct charges Stripe Connect** : l'indépendant vendeur (compte connecté) reçoit le paiement ; BPEI ne perçoit **aucune commission Stripe automatique** dans ce flux.
3. Dans le Dashboard du bon compte Stripe, créer un compte connecté **en mode test** pour un indépendant identifié et vérifier explicitement `charges_enabled`, `payouts_enabled` et `country=FR`. Inscrire ensuite le couple `issuer_id ↔ acct_...` dans `bpei_stripe_connected_accounts` avec `test_verified_at` et `test_enabled=true` seulement après vérification des deux identités. Aucun enregistrement n'existe aujourd'hui.
4. Configurer les **Secrets Supabase Edge Functions**, sans jamais les mettre dans GitHub ni les variables `VITE_*` :
   - `STRIPE_SECRET_KEY=sk_test_...` — clé de la plateforme de TEST
   - `BPEI_STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...` — secret de l'endpoint **Connect**, abonné aux événements des comptes connectés
   - `BPEI_CHECKOUT_RETURN_ORIGIN=https://[domaine-préproduction-protégé]` — origine HTTPS exacte, sans chemin
   - `BPEI_TEST_CHECKOUT_ENABLED=true` — verrou serveur, **garder false jusqu'à l'homologation**
   - `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` — secrets serveur de Supabase, fournis par l'environnement, jamais côté navigateur.
5. L'endpoint Stripe Connect webhook devra correspondre à `https://qmbsfmcotnsxsvbigynz.supabase.co/functions/v1/bpei-test-webhook` et être configuré pour les événements Connect pertinents ; vérifier la configuration et les signatures avant activation.
6. Après vérification du nom du marchand, de la facturation et du webhook, ouvrir le verrou SQL `bpei_payment_controls.test_checkout_enabled` en préproduction **uniquement**. Activer séparément l'interface avec `VITE_BPEI_TEST_CHECKOUT_ENABLED=true` dans Preview, sans publier `bpei.fr`.
7. Tester avec vrais comptes de préproduction : facture 108,00 € TTC, montant exact 10 800 centimes, paiement de test réussi, expiré, refusé, doublon de webhook et tentative de webhook pour un autre compte/montant. Tester l'isolation de deux indépendants et un admin. Vérifier que 0 devise live et 0 paiement réel sont possible.

## Indispensable avant commercialisation réelle
- Développer **un second flux live distinct** (pas réutiliser silencieusement les verrous test), validation KYC des indépendants et du compte plateforme, supervision des erreurs, litiges, remboursements, avoirs, réconciliation comptable et commission si souhaitée.
- Vérifier la conformité des documents commerciaux, l'émission et la transmission des factures électroniques françaises B2B applicables, et obtenir une première identité émettrice/administrateur réellement vérifiée.
- Mettre en place la recette réelle SMTP/Authentification/RLS, la gestion de l'assistance client et le déploiement commercial autorisé.
- **TPE physique / Tap to Pay NFC** : non intégré dans le code web. Pour un premier pilote, étudier Tap to Pay dans l'application Stripe Dashboard du compte **du prestataire** (si disponible et autorisé) plutôt que prétendre qu'une page web contrôle le NFC.

Documentation technique :
- https://docs.stripe.com/connect/direct-charges
- https://docs.stripe.com/connect/saas/tasks/accept-payment
- https://docs.stripe.com/webhooks/signature
- https://docs.stripe.com/no-code/in-person
