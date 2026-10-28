# BPEI — Rapport technique et critères de mise en ligne

## Nettoyage des boutiques : terminé sur la branche de préproduction
- 14 routes applicatives conservées.
- Modules historiques des boutiques, gestion de stock, caisse, facturation, paiements, abonnements et gestion propriétaires supprimés de la branche propre.
- Modules NPM directs devenus inutiles retirés, lockfile Bun régénéré.
- Le build Vite utilise TanStack Start + Nitro sans plugin de build Lovable.
- Anciennes URL publiques redirigées via Vercel.
- Sauvegarde préalable : `backup/avant-nettoyage-boutiques-2026-10-28`.

## Vérifications réalisées
- Compilation Vercel : réussite sur préproduction.
- GitHub Actions : installation figée, build Node et tests HTTP réussis.
- HTTP 200 vérifié : accueil, partenaires, espace indépendant, pages juridiques provisoires, sitemap et santé.
- Audit automatique Supabase : aucune alerte à la dernière vérification.

## Avant le lancement public et les publicités
- [ ] Tester réellement e-mail, création de compte, profil et candidature.
- [ ] Tester les permissions inter-comptes et les cas d'échec.
- [ ] Valider identité de l'éditeur, CGU et RGPD ; mettre en ligne les documents finaux.
- [ ] Mettre en place les formulaires et le traitement des demandes clients avec suivi.
- [ ] Confirmer la couverture opérationnelle et les intervenants vérifiés.
- [ ] Basculer l'hébergement sur une offre autorisée pour usage commercial puis configurer bpei.fr.

**Décision actuelle :** préproduction de développement validée, site non prêt à recevoir de la publicité payante.
