import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { publicGetShopStorefront } from "@/lib/public-shop.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin, Phone, Mail, Globe, Clock, Wrench, Package,
  CalendarCheck, Navigation, MessageSquare, ShieldCheck, Search, ShoppingCart, Plus,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import { CartDrawer } from "@/components/public/CartDrawer";
import { cart, useCart } from "@/lib/cart";
import { toast } from "sonner";

type ServiceItem = {
  id: string; name: string; description: string | null; category: string | null; line_type: string;
  estimated_duration_minutes: number | null; price_ttc_cents: number;
};
type ProductItem = {
  id: string; name: string; description: string | null; category: string | null; brand: string | null;
  sku: string | null; unit: string; item_type: string; available: number; in_stock: boolean; price_ttc_cents: number;
};
type Hour = {
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
  break_start: string | null;
  break_end: string | null;
};

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export const Route = createFileRoute("/b/$shopId")({
  head: ({ loaderData }) => {
    const data = loaderData as any;
    if (!data) {
      return { meta: [{ title: "Boutique introuvable — BPEI" }, { name: "robots", content: "noindex" }] };
    }
    const shop = data.shop;
    const title = `${shop.name}${shop.city ? ` — ${shop.city}` : ""} | BPEI`;
    const desc = shop.description
      ? shop.description.slice(0, 155)
      : `Services de réparation et produits informatiques proposés par ${shop.name}${shop.city ? ` à ${shop.city}` : ""}.`;
    const url = `https://bpei.fr/b/${shop.id}`;
    // Structured data (LocalBusiness) only when address is complete
    const scripts: { type: string; children: string }[] = [];
    if (shop.address && shop.city && shop.postal_code) {
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: shop.name,
        description: shop.description ?? undefined,
        url,
        telephone: shop.phone ?? undefined,
        email: shop.email ?? undefined,
        address: {
          "@type": "PostalAddress",
          streetAddress: shop.address,
          postalCode: shop.postal_code,
          addressLocality: shop.city,
          addressCountry: "FR",
        },
      };
      scripts.push({ type: "application/ld+json", children: JSON.stringify(jsonLd) });
    }
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
  loader: async ({ params }) => {
    const data = await publicGetShopStorefront({ data: { shopId: params.shopId } });
    if (!data) throw notFound();
    return data;
  },
  notFoundComponent: ShopNotFound,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Boutique indisponible</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/boutiques" className="mt-6 inline-block text-sm text-electric hover:underline">← Toutes les boutiques</Link>
      </main>
      <SiteFooter />
    </div>
  ),
  component: PublicShopPage,
});

function ShopNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Boutique introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cette boutique n'existe pas ou n'est pas encore validée.</p>
        <Link to="/boutiques" className="mt-6 inline-block text-sm text-electric hover:underline">← Toutes les boutiques</Link>
      </main>
      <SiteFooter />
    </div>
  );
}

function isOpenNow(hours: Hour[]): boolean | null {
  if (!hours || hours.length === 0) return null;
  const now = new Date();
  const dow = now.getDay();
  const h = hours.find((x) => x.day_of_week === dow);
  if (!h || h.is_closed || !h.opens_at || !h.closes_at) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [oH, oM] = h.opens_at.split(":").map(Number);
  const [cH, cM] = h.closes_at.split(":").map(Number);
  const open = oH * 60 + oM;
  const close = cH * 60 + cM;
  if (cur < open || cur > close) return false;
  if (h.break_start && h.break_end) {
    const [bsH, bsM] = h.break_start.split(":").map(Number);
    const [beH, beM] = h.break_end.split(":").map(Number);
    if (cur >= bsH * 60 + bsM && cur < beH * 60 + beM) return false;
  }
  return true;
}

function PublicShopPage() {
  const { shopId } = Route.useParams();
  const initial = Route.useLoaderData();
  const fetchFn = useServerFn(publicGetShopStorefront);
  const { data } = useQuery({
    queryKey: ["public-shop", shopId],
    queryFn: () => fetchFn({ data: { shopId } }),
    initialData: initial,
    staleTime: 60_000,
  });
  const shop = data!.shop as any;
  const verified = Boolean((data as any)?.verified);
  const isMobile = shop.business_type === "mobile_independent";
  const allServices = data!.services as ServiceItem[];
  const allProducts = data!.products as ProductItem[];
  const hours = (data!.hours ?? []) as Hour[];
  const paymentMethods = (data!.payment_methods ?? null) as {
    card_in_store: boolean; cash: boolean; payment_on_pickup: boolean;
    bank_transfer: boolean; cheque: boolean; manual: boolean;
    preparation_delay: string | null;
  } | null;

  const [prodQuery, setProdQuery] = useState("");
  const [prodCat, setProdCat] = useState<string>("all");
  const [svcQuery, setSvcQuery] = useState("");
  const [svcCat, setSvcCat] = useState<string>("all");
  const [cartOpen, setCartOpen] = useState(false);
  const cartLines = useCart(shopId);
  const cartCount = cartLines.reduce((n, l) => n + l.quantity, 0);

  const productCats = useMemo(() => Array.from(new Set(allProducts.map((p) => p.category).filter(Boolean) as string[])).sort(), [allProducts]);
  const serviceCats = useMemo(() => Array.from(new Set(allServices.map((s) => s.category).filter(Boolean) as string[])).sort(), [allServices]);

  const services = useMemo(() => {
    const n = svcQuery.trim().toLowerCase();
    return allServices.filter((s) => {
      if (svcCat !== "all" && (s.category ?? "") !== svcCat) return false;
      if (n && !`${s.name} ${s.description ?? ""} ${s.category ?? ""}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [allServices, svcQuery, svcCat]);
  const products = useMemo(() => {
    const n = prodQuery.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (prodCat !== "all" && (p.category ?? "") !== prodCat) return false;
      if (n && !`${p.name} ${p.description ?? ""} ${p.brand ?? ""} ${p.category ?? ""} ${p.sku ?? ""}`.toLowerCase().includes(n)) return false;
      return true;
    });
  }, [allProducts, prodQuery, prodCat]);

  const servicesByCat = useMemo(() => groupBy<ServiceItem>(services, (s) => s.category ?? "Autres"), [services]);
  const productsByCat = useMemo(() => groupBy<ProductItem>(products, (p) => p.category ?? "Autres"), [products]);

  const openNow = isOpenNow(hours);
  const addressLine = [shop.address, shop.postal_code, shop.city].filter(Boolean).join(", ");
  const mapsUrl = addressLine
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${shop.name} ${addressLine}`)}`
    : null;
  const contactHref = `/contact?shop=${shop.id}`;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 md:pb-0">
      <SiteHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-border bg-secondary/30">
          <div className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
            <Link to="/boutiques" className="text-xs text-muted-foreground hover:text-foreground">← Toutes les boutiques</Link>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{shop.name}</h1>
              {shop.status === "validated" && (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Boutique BPEI
                </Badge>
              )}
              {verified && (
                <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100" title="Dossier vérifié par BPEI">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Vérifié BPEI
                </Badge>
              )}
              {isMobile && (
                <Badge variant="outline" className="border-indigo-400 text-indigo-700">Intervention à domicile</Badge>
              )}
              {openNow === true && <Badge variant="outline" className="border-emerald-500 text-emerald-700">Ouvert maintenant</Badge>}
              {openNow === false && <Badge variant="outline" className="text-muted-foreground">Fermé</Badge>}
            </div>
            {shop.description && <p className="mt-3 max-w-2xl text-muted-foreground">{shop.description}</p>}

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {addressLine && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{addressLine}</span>}
              {isMobile && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {shop.service_radius_km ? `Rayon ${shop.service_radius_km} km` : "Intervention à domicile"}
                  {Array.isArray(shop.covered_cities) && shop.covered_cities.length > 0
                    ? ` · ${shop.covered_cities.slice(0, 4).join(", ")}${shop.covered_cities.length > 4 ? "…" : ""}`
                    : ""}
                </span>
              )}
              {shop.phone && <a href={`tel:${shop.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Phone className="h-4 w-4" />{shop.phone}</a>}
              {shop.email && <a href={`mailto:${shop.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail className="h-4 w-4" />{shop.email}</a>}
              {shop.website && <a href={shop.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground"><Globe className="h-4 w-4" />Site web</a>}
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {shop.phone && (
                <Button asChild variant="outline"><a href={`tel:${shop.phone}`}><Phone className="mr-2 h-4 w-4" /> Appeler</a></Button>
              )}
              {mapsUrl && (
                <Button asChild variant="outline"><a href={mapsUrl} target="_blank" rel="noopener noreferrer"><Navigation className="mr-2 h-4 w-4" /> Itinéraire</a></Button>
              )}
              <Button asChild variant="outline">
                <Link to="/contact" search={{ shop: shop.id } as any}><MessageSquare className="mr-2 h-4 w-4" /> Contacter</Link>
              </Button>
              <Button asChild className="bg-electric text-electric-foreground hover:bg-electric/90">
                <Link to="/reserver/$shopId" params={{ shopId: shop.id }}>
                  <CalendarCheck className="mr-2 h-4 w-4" /> Prendre RDV
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Info grid: hours + contact box */}
        <section className="py-10">
          <div className="mx-auto max-w-5xl px-4 md:px-6 grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-electric" />
                  <h2 className="font-semibold">Horaires d'ouverture</h2>
                </div>
                {hours.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Les horaires ne sont pas encore renseignés. Contactez la boutique pour vérifier ses disponibilités.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {[1,2,3,4,5,6,0].map((dow) => {
                      const h = hours.find((x) => x.day_of_week === dow);
                      const today = new Date().getDay() === dow;
                      return (
                        <li key={dow} className={`flex justify-between rounded px-2 py-1 ${today ? "bg-electric/10 font-medium" : ""}`}>
                          <span>{DAYS[dow]}</span>
                          <span className="text-muted-foreground">
                            {!h || h.is_closed || !h.opens_at ? "Fermé" : (
                              <>
                                {h.opens_at.slice(0,5)}–{h.break_start ? h.break_start.slice(0,5) : (h.closes_at?.slice(0,5) ?? "")}
                                {h.break_start && h.break_end && h.closes_at && ` · ${h.break_end.slice(0,5)}–${h.closes_at.slice(0,5)}`}
                              </>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-electric" />
                  <h2 className="font-semibold">Contacter cette boutique</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Une question sur une prestation, un produit ou un devis ? Envoyez votre demande — l'équipe BPEI transfère votre message à la boutique.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/contact" search={{ shop: shop.id } as any}>Écrire à la boutique</Link>
                  </Button>
                  {shop.phone && (
                    <Button asChild size="sm" variant="outline"><a href={`tel:${shop.phone}`}>Appeler</a></Button>
                  )}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Les moyens de paiement, options de retrait et modalités précises sont confirmés directement par la boutique lors de votre visite ou de votre commande.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment methods (public — no IBAN ever) */}
          {paymentMethods && (paymentMethods.card_in_store || paymentMethods.cash || paymentMethods.payment_on_pickup || paymentMethods.bank_transfer || paymentMethods.cheque || paymentMethods.manual) && (
            <div className="mx-auto mt-6 max-w-5xl px-4 md:px-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-electric" />
                    <h2 className="font-semibold">Moyens de paiement acceptés</h2>
                  </div>
                  <ul className="flex flex-wrap gap-2 text-sm">
                    {paymentMethods.card_in_store && <li><Badge variant="secondary">Carte bancaire</Badge></li>}
                    {paymentMethods.cash && <li><Badge variant="secondary">Espèces</Badge></li>}
                    {paymentMethods.payment_on_pickup && <li><Badge variant="secondary">Paiement au retrait</Badge></li>}
                    {paymentMethods.bank_transfer && <li><Badge variant="secondary">Virement bancaire accepté</Badge></li>}
                    {paymentMethods.cheque && <li><Badge variant="secondary">Chèque</Badge></li>}
                  </ul>
                  {paymentMethods.preparation_delay && (
                    <p className="mt-3 text-xs text-muted-foreground">Délai de préparation du paiement : {paymentMethods.preparation_delay}</p>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Les coordonnées de virement (IBAN) sont transmises par la boutique après validation de votre commande — jamais publiées ici.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </section>


        {/* Services */}
        <section className="py-6">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-electric" />
              <h2 className="text-xl font-semibold">Prestations proposées</h2>
              <Badge variant="secondary" className="ml-1">{services.length}{services.length !== allServices.length ? ` / ${allServices.length}` : ""}</Badge>
            </div>
            {allServices.length > 4 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr,200px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={svcQuery} onChange={(e) => setSvcQuery(e.target.value)} placeholder="Rechercher une prestation…" className="h-10 pl-9" />
                </div>
                <Select value={svcCat} onValueChange={setSvcCat}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes catégories</SelectItem>
                    {serviceCats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {allServices.length === 0 ? (
              <EmptyBlock text="Aucune prestation publiée pour l'instant." />
            ) : services.length === 0 ? (
              <EmptyBlock text="Aucune prestation ne correspond à votre recherche." />
            ) : (
              <div className="mt-6 space-y-8">
                {Object.entries(servicesByCat).map(([cat, items]) => (
                  <div key={cat}>
                    <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{cat}</h3>
                    <ul className="grid gap-3 md:grid-cols-2">
                      {items.map((s) => (
                        <li key={s.id}>
                          <Card className="h-full transition-shadow hover:shadow-md">
                            <CardContent className="flex h-full flex-col gap-3 pt-6">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <h4 className="font-semibold leading-tight">{s.name}</h4>
                                  {s.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="text-lg font-bold text-foreground">{formatMoney(s.price_ttc_cents)}</div>
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">TTC</div>
                                </div>
                              </div>
                              <div className="mt-auto flex items-center justify-between gap-2">
                                {s.estimated_duration_minutes ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" /> ~{s.estimated_duration_minutes} min
                                  </span>
                                ) : <span />}
                                <div className="flex gap-2">
                                  <Button size="sm" variant="outline" onClick={() => { cart.add(shop.id, { kind: "service", refId: s.id, name: s.name, unit_price_cents: s.price_ttc_cents, tax_rate: 20 }); toast.success("Ajouté au panier"); }}>
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button asChild size="sm" variant="outline">
                                    <Link to="/reserver/$shopId" params={{ shopId: shop.id }} search={{ service: s.id } as any}>Réserver</Link>
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Products */}
        <section className="border-t border-border bg-secondary/20 py-10 mt-6">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-electric" />
              <h2 className="text-xl font-semibold">Produits disponibles</h2>
              <Badge variant="secondary" className="ml-1">{products.length}{products.length !== allProducts.length ? ` / ${allProducts.length}` : ""}</Badge>
            </div>
            {allProducts.length > 4 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr,200px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={prodQuery} onChange={(e) => setProdQuery(e.target.value)} placeholder="Rechercher un produit, une marque, un SKU…" className="h-10 pl-9" />
                </div>
                <Select value={prodCat} onValueChange={setProdCat}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes catégories</SelectItem>
                    {productCats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {allProducts.length === 0 ? (
              <EmptyBlock text="Aucun produit publié pour l'instant." />
            ) : products.length === 0 ? (
              <EmptyBlock text="Aucun produit ne correspond à votre recherche." />
            ) : (
              <div className="mt-6 space-y-8">
                {Object.entries(productsByCat).map(([cat, items]) => (
                  <div key={cat}>
                    <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">{cat}</h3>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((p) => (
                        <li key={p.id}>
                          <Card className="h-full transition-shadow hover:shadow-md">
                            <CardContent className="flex h-full flex-col gap-2 pt-6">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="font-semibold leading-tight line-clamp-2">{p.name}</h4>
                                  {p.brand && <div className="mt-0.5 text-xs text-muted-foreground">{p.brand}</div>}
                                </div>
                                {p.in_stock ? (
                                  <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">En stock</Badge>
                                ) : (
                                  <Badge variant="outline" className="shrink-0 text-muted-foreground">Sur commande</Badge>
                                )}
                              </div>
                              {p.description && <p className="line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                              <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                                <div>
                                  <div className="text-lg font-bold">{formatMoney(p.price_ttc_cents)}</div>
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">TTC</div>
                                </div>
                                <Button
                                  size="sm"
                                  disabled={!p.in_stock}
                                  onClick={() => { cart.add(shop.id, { kind: "product", refId: p.id, name: p.name, unit_price_cents: p.price_ttc_cents, tax_rate: 20 }); toast.success("Ajouté au panier"); }}
                                >
                                  <Plus className="mr-1 h-3.5 w-3.5" /> Panier
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="pt-2 text-xs text-muted-foreground">
                  Ajoutez au panier puis envoyez la demande à la boutique. Elle vous recontactera pour confirmer et convenir du règlement.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />

      {/* Floating cart button */}
      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-electric px-4 py-3 text-sm font-semibold text-electric-foreground shadow-lg hover:bg-electric/90 md:bottom-6"
        >
          <ShoppingCart className="h-4 w-4" />
          Panier · {cartCount}
        </button>
      )}
      <CartDrawer shopId={shop.id} shopName={shop.name} open={cartOpen} onOpenChange={setCartOpen} />

      {/* Mobile fixed action bar */}
      <nav
        aria-label="Actions rapides"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 gap-1 border-t border-border bg-background/95 p-2 backdrop-blur md:hidden"
      >
        {shop.phone ? (
          <a href={`tel:${shop.phone}`} className="flex flex-col items-center justify-center rounded-md py-2 text-xs font-medium hover:bg-secondary">
            <Phone className="mb-0.5 h-4 w-4" /> Appeler
          </a>
        ) : <span />}
        {mapsUrl ? (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center rounded-md py-2 text-xs font-medium hover:bg-secondary">
            <Navigation className="mb-0.5 h-4 w-4" /> Itinéraire
          </a>
        ) : <span />}
        <a href={contactHref} className="flex flex-col items-center justify-center rounded-md bg-electric py-2 text-xs font-medium text-electric-foreground">
          <MessageSquare className="mb-0.5 h-4 w-4" /> Contacter
        </a>
      </nav>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function groupBy<T>(list: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of list) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}