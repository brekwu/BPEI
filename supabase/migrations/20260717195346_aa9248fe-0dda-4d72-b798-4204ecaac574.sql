UPDATE public.legal_documents
SET content = $BETA$# Conditions de la bêta — {{BPEI_LEGAL_NAME}}

> **Modèle préparatoire — brouillon non publié.** Ce document doit être relu par un conseil juridique avant publication.

## 1. Objet
Le présent document définit les conditions d'accès et d'utilisation de la version bêta de la plateforme {{BPEI_NAME}} exploitée par {{BPEI_LEGAL_NAME}} (SIREN {{BPEI_SIREN}}).

## 2. Accès
L'accès à la bêta est réservé aux professionnels dont la candidature a été acceptée par BPEI. Aucune ouverture publique automatique.

## 3. Durée
La bêta prend fin à la date paramétrable {{BETA_END_DATE}}. Cette date peut être avancée ou reportée par BPEI moyennant préavis raisonnable.

## 4. Absence de conversion automatique
À la fin de la bêta, aucune souscription payante ne sera activée automatiquement. Un consentement explicite du professionnel sera requis pour tout passage à une offre payante.

## 5. Fonctions expérimentales
Certaines fonctions sont expérimentales. Elles peuvent être modifiées, restreintes ou retirées sans préavis, sans que cela ouvre droit à indemnisation.

## 6. Retours
Le professionnel s'engage à signaler dans un délai raisonnable les anomalies rencontrées via {{SUPPORT_EMAIL}} ou le formulaire /signaler-bug.

## 7. Disponibilité
BPEI met en œuvre des moyens raisonnables pour assurer la disponibilité du service, sans engagement de niveau de service pendant la bêta.

## 8. Sécurité
BPEI applique les mesures techniques et organisationnelles décrites dans l'Annexe sécurité (document `security_annex`).

## 9. Données
Le traitement des données à caractère personnel relève de la Politique de confidentialité et de l'Accord de sous-traitance RGPD (`dpa`).

## 10. Export
Le professionnel peut, à tout moment, demander l'export de ses données via /demande-donnees selon la Procédure d'export et de suppression (`data_export_deletion_procedure`).

## 11. Fin de bêta
À l'échéance {{BETA_END_DATE}}, BPEI communiquera au professionnel les modalités d'archivage, d'export et de bascule éventuelle vers une offre payante.

## 12. Suspension
BPEI peut suspendre l'accès d'un professionnel selon la Politique de suspension et de résiliation (`suspension_policy`).

## 13. Passage vers une offre payante
Le passage vers une offre payante requiert l'acceptation explicite du contrat SaaS (`saas_subscription_contract`) et de l'annexe d'abonnement correspondante.

## 14. Acceptation
La poursuite de l'utilisation de la plateforme après notification vaut acceptation des présentes conditions.

---
_Variables : {{BPEI_LEGAL_NAME}}, {{BPEI_NAME}}, {{BPEI_SIREN}}, {{BETA_END_DATE}}, {{SUPPORT_EMAIL}}._
$BETA$
WHERE document_code = 'beta_terms' AND version = 1;

UPDATE public.legal_documents
SET content = $SUSP$# Politique de suspension et de résiliation — {{BPEI_LEGAL_NAME}}

> **Modèle préparatoire — brouillon non publié.** Ce document doit être relu par un conseil juridique avant publication. Les délais chiffrés (par exemple 48 h, 7 jours) sont indicatifs et devront être arrêtés lors de la revue juridique.

## 1. Objet
Le présent document décrit les cas et modalités de suspension et de résiliation applicables aux professionnels et aux structures inscrits sur {{BPEI_NAME}}.

## 2. Suspension de sécurité
En cas de menace immédiate pour la sécurité de la plateforme, des utilisateurs ou des données, BPEI peut suspendre immédiatement l'accès concerné, avec information a posteriori du professionnel.

## 3. Suspension contractuelle
BPEI peut suspendre l'accès en cas de manquement grave ou répété aux conditions contractuelles (SaaS, annexes, charte réseau, règles vendeurs), après tentative de correction préalable lorsque cela est possible.

## 4. Suspension du réseau
Le retrait d'une structure du réseau de partenariats peut être décidé selon les modalités prévues à la Charte du réseau (`network_charter`).

## 5. Correction préalable
Sauf urgence sécurité, BPEI notifie le manquement constaté et invite le professionnel à corriger la situation dans un délai raisonnable {{CORRECTION_DELAY}}.

## 6. Notification
Toute suspension est notifiée par e-mail à l'adresse de contact enregistrée, avec indication du motif, des conséquences opérationnelles et de la voie de recours.

## 7. Observations
Le professionnel dispose d'un délai {{OBSERVATION_DELAY}} pour transmettre ses observations écrites via /suspension-recours.

## 8. Décision
Après examen des observations, BPEI notifie sa décision motivée : levée, maintien, ou résiliation.

## 9. Recours
Le professionnel dispose d'un droit de recours interne via le formulaire /suspension-recours et, si applicable, du recours au médiateur ({{MEDIATOR_NAME}}) selon la Politique de réclamations (`complaint_policy`).

## 10. Résiliation par le professionnel
Le professionnel peut résilier à tout moment sa souscription selon les modalités prévues au contrat SaaS et aux annexes d'abonnement.

## 11. Résiliation par BPEI
BPEI peut résilier en cas de manquement grave non corrigé, de fraude, d'atteinte à la sécurité, ou d'incompatibilité avec la charte du réseau.

## 12. Retrait de la page publique
En cas de suspension ou de résiliation, la page publique de la structure est dépubliée ; l'annuaire est mis à jour.

## 13. Retrait de la marque
L'utilisation de la marque BPEI et du badge Vérifié cesse immédiatement au retrait ; les modalités sont précisées à la Licence de marque (`brand_license`).

## 14. Export
Le professionnel dispose d'un délai raisonnable {{EXPORT_DELAY}} pour exporter ses données selon la Procédure d'export et de suppression (`data_export_deletion_procedure`).

## 15. Conservation
Certaines données sont conservées après résiliation pour respecter les obligations légales (facturation, traçabilité, contentieux) selon les durées documentées à la Politique de confidentialité.

## 16. Suppression
À l'issue des durées de conservation, les données sont supprimées ou anonymisées.

## 17. Obligations restant applicables
Restent applicables après résiliation : les obligations de confidentialité, de sécurité, de non-dénigrement, et de coopération pour l'export.

---
_Variables : {{BPEI_LEGAL_NAME}}, {{BPEI_NAME}}, {{CORRECTION_DELAY}}, {{OBSERVATION_DELAY}}, {{EXPORT_DELAY}}, {{MEDIATOR_NAME}}._
$SUSP$
WHERE document_code = 'suspension_policy' AND version = 1;