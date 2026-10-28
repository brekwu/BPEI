import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { getInvoice, replaceInvoiceLines, issueInvoice } from "@/lib/invoices.functions";
import { listCatalog } from "@/lib/catalog.functions";
import { recordPayment } from "@/lib/payments.functions";
import { getBillingSettings, billingSettingsMissing } from "@/lib/billing-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatMoney, formatDate, formatDateTime, toCents } from "@/lib/money";
import { LineItemsEditor, type EditableLine } from "@/components/shop/LineItemsEditor";
import { InvoiceStatusBadge } from "@/components/shop/DocumentStatusBadge";
import { BillingSettingsBanner } from "@/components/shop/BillingSettingsBanner";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance-constants";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, CreditCard, Link2, Copy } from "lucide-react";
import { createPaymentLink } from "@/lib/payment-links.functions";
import { canManageShop } from "@/lib/shop-constants";
import { DownloadPdfButton, PdfDownloadButton } from "@/components/shop/DownloadPdfButton";
import { getPaymentReceiptPdf } from "@/lib/documents-extra.functions";
import { PageContainer, SectionCard, EmptyState } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { StripeCheckoutButton } from "@/components/shop/StripeCheckoutButton";
import { StripeRefundButton } from "@/components/shop/StripeRefundButton";
import { TerminalCheckoutDialog } from "@/components/shop/TerminalCheckoutDialog";
import { TerminalRefundButton } from "@/components/shop/TerminalRefundButton";
import { Smartphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/invoices/$invoiceId")({
  head: () => ({ meta: [{ title: "Facture — BPEI" }] }),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { shopId, invoiceId } = Route.useParams();
  const ctx = useShop();
  const qc = useQueryClient();
  const getFn = useServerFn(getInvoice);
  const catFn = useServerFn(listCatalog);
  const replaceFn = useServerFn(replaceInvoiceLines);
  const issueFn = useServerFn(issueInvoice);
  const payFn = useServerFn(recordPayment);
  const settingsFn = useServerFn(getBillingSettings);
  const createLinkFn = useServerFn(createPaymentLink);

  const detail = useQuery({
    queryKey: ["invoice", shopId, invoiceId],
    queryFn: () => getFn({ data: { shopId, invoiceId } }),
  });
  const catalog = useQuery({
    queryKey: ["catalog", shopId, false],
    queryFn: () => catFn({ data: { shopId, includeArchived: false } }),
  });
  const settings = useQuery({
    queryKey: ["billing-settings", shopId],
    queryFn: () => settingsFn({ data: { shopId } }),
  });

  const [lines, setLines] = useState<EditableLine[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [tpeOpen, setTpeOpen] = useState(false);


  if (detail.isLoading || !detail.data) {
    return (
      <PageContainer size="wide">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </PageContainer>
    );
  }
  const inv = detail.data.invoice as any;
  const currentLines: EditableLine[] = lines ?? (detail.data.lines as any[]).map((l, i) => ({
    id: l.id, line_type: l.line_type, catalog_item_id: l.catalog_item_id,
    description: l.description, quantity: Number(l.quantity), unit: l.unit,
    unit_price_cents: l.unit_price_cents, discount_percent: Number(l.discount_percent),
    tax_rate: Number(l.tax_rate), display_order: l.display_order ?? i,
  }));
  const locked = !!inv.locked_at;
  const isDraft = inv.status === "draft";
  const canManage = canManageShop(ctx.role);
  const missing = billingSettingsMissing(settings.data);

  async function saveLines() {
    await replaceFn({ data: { shopId, invoiceId, lines: currentLines } });
    setDirty(false); setLines(null);
    qc.invalidateQueries({ queryKey: ["invoice", shopId, invoiceId] });
    toast.success("Lignes enregistrées");
  }

  async function issue() {
    if (currentLines.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    if (dirty) await saveLines();
    await issueFn({ data: { shopId, invoiceId } });
    qc.invalidateQueries({ queryKey: ["invoice", shopId, invoiceId] });
    toast.success("Facture émise et verrouillée");
  }

  return (
    <PageContainer size="wide">
      {missing.length > 0 && <BillingSettingsBanner missing={missing} shopId={shopId} />}

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 pb-2 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-electric">Facture</div>
            <InvoiceStatusBadge status={inv.status} />
          </div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {inv.invoice_number ?? "Brouillon de facture"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Émise le {formatDate(inv.issue_date)} · Échéance {formatDate(inv.due_date)} · Total <span className="tabular-nums">{formatMoney(inv.total_including_tax_cents, inv.currency)}</span> · Solde <span className="tabular-nums font-semibold text-foreground">{formatMoney(inv.amount_due_cents, inv.currency)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && isDraft && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button><Send className="mr-2 h-4 w-4" />Émettre</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Émettre définitivement ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Un numéro sera attribué et la facture verrouillée. Toute correction devra ensuite passer par un avoir.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={issue}>Émettre</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canManage && !isDraft && inv.amount_due_cents > 0 && (
            <Button variant="secondary" onClick={() => setPayOpen(true)}><CreditCard className="mr-2 h-4 w-4" />Enregistrer un paiement</Button>
          )}
          {canManage && !isDraft && inv.amount_due_cents > 0 && (
            <Button variant="outline" onClick={async () => {
              try {
                const res = await createLinkFn({ data: {
                  shopId, amountCents: inv.amount_due_cents, invoiceId,
                  customerId: detail.data.customer?.id ?? null,
                  label: `Facture ${inv.invoice_number ?? ""}`.trim(),
                } });
                const url = `${window.location.origin}/pay/${res.token}`;
                setLinkUrl(url);
                setLinkOpen(true);
              } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
            }}><Link2 className="mr-2 h-4 w-4" />Générer un lien</Button>
          )}
          {canManage && !isDraft && inv.amount_due_cents > 0 && (
            <StripeCheckoutButton shopId={shopId} invoiceId={invoiceId} />
          )}
          {canManage && !isDraft && inv.amount_due_cents > 0 && (
            <Button variant="default" onClick={() => setTpeOpen(true)}>
              <Smartphone className="mr-2 h-4 w-4" />Encaisser au TPE
            </Button>
          )}
          <DownloadPdfButton shopId={shopId} id={invoiceId} kind="invoice" />
          <Button variant="ghost" onClick={() => window.print()}>Imprimer</Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard
            title="Lignes"
            action={dirty && !locked ? <Button size="sm" onClick={saveLines}>Enregistrer</Button> : null}
          >
            <LineItemsEditor
              value={currentLines}
              onChange={(v) => { setLines(v); setDirty(true); }}
              catalog={catalog.data as any}
              disabled={locked}
            />
          </SectionCard>

          <SectionCard title="Paiements" padded={false}>
            {(detail.data.payments as any[]).length === 0 ? (
              <EmptyState icon={<CreditCard className="h-6 w-6" />} title="Aucun paiement" description="Aucun paiement n'a encore été enregistré pour cette facture." className="border-0 rounded-none" />
            ) : (
              <ul className="divide-y divide-border">
                {(detail.data.payments as any[]).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{formatDateTime(p.paid_at)} — {PAYMENT_METHOD_LABEL[p.method as keyof typeof PAYMENT_METHOD_LABEL]}</div>
                      {p.reference && <div className="truncate text-xs text-muted-foreground">Réf : {p.reference}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="tabular-nums font-medium">
                        {formatMoney(p.amount_cents, p.currency)}
                        {p.refunded_amount_cents > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">(remb. {formatMoney(p.refunded_amount_cents, p.currency)})</span>
                        )}
                      </div>
                      {canManage && p.provider === "stripe" && p.connector_type !== "stripe_terminal" && (p.refunded_amount_cents ?? 0) < p.amount_cents && (
                        <StripeRefundButton shopId={shopId} paymentId={p.id} maxCents={p.amount_cents - (p.refunded_amount_cents ?? 0)} currency={p.currency} />
                      )}
                      {canManage && p.connector_type === "stripe_terminal" && (
                        <TerminalRefundButton
                          shopId={shopId}
                          payment={p}
                          onRefunded={() => qc.invalidateQueries({ queryKey: ["invoice", shopId, invoiceId] })}
                        />
                      )}
                      <PdfDownloadButton
                        fn={getPaymentReceiptPdf}
                        data={{ shopId: shopId, paymentId: p.id }}
                        label="Reçu"
                        fallbackFilename={`recu-${p.id.slice(0, 8)}.pdf`}
                        compact
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Client">
            {detail.data.customer ? (
              <div className="space-y-1 text-sm">
                <div className="font-medium">{detail.data.customer.customer_type === "business"
                  ? detail.data.customer.company_name
                  : `${detail.data.customer.first_name ?? ""} ${detail.data.customer.last_name ?? ""}`.trim()}</div>
                {detail.data.customer.email && <div className="text-muted-foreground">{detail.data.customer.email}</div>}
              </div>
            ) : <div className="text-sm text-muted-foreground">Aucun client rattaché</div>}
          </SectionCard>
          {inv.quote_id && (
            <SectionCard>
              <a className="text-sm text-electric hover:underline" href={`/app/shop/${shopId}/quotes/${inv.quote_id}`}>
                <FileText className="mr-1.5 inline h-4 w-4" />Devis d'origine
              </a>
            </SectionCard>
          )}
        </div>
      </div>

      <RecordPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        amountDueCents={inv.amount_due_cents}
        currency={inv.currency}
        onSubmit={async (v) => {
          await payFn({ data: { shopId, invoiceId, ...v } });
          qc.invalidateQueries({ queryKey: ["invoice", shopId, invoiceId] });
          setPayOpen(false);
          toast.success("Paiement enregistré");
        }}
      />

      <TerminalCheckoutDialog
        open={tpeOpen}
        onOpenChange={(v) => {
          setTpeOpen(v);
          if (!v) qc.invalidateQueries({ queryKey: ["invoice", shopId, invoiceId] });
        }}
        shopId={shopId}
        invoiceId={invoiceId}
        invoiceNumber={inv.invoice_number}
        amountDueCents={inv.amount_due_cents}
        currency={inv.currency}
        customerLabel={detail.data.customer ? (detail.data.customer.company_name ?? `${detail.data.customer.first_name ?? ""} ${detail.data.customer.last_name ?? ""}`.trim()) : null}
      />

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Lien de paiement créé</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Partagez ce lien avec votre client. Il pourra consulter le montant, la référence à indiquer et vos coordonnées bancaires.</p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
              <code className="flex-1 truncate text-xs">{linkUrl}</code>
              <Button size="sm" variant="ghost" onClick={() => { if (linkUrl) { navigator.clipboard.writeText(linkUrl); toast.success("Copié"); } }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setLinkOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function RecordPaymentDialog({
  open, onOpenChange, amountDueCents, currency, onSubmit,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  amountDueCents: number; currency: string;
  onSubmit: (v: { amount_cents: number; method: any; reference?: string; notes?: string }) => Promise<void>;
}) {
  const [amount, setAmount] = useState((amountDueCents / 100).toFixed(2));
  const [method, setMethod] = useState<string>("card_terminal");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Enregistrer un paiement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Montant ({currency})</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="mt-1 text-xs text-muted-foreground">Solde restant : {formatMoney(amountDueCents, currency)}</div>
          </div>
          <div><Label>Méthode</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Référence (optionnel)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></div>
          <div><Label>Notes (optionnel)</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => onSubmit({
            amount_cents: toCents(amount),
            method: method as any,
            reference: reference || undefined,
            notes: notes || undefined,
          })}>Confirmer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}