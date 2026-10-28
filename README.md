# BPEI — réseau de techniciens informatiques indépendants

Branche `feat/reseau-national-2026-10` : application épurée du réseau **indépendants uniquement**. Les modules historiques boutiques ont été retirés. Ancien code sauvegardé dans `backup/avant-nettoyage-boutiques-2026-10-28`.

## Ce qui est disponible
- Accueil et informations publiques
- Compte et profil indépendant, connexion par Supabase Auth
- Candidature indépendante et consultation des demandes attribuées, protégées par RLS
- Formulaires clients et juridiques non validés **fermés** par défaut
- Déploiement de **préproduction uniquement** sur Vercel

## Ce qui bloque l'exploitation commerciale
- Vérifier le parcours inscription/candidature de bout en bout, les e-mails et l'isolement inter-comptes
- Mettre en place les flux de demandes clients et l'administration des missions
- Valider les mentions légales, la politique de confidentialité et les conditions de collaboration
- Basculer vers un hébergement **autorisé pour l'usage commercial** avant toute mise en production

## Tests
`bun install --frozen-lockfile` puis `bun run build`.
Après lancement local du serveur : `node scripts/smoke-http.mjs`.

Aucune donnée cliente historique, aucun compte boutique et aucune clé secrète ne sont migrés.
