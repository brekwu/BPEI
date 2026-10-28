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
1. P1.2 — Protection des demandes client contre les abus (limites serveur et modération), tableau de bord complet des missions et incidents.
2. P1.3 — Livraison e-mail transactionnelle, modèles et retries, uniquement après SMTP validé.
3. P1.4 — Recette de bout en bout, performance mobile, accessibilité, supervision et promotion de la version vérifiée.

## Critères de sortie P1.1
- Migration versionnée en GitHub et appliquée dans Supabase.
- Tables avec RLS, accès anonyme interdit, transitions strictement autorisées.
- Compilation et tests automatisés réussis.
- Test avec vrais utilisateurs et notifications effectivement reçues dans l'application : **à faire avant de considérer le lot complètement homologué**.
