# BPEI — audit de transformation en réseau national indépendant
Date : 29 octobre 2026. Base examinée : `brekwu/BPEI`, branche `feat/mvp-commercial-foundation`, Supabase préproduction `qmbsfmcotnsxsvbigynz`.

## Vision et principe juridique
**BPEI = Bureau des Partenaires et Entrepreneurs de l'Informatique.** Le produit ne doit plus être présenté comme un simple annuaire : c'est une enseigne commune qui accompagne des **entrepreneurs indépendants** en France. La marque ne rend pas ces personnes salariées. Pas de quotas ou horaires imposés, pas de niveau obtenu automatiquement au nombre de missions, aucune couverture nationale affichée sans partenaire effectivement actif.

## État réel du cahier des charges (audit après première tranche)
| Exigence demandée | Base existante et développement effectué | Limites et critères de sortie |
| --- | --- | --- |
| 1. Inscription et validation des techniciens | Auth Supabase, fiches, candidatures, dossiers SIRET/RC Pro déjà existants. Champs formation, expérience, travail à distance et stade professionnel ajoutés. | Activation des inscriptions suspendue jusqu'aux textes juridiques, SMTP et tests réels ; aucun candidat n'existe aujourd'hui. |
| 2. Évaluation et niveaux | **100 questions** (25 par niveau) + réponses protégées par RLS admin. Évaluation écrite/pratique/entretien, note et justification, niveaux Junior/Confirmé/Expert/Master, suspension et autorisation manuelle. | Les tests sont notés par un évaluateur humain, pas passés en autonomie. Étalonnage, formation des évaluateurs et pilotage terrain à réaliser. |
| 3. Zones géographiques | Ville, code postal, rayon déclaré existants ; opt-in public, téléassistance et recherche de partenaires actifs par ville/code postal, compétences vérifiées et SIRET/RC Pro. | Pas de calcul réel de rayon km, d'agenda ou de disponibilités en direct. Référencement local à valider ville par ville. |
| 4. Prospection et prospects | CRM privé avec preuve de base légale, statuts, origine personnelle, dédoublonnage par email/opportunité, autorisation stricte. | Pas d'envoi de prospection automatisée, apport interrégional ni rémunération d'apporteur ; programme de relances et modèles à produire. |
| 5. Devis et factures | Modules de devis, validation et facture numérotée existants, exigences fiscales renforcées. | Pas d'avoirs ni d'acomptes conformes complets, pas de facture électronique structurée via plateforme agréée, aucun document réel validé. |
| 6. Missions et rémunérations | Gestion de mission et incidents existante. Une proposition de rémunération HT avec origine, frais et part BPEI/technicien est maintenant obligatoire avant acceptation de la mission. | **Le partage contractuel n'est pas relié à Stripe**. Les barèmes Junior 50/40 €, Confirmé 58/32 €, Expert 64/26 €, Master 70/20 € sur 90 € HT sont illustratifs, non imposés. Origine technicien ~10 % indicatif, à contractualiser. |
| 7. Gestion administrative | Espaces individuels, suivi missions, devis et factures, documents accessibles. | Tableau de CA, dépenses, export, simulation Urssaf paramétrable et échéances administratives non terminés. |
| 8. Espace administrateur | Panneaux dossiers, contrôle de justificatifs, niveaux, épreuves, compétences, missions, litiges et rémunération proposés. | Aucun administrateur réel Auth aujourd'hui. Vérifier rôles et fonctionnement avec tests d'identités réelles. |
| 9. Portail national clients | Formulaire d'intervention existant, recherche opt-in exacte par ville/code postal ou distance ajoutée. | Formulaires publics toujours fermés, pas de réservation autonome sur créneau, profils/avis clients vérifiés encore incomplets. |
| 10. Paiement et facturation testés | Stripe Connect TEST, suivi d'événements et ajustements, PDF email et factures préparés. | Aucun marchand Stripe Connect ni expéditeur réel, aucun e-mail ou paiement réel testé. Le partage illustratif ne correspond pas encore à la structure Stripe test actuelle plafonnée à 25 % et devra être repensé selon le vendeur légal, commissions et TVA. |

## Priorité P0 — indispensable avant une première campagne commerciale
1. Vérifier la structure juridique **réelle** de BPEI, les prestataires vendeurs, les responsabilités et commissions, les CGU/CGV partenaires, la protection RGPD, la médiation et la rétractation B2C. Faire approuver les versions par une personne habilitée.
2. Configurer le SMTP et une vraie identité administratrice confirmée, puis réaliser un test avec deux comptes indépendants : un Junior débutant sans SIRET limité aux ressources/évaluation et un professionnel actif.
3. Vérifier les quatre épreuves humaines, les promotions anticipées/suspensions, les règles d'activation de missions, les compétences validées et les résultats privés.
4. Mettre d'accord l'architecture **facturation/commission/paiement** (qui vend au client, qui facture et encaisse, compte marchand, frais et TVA), en particulier les parts de BPEI qui dépassent le plafond technique Connect TEST actuellement prévu.
5. Finaliser les obligations françaises de facturation (acomptes, avoirs, TVA, numéros et factures électroniques structurées selon taille/statut), l'envoi SMTP/fournisseur et des tests de réception.
6. Tester la création d'un prospect licite, la gestion des doublons, l'attribution, la rémunération chiffrée et son acceptation volontaire avant la mission.
7. Intégrer et tester trois vrais parcours de préproduction : client particulier, client pro, incident/refus/remboursement, avec comptes et identités de démonstration mais **sans faux consentements ni transactions LIVE**.
8. Vérifier sauvegarde/restauration, contrôle des droits, accessibilité mobile et contrat d'hébergement commercial ; fusionner la branche après revue seulement, puis ouvrir les fonctionnalités au public.

## Priorité P1 — outils pour aider les jeunes indépendants
- Agenda des disponibilités et rendez-vous ; matching géographique réel avec géocodage et distances.
- Guide moderne de prospection, modèles modifiables, rappel des relances et protections anti-spam.
- Comptabilité simplifiée : dépenses, recettes, taux de cotisations paramétrables, projections Urssaf et export ; ne jamais prétendre effectuer une déclaration officielle.
- Acomptes, avoirs, annulations, suivi des remboursements et émission de factures électroniques via opérateur adapté.
- Avis clients authentifiés par preuve d'intervention, suivi qualité, mentorat et promotions motivées.

## Priorité P2 — développement national
- Partenariats régionaux, attribution d'un apporteur dans une autre ville avec accord et commission distincte.
- Parcours client de réservation, notifications multicanales, disponibilité réseau et évaluation de satisfaction vérifiée.
- Charte graphique réseau, badges niveaux et supports d'identification uniformes.
- Reporting national par région, rétention et qualité du réseau, expansion seulement où un technicien est actif.

## Mesures de sécurité conservées
- Données du CRM visibles uniquement par leur propriétaire et les administrateurs (RLS) ; pas de prospection automatique ni traitement de contacts sans base légale documentée.
- Réponses du questionnaire **uniquement** accessibles aux administrateurs ; promotion non automatique ; activation professionnelle manuelle.
- Recherche publique strictement filtrée par opt-in, dossier valide et compétence effectivement vérifiée ; aucune identité privée/coordonnée bancaire exposée.
- Les propositions de rémunération doivent être acceptées par le technicien avant l'acceptation d'une nouvelle mission ; aucune rémunération n'est versée par ces RPC.
- Les options d'encaissement TEST, les e-mails et les inscriptions publiques restent désactivées jusqu'à preuves opérationnelles.

**Conclusion :** la première tranche du nouveau réseau est techniquement intégrée sur la branche, mais les fonctions détaillées en P0/P1/P2 ne sont pas toutes homologuées ni commercialement opérationnelles.
