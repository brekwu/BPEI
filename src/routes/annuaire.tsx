import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, MapPin, Search } from "lucide-react";
import { publicListDirectory } from "@/lib/public-shop.functions";

export const Route = createFileRoute("/annuaire")({
  head: () => ({
    meta: [
      { title: "Annuaire BPEI — Boutiques et indépendants vérifiés" },
      { name: "description", content: "Trouvez une boutique BPEI ou un réparateur indépendant vérifié près de chez vous." },
      { property: "og:title", content: "Annuaire BPEI" },
      { property: "og:description", content: "Boutiques et réparateurs indépendants vérifiés du réseau BPEI." },
      { property: "og:url", content: "https://bpei.fr/annuaire" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/annuaire" }],
  }),
  component: DirectoryPage,
});

type Kind = "all" | "physical_shop" | "mobile_independent";

function DirectoryPage() {
  const [tab, setTab] = useState<Kind>("all");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const listFn = useServerFn(publicListDirectory);

  const { data, isLoading } = useQuery({
    queryKey: ["directory", tab],
    queryFn: () => listFn({ data: { businessType: tab === "all" ? undefined : tab } }),
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const c = city.trim().toLowerCase();
    return (data ?? []).filter((r: any) => {
      if (s && !`${r.name ?? ""} ${r.description ?? ""}`.toLowerCase().includes(s)) return false;
      if (c) {
        const inCity = (r.city ?? "").toLowerCase().includes(c);
        const inCovered = (r.covered_cities ?? []).some((x: string) => x.toLowerCase().includes(c));
        if (!inCity && !inCovered) return false;
      }
      return true;
    });
  }, [data, q, city]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Annuaire BPEI</h1>
        <p className="mt-2 text-muted-foreground">
          Boutiques et réparateurs indépendants du réseau BPEI. Le badge <span className="inline-flex items-center gap-1 text-sky-700"><ShieldCheck className="h-4 w-4" />Vérifié</span> garantit que le dossier a été contrôlé.
        </p>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Nom, spécialité, description…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ville (ex : Nice, Paris)" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)}>
        <TabsList>
          <TabsTrigger value="all">Tous</TabsTrigger>
          <TabsTrigger value="physical_shop">Boutiques</TabsTrigger>
          <TabsTrigger value="mobile_independent">Indépendants</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun résultat.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s: any) => (
                <li key={s.id}>
                  <Link to="/b/$shopId" params={{ shopId: s.id }}>
                    <Card className="h-full transition hover:shadow-md">
                      {s.cover_url ? (
                        <div className="h-24 w-full rounded-t-lg bg-cover bg-center" style={{ backgroundImage: `url(${s.cover_url})` }} />
                      ) : null}
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {s.logo_url ? (
                            <img src={s.logo_url} alt="" className="h-12 w-12 rounded-md object-cover" />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="truncate">{s.name}</strong>
                              {s.verified ? (
                                <Badge className="bg-sky-100 text-sky-800"><ShieldCheck className="mr-1 h-3 w-3" />Vérifié</Badge>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {s.business_type === "mobile_independent"
                                ? `Indépendant à domicile${s.service_radius_km ? ` · ${s.service_radius_km} km` : ""}`
                                : (s.city ?? "Boutique")}
                            </div>
                            {s.description ? (
                              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                            ) : null}
                            {s.business_type === "mobile_independent" && s.covered_cities?.length ? (
                              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">Zones : {s.covered_cities.join(", ")}</p>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}