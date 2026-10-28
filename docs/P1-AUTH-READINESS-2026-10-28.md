# BPEI — Contrôle réel Auth/e-mail et préproduction

Constat en lecture seule du **28 octobre 2026**, projet Supabase `qmbsfmcotnsxsvbigynz` et projet Vercel `bpei-preview`.

## Éléments contrôlés

- Vercel Preview utilise la même URL Supabase publique côté serveur et navigateur : `https://qmbsfmcotnsxsvbigynz.supabase.co`.
- Les clés publiques Supabase côté serveur et client sont présentes et identiques. Aucune clé secrète n'a été publiée, recopiée ou nécessaire pour cette comparaison.
- `BPEI_STAGING=true`, `BPEI_FORMS_ENABLED=false` et `VITE_BPEI_PUBLIC_FORMS_ENABLED=false`.
- Le projet Vercel Preview est protégé par Vercel Authentication SSO. `NITRO_PRESET=vercel`.
- Supabase : 37 migrations appliquées et versionnées dans GitHub ; fonction SQL `bpei_private.before_bpei_user_created` présente.
- Inventaire SQL lu directement : 0 utilisateurs, 0 administrateurs, 0 documents juridiques, 0 publications juridiques, 0 missions, 0 incidents ; `legal_documents_published=false`, `independent_registration_enabled=false`, `legal_version=NULL`.
- Les advisors de sécurité Supabase ne retournent aucune alerte au moment de la vérification.

## Points non prouvés et indispensables

1. **Auth Before User Created Hook réellement activé dans Supabase** : présence d'une fonction SQL != activation du hook GoTrue. Ouvrir https://supabase.com/dashboard/project/qmbsfmcotnsxsvbigynz/auth/hooks et vérifier la liaison ; conserver les créations de comptes bloquées tant que le flux d'administration initiale n'a pas été organisé.
2. **SMTP externe effectif** : le statut de l'envoi transactionnel et sa réception chez un destinataire hors de l'équipe Supabase ne sont pas vérifiables depuis les outils disponibles. Ouvrir https://supabase.com/dashboard/project/qmbsfmcotnsxsvbigynz/auth/smtp et vérifier SPF/DKIM/DMARC. Ne jamais stocker les mots de passe SMTP dans le dépôt.
3. **Site URL et allowlist** : l'ancien e-mail de test redirigeait vers localhost:3000 ; contrôler https://supabase.com/dashboard/project/qmbsfmcotnsxsvbigynz/auth/url-configuration . L'URL de préproduction à autoriser doit être une URL HTTPS stable et maîtrisée, pas un joker global sur vercel.app.
4. **Compte administrateur réel** : aucune identité ni adresse administrateur n'est encore vérifiée dans la base. Utiliser la procédure `scripts/p0-bootstrap-admin.mjs` uniquement avec une adresse autorisée, un environnement de confiance et des secrets d'administration non divulgués.
5. **Contenus juridiques** : aucune version validée des mentions légales, CGU et confidentialité n'est publiée ; ne pas contourner cette exigence. Ne pas ouvrir les inscriptions ou le domaine public avant validation juridique.
6. **Test complet réel** : confirmation d'e-mail, redirection HTTPS, connexion, profil, dépôt/validation de candidature, double isolation Auth/RLS, récupération du mot de passe et gestion administrative doivent être exécutés sur des comptes approuvés avant publication.

## Tests supplémentaires livrés

- `src/lib/bpei-auth-redirect.ts` construit les URLs de confirmation et de récupération à partir du domaine courant, exige HTTPS sauf localhost en développement, et n'interprète pas un simple `?code` comme une preuve de récupération du mot de passe.
- `tests/bpei-auth-redirect.test.ts` vérifie les URLs sûres, les origines détournées et la classification des liens de récupération.
- `tests/p1-auth-readiness.sql` retourne uniquement l'inventaire de compteurs et des contrôles de publication ; ce test ne configure pas SMTP ou GoTrue.
- `scripts/p1-live-rls-smoke.mjs` est prêt pour quatre comptes réels et des missions autorisées ; il reste **non exécuté** faute de comptes, et il ne teste pas le transport e-mail.

## Décision

**NO GO pour la publication et l'ouverture des inscriptions.** Les vérifications de développement et la préproduction Vercel sont opérationnelles, mais les paramètres externes Auth/SMTP/redirects et les éléments juridiques ne sont pas homologués. Ne pas fusionner le lot P1 dans une branche de lancement tant que la recette réelle n'est pas terminée.
