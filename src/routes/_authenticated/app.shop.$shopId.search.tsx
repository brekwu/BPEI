import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { useShop } from "@/components/shop/ShopLayout";
import {
  PageContainer, PageHeader, SectionCard, DataTableShell, StatusBadge,
} from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { searchCategory, type SearchCategory } from "@/lib/global-search.functions";
import { formatMoney } from "@/lib/money";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  Search as SearchIcon, Users, Cpu, Wrench, Calendar, FileText, Receipt, Undo2,
  CreditCard, Boxes, Package, Truck, ShoppingCart, ChevronLeft, ChevronRight,
} from "lucide-react";

const CATEGORY_META: Record<SearchCategory, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  customers:       { label: "Clients",       icon: Users },
  devices:         { label: "Appareils",     icon: Cpu },
  repairs:         { label: "Réparations",   icon: Wrench },
  appointments:    { label: "Rendez-vous",   icon: Calendar },
  quotes:          { label: "Devis",         icon: FileText },
  invoices:        { label: "Factures",      icon: Receipt },
  credit_notes:    { label: "Avoirs",        icon: Undo2 },
  payments:        { label: "Paiements",     icon: CreditCard },
  stock:           { label: "Stock",         icon: Boxes },
  services:        { label: "Catalogue",     icon: Package },
  suppliers:       { label: "Fournisseurs",  icon: Truck },
  purchase_orders: { label: "Commandes",     icon: ShoppingCart },
};

const CATEGORY_ORDER: SearchCategory[] = [
  "customers", "devices", "repairs", "appointments",
  "quotes", "invoices", "credit_notes", "payments",
  "stock", "services", "suppliers", "purchase_orders",
];

const PAGE_SIZE = 20;

const searchSchema = z.object({
  q: z.string().catch("").default(""),
  cat: z.string().catch("customers").default("customers"),
  page: z.number().int().catch(1).default(1),
});

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/search")({
  head: () => ({
    meta: [
      { title: "Recherche — BPEI" },
      { name: "description", content: "Recherche globale filtrée par catégorie avec pagination." },
    ],
  }),
  validateSearch: searchSchema,
  component: SearchPage,
});

function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim();
  if (!t || !text) return <>{text}</>;
  const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === t.toLowerCase()
          ? <mark key={i} className="rounded bg-primary/20 px-0.5 text-foreground">{p}</mark>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function isCategory(v: string): v is SearchCategory {
  return (CATEGORY_ORDER as string[]).includes(v);
}

function SearchPage() {
  const { shopId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  useShop();

  const [qInput, setQInput] = useState(search.q);
  useEffect(() => { setQInput(search.q); }, [search.q]);
  const dq = useDebouncedValue(qInput, 250);

  // Sync debounced query to URL (reset page to 1 on change)
  useEffect(() => {
    if (dq === search.q) return;
    navigate({
      to: "/app/shop/$shopId/search",
      params: { shopId },
      search: { q: dq, cat: search.cat, page: 1 },
      replace: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  const term = search.q.trim();
  const category: SearchCategory = isCategory(search.cat) ? search.cat : "customers";
  const page = Math.max(1, search.page);
  const offset = (page - 1) * PAGE_SIZE;

  const fetchCat = useServerFn(searchCategory);
  const enabled = term.length >= 2;

  const { data, isFetching, error } = useQuery({
    queryKey: ["search-category", shopId, term, category, offset],
    queryFn: ({ signal }) => fetchCat({
      data: { shopId, q: term, category, offset, limit: PAGE_SIZE },
      signal,
    }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function setCategory(next: SearchCategory) {
    navigate({
      to: "/app/shop/$shopId/search",
      params: { shopId },
      search: { q: term, cat: next, page: 1 },
      replace: true,
    });
  }

  function setPage(next: number) {
    navigate({
      to: "/app/shop/$shopId/search",
      params: { shopId },
      search: { q: term, cat: category, page: Math.max(1, Math.min(pageCount, next)) },
    });
  }

  const currentMeta = CATEGORY_META[category];

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Recherche"
        title={term ? `Résultats pour « ${term} »` : "Recherche"}
        description="Filtrez par catégorie et parcourez tous les résultats avec pagination."
      />

      <SectionCard>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder="Tapez votre recherche (min. 2 caractères)…"
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((c) => {
            const meta = CATEGORY_META[c];
            const Icon = meta.icon;
            const active = c === category;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors " +
                  (active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title={
          <div className="flex items-center gap-2">
            <currentMeta.icon className="h-4 w-4 text-muted-foreground" />
            <span>{currentMeta.label}</span>
            <Badge variant="secondary">{enabled ? total : 0}</Badge>
          </div>
        }
      >
        {!enabled && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Saisissez au moins 2 caractères pour lancer la recherche.
          </div>
        )}

        {enabled && error && (
          <div className="py-8 text-center text-sm text-destructive">
            Erreur lors de la recherche.
          </div>
        )}

        {enabled && !error && rows.length === 0 && !isFetching && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Aucun résultat pour « {term} » dans {currentMeta.label.toLowerCase()}.
          </div>
        )}

        {enabled && rows.length > 0 && (
          <DataTableShell>
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Nom</th>
                  <th className="px-3 py-2 text-left">Détails</th>
                  <th className="px-3 py-2 text-left">Statut</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                  <th className="px-3 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">
                      <Highlight text={r.title} term={term} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.subtitle ? <Highlight text={r.subtitle} term={term} /> : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.status ? <StatusBadge status={r.status} /> : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {r.amount_cents != null ? formatMoney(r.amount_cents) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to={r.href}>Ouvrir</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        )}

        {enabled && pageCount > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Page {page} sur {pageCount} · {total} résultat{total > 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page <= 1 || isFetching}
              >
                <ChevronLeft className="h-4 w-4" /> Précédent
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page >= pageCount || isFetching}
              >
                Suivant <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
}