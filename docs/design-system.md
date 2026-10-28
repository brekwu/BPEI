# BPEI — Design System (Phase Polish P1)

Fondations partagées par toutes les pages authentifiées et publiques.
Toute nouvelle page **doit** utiliser exclusivement ces briques.

## Import

```ts
import {
  PageContainer,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  DataTableShell,
  DialogShell,
  EmptyState,
  FormSection,
  FormRow,
  FormActions,
  Skeleton,
} from "@/components/ui-kit";
```

## Squelette d'une page type

```tsx
<PageContainer>
  <PageHeader
    eyebrow="Boutique"
    title="Réparations"
    description="Suivi complet des interventions en cours."
    actions={<Button>Nouvelle réparation</Button>}
  />

  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <StatCard label="En cours" value={12} accent="electric" icon={<Wrench />} />
    ...
  </div>

  <DataTableShell
    toolbar={<Filters />}
    loading={isLoading}
    empty={rows.length === 0}
    emptyTitle="Aucune réparation"
    emptyDescription="Créez votre première réparation depuis un devis ou un rendez-vous."
    emptyAction={<Button>Créer</Button>}
    footer={<Pagination />}
  >
    <table>...</table>
  </DataTableShell>
</PageContainer>
```

## Composants

### `PageContainer`
Wrapper standard : `max-w-6xl`, padding responsive, `space-y-6`, animation fade-in.
Variantes `size`: `narrow` (formulaires), `default`, `wide`.

### `PageHeader`
Eyebrow, titre display, description, actions à droite. Gère mobile (grid) → desktop (flex).

### `SectionCard`
Carte de contenu à titre optionnel. Utiliser dès qu'un bloc a une identité propre.

### `StatCard`
Chiffre clé. Props : `label`, `value`, `icon`, `hint`, `trend`, `accent`.
Accents : `default | electric | success | warning | destructive`.

### `StatusBadge`
Badge de statut métier. Fait **le mapping automatique** statut technique → libellé FR + tonalité.
Ajouter les nouveaux statuts dans `STATUS_MAP` de `status-badge.tsx` (pas dans les pages).

### `DataTableShell`
Coquille table : toolbar, table native, footer pagination, skeleton loading, empty state intégré.
Le `<table>` reste écrit à la main (avec les primitives `@/components/ui/table`) pour garder
la souplesse par domaine, mais le chrome est unifié.

### `DialogShell`
Coquille standard pour tous les modaux : header (titre + description), body scrollable, footer.
Tailles : `sm | md | lg | xl`.

### `EmptyState`
Icône + titre + description + action, pour les listes vides.

### `FormSection` / `FormRow` / `FormActions`
Structure de formulaire : sections titrées, rangées 2 colonnes responsive, footer d'actions
(option `sticky` pour les formulaires longs).

### `Skeleton`
Placeholder de chargement (utiliser plutôt que des spinners custom).

## Règles

1. **Aucune couleur hardcodée** (`text-white`, `bg-gray-*`, `#hex`) dans les pages. Utiliser
   les tokens sémantiques (`text-foreground`, `bg-card`, `border-border`, `text-electric`, etc.).
2. **Aucun mapping statut ad hoc** dans une page — passer par `<StatusBadge status="..." />`.
3. **Aucun modal** sans `DialogShell` (garantit cohérence header/footer/scroll).
4. **Aucune table** sans `DataTableShell` (garantit skeleton + empty state uniformes).
5. **Animations** : utiliser `animate-fade-in`, `animate-scale-in`, `hover-scale`,
   `animate-slide-in-right` (déjà définis dans Tailwind config). Pas d'animation gadget.
6. **Notifications** : `toast` depuis `sonner` uniquement.
7. **Responsive** : chaque page doit être testée à 375 / 768 / 1280 px minimum.

## Tokens (rappel)

Couleurs sémantiques dans `src/styles.css` :
`--background --foreground --card --primary --secondary --muted --accent --border --border-strong --electric --electric-soft --success --warning --destructive --surface-muted`.

Fonts : `font-display` (headings), sans par défaut (body).

Animations : voir `tailwind.config` / `styles.css` — `fade-in`, `scale-in`, `slide-in-right`,
`accordion-*`.