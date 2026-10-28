# BPEI — Phase P1 : exploitation du réseau de techniciens indépendants

Date : 28 octobre 2026. Branche isolée : `feat/p1-mission-operations`.
Aucune migration de boutiques ou comptes de l'ancien outil n'est prévue.

## Lot P1.1 — Missions et incidents (développé en préproduction)
- Un indépendant peut signaler un problème sur une mission acceptée ou en cours.
- Catégories : client injoignable, difficulté technique, sécurité, autre.
- Limites anti-abus en base : au maximum 3 signalements par technicien sur 24 heures et un seul incident non résolu par mission.
- Seuls l'auteur et les administrateurs peuvent lire l'incident (RLS).
- Un administrateur peut prendre en charge puis résoudre avec un compte rendu.
- Notifications internes lors des attributions, des changements de statut et du traitement des incidents.
- Les notifications sont visibles uniquement par leur destinataire, qui peut les marquer comme lues.

## Limites et recette restant à valider
- Tests unitaires, typage, compilation et parcours navigateur simulés exécutés par GitHub Actions. Aucun test métier complet en conditions réelles tant que le portail reste sans administrateur et sans comptes confirmés.
- L'envoi d'e-mails, les SMS et les notifications push ne font **pas** partie des notifications internes implémentées.
- Les politiques RLS doivent encore être testées de bout en bout avec deux comptes distincts et un administrateur réel.
- Le déclenchement des notifications et le cycle complet d'incident doivent être testés sur de véritables missions en préproduction.
- La nouvelle branche ne doit pas être fusionnée ni mise sur `bpei.fr` avant la recette P0/P1.

## Lots suivants
1. P1.2 — Protection anti-doublon et plafond de cinq demandes par adresse e-mail sur 24 h : **développés en base**. La modération, l’analyse des abus par adresse réseau et les tests réels restent à faire. Tableau de bord des demandes déjà disponible.
2. P1.3 — Livraison e-mail transactionnelle, modèles et retries, uniquement après SMTP validé.
3. P1.4 — Recette de bout en bout, performance mobile, accessibilité, supervision et promotion de la version vérifiée.

## Critères de sortie P1.1
- Migration versionnée en GitHub et appliquée dans Supabase.
- Tables avec RLS, accès anonyme interdit, transitions strictement autorisées.
- Compilation et tests automatisés réussis.
- Test avec vrais utilisateurs et notifications effectivement reçues dans l'application : **à faire avant de considérer le lot complètement homologué**.

## Mise à jour du 28/10/2026

- Migration `20261028172500` : rejet des doublons identiques pendant 10 minutes et limitation à 5 demandes par e-mail sur une fenêtre de 24 heures.
- Ce garde-fou est un premier contrôle côté serveur et ne constitue pas une solution complète contre le spam (adresses e-mail jetables, robots distribués).
- Aucune réouverture de `bpei_intake_flags` n'a été effectuée.

## Lot P1.2 — Suivi détaillé des missions (développé)

- Migration `20261028172750` : table append-only `bpei_mission_events`, historisation automatique des transitions et état initial des missions existantes (sans inventer de transitions antérieures).
- Le technicien peut consulter l'historique de ses missions depuis `/espace-independant`.
- L'administrateur dispose d'un tableau `/gestion-missions` avec recherche, filtres de statuts, dates et historique par mission.
- La lecture SQL est réservée au technicien désigné et aux administrateurs, et aucun droit direct d'insertion ou de modification n'est accordé aux comptes utilisateurs.
- Le tableau `/gestion-missions` utilise désormais 25 missions par page, recherche par titre de mission ou technicien et filtres exécutés en base. Les tests avec de vrais comptes, les exports et la supervision opérationnelle restent à valider.
- Les tests navigateur anonymes ne remplacent pas la recette RLS en présence d'utilisateurs réels ; le portail reste fermé tant que les critères d'ouverture P0 ne sont pas validés.

## Lot P1.3 — Recherche globale et supervision des missions (intégré en préproduction)

- Migration `20261028173402` : procédure `bpei_admin_search_missions` contrôlant explicitement le rôle administrateur. L'API renvoie des dossiers paginés et les décomptes calculés sur l'ensemble des données correspondantes, pas seulement sur la page chargée.
- Filtres par statut et recherche côté serveur sur le titre et le nom du technicien, sans plafond artificiel de 300 missions.
- Supervision des missions nécessitant une attention : incident en cours, rendez-vous dépassé, proposition sans réponse après 24 heures.
- Requêtes bornées à 50 résultats et 10 000 lignes de décalage au niveau SQL ; interface utilisant des pages de 25 missions.
- Les politiques RLS restent appliquées, l'accès anonyme à la fonction est révoqué, et la fonction est SECURITY INVOKER.
- Le test navigateur utilise une authentification et des réponses RPC simulées. La recette multi-comptes sur de vraies missions reste obligatoire.
- Aucune fusion dans la branche principale ni ouverture de `bpei.fr`.

## Lot P1.4 — Escalades et affectation des incidents (développé)

- Migration Supabase `20261028174135` : priorité basse/normale/haute/critique, responsable administrateur autorisé, échéance **indicative** de suivi, journal des changements immuable côté application.
- Le tableau `/gestion-incidents` permet de filtrer les dossiers actifs, non attribués, en retard, personnels ou résolus.
- Un administrateur peut justifier un changement de priorité (10 à 500 caractères), affecter l'incident à lui-même ou à un autre administrateur, et retirer une affectation.
- Une escalade critique et une nouvelle affectation génèrent des notifications dans l'application. L'historique conserve l'état de chaque modification.
- Aucune modification directe des priorités et affectations depuis les clients : les changements passent par des fonctions SQL vérifiant l'appartenance à `independent_admins`.
- Les échéances sont des objectifs de traitement internes, sans promesse contractuelle de délai de réponse.
- Limites : recettes avec deux administrateurs et un technicien réel à exécuter, aucun envoi d'e-mail ni SMS, et absence de publication de la branche P1 sur le domaine public.

## Lot P1.5 — Statistiques et rapports des incidents (développement intégré)

- Migration `20261028175007` : agrégats SQL pour 7, 30 ou 90 jours par **date de création** des incidents : volumes par statut/priorité, dossiers sans responsable, échéances dépassées, incidents critiques et moyenne des heures jusqu'à la résolution.
- L'API de statistiques nécessite un compte présent dans `independent_admins`, reste SECURITY INVOKER et sans permission d'exécution pour `anon`. Aucun tableau public n'expose ces données.
- Le tableau `/gestion-incidents` présente les chiffres agrégés et les changements de période, puis un export CSV déclenché par l'administrateur connecté. Export limité à 1 000 lignes, par paquets de 250, sans envoi serveur externe.
- Les cellules CSV sont protégées contre l'injection de formules de tableur. Les exports contiennent des données professionnelles confidentielles et doivent être conservés/partagés avec précaution.
- Chaque incident résolu dispose d'un rapport texte téléchargeable : description, résolution, priorité, échéance interne et chronologie des décisions (jusqu'à 499 événements).
- Limites : tests réels Auth/RLS avec comptes distincts et validation opérationnelle des rapports encore nécessaires ; aucun SMTP, aucune publication `bpei.fr`, aucune mise en production P1.

## Lot P1.6 — Séparation des comptes et sécurité RLS

Vérifié le 28 octobre 2026 en préproduction :

- Supabase : migration `20261028175736` appliquée pour permettre à deux administrateurs autorisés de consulter leur liste réciproque et d'affecter un incident. Les techniciens ne voient pas ce registre.
- Test transactionnel SQL exécuté avec 2 administrateurs fictifs, 2 techniciens fictifs, 2 missions et 2 incidents. Un seul contrôle de création des missions a été suspendu **à l'intérieur de cette transaction de test uniquement** afin de ne pas simuler une fausse publication juridique. L'ensemble a été annulé par ROLLBACK.
- Assertions réussies : chaque technicien ne voit que ses propres missions, incidents, journaux et notifications ; les administrateurs voient les incidents des deux techniciens et peuvent affecter un dossier entre eux ; les RPC administratifs refusent les techniciens.
- Après test : 0 utilisateur, 0 administrateur, 0 mission, 0 incident, 0 événement ou notification persistants.
- Test SQL non destructif réutilisable : `tests/p1-db-permissions.sql`. Test navigateur supplémentaire d'un technicien connecté sans rôle administrateur : `scripts/browser-p1-role-isolation-smoke.mjs`.
- La migration 37 **n'est pas encore présente sous forme de fichier SQL dans GitHub**, bien qu'elle soit appliquée à Supabase. Il reste à synchroniser ce fichier avant toute reconstruction ou fusion. Les 36 fichiers de migration présents dans le dépôt ne reproduisent pas intégralement la base actuelle.
- Cette recette ne constitue pas la validation P0 : aucune inscription e-mail réelle, aucun compte administrateur réel, aucun SMTP ni activation du hook Auth vérifiée. Ne pas ouvrir `bpei.fr` ni les inscriptions.
