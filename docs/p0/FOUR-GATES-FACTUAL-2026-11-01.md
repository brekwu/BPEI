# BPEI P0 — quatre contrôles réels — 1er novembre 2026

Document de recette interne, non contractuel, non publié en tant que pages juridiques.

## 1. Premier administrateur
- Vérification directe Supabase : 0 utilisateur dans auth.users, 0 administrateur dans public.independent_admins.
- Ne pas créer de rôle administrateur pour une adresse non inscrite et non confirmée.
- Créer un vrai compte Auth, obtenir sa confirmation e-mail, vérifier user_id et email_confirmed_at, puis suivre docs/BOOTSTRAP_ADMIN_BPEI.md.
- Le privilège ne doit jamais venir de user_metadata.

## 2. Confirmation e-mail
- Livraison réelle et clic de validation non observés.
- Avant toute inscription publique, contrôler la configuration SMTP, l'activation du hook Before User Created dans Supabase hébergé, puis utiliser un compte de préproduction réellement vérifié.
- Ne pas mettre email_confirmed_at artificiellement à une date.

## 3. Stripe TEST
- Compte Stripe accessible : acct_1TXPtqI9Mu6KnwVF, environnement test « New business ».
- Compte non vérifié comme marchand final de BPEI ; charges_enabled false et details_submitted false.
- Session Checkout de test de 1,00 EUR créée dans Stripe avec livemode false :
  cs_test_a1kHiPiMKqZPNpoJPDwoXZIGsw1uUhyTsON5hhyvO9Z4Fq1BWaKNtgxd4F
- État immédiatement après création : status=open, payment_status=unpaid.
- La session indépendante n'est pas une facture, ni un encaissement, ni une preuve de webhook BPEI. Aucun rapprochement de paiement de mission ou commission n'a été attesté.
- Garder Stripe LIVE désactivé. Tester ensuite paiement simulé, webhook signé, déduplication et rapprochement d'une vraie facture TEST BPEI.

## 4. Juridique
- Les cinq brouillons existent dans docs/juridique : mentions légales, confidentialité, CGU, CGV interventions, convention partenaire.
- Ils contiennent encore des champs non vérifiés : identité EI, SIREN/SIRET, adresse professionnelle légalement publiée, TVA, contact, hébergement, qualification juridique de BPEI, médiation B2C, flux financiers et contrats des prestataires.
- Ne pas les publier comme définitifs ni activer le drapeau legal_documents_published tant que l'exploitant n'a pas fourni et approuvé les informations exactes et les conventions nécessaires.
- Ne jamais fabriquer une adhésion à un médiateur, une signature, ni un consentement.

## Décision de sortie
P0 non validé. Conserver inscriptions publiques et paiements réels fermés. Les contrôles ci-dessus doivent être étayés par des preuves réelles distinctes des tests SQL et des simulations navigateur.
