# BPEI — contrôles avant et après restauration

Ces scripts comparent seulement le **nombre de lignes de chaque table**, sans exporter les coordonnées des clients ou des techniciens. Ils ne restaurent pas la base à eux seuls.

## 1. Sauvegarde originale
- Lancer l'export SQL complet dans le tableau de bord Lovable Cloud, sur le **projet BPEI exact**.
- Conserver le fichier localement ou dans un coffre privé. **Ne pas le pousser sur GitHub** et ne pas le joindre à une pull request : il peut contenir des données personnelles ou d'authentification.
- Sauvegarder également les objets des buckets Storage, puis les paramètres d'authentification et les variables secrètes via leurs gestionnaires dédiés.

## 2. Inventaire avant migration
Le script `scripts/migration/inventaire.sql` utilise une table **temporaire** puis émet un tableau JSON des comptes de lignes. Aucune table métier n'est modifiée.

Si une connexion PostgreSQL source autorisée existe, ouvrir une session protégée (fichier service PostgreSQL ou variables non journalisées) puis exécuter :

```sh
psql -X -qAt -v ON_ERROR_STOP=1 -f scripts/migration/inventaire.sql > inventaire-source.json
```

Sur Lovable Cloud sans connexion directe, lancer le contenu du script dans l'éditeur SQL administratif et **enregistrer uniquement la sortie JSON des nombres de lignes**, pas le résultat d'une requête contenant des lignes utilisateur.

Un résultat `rows: -1` signale que le rôle utilisé ne peut pas compter la table : impossible de conclure à une migration parfaite avec cette ligne.

## 3. Restauration en préproduction
- Ne pas importer dans la base Lovable de production.
- Créer un nouveau projet Supabase privé et restaurer le dump complet dans une base isolée.
- Un dump complet qui contient déjà les schémas et tables ne doit pas être suivi d'une réexécution aveugle des migrations : risques de doublons et d'échecs SQL.
- Reconfigurer les fournisseurs d'authentification, les e-mails, les domaines de redirection et les secrets dans leur gestionnaire, sans les verser dans GitHub.
- Restaurer les fichiers Storage indépendamment si l'export SQL ne fournit que leurs métadonnées.

## 4. Vérifications comparatives
Exécuter le même inventaire sur la destination pour créer `inventaire-destination.json`, puis :

```sh
node scripts/migration/comparer.mjs inventaire-source.json inventaire-destination.json
```

Le script **refuse** les tables absentes, un nombre de lignes différent, un résultat inaccessible, les tables supplémentaires ou un inventaire vide. Ces contrôles sont nécessaires, mais **insuffisants** : vérifier les UUID, relations et clés étrangères, les six comptes utilisateurs existants, les rôles des boutiques, les fichiers Storage, les permissions RLS, la connexion d'un utilisateur existant et les parcours réels.

## 5. Bascule et retour arrière
- Interdire les nouvelles écritures pendant la copie finale pour éviter les divergences.
- Effectuer une sauvegarde datée après le gel.
- Effectuer les contrôles de comptes, formulaires, droits d'administration et affichages.
- Ne pointer `bpei.fr` vers le nouvel hébergeur qu'après validation technique et légale et installation de TLS.
- Conserver les enregistrements DNS initiaux et le backend Lovable pour un retour arrière contrôlé. **Le retour des DNS ne ramène pas les données ajoutées sur le nouveau site** : les réconcilier avant toute restauration.

## Statut mis à jour le 28 octobre 2026

- Projet Supabase **BPEI créé et sain**, référence `qmbsfmcotnsxsvbigynz`, région Paris `eu-west-3`.
- Archive originale `pro-repair-connect_261028.backup` reçue et inventoriée séparément. **Ne jamais ajouter l'archive au GitHub public.**
- La base cible contient encore **zéro compte, zéro identité et zéro table métier** lors du dernier contrôle. **La restauration n'a pas eu lieu.**
- Le kit local de restauration `BPEI_etape1_pack_restauration.zip` a été fourni à l'utilisateur. Il nécessite PostgreSQL 18 et des identifiants de connexion saisis uniquement sur son poste ; il n'a pas été exécuté contre Supabase.
- Vercel `bpei-preview` est en prévisualisation privée ; les formulaires restent désactivés et `bpei.fr` demeure inchangé.

## Étape 2 — comptes et boutiques

Après restauration, exécuter `scripts/migration/audit-comptes-boutiques.sql` dans le SQL Editor de **ce projet Supabase uniquement**, ou avec `psql -X -v ON_ERROR_STOP=1 -f scripts/migration/audit-comptes-boutiques.sql`.

Ce diagnostic crée des **tables temporaires uniquement**, compare les volumes historiques suivants, puis vérifie les références croisées et l'activation RLS :

| Objet | Attendu |
|---|---:|
| auth.users | 6 |
| auth.identities | 6 |
| public.profiles | 6 |
| public.shops | 5 |
| public.shop_applications | 6 |
| public.shop_memberships | 9 |
| public.user_platform_roles | 9 |
| public.shop_subscriptions | 4 |
| storage.buckets | 5 |

Le contrôle a été testé sur la base encore vide : il retourne `A_VERIFIER` et identifie les tables absentes au lieu d'échouer.

**Attention :** obtenir tous les comptes de lignes et l'absence de références orphelines ne prouve pas la connexion. Après import, tester séparément un vrai utilisateur existant (mot de passe / OAuth / réinitialisation), les permissions boutique et admin avec deux comptes distincts, les redirections Auth, les e-mails et la disponibilité des objets Storage physiques. Ne pas activer les paiements ou formulaires publics avant validation des autorisations RLS et des documents légaux.