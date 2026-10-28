# BPEI — Recette P1 avec de véritables sessions Supabase

## Périmètre

Le script `scripts/p1-live-rls-smoke.mjs` valide les autorisations métier avec des sessions Auth réelles. Il utilise uniquement des opérations en lecture, et ne crée ni compte, ni mission, ni incident, ni publication juridique.

**État initial du 28/10/2026 :** 0 utilisateur Auth, 0 administrateur, 0 mission et 0 incident dans le projet Supabase de préproduction. La recette *ne peut donc pas être exécutée positivement aujourd'hui*. Le script doit échouer de façon explicite si des paramètres manquent.

## Conditions à réunir avant exécution

- Quatre comptes de préproduction autorisés, appartenant à des personnes qui ont accepté de participer aux tests : deux administrateurs BPEI et deux techniciens indépendants. Leurs adresses doivent avoir été confirmées par Supabase Auth.
- Les administrateurs sont réellement enregistrés dans `independent_admins` selon la procédure de bootstrap administrateur déjà documentée.
- Deux missions réelles de préproduction, l'une attribuée au technicien A, l'autre au technicien B, créées dans le respect des contrôles légaux, avec un incident chacun.
- La configuration Auth Hook, SMTP, redirections de confirmation et consentements juridiques a été correctement validée. **N'ouvrez pas les inscriptions publiques pour générer des comptes de test.**
- Aucun compte tiers, client réel ou dossier de production n'est utilisé à des fins de test sans autorisation.

## Variables requises

Sur l'ordinateur de test ou dans un coffre à secrets de CI, configurer les variables : `P1_SUPABASE_URL`, `P1_SUPABASE_PUBLISHABLE_KEY`, `P1_ADMIN_A_EMAIL`, `P1_ADMIN_A_PASSWORD`, `P1_ADMIN_B_EMAIL`, `P1_ADMIN_B_PASSWORD`, `P1_TECH_A_EMAIL`, `P1_TECH_A_PASSWORD`, `P1_TECH_B_EMAIL`, `P1_TECH_B_PASSWORD`, `P1_INCIDENT_A_ID`, `P1_INCIDENT_B_ID`, `P1_MISSION_A_ID` et `P1_MISSION_B_ID`.

Ne jamais déposer de mots de passe, de clés privées ni de jetons dans GitHub, dans le chat ou dans un fichier versionné. Une clé **publique** Supabase suffit pour le script ; la clé `service_role` ne doit pas être utilisée ici.

## Exécution

Depuis la copie du dépôt contenant les dépendances installées :

```bash
node scripts/p1-live-rls-smoke.mjs
```

Le code de retour 2 indique des variables manquantes ; 1 indique un échec réel d'autorisation, d'authentification ou de configuration ; 0 indique que tous les contrôles de lecture ont réussi.

Les contrôles incluent les quatre connexions, la confirmation des e-mails, la liste croisée des administrateurs, les incidents et missions propres à chaque technicien, l'absence de lecture des dossiers des autres techniciens, l'isolation des boîtes de notifications et le rejet des RPC administrateurs pour les techniciens.

Le script déconnecte les sessions Auth après son exécution. Il ne garantit pas qu'un technicien puisse créer un nouvel incident : ce parcours nécessite une recette de modification distincte et explicitement encadrée. Il ne vérifie pas non plus l'envoi des e-mails SMTP ni la mise en ligne du domaine public.

## Interprétation

- `PASS` : ces contrôles de lecture et de rôle ont réussi avec les quatre vraies sessions et les quatre dossiers attendus.
- `LIVE RLS FAILED` : le lot n'est pas homologué ; corriger avant de fusionner.
- `LIVE RLS NOT RUN` : le test n'a pas démarré, et aucune réussite ne doit être revendiquée.

Pour l'instant, le test SQL transactionnel et les tests navigateur simulés sont réussis, mais le test de sessions réelles reste **non exécuté**. Cette distinction doit rester visible dans le bilan de publication P1.
