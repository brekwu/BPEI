# BPEI — réseau de techniciens informatiques indépendants

Ce dépôt contient désormais la version **indépendants uniquement**. Les anciennes routes et modules des boutiques informatiques, de caisse, stock, facturation, abonnements, paiements et imports ont été retirés. Les anciennes URL importantes redirigent vers le nouveau parcours.

## Technique
- React 19 + TanStack Start + Nitro/Vite 8, sans plugin de build Lovable
- Supabase Auth et trois tables métiers indépendants avec RLS
- Vercel : préproduction, variables publiques limitées au projet BPEI
- CI : installation figée, build Node et tests SSR HTTP
- Le fichier `src/routeTree.gen.ts` est généré à la compilation

## Sauvegarde / retour arrière
Le code d'origine est conservé dans `backup/avant-nettoyage-boutiques-2026-10-28`. Le nouveau code se trouve sur `feat/bpei-independent-release-clean`.

## Tests
```sh
bun install --frozen-lockfile
bun run build
PORT=3000 HOST=127.0.0.1 bun run start
node scripts/smoke-http.mjs
```

## Blocages avant ouverture commerciale
Le parcours inscription/candidature et la séparation des comptes doivent encore être testés avec des utilisateurs de test. L'attribution des missions et les demandes clients ne sont pas activées. Les pages légales affichent un état non publié en attendant l'identité de l'éditeur et les documents vérifiés. Ne pas lancer de publicité ni publier le site commercial avant ces validations et une offre Vercel adaptée à l'usage commercial.
