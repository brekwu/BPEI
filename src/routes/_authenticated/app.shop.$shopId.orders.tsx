import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useShop } from "@/components/shop/ShopLayout";
import { shopListOrders, shopGetOrder, shopUpdateOrderStatus, shopPostOrderMessage } from "@/lib/orders.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/money";
import { toast } from "sonner";
import { MessageSquare, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/orders")({
  head: () => ({ meta: [{ title: "Commandes — BPEI" }] }),
  component: OrdersPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente", confirmed: "Confirmée", paid: "Payée",
  ready: "Prête", delivered: "Remise", cancelled: "Annulée",
};

function OrdersPage() {
  const { shopId } = useShop();
  const listFn = useServerFn(shopListOrders);
  const { data: list = [], refetch } = useQuery({
    queryKey: ["shop-orders", shopId],
    queryFn: () => listFn({ data: { shopId } }),
  });
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-[380px,1fr]">
      <div>
        <h1 className="mb-4 text-xl font-bold">Commandes clients</h1>
        <p className="mb-4 text-sm text-muted-foreground">Reçues depuis votre fiche publique BPEI.</p>
        <ul className="space-y-2">
          {list.length === 0 && (
            <li className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucune commande pour le moment.
            </li>
          )}
          {list.map((o: any) => (
            <li key={o.id}>
              <button
                onClick={() => setSelected(o.id)}
                className={`w-full rounded-lg border p-3 text-left transition hover:bg-secondary/30 ${selected === o.id ? "border-electric" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{o.order_number ?? o.id.slice(0, 8)}</span>
                  <Badge variant="secondary">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{o.contact_name} · {o.contact_phone}</div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{new Date(o.created_at).toLocaleString("fr-FR")}</span>
                  <span className="font-semibold">{formatMoney(o.total_cents)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        {selected ? <OrderDetail orderId={selected} onChange={refetch} /> : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-12 text-sm text-muted-foreground">
            Sélectionnez une commande pour voir le détail et échanger avec le client.
          </div>
        )}
      </div>
    </div>
  );
}

function OrderDetail({ orderId, onChange }: { orderId: string; onChange: () => void }) {
  const getFn = useServerFn(shopGetOrder);
  const statusFn = useServerFn(shopUpdateOrderStatus);
  const msgFn = useServerFn(shopPostOrderMessage);
  const { data, refetch } = useQuery({
    queryKey: ["shop-order", orderId],
    queryFn: () => getFn({ data: { orderId } }),
    refetchInterval: 30_000,
  });
  const [body, setBody] = useState("");
  const statusMut = useMutation({
    mutationFn: (status: any) => statusFn({ data: { orderId, status } }),
    onSuccess: () => { toast.success("Statut mis à jour"); refetch(); onChange(); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });
  const sendMut = useMutation({
    mutationFn: () => msgFn({ data: { orderId, body } }),
    onSuccess: () => { setBody(""); toast.success("Message envoyé"); refetch(); },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  if (!data) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  const { order, items, messages } = data as any;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>{order.order_number}</span>
            <Link to="/commande/$token" params={{ token: order.public_token }} target="_blank" className="text-xs text-electric hover:underline inline-flex items-center gap-1">
              Vue client <ExternalLink className="h-3 w-3" />
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-2 md:grid-cols-2">
            <div><span className="text-muted-foreground">Client :</span> <span className="font-medium">{order.contact_name}</span></div>
            <div><span className="text-muted-foreground">Téléphone :</span> <a href={`tel:${order.contact_phone}`} className="font-medium hover:underline">{order.contact_phone}</a></div>
            {order.contact_email && <div><span className="text-muted-foreground">Email :</span> <a href={`mailto:${order.contact_email}`} className="hover:underline">{order.contact_email}</a></div>}
            <div><span className="text-muted-foreground">Statut paiement :</span> {order.payment_status}</div>
          </div>
          {order.notes && <div className="rounded bg-secondary/40 p-3 text-sm"><span className="text-muted-foreground">Notes client :</span> {order.notes}</div>}

          <ul className="divide-y border-t pt-2">
            {items.map((it: any) => (
              <li key={it.id} className="flex items-center justify-between py-2">
                <div><div className="font-medium">{it.name}</div><div className="text-xs text-muted-foreground">{it.quantity} × {formatMoney(it.unit_price_cents)} · TVA {it.tax_rate}%</div></div>
                <div className="font-semibold">{formatMoney(it.line_total_cents)}</div>
              </li>
            ))}
          </ul>
          <div className="border-t pt-3 text-right text-base font-bold">Total : {formatMoney(order.total_cents)}</div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-sm text-muted-foreground">Changer le statut :</span>
            <Select value={order.status} onValueChange={(v) => statusMut.mutate(v)}>
              <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" /> Messagerie client</CardTitle></CardHeader>
        <CardContent>
          <ul className="mb-4 space-y-3">
            {messages.length === 0 && <li className="text-sm text-muted-foreground">Aucun message.</li>}
            {messages.map((m: any) => (
              <li key={m.id} className={`rounded-md border p-3 text-sm ${m.author_type === "shop" ? "bg-electric/10" : "bg-secondary/30"}`}>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>{m.author_type === "shop" ? "Boutique" : (m.author_name || "Client")}</span>
                  <span>{new Date(m.created_at).toLocaleString("fr-FR")}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Répondre au client…" />
            <Button onClick={() => sendMut.mutate()} disabled={!body.trim() || sendMut.isPending}>Envoyer</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}