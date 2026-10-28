import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { publicGetOrderByToken, publicPostOrderMessage } from "@/lib/orders.functions";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { MessageSquare } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente de confirmation",
  confirmed: "Confirmée par la boutique",
  paid: "Payée",
  ready: "Prête pour retrait",
  delivered: "Remise / livrée",
  cancelled: "Annulée",
};

export const Route = createFileRoute("/commande/$token")({
  head: () => ({ meta: [{ title: "Suivi de commande — BPEI" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ params }) => {
    const d = await publicGetOrderByToken({ data: { token: params.token } });
    if (!d) throw notFound();
    return d;
  },
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Commande introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </main>
      <SiteFooter />
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Commande introuvable</h1>
      </main>
      <SiteFooter />
    </div>
  ),
  component: OrderPage,
});

function OrderPage() {
  const { token } = Route.useParams();
  const initial = Route.useLoaderData() as any;
  const fetchFn = useServerFn(publicGetOrderByToken);
  const postFn = useServerFn(publicPostOrderMessage);
  const { data, refetch } = useQuery({
    queryKey: ["public-order", token],
    queryFn: () => fetchFn({ data: { token } }),
    initialData: initial,
    refetchInterval: 30_000,
  });
  const [msg, setMsg] = useState("");
  const [name, setName] = useState(initial?.order?.contact_name ?? "");
  const mut = useMutation({
    mutationFn: () => postFn({ data: { token, body: msg, authorName: name } }),
    onSuccess: () => { setMsg(""); toast.success("Message envoyé"); refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const order = data.order;
  const shop = data.shop;
  const items = data.items as any[];
  const messages = data.messages as any[];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 md:px-6">
        <div className="mb-6">
          <Link to="/b/$shopId" params={{ shopId: shop.id }} className="text-xs text-muted-foreground hover:text-foreground">
            ← Retour à la boutique
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Commande {order.order_number ?? ""}</h1>
          <p className="text-sm text-muted-foreground">
            Passée auprès de <span className="font-medium text-foreground">{shop.name}</span>
            {shop.city ? ` — ${shop.city}` : ""}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                Détail
                <Badge>{STATUS_LABEL[order.status] ?? order.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {it.quantity} × {formatMoney(it.unit_price_cents)} · TVA {it.tax_rate}%
                      </div>
                    </div>
                    <div className="font-semibold">{formatMoney(it.line_total_cents)}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 space-y-1 border-t pt-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Sous-total HT</span><span>{formatMoney(order.subtotal_cents)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span>{formatMoney(order.tax_cents)}</span></div>
                <div className="flex justify-between text-base font-bold"><span>Total TTC</span><span>{formatMoney(order.total_cents)}</span></div>
                <div className="pt-2 text-xs text-muted-foreground">
                  Paiement : {order.payment_status === "paid" ? "réglée" : "à régler avec la boutique (en boutique ou lien de paiement)"}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Contact boutique</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="font-medium">{shop.name}</div>
              {shop.phone && <div><a href={`tel:${shop.phone}`} className="hover:underline">{shop.phone}</a></div>}
              {shop.email && <div><a href={`mailto:${shop.email}`} className="hover:underline">{shop.email}</a></div>}
              <p className="pt-3 text-xs text-muted-foreground">Conservez ce lien pour suivre la commande.</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" /> Messagerie</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="mb-4 space-y-3">
              {messages.length === 0 && <li className="text-sm text-muted-foreground">Aucun message pour l'instant.</li>}
              {messages.map((m) => (
                <li key={m.id} className={`rounded-md border p-3 text-sm ${m.author_type === "shop" ? "bg-secondary/30" : "bg-background"}`}>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium">{m.author_type === "shop" ? shop.name : m.author_name || "Vous"}</span>
                    <span>{new Date(m.created_at).toLocaleString("fr-FR")}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <Input placeholder="Votre nom" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea rows={3} placeholder="Votre message" value={msg} onChange={(e) => setMsg(e.target.value)} />
              <Button onClick={() => mut.mutate()} disabled={!msg.trim() || mut.isPending}>Envoyer</Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}