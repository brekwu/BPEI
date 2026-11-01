# BPEI — cible d'hébergement commercial préparée : Netlify Free

**État : cible de déploiement préparée dans GitHub, AUCUN site Netlify créé ni trafic migré.** La préproduction Vercel actuelle reste inchangée/protégée. Ne pas publier tant que le P0 administratif, juridique et Stripe n'est pas validé.

## Choix et limites
- Netlify Free autorise les projets commerciaux. Offre vérifiée le 1er novembre 2026 : **0 $**, **300 crédits par mois** avec plafond strict ; si le solde est épuisé, Netlify met les sites en pause jusqu'au cycle suivant ou une montée de gamme. Aucun SLA/garantie de disponibilité n'est présumé.
- TanStack Start est officiellement supporté, SSR et fonctions incluses ; le projet utilise déjà **Nitro v3**, capable de générer le preset **`netlify`** sans dépendance supplémentaire.
- `netlify.toml` : build Bun verrouillé, sortie statique `dist` et fonctions `.netlify/functions-internal`, préproduction conservée par défaut (`BPEI_STAGING=true`, formulaires désactivés).
- Les Edge Functions Stripe / SMTP restent sur **Supabase**, pas dans les fonctions hébergées par Netlify. Les webhooks Stripe doivent utiliser leur URL Supabase vérifiée et leur signature, jamais une URL fictive de Netlify.
- Les paramètres `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` doivent être configurés dans le **tableau Netlify** pour l'environnement voulu, jamais inscrits dans Git ; vérifier le moment d'injection des clés et les routes SSR.
- Netlify Free peut héberger le projet commercial **après** la recette en production, mais ne résout ni l'identité de l'opérateur, ni la conformité du traitement des données, ni les paiements.

## Opérations nécessaires chez les fournisseurs (pas encore exécutées)
1. Dans GitHub `brekwu/BPEI`, ouvrir `Settings → General → Danger Zone → Change repository visibility → Private`, confirmer la transition, puis vérifier que Netlify/Vercel disposent d'un accès Git au dépôt privé. Aucune API GitHub de modification de visibilité n'est disponible dans le connecteur actuel.
2. Créer un compte/site **Netlify Free** pour l'EI, importer la branche `main` après la validation de la compilation Netlify et autoriser le dépôt privé. L'outil Netlify n'est actuellement pas connecté.
3. Ajouter uniquement les variables d'environnement nécessaires dans Netlify. Conserver les garde-fous activés jusqu'à la fin réelle du P0 ; ne jamais injecter la clé `service_role` dans un `VITE_*` ou dans le client.
4. Vérifier les pages SSR, Auth callback, session, santé, CGU, mentions légales, CSP/CORS, les redirections historiques et HTTPS sur une URL `*.netlify.app` non annoncée publiquement.
5. **Avant la bascule DNS** chez OVH, relever tous les enregistrements @, www, MX, SPF, DKIM, DMARC et les services existants. Ne modifier que A/AAAA/CNAME de @ et www selon les recommandations exactes données par **Netlify pour le site créé** ; **ne PAS réutiliser les anciennes valeurs Vercel** et préserver tous les enregistrements e-mail.
6. Enregistrer/valider `bpei.fr` et `www.bpei.fr` dans Netlify, vérifier certificat HTTPS puis tests réels ; seulement ensuite envisager la coupure de la préproduction Vercel. Aucun DNS OVH n'a été modifié ici.

## Contrôle de compilation
Le workflow `.github/workflows/bpei-tests.yml` comprend un job `netlify-nitro-build` qui génère et vérifie les artefacts `dist`, `.netlify/functions-internal/nitro.json` et `.netlify/functions-internal/server/main.mjs` sans publier le site.
Pour démarrer ensuite une vraie recette Netlify, le connecteur ou l'accès au compte Netlify est indispensable.

## Documentation
- https://nitro.build/deploy/providers/netlify
- https://www.netlify.com/pricing/
- https://docs.netlify.com/build/frameworks/framework-setup-guides/tanstack-start/
- https://www.netlify.com/blog/introducing-netlify-free-plan/
- https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/
