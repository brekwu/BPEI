# BPEI — Activation des e-mails de confirmation et publication

## Constat contrôlé le 28 octobre 2026

- Une inscription de test Supabase a créé un compte et le courriel de confirmation a été reçu dans une boîte Gmail autorisée.
- **Le lien reçu redirigeait vers `http://localhost:3000`** : la configuration Auth de l'environnement hébergé n'est pas adaptée au site public.
- Le client BPEI passe maintenant `emailRedirectTo: window.location.origin + "/espace-independant"` à l'inscription, mais Supabase doit explicitement autoriser ces URL. **Le réglage du tableau de bord reste à faire.**
- Le serveur SMTP intégré Supabase est limité aux destinataires préautorisés et n'est pas adapté à un lancement commercial.

## Configuration requise dans Supabase (projet `qmbsfmcotnsxsvbigynz`)

1. Ouvrir [Authentication > URL Configuration](https://supabase.com/dashboard/project/qmbsfmcotnsxsvbigynz/auth/url-configuration).
2. **Site URL** : choisir l'URL réelle et vérifiée de la plateforme au moment de son lancement, par exemple `https://bpei.fr` **uniquement une fois le domaine publié et correctement routé**.
3. **Redirect URLs** : enregistrer les URLs exactes du domaine BPEI et celles de préproduction utilisées pour la recette. Éviter une allowlist trop large de domaines `*.vercel.app`, qui autoriserait des domaines tiers.
4. Ouvrir [Authentication > SMTP Settings](https://supabase.com/dashboard/project/qmbsfmcotnsxsvbigynz/auth/smtp) et configurer un fournisseur SMTP adapté à la production, avec identifiants conservés dans les paramètres sécurisés, jamais dans GitHub ni le frontend.
5. Authentifier le domaine d'envoi (SPF, DKIM, et politique DMARC) chez le fournisseur et vérifier les limites d'envoi du plan.
6. Configurer l'adresse expéditrice, le nom `BPEI`, et la durée de validité du lien ; tester redirection, expiration, réutilisation et e-mail invalide.
7. Exécuter une **inscription réelle** dans le navigateur avec une adresse autorisée, ouvrir le lien de confirmation depuis le courriel, vérifier que le retour arrive à `/espace-independant`, puis se connecter avec le mot de passe.
8. Vérifier dans Auth que `email_confirmed_at` est renseigné et que les e-mails ne finissent pas en spam.
9. Ne retirer aucun des verrous de publication tant que les mentions légales, CGU, politique de confidentialité et identité du responsable de traitement ne sont pas validées.

## Premiers administrateurs et données juridiques

Le premier compte administrateur ne peut être ajouté qu'après confirmation explicite de l'adresse e-mail à utiliser et inscription confirmée. Consulter `docs/BOOTSTRAP_ADMIN_BPEI.md`.

La base `bpei_launch_controls` bloque l'ouverture des inscriptions via le site et la soumission des candidatures tant que les documents légaux ne sont pas publiés ; `bpei_legal_acceptances` stocke la version acceptée et la date d'acceptation du compte connecté. Les demandes de contact/intervention restent également fermées.

## Critères avant publicité

- SMTP fonctionnel **pour un destinataire externe autorisé à recevoir**, sans restriction à l'équipe Supabase.
- Un e-mail aboutit dans la bonne boîte, avec une redirection HTTPS BPEI valide.
- Inscription → confirmation → connexion → profil → consentement versionné → candidature → statut → examen admin → acceptation/refus : **tests navigateur et base réussis**.
- Identité juridique BPEI, durées de conservation, coordonnées de contact et conditions de mise en relation validées et publiées.
- Hébergement conforme à un usage commercial et contrôle de domaine `bpei.fr` terminé.

Documentation : https://supabase.com/docs/guides/auth/auth-smtp ; https://supabase.com/docs/guides/auth/redirect-urls
