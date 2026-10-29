# BPEI — audit de transformation en réseau national indépendant
Date : 29 octobre 2026. Base examinée : `brekwu/BPEI`, branche `feat/mvp-commercial-foundation`, Supabase préproduction `qmbsfmcotnsxsvbigynz`.

## Vision et principe juridique
**BPEI = Bureau des Partenaires et Entrepreneurs de l'Informatique.** Le produit ne doit plus être présenté comme un simple annuaire : c'est une enseigne commune qui accompagne des **entrepreneurs indépendants** en France. La marque ne rend pas ces personnes salariées. Pas de quotas ou horaires imposés, pas de niveau obtenu automatiquement au nombre de missions, aucune couverture nationale affichée sans partenaire effectivement actif.

## État réel du cahier des charges (audit après première tranche)
| Exigence demandée | Base existante et développement effectué | Limites et critères de sortie |
| --- | --- | --- |
| 1. Inscription et validation des techniciens | Auth Supabase, fiches, candidatures, dossiers SIRET/RC Pro déjà existants. Champs formation, expérience, travail à distance et stade professionnel ajoutés. | Activation des inscriptions suspendue jusqu'aux textes juridiques, SMTP et tests réels ; aucun candidat n'existe aujourd'hui. |
| 2. Évaluation et niveaux | **100 questions** (25 par niveau) + réponses protégées par RLS admin. Évaluation écrite/pratique/entretien, note et justification, niveaux Junior/Confirmé/Expert/Master, suspension et autorisation manuelle. | Les tests sont notés par un évaluateur humain, pas passés en autonomie. Étalonnage, formation des évaluateurs et pilotage terrain à réaliser. |
| 3. Zones géographiques | Ville, code postal, rayon déclaré existants ; opt-in public, téléassistance et recherche de partenaires actifs par ville/code postal, compétences vérifiées et SIRET/RC Pro. | Agenda privé de créneaux libres et rendez-vous confirmés par administration réalisé. Pas de calcul réel du rayon km, ni réservation autonome client en temps réel. Référencement local à valider ville par ville. |
| 4. Prospection et prospects | CRM privé avec preuve de base légale, statuts, origine personnelle, dédoublonnage par email/opportunité, autorisation stricte. | Guide 2026 et modèles B2B personnalisables désormais disponibles dans /ressources-prospection. Pas d'envoi de prospection automatisée, d'apport interrégional rémunéré ni de rappels de relance automatiques. |
| 5. Devis et factures | Modules de devis, validation et facture numérotée existants, exigences fiscales renforcées. | Pas d'avoirs ni d'acomptes conformes complets, pas de facture électronique structurée via plateforme agréée, aucun document réel validé. |
| 6. Missions et rémunérations | Gestion de mission et incidents existante. Une proposition de rémunération HT avec origine, frais et part BPEI/technicien est maintenant obligatoire avant acceptation de la mission. | **Le partage contractuel n'est pas relié à Stripe**. Les apports interrégionaux sont désormais contractualisés, proposés et acceptés distinctement, mais non versés. Les barèmes Junior 50/40 €, Confirmé 58/32 €, Expert 64/26 €, Master 70/20 € sur 90 € HT sont illustratifs, non imposés. Origine technicien ~10 % indicatif, à contractualiser. |
| 7. Gestion administrative | Espaces individuels, suivi missions, devis et factures, documents accessibles. | Registre personnel de recettes/dépenses réellement réalisées avec preuve, annulation motivée, export CSV et simulation Urssaf à taux choisi ajouté. Pas de synchronisation bancaire, de déclaration officielle ni de calendrier des échéances administratives. |
| 8. Espace administrateur | Panneaux dossiers, contrôle de justificatifs, niveaux, épreuves, compétences, missions, litiges et rémunération proposés. | Aucun administrateur réel Auth aujourd'hui. Vérifier rôles et fonctionnement avec tests d'identités réelles. |
| 9. Portail national clients | Formulaire d'intervention existant, recherche opt-in exacte par ville/code postal ou distance ajoutée. | Formulaires publics toujours fermés, pas de réservation autonome sur créneau. Les rendez-vous sont confirmés par l'administration ; avis clients avec code à usage unique après mission facturée, consentement de publication et modération créés, mais ni envoyés ni testés avec vrais clients. |
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
- Agenda des disponibilités et réservations internes créé ; compléter géocodage/rayon kilométrique et réservations client autonomes sans chevauchement.
- Guide moderne de prospection et modèles disponibles ; compléter les rappels de relances et outils anti-spam sans prospection automatique abusive.
- Comptabilité simplifiée créée (journal privé, simulation de charges au taux choisi et CSV) ; compléter les rapprochements, échéances et exports comptables structurés, sans jamais prétendre effectuer une déclaration officielle.
- Acomptes, avoirs, annulations, suivi des remboursements et émission de factures électroniques via opérateur adapté.
- Avis clients avec preuve d'intervention facturée et code unique créés ; compléter rétractation du consentement autonome, signalements, suivi qualité, mentorat et promotions motivées.

## Priorité P2 — développement national
- Partenariats régionaux ; attribution contractuelle d'un apporteur distinct désormais créée, avec accord séparé, mais facturation/versement des commissions non réalisé.
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

## Tranche de finalisation du 29 octobre — 65 migrations

Quatre migrations supplémentaires (**62 à 65**) sont appliquées : disponibilités privées et réservations sans conflit, avis clients issus d'interventions terminées facturées avec code à usage unique et modération, retrait documenté et statistiques publiques anonymisées, et rémunération de l'apporteur interrégional distinct du prestataire exécutant. La fonction Edge `bpei-customer-review` est déployée en mode fermé, et les espaces administrateur et indépendant affichent les commandes correspondantes. **Tout cela reste de la préproduction sans aucun compte, créneau, client, invitation, avis ni paiement réel.** Aucune décision juridique ou bancaire n'a été prise au nom du titulaire. La priorité commerciale demeure la réalisation d'un parcours réellement testé sur comptes consentants et le choix documenté du modèle économique BPEI.
