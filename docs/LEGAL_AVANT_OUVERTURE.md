# BPEI — vérifications légales AVANT ouverture des formulaires

## Audit de la base existante (28 octobre 2026)
Les documents enregistrés dans Lovable Cloud ne sont pas tous publiés :
- `privacy_policy` : **archivé**, aucune version actuellement publiée.
- `legal_notice` : **brouillon**, aucune version actuellement publiée.
- `website_terms` : publié, mais contient les conditions du site existant et doit être relu pour le nouveau réseau d'indépendants.
- `platform_legal_settings.hosting_provider_name` : **non renseigné** (la base sera migrée vers un hébergeur indépendant).
- `network_charter`, `shop_independent_framework` : brouillons. Aucun contrat de partenariat national validé sur cette base.

Ces constats viennent des **statuts** des documents ; ils ne valident pas la conformité ou les contenus juridiques.

## Barrières de mise en service intégrées dans le code
Deux conditions distinctes :
- `VITE_BPEI_PUBLIC_FORMS_ENABLED=true` **au build** : affiche les formulaires au navigateur ;
- `BPEI_FORMS_ENABLED=true` **au runtime du serveur** : autorise effectivement leur traitement.
Si une variable reste absente ou différente de `true`, l'ouverture du formulaire n'est pas effective. En préproduction, les deux doivent rester `false` par défaut. Ne jamais utiliser ces flags pour compenser l'absence de contrôles RLS.

## Mentions légales à compléter et publier (sans information fictive)
- Identité de l'éditeur, statut juridique et immatriculation, adresse et contact, responsable de publication ;
- Hébergeur réel de bpei.fr (nom et coordonnées de l'hébergeur finalement retenu) ;
- Politique de confidentialité : responsable de traitement, finalités candidatures et demandes d'intervention, base légale, destinataires, sous-traitants, hébergement, éventuels transferts, durée réelle de conservation, modalités des droits et contact, réclamations CNIL ;
- Cookies/tracking : uniquement selon l'implémentation réelle et le régime de consentement applicable ;
- Information sur le rôle d'intermédiaire de BPEI par rapport aux indépendants, devis et facturation ;
- Convention de partenariat technicien : indépendance, liberté d'accepter/refuser les demandes, critères de sélection, information tarifaire, commissions éventuelles, responsabilités, assurance, résiliation, gestion des litiges ;
- Information consommateurs et médiation quand applicable, conforme à la structure contractuelle réelle ;
- Conservation et suppression sécurisée des candidatures refusées ou des demandes sans suite.

## Critères avant de passer les flags à true
1. Politique de confidentialité publiée et accessible sans connexion à `/confidentialite` ;
2. Mentions légales publiées et hébergeur exact renseigné ;
3. CGU/CGV et convention d'indépendants relues et validées ;
4. Base distincte provisionnée, droits RLS et authentification testés ;
5. Candidature et demande client testées avec valeurs factices, accès administrateur contrôlé ;
6. Anti-spam/rate-limit actif, sans secret côté navigateur ;
7. Suppression des dossiers de test et vérification du rollback.

**Ces documents sont une checklist technique et non un avis juridique.**
