# BPEI — hébergement Node indépendant

Le projet BPEI est un serveur complet TanStack Start / Nitro, et **non** un simple site statique. Un hébergeur prenant en charge Node 22 ou Docker est nécessaire (ou tout hébergeur compatible Nitro). Aucune installation d'application Render n'est requise.

## Démarrage sur Node

```sh
bun install --frozen-lockfile
NITRO_PRESET=node-server bun run build
HOST=0.0.0.0 PORT=3000 bun run start
```

## Docker

```sh
docker build \
  --build-arg VITE_SUPABASE_URL=https://PROJECT.supabase.co \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY \
  -t bpei:staging .

docker run --rm -p 3000:3000 \
  -e SUPABASE_URL=https://PROJECT.supabase.co \
  -e SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY \
  -e SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SECRET_VALUE \
  -e HASH_PEPPER=YOUR_UNIQUE_RANDOM_VALUE \
  -e BPEI_STAGING=true \
  bpei:staging
```

Les variables `SUPABASE_SERVICE_ROLE_KEY` et `HASH_PEPPER` doivent être définies uniquement dans le **gestionnaire de secrets de l'hébergeur**, pas dans les scripts ou dans GitHub. Le code ci-dessus est un exemple ; ne pas y recopier de véritables secrets lors du partage.

Le staging doit avoir `BPEI_STAGING=true`, un domaine temporaire dédié et une base de données de test. Le serveur répond à `GET /health`. Les formulaires sont destinés à écrire dans la base via des fonctions serveur protégées par limitation de débit et validation.

**Ne pas pointer bpei.fr vers le staging.** La migration des utilisateurs et données boutiques provenant de Lovable Cloud n'est pas achevée. Voir `docs/MIGRATION_DONNEES_LOVABLE.md` pour la procédure et le retour arrière.

Le `Dockerfile` produit la version front et SSR avec `node-server`. Un domaine public et TLS peuvent être gérés par un reverse proxy sécurisé, après tests complets.
