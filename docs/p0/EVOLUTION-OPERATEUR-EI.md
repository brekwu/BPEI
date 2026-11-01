# BPEI — Exploitant au lancement et évolution ultérieure
**Document de préparation P0 — 1er novembre 2026 — non publiable et non contractuel.**

## Décision de principe confirmée par l'exploitant
Le réseau BPEI sera lancé par l'entreprise individuelle existante (régime **micro-entrepreneur**) qui exploite déjà l'activité professionnelle présentée sous le nom **HP Informatique**. BPEI est un **nom commercial envisagé**, pas une seconde société ni une seconde micro-entreprise. La disponibilité du nom, son usage réel et sa déclaration éventuelle au registre national des entreprises doivent être vérifiés.

Ce choix permet de préparer la documentation sans créer une autre structure juridique. Le nom civil de l'entrepreneur individuel (avec la mention **EI**), son adresse professionnelle légalement communicable et son SIREN demeurent les identifiants du professionnel ; les documents commerciaux exigent aussi l'identification correcte de l'établissement, la situation TVA et les mentions légales obligatoires. Ne jamais utiliser simplement « BPEI SAS » ni « HP Informatique société » sans une immatriculation correspondante.

**Inconnues non réglées :** [À COMPLÉTER : nom légal exact de l'EI, numéro SIREN, SIRET de l'établissement, coordonnées professionnelles, situation TVA, activité(s) réellement déclarée(s), disponibilité de BPEI au registre, assurance, médiateur compétent]. Aucune donnée n'est déduite d'un nom de domaine ou d'un profil GitHub.

## Deux changements possibles ultérieurement

### A. Ajouter ou modifier une activité / un nom commercial sans changer d'exploitant
- Vérifier les données actuelles de l'EI dans l'extrait RNE et l'activité exacte déjà enregistrée.
- Si nécessaire, déclarer via le **guichet unique** l'ajout d'une activité d'intermédiation/mise en relation et le nom commercial ou l'enseigne BPEI ; conserver les accusés et vérifier leur traitement.
- Pour une même EI, le **SIREN** de l'entreprise reste le même. Le **SIRET** dépend de l'établissement et peut changer en cas de modification d'établissement ou d'adresse. Vérifier les preuves avant publication.
- Mettre à jour le site, les informations précontractuelles, la politique de confidentialité et les pièces contractuelles ; ne pas effacer les factures et contrats déjà émis.
- Déterminer avec un professionnel la nature fiscale exacte de l'intermédiation, les taux applicables et les seuils cumulés des activités exercées.

### B. Exploiter BPEI par une future société
Le passage à une société **n'est pas un simple changement de nom dans une base de données** : une nouvelle personne morale sera créée et tout ou partie de l'activité pourra devoir être apportée ou cédée selon un montage approprié. Faire confirmer par un expert juridique/comptable les effets sur le patrimoine, les contrats et les clients.

Préparer avant la bascule : immatriculation / numéro SIREN de la société, identité des dirigeants, propriété de la marque et du domaine, nouvelle politique de confidentialité et notifications éventuelles aux personnes concernées, accords partenaires, contrats/devis actifs, continuité de la facturation et numérotation, dettes et créances, assurances, banque, Stripe Connect/KYC, contrats fournisseurs Supabase/Vercel/SMTP et éventuels besoins de transferts de données.

Ne jamais modifier rétrospectivement l'émetteur d'une facture historique. Les périodes juridiques doivent rester traçables, avec un émetteur applicable **au moment de l'opération** et un mécanisme contractuel vérifié pour la transition.

## Point crucial du modèle économique BPEI
Avant le premier encaissement, choisir et documenter : **qui contracte avec le client**, **qui facture l'intervention**, **qui reçoit les fonds**, **qui facture la commission**, **qui supporte les remboursements/contestations**, et l'incidence exacte sur le **chiffre d'affaires** et la TVA de l'EI. Les transferts Stripe ne suffisent pas à décider qui est juridiquement le vendeur.

Le scénario prévu dans le code (technicien indépendant émettant ses documents et BPEI percevant une rémunération de mise en relation) doit être validé dans les contrats et la comptabilité avant activation, en particulier pour le traitement d'éventuels fonds de tiers. Ne pas présumer que seules les commissions sont déclarables dans le régime micro sans examen du circuit effectif.

## Contrôle de publication
Ces informations ne remplacent ni la vérification administrative, ni les textes contractuels finalisés, ni la recette Stripe TEST. **Ne pas publier les brouillons avec des placeholders** ; le garde-fou légal existant dans Supabase doit rester actif.

## Sources officielles à vérifier au moment de la formalité
- https://entreprendre.service-public.gouv.fr/vosdroits/F33339 — cumul d'activités sous une micro-entreprise.
- https://entreprendre.service-public.gouv.fr/vosdroits/F23283 — nom commercial d'entreprise individuelle.
- https://entreprendre.service-public.gouv.fr/vosdroits/F36250 — modifications EI, ajout d'activité / changement d'enseigne / nouveau SIRET si applicable.
- https://entreprendre.service-public.gouv.fr/vosdroits/R61572 — guichet unique pour les formalités.
- https://entreprendre.service-public.gouv.fr/vosdroits/F31808 — identité d'EI et mentions de facturation.
- https://entreprendre.service-public.gouv.fr/vosdroits/F32308 — passage d'EI à société par apport ou cession.
