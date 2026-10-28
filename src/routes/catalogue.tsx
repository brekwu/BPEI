import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Package, Wrench, Store, Clock, MapPin } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { publicBrowseCatalog } from "@/lib/public-catalog.functions";

const searchSchema = z.object({
  q: z.string().catch("").default(""),
  kind: z.string().catch("all").default("all"),
  category: z.string().catch("").default(""),
  city: z.string().catch("").default(""),
});

export const Route = createFileRoute("/catalogue")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Catalogue BPEI — Produits et prestations des boutiques" },
      { name: "description", content: "Parcourez les produits et prestations proposés par les boutiques informatiques du réseau BPEI. Recherche par nom, catégorie et ville." },
      { property: "og:title", content: "Catalogue BPEI" },
      { property: "og:description", content: "Produits et prestations informatiques disponibles près de chez vous." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://bpei.fr/catalogue" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/catalogue" }],
  }),
  component: CataloguePage,
});

function CataloguePage() {
  const { q, kind, category, city } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [text, setText] = useState(q);
  const [debounced, setDebounced] = useState(q);

  useEffect(() => { setText(q); }, [q]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);
  useEffect(() => {
    if (debounced !== q) navigate({ search: (p: Record<string, string>) => ({ ...p, q: debounced }), replace: true });
  }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFn = useServerFn(publicBrowseCatalog);
  const safeKind = (kind === "products" || kind === "services") ? kind : "all";
  const { data, isFetching } = useQuery({
    queryKey: ["public-catalog", debounced, safeKind, category, city],
    queryFn: () => fetchFn({ data: { q: debounced, kind: safeKind, category, city, limit: 80 } }),
    staleTime: 30_000,
  });

  const products = data?.products ?? [];
  const services = data?.services ?? [];
  const productCategories = data?.productCategories ?? [];
  const serviceCategories = data?.serviceCategories ?? [];
  const cities = data?.cities ?? [];

  const totalCount = safeKind === "services" ? services.length : safeKind === "products" ? products.length : products.length + services.length;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero + search */}
        <section className="border-b border-border bg-secondary/30 py-12">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Catalogue du réseau BPEI</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Découvrez les produits en stock et les prestations proposées par les boutiques informatiques du réseau. Chaque article renvoie vers sa boutique.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-[1fr,180px,180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Nom, marque, catégorie…"
                  aria-label="Rechercher dans le catalogue"
                  className="h-11 pl-9"
                />
              </div>
              <Select
                value={city || "all"}
                onValueChange={(v) => navigate({ search: (p: Record<string, string>) => ({ ...p, city: v === "all" ? "" : v }), replace: true })}
              >
                <SelectTrigger className="h-11" aria-label="Filtrer par ville"><SelectValue placeholder="Toutes les villes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les villes</SelectItem>
                  {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={category || "all"}
                onValueChange={(v) => navigate({ search: (p: Record<string, string>) => ({ ...p, category: v === "all" ? "" : v }), replace: true })}
              >
                <SelectTrigger className="h-11" aria-label="Filtrer par catégorie"><SelectValue placeholder="Toutes catégories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {(safeKind === "services" ? serviceCategories : safeKind === "products" ? productCategories : [...new Set([...productCategories, ...serviceCategories])].sort()).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="py-8">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <Tabs
              value={safeKind}
              onValueChange={(v) => navigate({ search: (p: Record<string, string>) => ({ ...p, kind: v, category: "" }), replace: true })}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:w-auto">
                  <TabsTrigger value="all">Tout <Badge variant="secondary" className="ml-2">{products.length + services.length}</Badge></TabsTrigger>
                  <TabsTrigger value="products"><Package className="mr-1.5 h-3.5 w-3.5" />Produits <Badge variant="secondary" className="ml-2">{products.length}</Badge></TabsTrigger>
                  <TabsTrigger value="services"><Wrench className="mr-1.5 h-3.5 w-3.5" />Prestations <Badge variant="secondary" className="ml-2">{services.length}</Badge></TabsTrigger>
                </TabsList>
                <span className="text-xs text-muted-foreground">
                  {isFetching ? "Recherche…" : `${totalCount} résultat${totalCount > 1 ? "s" : ""}`}
                </span>
              </div>

              <TabsContent value="all" className="mt-6 space-y-10">
                {products.length > 0 && <ProductGrid items={products} />}
                {services.length > 0 && <ServiceGrid items={services} />}
                {products.length + services.length === 0 && <Empty />}
              </TabsContent>
              <TabsContent value="products" className="mt-6">
                {products.length === 0 ? <Empty /> : <ProductGrid items={products} />}
              </TabsContent>
              <TabsContent value="services" className="mt-6">
                {services.length === 0 ? <Empty /> : <ServiceGrid items={services} />}
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function ProductGrid({ items }: { items: import("@/lib/public-catalog.functions").CatalogProduct[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        <Package className="h-4 w-4" /> Produits
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <li key={p.id}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-2 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-tight line-clamp-2">{p.name}</h3>
                    {p.brand && <div className="mt-0.5 text-xs text-muted-foreground">{p.brand}</div>}
                  </div>
                  {p.in_stock ? (
                    <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">En stock</Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-muted-foreground">Sur commande</Badge>
                  )}
                </div>
                {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                {p.category && <Badge variant="outline" className="w-fit text-[10px] uppercase tracking-wide">{p.category}</Badge>}
                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <div>
                    <div className="text-lg font-bold">{formatMoney(p.price_ttc_cents)}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">TTC</div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/b/$shopId" params={{ shopId: p.shop_id }}>Voir la boutique</Link>
                  </Button>
                </div>
                <div className="flex items-center gap-1 pt-1 text-xs text-muted-foreground">
                  <Store className="h-3 w-3" />
                  <Link to="/b/$shopId" params={{ shopId: p.shop_id }} className="hover:underline">{p.shop_name}</Link>
                  {p.shop_city && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{p.shop_city}</span>}
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ServiceGrid({ items }: { items: import("@/lib/public-catalog.functions").CatalogService[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        <Wrench className="h-4 w-4" /> Prestations
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {items.map((s) => (
          <li key={s.id}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 pt-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-tight">{s.name}</h3>
                    {s.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold">{formatMoney(s.price_ttc_cents)}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">TTC</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {s.category && <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{s.category}</Badge>}
                  {s.estimated_duration_minutes && (
                    <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />~{s.estimated_duration_minutes} min</span>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Store className="h-3 w-3" />
                    <Link to="/b/$shopId" params={{ shopId: s.shop_id }} className="hover:underline">{s.shop_name}</Link>
                    {s.shop_city && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{s.shop_city}</span>}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/reserver/$shopId" params={{ shopId: s.shop_id }} search={{ service: s.id } as any}>Réserver</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
      Aucun résultat pour ces critères. Essayez d'élargir votre recherche ou de retirer un filtre.
    </div>
  );
}