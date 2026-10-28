-- ============================================================
-- 1) IDENTITÉ JURIDIQUE — données confirmées Hugo Pavio / BPEI
-- ============================================================
UPDATE public.platform_legal_settings SET
  legal_name                    = 'Hugo Pavio',
  commercial_name               = 'BPEI — Boutiques Professionnelles d''Experts Informatiques',
  legal_form                    = 'Entrepreneur individuel (micro-entrepreneur)',
  capital_amount                = NULL,
  registered_office_address     = '142 rue de Rivoli',
  registered_office_postal_code = '75001',
  registered_office_city        = 'Paris',
  registered_office_country     = 'France',
  siren                         = '105 370 001',
  siret                         = '105 370 001 00015',
  rcs_city                      = NULL,
  rne_registration              = NULL,
  vat_number                    = NULL,
  professional_email            = 'contact@bpei.fr',
  professional_phone            = NULL,
  publication_director_name     = 'Hugo Pavio',
  legal_representative_name     = 'Hugo Pavio',
  hosting_provider_name         = NULL,
  hosting_provider_address      = NULL,
  hosting_provider_phone        = NULL,
  hosting_provider_website      = NULL,
  privacy_contact_email         = 'confidentialite@bpei.fr',
  data_protection_officer_name  = NULL,
  data_protection_officer_email = NULL,
  complaint_email               = 'reclamations@bpei.fr',
  support_email                 = 'support@bpei.fr',
  mediator_name                 = NULL,
  governing_law                 = 'Droit français',
  updated_at                    = now(),
  updated_by                    = '1a2c66dc-e634-4873-8c48-e786417fb2d3'
WHERE singleton = TRUE;

-- ============================================================
-- 2) RÉDACTION + PUBLICATION DES DOCUMENTS
-- ============================================================
DO $$
DECLARE
  owner_id uuid := '1a2c66dc-e634-4873-8c48-e786417fb2d3';
  today date := CURRENT_DATE;
  rec RECORD;
  docs jsonb := jsonb_build_array(
    jsonb_build_object('code','website_terms','title','Conditions générales d''utilisation du site bpei.fr','summary','Conditions d''utilisation du site public bpei.fr et des espaces associés.','content',
$md$# Conditions générales d''utilisation du site bpei.fr

## 1. Objet
Les présentes conditions régissent l''accès et l''utilisation du site bpei.fr, édité par Hugo Pavio (BPEI — Boutiques Professionnelles d''Experts Informatiques), entrepreneur individuel immatriculé sous le SIREN 105 370 001, dont le siège est situé 142 rue de Rivoli, 75001 Paris (France).

## 2. Public visé
Le site s''adresse au grand public à des fins d''information, aux professionnels souhaitant candidater au réseau BPEI, et aux boutiques et intervenants disposant d''un compte BPEI.

## 3. Nature du service
BPEI est un logiciel en mode SaaS et un réseau professionnel de boutiques et intervenants indépendants. BPEI n''est pas vendeur des prestations proposées par les boutiques ; chaque boutique demeure indépendante et pleinement responsable de ses prestations, garanties, factures et de sa relation avec ses clients.

## 4. Comptes et accès
Certaines fonctionnalités nécessitent la création d''un compte. L''utilisateur s''engage à fournir des informations exactes, à préserver la confidentialité de ses identifiants et à signaler toute utilisation non autorisée.

## 5. Propriété intellectuelle
La marque BPEI, les contenus éditoriaux, l''interface et le code source du site sont protégés. Toute reproduction, extraction ou réutilisation sans autorisation écrite est interdite. Les contenus déposés par les boutiques restent leur propriété.

## 6. Comportement des utilisateurs
Sont notamment interdits : la fraude, l''usurpation d''identité, la collecte automatisée de données, la publication de contenus illicites, la mise en cause abusive de tiers, toute atteinte à la sécurité du service.

## 7. Disponibilité du service
BPEI met en œuvre les moyens raisonnables pour assurer la disponibilité du site. Aucune disponibilité absolue n''est garantie ; des interruptions pour maintenance ou incident peuvent survenir.

## 8. Responsabilité
BPEI ne peut être tenu responsable des contenus publiés par des tiers, du comportement des boutiques indépendantes ni des dommages indirects. Aucun chiffre d''affaires ni nombre de clients n''est garanti aux boutiques.

## 9. Modifications
Les présentes conditions peuvent être modifiées ; la version applicable est celle en ligne à la date d''utilisation. Toute évolution substantielle fait l''objet d''une nouvelle version datée et versionnée.

## 10. Droit applicable
Les présentes conditions sont régies par le droit français. Tout litige est soumis aux règles de compétence légalement applicables.
$md$),
    jsonb_build_object('code','subscription_terms','title','Conditions d''abonnement BPEI (professionnels)','summary','Contrat d''abonnement B2B au logiciel et au réseau BPEI.','content',
$md$# Conditions d''abonnement BPEI (professionnels)

## 1. Objet
Les présentes conditions régissent la souscription par un professionnel à une offre d''abonnement BPEI (SaaS et réseau) proposée par Hugo Pavio (BPEI), SIREN 105 370 001.

## 2. Public
L''offre est strictement réservée aux professionnels au sens du Code de commerce. Aucun contrat n''est conclu avec un consommateur au sens du Code de la consommation.

## 3. Formation du contrat
Le contrat est formé par l''acceptation des présentes conditions et la souscription en ligne. Le client déclare disposer de la capacité juridique pour engager sa structure.

## 4. Périodicité et prix
Les abonnements sont mensuels ou annuels. Les prix sont affichés hors taxes. La TVA est ajoutée le cas échéant conformément à la réglementation applicable.

## 5. Renouvellement
Sauf résiliation, l''abonnement se renouvelle tacitement à échéance selon la périodicité souscrite.

## 6. Résiliation
Le client peut résilier à tout moment depuis son espace ou par écrit ; la résiliation prend effet à la fin de la période en cours. Aucun remboursement au prorata n''est dû, sauf disposition légale contraire.

## 7. Suspension et impayés
En cas d''impayé ou de manquement grave, BPEI peut suspendre l''accès après notification. L''espace passe en lecture seule ; les données restent exportables pendant 30 jours après fin d''abonnement.

## 8. Propriété et export des données
Les données saisies par le client dans son espace lui appartiennent. Un export au format standard est mis à disposition à la demande et pendant les 30 jours suivant la fin d''abonnement.

## 9. Support
BPEI fournit un support par courriel à l''adresse indiquée dans les conditions applicables à l''offre. Aucun engagement de niveau de service (SLA) n''est souscrit sauf mention contractuelle expresse.

## 10. Indépendance des boutiques
Chaque boutique demeure indépendante. BPEI ne se substitue pas à elle dans ses obligations à l''égard de ses propres clients.

## 11. Absence de garantie commerciale
Aucun chiffre d''affaires, nombre de clients ou exclusivité géographique n''est garanti par la souscription à un abonnement.

## 12. Responsabilité
La responsabilité de BPEI est limitée, dans la mesure permise par la loi, au montant hors taxes payé par le client au titre des 12 mois précédant le fait générateur.

## 13. Sécurité
BPEI met en œuvre des mesures techniques et organisationnelles pour protéger les données. Le détail sensible de l''architecture n''est pas diffusé publiquement.

## 14. Modifications
BPEI peut faire évoluer les présentes conditions ; toute évolution substantielle donne lieu à une nouvelle version, notifiée avec préavis raisonnable.

## 15. Droit applicable et juridiction
Le contrat est régi par le droit français. Tout litige est soumis aux règles de compétence légalement applicables entre professionnels.
$md$),
    jsonb_build_object('code','cookie_policy','title','Politique cookies et traceurs','summary','Traceurs utilisés sur bpei.fr et paramétrage du consentement.','content',
$md$# Politique cookies et traceurs

## 1. Traceurs strictement nécessaires
Le site utilise uniquement les traceurs nécessaires à l''authentification (session Supabase Auth), à la sécurité (protection anti-abus) et à la conservation des préférences de consentement. Ces traceurs sont exemptés de consentement conformément à la doctrine CNIL.

## 2. Analyse d''audience
Aucun traceur d''analyse d''audience tiers n''est actuellement déposé.

## 3. Services externes
Certaines fonctionnalités (paiement, cartographie) peuvent, lorsqu''elles sont activées, déposer des traceurs opérés par un prestataire tiers. Ces dépôts n''ont lieu qu''après consentement explicite.

## 4. Publicité
Aucun traceur publicitaire n''est déposé.

## 5. Paramétrage
Un bandeau de gestion des cookies permet, avant tout dépôt non nécessaire, de « Tout accepter », de « Tout refuser » avec une visibilité comparable, ou de personnaliser catégorie par catégorie. Le consentement peut être retiré à tout moment depuis le pied de page.

## 6. Durée de conservation
Les choix de consentement sont conservés au maximum 13 mois.

## 7. Contact
Pour toute question relative aux cookies, contacter confidentialite@bpei.fr.
$md$),
    jsonb_build_object('code','seller_rules','title','Règles applicables aux boutiques du réseau','summary','Obligations des boutiques indépendantes membres du réseau BPEI.','content',
$md$# Règles applicables aux boutiques du réseau BPEI

## 1. Statut
Chaque boutique du réseau BPEI est une entreprise indépendante disposant de sa propre immatriculation, de sa propre facturation et de ses propres garanties. BPEI n''est ni employeur, ni mandataire, ni vendeur.

## 2. Loyauté commerciale
La boutique s''engage à des pratiques commerciales loyales : prix affichés, devis et factures conformes, information claire sur les délais et garanties, respect des droits des consommateurs pour ses propres clients.

## 3. Qualité et compétence technique
La boutique s''engage à ne proposer que des prestations pour lesquelles elle dispose des compétences, du matériel et des autorisations nécessaires.

## 4. Sécurité et confidentialité
La boutique protège les données de ses clients, notamment les données présentes sur les appareils reçus en réparation, et respecte le secret professionnel.

## 5. Utilisation du logiciel BPEI
La boutique utilise le logiciel BPEI conformément aux conditions d''abonnement et n''utilise pas les fonctionnalités bloquées (commissions, contrats d''exclusivité, traitement de données sensibles) tant qu''elles ne sont pas ouvertes contractuellement.

## 6. Respect des règles réseau
La boutique respecte la charte réseau, la politique de modération, la politique des avis et les règles du badge vérifié.

## 7. Suspension
En cas de manquement grave, BPEI peut suspendre l''accès à la plateforme selon la politique de suspension ; la boutique dispose d''un droit de recours.
$md$),
    jsonb_build_object('code','review_policy','title','Politique des avis clients','summary','Recueil, publication et modération des avis.','content',
$md$# Politique des avis clients

## 1. Origine des avis
Les avis publiés sur BPEI proviennent de clients ayant effectivement bénéficié d''une prestation d''une boutique du réseau, sollicités via un lien nominatif associé à une commande, une réparation ou un devis validé.

## 2. Vérification
Chaque avis est associé à une transaction traçable. Les avis anonymes non rattachables ne sont pas publiés.

## 3. Modération
Les avis sont publiés après contrôle automatique et, le cas échéant, examen humain. Sont refusés les avis contenant des injures, des données personnelles de tiers, des propos discriminatoires, des contenus manifestement illicites ou hors sujet.

## 4. Droit de réponse
La boutique concernée dispose d''un droit de réponse public, dans les mêmes conditions de modération.

## 5. Signalement
Tout utilisateur peut signaler un avis via le formulaire dédié. Un examen est réalisé dans un délai raisonnable.

## 6. Suppression
Un avis peut être supprimé s''il enfreint les règles ci-dessus, si son auteur en fait la demande, ou sur décision motivée de BPEI.

## 7. Note globale
Les notes globales des boutiques sont recalculées à partir des seuls avis publiés et non retirés.
$md$),
    jsonb_build_object('code','moderation_policy','title','Politique de modération','summary','Règles de modération des contenus publiés sur BPEI.','content',
$md$# Politique de modération

## 1. Contenus concernés
La présente politique s''applique à l''ensemble des contenus publiés sur BPEI : fiches boutiques, catalogues, avis, messages, signalements.

## 2. Contenus interdits
Sont notamment interdits : les contenus manifestement illicites (haine, discrimination, apologie, atteinte aux mineurs), les atteintes aux droits de tiers (propriété intellectuelle, vie privée, droit à l''image), les pratiques trompeuses, les tentatives de contournement de la plateforme.

## 3. Moyens de modération
BPEI combine des contrôles automatiques (règles, filtres) et un examen humain lorsque nécessaire. La modération peut intervenir a priori (avant publication) ou a posteriori (après signalement).

## 4. Mesures
Selon la gravité, BPEI peut retirer un contenu, restreindre sa visibilité, avertir l''auteur, suspendre un compte, ou déférer aux autorités compétentes.

## 5. Notification
L''auteur d''un contenu retiré ou restreint est informé, avec les motifs, sauf lorsque cette information nuirait à une enquête ou serait manifestement inutile.

## 6. Recours
L''auteur dispose d''une voie de recours interne via le formulaire de contact ; BPEI répond dans un délai raisonnable.

## 7. Coopération avec les autorités
BPEI coopère avec les autorités judiciaires et administratives dans les conditions prévues par la loi.
$md$),
    jsonb_build_object('code','ranking_policy','title','Politique de classement de l''annuaire','summary','Critères de tri et de mise en avant dans l''annuaire des boutiques.','content',
$md$# Politique de classement de l''annuaire BPEI

## 1. Principe
L''annuaire BPEI présente les boutiques du réseau selon des critères objectifs et explicités. Aucun classement payant occulte n''est pratiqué.

## 2. Critères par défaut
Par défaut, les résultats sont classés selon une combinaison de : pertinence géographique par rapport à la recherche de l''utilisateur, statut de la boutique (active, vérifiée), complétude de la fiche, note moyenne issue des avis vérifiés, ancienneté et activité récente sur la plateforme.

## 3. Filtres
L''utilisateur peut modifier le classement (proximité, note, spécialité). Les filtres appliqués sont clairement affichés.

## 4. Boutiques suspendues ou non vérifiées
Les boutiques suspendues n''apparaissent pas. Les boutiques non vérifiées peuvent apparaître avec une mention distinctive.

## 5. Modifications
Les critères peuvent évoluer ; toute évolution substantielle donne lieu à une nouvelle version datée de la présente politique.
$md$),
    jsonb_build_object('code','reporting_policy','title','Politique de signalement (DSA)','summary','Procédure de signalement de contenus ou boutiques.','content',
$md$# Politique de signalement

## 1. Qui peut signaler
Tout utilisateur peut signaler un contenu, une boutique ou un comportement qu''il estime contraire à la loi ou aux règles de la plateforme, via le formulaire dédié.

## 2. Informations demandées
Le formulaire recueille : la nature du signalement, une description suffisamment précise, l''URL ou l''identifiant du contenu concerné, une déclaration de bonne foi et, facultativement, les coordonnées du signalant.

## 3. Traitement
BPEI examine chaque signalement dans un délai raisonnable. Un signalement manifestement abusif peut être écarté ; les abus répétés peuvent faire l''objet de mesures.

## 4. Mesures possibles
Retrait du contenu, restriction de visibilité, avertissement, suspension, ou absence de mesure motivée. Le signalant est informé des suites lorsque cela est possible.

## 5. Recours
La personne dont le contenu est retiré peut contester la décision via un recours interne.

## 6. Autorités
BPEI coopère avec les autorités compétentes conformément à la loi.
$md$),
    jsonb_build_object('code','complaint_policy','title','Procédure de réclamation','summary','Comment adresser une réclamation à BPEI.','content',
$md$# Procédure de réclamation

## 1. Périmètre
La présente procédure concerne les réclamations relatives à l''utilisation du logiciel et du site BPEI. Les réclamations relatives à une prestation effectuée par une boutique doivent être adressées en premier lieu à la boutique concernée, qui reste seule responsable de sa prestation.

## 2. Comment réclamer
Toute réclamation peut être adressée par courriel à reclamations@bpei.fr, ou via le formulaire de contact. Elle doit préciser l''identité du réclamant, l''objet de la réclamation et, le cas échéant, les éléments justificatifs.

## 3. Accusé de réception
Un accusé de réception est adressé sous un délai raisonnable après réception.

## 4. Traitement
BPEI examine la réclamation et apporte une réponse motivée dans un délai raisonnable, en principe sous 30 jours.

## 5. Recours
En cas de désaccord persistant, chacun peut faire valoir ses droits selon les voies légales applicables. Aucun médiateur de la consommation n''est désigné pour les contrats professionnels souscrits directement auprès de BPEI.
$md$),
    jsonb_build_object('code','verified_badge_rules','title','Règles du badge « Boutique vérifiée »','summary','Conditions d''attribution, de suspension et de retrait du badge.','content',
$md$# Règles du badge « Boutique vérifiée »

## 1. Objet
Le badge « Boutique vérifiée » atteste qu''une boutique a transmis certains justificatifs à BPEI et qu''elle est active sur la plateforme. Il ne constitue ni une garantie de résultat, ni une certification indépendante, ni une caution quant à la qualité individuelle d''une prestation.

## 2. Conditions d''attribution
- Immatriculation professionnelle valide (SIREN ou équivalent).
- Fiche boutique complète (raison sociale, adresse, contact).
- Acceptation de la charte réseau et des règles applicables.
- Absence de manquement grave connu au moment de l''attribution.

## 3. Suspension et retrait
Le badge peut être suspendu ou retiré en cas de manquement grave, d''informations inexactes, de suspension du compte, ou de radiation de la structure.

## 4. Transparence
Les critères ci-dessus sont publics. La liste des boutiques disposant du badge est visible dans l''annuaire.

## 5. Recours
Une boutique dont le badge est retiré peut demander un réexamen dans les 30 jours.
$md$),
    jsonb_build_object('code','directory_admission','title','Règles d''admission à l''annuaire','summary','Conditions d''admission et de maintien dans l''annuaire BPEI.','content',
$md$# Règles d''admission à l''annuaire BPEI

## 1. Candidature
Toute structure professionnelle exerçant une activité compatible avec le réseau BPEI peut candidater via le formulaire prévu.

## 2. Justificatifs
La candidature comporte : identité de la structure, immatriculation, coordonnées, description de l''activité, éventuels justificatifs complémentaires demandés.

## 3. Examen
BPEI examine chaque candidature. Le refus est motivé ; il n''ouvre pas droit à indemnité.

## 4. Maintien
Le maintien dans l''annuaire suppose le respect continu des règles réseau, la mise à jour de la fiche et l''absence de suspension.

## 5. Retrait
BPEI peut retirer une boutique de l''annuaire en cas de manquement grave, d''inactivité prolongée ou à la demande de la boutique elle-même.
$md$),
    jsonb_build_object('code','marketplace_information','title','Information marketplace (transparence P2B)','summary','Informations de transparence pour les professionnels utilisateurs de la plateforme.','content',
$md$# Information marketplace — Transparence

## 1. Nature du service
BPEI met à disposition un logiciel de gestion et un annuaire de boutiques indépendantes. BPEI n''est pas partie aux contrats conclus entre les boutiques et leurs clients.

## 2. Accès et conditions
L''accès professionnel est conditionné à la souscription d''une offre d''abonnement et à l''acceptation des règles réseau. Les critères d''admission et de suspension sont publics.

## 3. Classement
Les résultats de l''annuaire sont classés selon la politique de classement publique. Aucun classement payant occulte n''est pratiqué.

## 4. Données
La boutique reste propriétaire des données saisies dans son espace. Un export est mis à disposition à sa demande et dans les 30 jours suivant la fin d''abonnement.

## 5. Communication
Toute évolution substantielle des règles applicables aux boutiques donne lieu à une notification préalable dans un délai raisonnable.

## 6. Différends
Les modalités de traitement des différends sont décrites dans la procédure de réclamation.
$md$),
    jsonb_build_object('code','functional_annex','title','Annexe fonctionnelle','summary','Périmètre fonctionnel du logiciel BPEI à la date de publication.','content',
$md$# Annexe fonctionnelle

## 1. Modules disponibles
- Gestion des clients, appareils et réparations.
- Devis, factures et avoirs numérotés.
- Catalogue de services et de produits.
- Stock et achats.
- Portail client (suivi de réparation, devis en ligne).
- Messagerie liée aux commandes.
- Rendez-vous et disponibilités.
- Notifications transactionnelles.
- Annuaire public et fiche boutique.

## 2. Modules en phase de test
- Encaissement par TPE Stripe Terminal (mode test uniquement à la date de publication). L''ouverture en production sera annoncée dans une nouvelle version de la présente annexe.

## 3. Modules bloqués
Les modules suivants ne sont pas ouverts et ne le seront qu''après cadre contractuel spécifique :
- Commissions plateforme.
- Contrats d''exclusivité.
- Traitement de données sensibles.

## 4. Évolutions
La liste des modules peut évoluer. Chaque évolution substantielle donne lieu à une nouvelle version datée.
$md$),
    jsonb_build_object('code','payment_link_terms','title','Conditions des liens de paiement','summary','Conditions applicables aux liens de paiement générés par les boutiques.','content',
$md$# Conditions des liens de paiement

## 1. Nature
Un lien de paiement est un moyen mis à disposition de la boutique pour permettre à un client de régler une somme. Le paiement est traité par le prestataire de paiement de la boutique (Stripe Connect) ; BPEI n''encaisse pas les fonds.

## 2. Génération
La boutique génère un lien depuis son espace pour un montant, un objet et, le cas échéant, un client identifié. Elle est responsable de l''exactitude des informations.

## 3. Sécurité
Le lien contient un identifiant unique. Il expire selon les paramètres de la boutique. Il ne doit pas être transmis à un tiers non autorisé.

## 4. Rétractation et remboursement
Les règles de rétractation et de remboursement relèvent de la relation entre la boutique et son client. BPEI n''est pas partie à cette relation.

## 5. Sécurité des paiements
Le respect des règles PCI-DSS relève du prestataire de paiement. Aucune donnée bancaire n''est stockée par BPEI.
$md$)
  );
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(docs)
  LOOP
    UPDATE public.legal_documents
       SET status = 'archived', archived_at = now(), updated_at = now()
     WHERE document_code = rec.value->>'code'
       AND language = 'fr'
       AND scope = 'platform'
       AND status = 'published';

    UPDATE public.legal_documents
       SET title          = rec.value->>'title',
           summary        = rec.value->>'summary',
           content        = rec.value->>'content',
           status         = 'published',
           effective_date = today,
           published_at   = now(),
           published_by   = owner_id,
           content_hash   = encode(sha256(convert_to(rec.value->>'content','UTF8')), 'hex'),
           updated_at     = now()
     WHERE document_code = rec.value->>'code'
       AND language = 'fr'
       AND scope = 'platform'
       AND status = 'draft'
       AND version = 1;

    IF NOT FOUND THEN
      INSERT INTO public.legal_documents (
        document_code, title, audience, scope, language, version, status, content,
        content_hash, summary, effective_date, published_at, published_by,
        requires_acceptance, created_by, created_at, updated_at
      )
      SELECT rec.value->>'code',
             rec.value->>'title',
             'public',
             'platform',
             'fr',
             COALESCE((SELECT MAX(version) FROM public.legal_documents WHERE document_code = rec.value->>'code' AND language = 'fr' AND scope = 'platform'), 0) + 1,
             'published',
             rec.value->>'content',
             encode(sha256(convert_to(rec.value->>'content','UTF8')), 'hex'),
             rec.value->>'summary',
             today,
             now(),
             owner_id,
             FALSE,
             owner_id,
             now(),
             now()
      WHERE NOT EXISTS (
        SELECT 1 FROM public.legal_documents
         WHERE document_code = rec.value->>'code'
           AND language = 'fr' AND scope = 'platform' AND status = 'published'
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- 3) DRAFTS BLOQUÉS — motifs consignés
-- ============================================================
UPDATE public.legal_documents
   SET summary = 'DRAFT — bloqué : téléphone professionnel BPEI et coordonnées exactes de l''hébergeur (raison sociale, adresse, téléphone) requises avant publication.',
       updated_at = now()
 WHERE document_code = 'legal_notice' AND status = 'draft';

UPDATE public.legal_documents
   SET summary = 'DRAFT — bloqué : boîte confidentialite@bpei.fr à provisionner et tester + identification exacte du prestataire d''hébergement avant publication.',
       updated_at = now()
 WHERE document_code = 'privacy_policy' AND status = 'draft';