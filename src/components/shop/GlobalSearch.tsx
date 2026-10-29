import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { globalSearch, type SearchCategory, type SearchResult } from "@/lib/global-search.functions";
import { formatMoney } from "@/lib/money";
import {
  Users, Cpu, Wrench, Calendar, FileText, Receipt, Undo2,
  CreditCard, Boxes, Package, Truck, ShoppingCart, Clock, ArrowRight, X,
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

const RECENTS_KEY = "bpei:search-recents";
const RECENTS_MAX = 6;

function readRecents(shopId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${RECENTS_KEY}:${shopId}`);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, RECENTS_MAX) : [];
  } catch { return []; }
}

function writeRecents(shopId: string, list: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${RECENTS_KEY}:${shopId}`, JSON.stringify(list.slice(0, RECENTS_MAX)));
  } catch { /* ignore */ }
}

function pushRecent(shopId: string, term: string): string[] {
  const t = term.trim();
  if (t.length < 2) return readRecents(shopId);
  const cur = readRecents(shopId).filter((x) => x.toLowerCase() !== t.toLowerCase());
  const next = [t, ...cur].slice(0, RECENTS_MAX);
  writeRecents(shopId, next);
  return next;
}

/** Highlight all case-insensitive occurrences of `term` inside `text`. */
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

export function GlobalSearch({
  shopId, open, onOpenChange,
}: {
  shopId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 200);
  const navigate = useNavigate();
  const searchFn = useServerFn(globalSearch);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => { if (open) setRecents(readRecents(shopId)); }, [open, shopId]);

  const enabled = dq.trim().length >= 2 && open;
  const { data, isFetching } = useQuery({
    queryKey: ["global-search", shopId, dq],
    queryFn: ({ signal }) => searchFn({ data: { shopId, q: dq.trim(), perCategory: 6 }, signal }),
    enabled,
    staleTime: 30_000,
  });

  useEffect(() => { if (!open) setQ(""); }, [open]);

  // Persist a recent when a stable query returned any result
  useEffect(() => {
    if (!enabled || !data || data.length === 0) return;
    const term = dq.trim();
    setRecents(pushRecent(shopId, term));
  }, [data, dq, enabled, shopId]);

  const grouped = useMemo(() => {
    const g = new Map<SearchCategory, SearchResult[]>();
    (data ?? []).forEach((r) => {
      const arr = g.get(r.category) ?? [];
      arr.push(r);
      g.set(r.category, arr);
    });
    return g;
  }, [data]);

  const total = data?.length ?? 0;

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  function go(href: string) {
    close();
    navigate({ to: href });
  }

  function openFullSearch(term: string) {
    close();
    navigate({
      to: "/app/shop/$shopId/search",
      params: { shopId },
      search: { q: term, cat: "all" as const, page: 1 },
    });
  }

  function clearRecents() {
    writeRecents(shopId, []);
    setRecents([]);
  }

  const term = dq.trim();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder="Rechercher clients, devis, factures, stock, commandes…"
      />
      <CommandList>
        {enabled && total === 0 && !isFetching && (
          <CommandEmpty>Aucun résultat pour « {term} »</CommandEmpty>
        )}

        {!enabled && recents.length > 0 && (
          <CommandGroup
            heading={
              <div className="flex items-center justify-between gap-2">
                <span>Recherches récentes</span>
                <button
                  type="button"
                  onClick={clearRecents}
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" /> Effacer
                </button>
              </div>
            }
          >
            {recents.map((r) => (
              <CommandItem
                key={`recent-${r}`}
                value={`recent-${r}`}
                onSelect={() => setQ(r)}
                className="gap-3"
              >
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{r}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!enabled && recents.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Tapez au moins 2 caractères pour lancer la recherche.
          </div>
        )}

        {isFetching && enabled && (
          <div className="px-3 py-2 text-center text-xs text-muted-foreground">Recherche…</div>
        )}

        {CATEGORY_ORDER.map((cat, idx) => {
          const rows = grouped.get(cat);
          if (!rows || rows.length === 0) return null;
          const meta = CATEGORY_META[cat];
          const Icon = meta.icon;
          return (
            <div key={cat}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={meta.label}>
                {rows.map((r) => (
                  <CommandItem
                    key={`${cat}-${r.id}`}
                    value={`${cat}-${r.id}-${r.title}-${r.subtitle ?? ""}`}
                    onSelect={() => go(r.href)}
                    className="gap-3"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        <Highlight text={r.title} term={term} />
                      </div>
                      {r.subtitle && (
                        <div className="truncate text-xs text-muted-foreground">
                          <Highlight text={r.subtitle} term={term} />
                        </div>
                      )}
                    </div>
                    {r.amount_cents != null && (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {formatMoney(r.amount_cents)}
                      </span>
                    )}
                    {r.status && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {r.status}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}

        {enabled && total > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value={`__see_all__-${term}`}
                onSelect={() => openFullSearch(term)}
                className="gap-3"
              >
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">Voir tous les résultats pour « {term} »</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Entrée</kbd>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Small hook so the layout can share open state and wire ⌘K / Ctrl+K globally. */
export function useGlobalSearchHotkey(setOpen: (v: boolean) => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}