# BPEI — Vérification obligatoire d'un professionnel

Cette procédure s'applique avant d'accepter une candidature sur le réseau de **techniciens informatiques indépendants**.

## Vérification de l'activité — aucun automatisme de confiance

1. Vérifier le SIRET de **14 chiffres** sur l'[Annuaire des Entreprises](https://annuaire-entreprises.data.gouv.fr/) ou l'[API Recherche d'Entreprises](https://recherche-entreprises.api.gouv.fr/docs/). Une recherche exacte peut être faite via `/search?q=<SIRET>`. Vérifier le SIRET exact de l'établissement et non seulement le SIREN de l'entreprise.
2. Vérifier que l'unité légale **et** l'établissement concerné sont signalés actifs. Un établissement fermé, même sous entreprise active, n'est pas validé pour le SIRET fourni. **Une absence dans l'API ouverte ne prouve pas une entreprise inexistante** : certaines données ne sont pas diffusibles.
3. En cas de doute ou de non-diffusion, consulter le [Registre national des entreprises (INPI)](https://data.inpi.fr/) et demander les justificatifs adaptés. Ne pas conclure à la fermeture sur un résultat absent.
4. Vérifier le lien **réel** entre le candidat et l'entreprise : identité du chef d'entreprise/mandataire ou autorisation écrite claire. Un SIRET public ne prouve jamais à lui seul que le candidat représente l'entreprise.
5. Consigner dans `/gestion-independants` la source officielle, la date de consultation, la référence du contrôle et la confirmation des trois éléments (unité légale active, établissement actif, identité concordante). **Ne pas coller de pièce d'identité sensible dans le champ référence**. Conserver les documents personnels uniquement via un stockage conforme, si le modèle de service en prévoit un.
6. Le compte candidat doit avoir un **e-mail confirmé**. Une candidature ne peut être approuvée sans dossier de vérification concordant avec son SIRET et daté de **30 jours au maximum**.
7. Si le candidat change le SIRET ou le nom commercial, la validation est automatiquement retirée et la candidature repasse en cours d'examen. Un nouveau contrôle est obligatoire.

## Protections techniques

- La table `independent_verification_checks` n'accepte aucune écriture directe de la part des utilisateurs ordinaires.
- La fonction publique `record_independent_verification` est exécutée avec les droits du demandeur ; la logique privilégiée réside dans `bpei_private` et recontrôle l'administrateur.
- Le RPC `review_independent_application(..., 'approved')` vérifie le dossier indépendamment de l'interface : désactiver ou contourner le bouton ne permet pas de contourner le backend.
- Une modification du SIRET ou du nom commercial invalide le contrôle enregistré.

## Limites non levées

- Le contrôle de l'état et des pièces est **humain**, avec consultation d'une source officielle. Il n'y a **pas encore de vérification automatique fiable de l'identité par API**.
- Des documents justificatifs d'identité ou de représentation peuvent être nécessaires selon les cas. Leur collecte, conservation, accès et durée légale restent à définir dans la politique de confidentialité.
- La couverture RC Pro, l'aptitude à intervenir et les conditions contractuelles sont des vérifications distinctes à prévoir avant exploitation commerciale.
- La qualité du registre peut varier, et certaines données sont confidentielles ou non diffusibles.

Sources officielles :
- https://entreprendre.service-public.gouv.fr/vosdroits/F31190
- https://entreprendre.service-public.gouv.fr/vosdroits/R19859
- https://annuaire-entreprises.data.gouv.fr/donnees/api-entreprises
