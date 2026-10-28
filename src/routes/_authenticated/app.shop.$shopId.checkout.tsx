import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { PageContainer, PageHeader, SectionCard, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  createSaleDraft, getSale, addSaleLine, updateSaleLine, removeSaleLine,
  setSaleCustomer, cancelSaleDraft, quickCreateCustomer, confirmSale,
  searchCatalog, searchCustomers, getCheckoutSettings,
} from "@/lib/checkout.functions";
import {
  ScanLine, Search, X, Trash2, User as UserIcon, UserPlus, CreditCard,
  Banknote, ArrowRight, Package, Wrench, PlusCircle, Loader2, CheckCircle2,
} from "lucide-react";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance-constants";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/checkout")({
  head: () => ({ meta: [{ title: "Encaissement — BPEI" }] }),
  component: CheckoutPage,
});

function euros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

type CustomerRow = { id: string; first_name: string | null; last_name: string | null; company_name: string | null; email: string | null; phone: string | null };

function customerLabel(c: CustomerRow | null | undefined) {
  if (!c) return "Vente au comptoir";
  const parts = [c.company_name, [c.first_name, c.last_name].filter(Boolean).join(" ")].filter(Boolean);
  return parts.join(" — ") || c.email || c.phone || "Client";
}

function CheckoutPage() {
  const { shopId } = useShop();
  const qc = useQueryClient();

  // Server fns
  const createDraft = useServerFn(createSaleDraft);
  const getSaleFn = useServerFn(getSale);
  const addLineFn = useServerFn(addSaleLine);
  const updateLineFn = useServerFn(updateSaleLine);
  const removeLineFn = useServerFn(removeSaleLine);
  const setCustomerFn = useServerFn(setSaleCustomer);
  const cancelFn = useServerFn(cancelSaleDraft);
  const quickCustFn = useServerFn(quickCreateCustomer);
  const confirmFn = useServerFn(confirmSale);
  const searchCatFn = useServerFn(searchCatalog);
  const searchCustFn = useServerFn(searchCustomers);
  const settingsFn = useServerFn(getCheckoutSettings);

  const [saleId, setSaleId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [customerModal, setCustomerModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const settingsQ = useQuery({
    queryKey: ["checkout-settings", shopId],
    queryFn: () => settingsFn({ data: { shopId } }),
  });

  // Create draft on mount
  useEffect(() => {
    if (saleId) return;
    createDraft({ data: { shopId, source: "counter" } })
      .then((id) => setSaleId(id))
      .catch((e: Error) => toast.error(e.message));
  }, [shopId, saleId, createDraft]);

  const saleQ = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => getSaleFn({ data: { saleId: saleId! } }),
    enabled: !!saleId,
    refetchOnWindowFocus: false,
  });

  const catalogQ = useQuery({
    queryKey: ["checkout-search", shopId, q],
    queryFn: () => searchCatFn({ data: { shopId, q } }),
    enabled: q.trim().length >= 1,
  });

  const invalidateSale = () => qc.invalidateQueries({ queryKey: ["sale", saleId] });

  const addLineMut = useMutation({
    mutationFn: (v: Parameters<typeof addLineFn>[0]["data"]) => addLineFn({ data: v }),
    onSuccess: () => { invalidateSale(); setQ(""); searchRef.current?.focus(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLineMut = useMutation({
    mutationFn: (v: Parameters<typeof updateLineFn>[0]["data"]) => updateLineFn({ data: v }),
    onSuccess: invalidateSale,
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLineMut = useMutation({
    mutationFn: (lineId: string) => removeLineFn({ data: { lineId } }),
    onSuccess: invalidateSale,
    onError: (e: Error) => toast.error(e.message),
  });

  const setCustMut = useMutation({
    mutationFn: (customerId: string | undefined) =>
      setCustomerFn({ data: { saleId: saleId!, customerId } }),
    onSuccess: () => { invalidateSale(); setCustomerModal(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: { saleId: saleId! } }),
    onSuccess: () => {
      toast.success("Vente annulée");
      setSaleId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sale = saleQ.data?.sale;
  const lines = saleQ.data?.lines ?? [];

  const total = sale?.total_including_tax_cents ?? 0;
  const subtotal = sale?.subtotal_excluding_tax_cents ?? 0;
  const tax = sale?.tax_total_cents ?? 0;

  // Fetch customer if set
  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  useEffect(() => {
    if (!sale?.customer_id) { setCustomer(null); return; }
    searchCustFn({ data: { shopId, q: sale.customer_id.slice(0, 8) } })
      .then(() => {}) // best-effort; actual lookup below
      .catch(() => {});
  }, [sale?.customer_id, shopId, searchCustFn]);

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Boutique"
        title="Encaissement"
        description="Vente rapide au comptoir avec facture ou reçu automatique."
        actions={
          sale && lines.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => cancelMut.mutate()}>
              <X className="mr-2 h-4 w-4" />Annuler la vente
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {/* Zone A — Search */}
          <SectionCard title="Ajouter des articles">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un produit, un service, un code-barres…"
                className="pl-9"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {q.trim().length >= 1 && (
              <div className="mt-3 space-y-1 max-h-80 overflow-y-auto rounded-md border border-border">
                {catalogQ.isLoading && (
                  <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />Recherche…
                  </div>
                )}
                {catalogQ.data && catalogQ.data.products.length === 0 && catalogQ.data.services.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">Aucun résultat.</div>
                )}
                {catalogQ.data?.products.map((p: any) => (
                  <button
                    key={`p-${p.id}`}
                    type="button"
                    onClick={() => saleId && addLineMut.mutate({ saleId, lineType: "product", stockItemId: p.id, quantity: 1 })}
                    className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-secondary"
                  >
                    <Package className="h-4 w-4 text-electric" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.sku ? `SKU ${p.sku} · ` : ""}Stock : {Number(p.quantity)}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{euros(p.sell_price_cents)}</div>
                  </button>
                ))}
                {catalogQ.data?.services.map((s: any) => (
                  <button
                    key={`s-${s.id}`}
                    type="button"
                    onClick={() => saleId && addLineMut.mutate({ saleId, lineType: "service", serviceCatalogId: s.id, quantity: 1 })}
                    className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-secondary"
                  >
                    <Wrench className="h-4 w-4 text-electric" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.name}</div>
                      {s.description && <div className="truncate text-xs text-muted-foreground">{s.description}</div>}
                    </div>
                    <div className="text-sm font-semibold">{euros(s.price_cents)}</div>
                  </button>
                ))}
              </div>
            )}

            {settingsQ.data?.allow_free_line !== false && (
              <div className="mt-3">
                <FreeLineForm
                  onAdd={(payload) => saleId && addLineMut.mutate({ saleId, lineType: "free", ...payload })}
                />
              </div>
            )}
          </SectionCard>

          {/* Zone B — Cart */}
          <SectionCard title={`Panier (${lines.length} ligne${lines.length > 1 ? "s" : ""})`}>
            {lines.length === 0 ? (
              <EmptyState icon={<ScanLine className="h-6 w-6" />} title="Panier vide" description="Recherchez un produit ou une prestation ci-dessus." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2">Article</th>
                      <th className="py-2 text-right">Qté</th>
                      <th className="py-2 text-right">PU HT</th>
                      <th className="py-2 text-right">TVA</th>
                      <th className="py-2 text-right">Total TTC</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l: any) => (
                      <tr key={l.id} className="border-b border-border last:border-b-0">
                        <td className="py-2">
                          <div className="font-medium">{l.name_snapshot}</div>
                          {l.sku_snapshot && <div className="text-xs text-muted-foreground">SKU {l.sku_snapshot}</div>}
                          {l.discount_percent > 0 && (
                            <Badge variant="secondary" className="mt-1">−{Number(l.discount_percent)}%</Badge>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min={0.01}
                            step={1}
                            defaultValue={Number(l.quantity)}
                            onBlur={(e) => {
                              const v = Number(e.currentTarget.value);
                              if (v > 0 && v !== Number(l.quantity)) {
                                updateLineMut.mutate({ lineId: l.id, quantity: v });
                              }
                            }}
                            className="w-16 rounded border border-border bg-surface px-2 py-1 text-right"
                          />
                        </td>
                        <td className="py-2 text-right">{euros(l.unit_price_cents)}</td>
                        <td className="py-2 text-right">{Number(l.tax_rate)}%</td>
                        <td className="py-2 text-right font-semibold">{euros(l.line_total_cents)}</td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeLineMut.mutate(l.id)}
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        {/* Zone C — Summary */}
        <div className="space-y-4">
          <SectionCard title="Client">
            <button
              type="button"
              onClick={() => setCustomerModal(true)}
              className="flex w-full items-center gap-3 rounded-md border border-border px-3 py-2 text-left hover:bg-secondary"
            >
              <UserIcon className="h-4 w-4 text-electric" />
              <span className="flex-1 truncate">{sale?.customer_id ? "Client sélectionné" : "Vente au comptoir"}</span>
              <span className="text-xs text-muted-foreground">Modifier</span>
            </button>
          </SectionCard>

          <SectionCard title="Résumé">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Sous-total HT</dt><dd>{euros(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">TVA</dt><dd>{euros(tax)}</dd></div>
              <div className="my-2 h-px bg-border" />
              <div className="flex justify-between text-lg font-bold"><dt>Total TTC</dt><dd>{euros(total)}</dd></div>
            </dl>
            <Button
              className="mt-4 w-full"
              size="lg"
              disabled={!saleId || lines.length === 0 || total <= 0}
              onClick={() => setPayModal(true)}
            >
              <CreditCard className="mr-2 h-4 w-4" />Encaisser {total > 0 && `— ${euros(total)}`}
            </Button>
          </SectionCard>
        </div>
      </div>

      {customerModal && saleId && (
        <CustomerPicker
          shopId={shopId}
          searchCustFn={searchCustFn}
          onPick={(cid) => setCustMut.mutate(cid)}
          onCreate={async (payload) => {
            try {
              const id = await quickCustFn({ data: { shopId, ...payload } });
              setCustMut.mutate(id);
            } catch (e: any) { toast.error(e.message); }
          }}
          onClose={() => setCustomerModal(false)}
          onClear={() => setCustMut.mutate(undefined)}
        />
      )}

      {payModal && saleId && sale && (
        <PaymentDialog
          saleId={saleId}
          total={total}
          settings={settingsQ.data}
          confirmFn={confirmFn}
          onClose={() => setPayModal(false)}
          onDone={(res) => {
            toast.success(res.invoice_number
              ? `Facture ${res.invoice_number} créée`
              : res.receipt_number
                ? `Reçu ${res.receipt_number} enregistré`
                : "Vente enregistrée");
            setPayModal(false);
            setSaleId(null);
          }}
        />
      )}
    </PageContainer>
  );
}

function FreeLineForm({ onAdd }: { onAdd: (v: { customName: string; customPriceCents: number; customTaxRate?: number }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [tax, setTax] = useState("20");

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <PlusCircle className="mr-2 h-4 w-4" />Ligne libre
      </Button>
    );
  }
  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <Input placeholder="Description" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Prix HT (€)" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Input placeholder="TVA %" type="number" step="0.1" value={tax} onChange={(e) => setTax(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annuler</Button>
        <Button size="sm" onClick={() => {
          const cents = Math.round(Number(price) * 100);
          if (!name.trim() || !(cents >= 0)) { toast.error("Description et prix requis"); return; }
          onAdd({ customName: name.trim(), customPriceCents: cents, customTaxRate: Number(tax) });
          setName(""); setPrice(""); setOpen(false);
        }}>Ajouter</Button>
      </div>
    </div>
  );
}

function CustomerPicker({
  shopId, searchCustFn, onPick, onCreate, onClose, onClear,
}: {
  shopId: string;
  searchCustFn: any;
  onPick: (id: string) => void;
  onCreate: (v: { lastName: string; firstName?: string; phone?: string; email?: string }) => void;
  onClose: () => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"search" | "create">("search");
  const [ln, setLn] = useState(""); const [fn, setFn] = useState(""); const [ph, setPh] = useState(""); const [em, setEm] = useState("");

  const qq = useQuery({
    queryKey: ["cust-search", shopId, q],
    queryFn: () => searchCustFn({ data: { shopId, q } }),
    enabled: q.trim().length >= 1,
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sélectionner un client</DialogTitle>
          <DialogDescription>Rechercher un client existant ou en créer un rapidement.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button variant={mode === "search" ? "default" : "outline"} size="sm" onClick={() => setMode("search")}>
            <Search className="mr-2 h-3.5 w-3.5" />Rechercher
          </Button>
          <Button variant={mode === "create" ? "default" : "outline"} size="sm" onClick={() => setMode("create")}>
            <UserPlus className="mr-2 h-3.5 w-3.5" />Créer
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>Vente au comptoir</Button>
        </div>

        {mode === "search" ? (
          <div className="space-y-2">
            <Input autoFocus placeholder="Nom, téléphone ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-64 overflow-y-auto divide-y divide-border">
              {(qq.data ?? []).map((c: CustomerRow) => (
                <button key={c.id} type="button" onClick={() => onPick(c.id)}
                  className="flex w-full items-center gap-2 py-2 text-left hover:bg-secondary rounded px-2">
                  <UserIcon className="h-4 w-4 text-electric" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{customerLabel(c)}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.phone || c.email || ""}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <Label>Nom *</Label>
              <Input value={ln} onChange={(e) => setLn(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Prénom</Label><Input value={fn} onChange={(e) => setFn(e.target.value)} /></div>
              <div><Label>Téléphone</Label><Input value={ph} onChange={(e) => setPh(e.target.value)} /></div>
            </div>
            <div><Label>E-mail</Label><Input type="email" value={em} onChange={(e) => setEm(e.target.value)} /></div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Annuler</Button>
              <Button onClick={() => {
                if (!ln.trim()) { toast.error("Nom requis"); return; }
                onCreate({ lastName: ln.trim(), firstName: fn.trim() || undefined, phone: ph.trim() || undefined, email: em.trim() || undefined });
              }}>Créer et sélectionner</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type PayMethod = "card_terminal" | "cash" | "cheque" | "bank_transfer" | "pickup" | "manual_received" | "other";

function PaymentDialog({
  saleId, total, settings, confirmFn, onClose, onDone,
}: {
  saleId: string;
  total: number;
  settings: any;
  confirmFn: any;
  onClose: () => void;
  onDone: (res: any) => void;
}) {
  const enabled: PayMethod[] = useMemo(() => {
    const arr = (settings?.enabled_methods as string[]) ?? ["card_terminal","cash","cheque","bank_transfer","pickup","manual_received"];
    return arr.filter((m): m is PayMethod =>
      ["card_terminal","cash","cheque","bank_transfer","pickup","manual_received","other"].includes(m));
  }, [settings]);

  const defaultDoc = (settings?.default_document as string) === "receipt" ? "receipt" : "invoice";
  const [method, setMethod] = useState<PayMethod>(enabled[0] ?? "card_terminal");
  const [terminalId, setTerminalId] = useState("");
  const [last4, setLast4] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [createDoc, setCreateDoc] = useState<"invoice" | "receipt" | "none">(defaultDoc as any);
  const [pending, setPending] = useState(false);

  async function confirmPayment() {
    if (pending) return;
    setPending(true);
    try {
      const res = await confirmFn({
        data: {
          saleId,
          payments: [{
            method,
            amount_cents: total,
            status: "confirmed",
            reference: reference || undefined,
            terminal_id: terminalId || undefined,
            card_last4: /^\d{4}$/.test(last4) ? last4 : undefined,
            connector_type: method === "card_terminal" ? "manual_terminal" : undefined,
            note: note || undefined,
          }],
          createDocument: createDoc,
          idempotencyKey: `sale-${saleId}`,
        },
      });
      onDone(res);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Encaissement</DialogTitle>
          <DialogDescription>
            Montant à encaisser : <span className="font-bold text-foreground">{(total/100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"})}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Moyen de paiement</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {enabled.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex items-center gap-2 rounded-md border p-2 text-sm ${method === m ? "border-electric bg-electric-soft" : "border-border hover:bg-secondary"}`}
                >
                  {m === "cash" ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                  {PAYMENT_METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          {method === "card_terminal" && (
            <div className="rounded-md border border-electric bg-electric-soft p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-electric">
                <CreditCard className="h-4 w-4" />
                Saisissez {(total/100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"})} sur le TPE
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Confirmez ci-dessous une fois le paiement accepté par le terminal.
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Terminal (facultatif)</Label>
                  <Input value={terminalId} onChange={(e) => setTerminalId(e.target.value)} placeholder="TPE-01" />
                </div>
                <div>
                  <Label className="text-xs">4 derniers chiffres</Label>
                  <Input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" />
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-xs">Référence transaction (facultatif)</Label>
                <Input value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>
          )}

          {method !== "card_terminal" && (
            <div>
              <Label>Référence (facultatif)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === "cheque" ? "N° chèque" : ""} />
            </div>
          )}

          <div>
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optionnelle" />
          </div>

          <div>
            <Label>Document</Label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(["invoice","receipt","none"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setCreateDoc(d)}
                  className={`rounded-md border p-2 text-sm ${createDoc === d ? "border-electric bg-electric-soft" : "border-border hover:bg-secondary"}`}
                >
                  {d === "invoice" ? "Facture" : d === "receipt" ? "Reçu" : "Aucun"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={confirmPayment} disabled={pending}>
            {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</> :
              <><CheckCircle2 className="mr-2 h-4 w-4" />Paiement accepté</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}