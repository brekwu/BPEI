import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Search, ChevronRight, Phone, Navigation } from "lucide-react";
import { publicSearchShops } from "@/lib/public-search.functions";

export const Route = createFileRoute("/boutiques")({
  head: () => ({
    meta: [
      { title: "Trouver une boutique BPEI — réparation, produits, services" },
      { name: "description", content: "Recherchez une boutique informatique du réseau BPEI par ville, code postal, service ou produit." },
      { property: "og:title", content: "Trouver une boutique BPEI" },
      { property: "og:description", content: "Recherchez par ville, code postal, service ou produit." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://bpei.fr/boutiques" }],
  }),
  component: BoutiquesPage,
});

function BoutiquesPage() {
  const search = useServerFn(publicSearchShops);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce
  useMemo(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["public-search-shops", debounced],
    queryFn: () => search({ data: { q: debounced, limit: 40 } }),
    staleTime: 30_000,
  });
  const results = data ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-secondary/30 py-16">
          <div className="mx-auto max-w-4xl px-4 md:px-6">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Trouver une boutique BPEI</h1>
            <p className="mt-3 text-muted-foreground">
              Recherchez par ville, code postal, nom, prestation (ex. « réparation PC ») ou produit (ex. « SSD », « clavier », « Logitech »).
            </p>
            <div className="relative mt-6">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Nice, 06000, réparation Mac, SSD, Logitech…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-12 pl-9 text-base"
                autoFocus
              />
            </div>
            {q && (
              <p className="mt-2 text-xs text-muted-foreground">
                {isFetching ? "Recherche…" : `${results.length} boutique${results.length > 1 ? "s" : ""} trouvée${results.length > 1 ? "s" : ""}`}
              </p>
            )}
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-4xl px-4 md:px-6">
            {results.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-10 text-center">
                <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">Aucune boutique {q ? `pour « ${q} »` : "pour l'instant"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {q ? "Essayez un autre terme, une autre ville ou effacez les filtres." : "Le réseau BPEI est en phase de lancement."}
                </p>
                {q && <Button className="mt-4" variant="outline" onClick={() => setQ("")}>Effacer la recherche</Button>}
              </div>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {results.map((s) => (
                  <li key={s.id}>
                    <Card className="h-full transition-all hover:border-electric hover:shadow-md">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between gap-3">
                          <Link to="/b/$shopId" params={{ shopId: s.id }} className="min-w-0 flex-1 group">
                            <h3 className="text-lg font-semibold group-hover:text-electric">{s.name}</h3>
                            {(s.city || s.postal_code) && (
                              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                {[s.postal_code, s.city].filter(Boolean).join(" ")}
                              </div>
                            )}
                            {s.address && <p className="mt-1 text-xs text-muted-foreground line-clamp-1">{s.address}</p>}
                          </Link>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </div>

                        {(s.matched_services.length > 0 || s.matched_products.length > 0) && (
                          <div className="mt-3 space-y-1.5">
                            {s.matched_services.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {s.matched_services.map((sv) => (
                                  <Badge key={sv.id} variant="secondary" className="text-[10px]">Service · {sv.name}</Badge>
                                ))}
                              </div>
                            )}
                            {s.matched_products.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {s.matched_products.map((p) => (
                                  <Badge key={p.id} variant="outline" className="text-[10px]">
                                    Produit · {p.name}{p.brand ? ` (${p.brand})` : ""}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {s.description && !s.matched_services.length && !s.matched_products.length && (
                          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{s.description}</p>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link to="/b/$shopId" params={{ shopId: s.id }}>Voir la boutique</Link>
                          </Button>
                          {s.phone && (
                            <Button asChild size="sm" variant="ghost">
                              <a href={`tel:${s.phone}`}><Phone className="mr-1 h-3 w-3" /> Appeler</a>
                            </Button>
                          )}
                          {(s.address || s.city) && (
                            <Button asChild size="sm" variant="ghost">
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([s.name, s.address, s.postal_code, s.city].filter(Boolean).join(" "))}`}
                                target="_blank" rel="noopener noreferrer"
                              >
                                <Navigation className="mr-1 h-3 w-3" /> Itinéraire
                              </a>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}