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
- La page est volontairement limitée aux 300 dernières missions : pagination et exports restent à réaliser pour une exploitation à grande échelle.
- Les tests navigateur anonymes ne remplacent pas la recette RLS en présence d'utilisateurs réels ; le portail reste fermé tant que les critères d'ouverture P0 ne sont pas validés.
