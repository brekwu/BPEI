# BPEI — Plan de migration contrôlée Lovable Cloud → Supabase + Render
_Document opérationnel, 28 octobre 2026. Aucun changement DNS ou suppression de données._

## État vérifié
- Projet Lovable : `2d1ac429-ce2c-45e9-bdc3-dffaa4747e4f`, serveur SQL géré par Lovable Cloud.
- Dépôt GitHub : `brekwu/BPEI` ; code sur `feat/reseau-national-2026-10`, PR #1.
- Base actuelle : 117 tables publiques et au moins 6 comptes Auth, 5 boutiques, 6 candidatures boutiques et 9 affectations de rôles (comptages au 28/10/2026).
- Tables `technician_applications` et `intervention_requests` : présentes, 0 enregistrement chacune au contrôle initial.
- Le dépôt contient les migrations SQL et la logique applicative mais **aucune sauvegarde de données**. Les migrations ne remplacent jamais l'export des lignes ni celui des utilisateurs.
- Supabase personnel connecté : une organisation `brekwu` en plan gratuit ; aucun projet existant. Création d'un projet additionnel annoncée à 0 USD/mois dans la tarification consultée, sous réserve des limites/conditions de service.
- Render : configuration de *staging uniquement*, `render.yaml` ; pas de DNS `bpei.fr`, déploiement automatique désactivé.

## Préconditions indispensables
1. Créer un projet Supabase distinct dans l'organisation choisie (préférence de région française `eu-west-3` si disponible) ; sauvegarder les valeurs publiques et les **secrets privés directement chez l'hébergeur**, jamais sur GitHub ou dans un message.
2. Contrôler le SQL de l'ensemble des migrations dans un environnement de test. Réconcilier les 117 tables et contraintes RLS de Lovable avec la nouvelle base, sans écraser les tables existantes d'Auth/Storage.
3. Faire un inventaire des tables contenant des données et des volumes. Exporter les lignes métiers avec leurs UUID d'origine, l'ordre des clés étrangères, les timestamps, les associations utilisateurs, les fichiers Storage et les éléments chiffrés. **Ne jamais écrire les données clients dans ce dépôt public.**
4. Prévoir explicitement l'authentification : la base Lovable Cloud n'expose pas les clés serveur ni une connexion Postgres externe sur le compte personnel. La migration des mots de passe et sessions n'est pas acquise. Privilégier une procédure sécurisée de réinvitation / réinitialisation des utilisateurs, après vérification de leur consentement et du mapping des comptes. Ne jamais lire ni exporter les mots de passe/hash.
5. Ne pas activer le script `sql/001_bloquer_insert_direct.sql` sur le backend source tant que la nouvelle écriture serveur n'est pas opérationnelle ; le script appartient à la migration sécurisée.
6. La clé `SUPABASE_SERVICE_ROLE_KEY` est un secret serveur **absolu** : ne jamais la préfixer de `VITE_` ni l'envoyer au navigateur.

## Configurer la préproduction Render
- Se connecter à Render, importer la branche du dépôt contenant `render.yaml` comme Blueprint.
- Serveur en région `frankfurt`, type `free` pour essais uniquement ; ce plan **n'est pas un hébergement de production recommandé**.
- Variables publiques *utilisées à la compilation* : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Variables serveur *privées* : `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `HASH_PEPPER`.
- Vérifier que l'URL Supabase côté client correspond exactement à celle côté serveur. Ne pas donner au staging les secrets de production tant que l'isolation n'est pas validée.
- Tester `GET /health`, SSR, formulaires, les refus RLS, la connexion admin, le rendu mobile et la suppression des données d'essai.

## Critères objectifs avant la bascule de domaine
- [ ] GitHub Actions : installation, 14 tests métier, build, lint ciblé, TypeScript, vrai SSR HTTP.
- [ ] Contrôle du repo public / rendu privé selon politique commerciale, aucun jeton commité.
- [ ] Base de destination provisionnée, migrations vérifiées sur DB de test.
- [ ] Données boutiques, profils, rôles et comptes migrés, avec contrôle des volumes et des liens.
- [ ] Fichiers publics et privés + logo récupérés depuis Lovable Cloud avec autorisations adéquates.
- [ ] Test d'enregistrement d'une candidature et d'une demande avec consentement, contrôle admin et suppression de ces enregistrements de test.
- [ ] Contrôle de l'anti-abus depuis le reverse proxy Render et de la politique RLS en conditions réelles.
- [ ] CGU/CGV/mentions légales/confidentialité adaptées au réseau indépendant, à l'hébergeur et aux flux de données.
- [ ] Stripe / commissions inactifs tant que les contrats et les tests ne sont pas finalisés.
- [ ] DNS documenté, TLS validé, TTL réduit et sauvegarde du routage original.

## Bascule et retour arrière
1. Effectuer une sauvegarde finale cohérente (base, Storage, utilisateurs et DNS).
2. Définir une courte fenêtre de gel des inscriptions/modifications sur le site source pour éviter deux bases divergentes.
3. Synchroniser les données finales, vérifier les totaux et les dossiers critiques ; tester les nouvelles sessions/connexions.
4. Modifier le DNS uniquement après confirmation de la disponibilité Render et du certificat HTTPS ; ne pas publier un staging incomplet à `bpei.fr`.
5. Surveiller les erreurs 5xx, la délivrabilité, les formulaires et les réponses. En cas d'échec, remettre les anciens DNS. **Attention : revenir au site original ne remigre pas automatiquement les nouveaux enregistrements** ; il faut les réconcilier.
6. Conserver Lovable Cloud comme source récupérable pendant une période de transition, sans la supprimer prématurément.

## Blocages non résolus
- Connexion/autorisation Render depuis ChatGPT et mise en place de son compte.
- Choix confirmé de l'organisation Supabase et provisionnement du nouveau projet.
- Sauvegarde et transfert effectifs des 117 tables, 6 utilisateurs et fichiers.
- Accès au compte DNS / registraire de `bpei.fr` non disponible ici.
- Documents légaux et modalités contractuelles à valider par le responsable du projet.

**Ce document n'atteste d'aucune migration de données réalisée.**
