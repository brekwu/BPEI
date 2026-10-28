import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  getQuote, replaceQuoteLines, updateQuoteHeader, issueQuote, cancelQuote,
  createQuoteToken, revokeQuoteToken, convertQuoteToInvoice,
} from "@/lib/quotes.functions";
import { listCatalog } from "@/lib/catalog.functions";
import { getBillingSettings, billingSettingsMissing } from "@/lib/billing-settings.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatMoney, formatDateTime, formatDate } from "@/lib/money";
import { LineItemsEditor, emptyLine, type EditableLine } from "@/components/shop/LineItemsEditor";
import { QuoteStatusBadge } from "@/components/shop/DocumentStatusBadge";
import { BillingSettingsBanner } from "@/components/shop/BillingSettingsBanner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Copy, ExternalLink, Send, Ban, FileText } from "lucide-react";
import { canManageShop } from "@/lib/shop-constants";
import { DownloadPdfButton } from "@/components/shop/DownloadPdfButton";
import { PageContainer, PageHeader, SectionCard, EmptyState } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/quotes/$quoteId")({
  head: () => ({ meta: [{ title: "Devis — BPEI" }] }),
  component: QuoteDetail,
});

function QuoteDetail() {
  const { shopId, quoteId } = Route.useParams();
  const ctx = useShop();
  const qc = useQueryClient();
  const nav = useNavigate();

  const getFn = useServerFn(getQuote);
  const listCatFn = useServerFn(listCatalog);
  const settingsFn = useServerFn(getBillingSettings);

  const detail = useQuery({
    queryKey: ["quote", shopId, quoteId],
    queryFn: () => getFn({ data: { shopId, quoteId } }),
  });
  const catalog = useQuery({
    queryKey: ["catalog", shopId, false],
    queryFn: () => listCatFn({ data: { shopId, includeArchived: false } }),
  });
  const settings = useQuery({
    queryKey: ["billing-settings", shopId],
    queryFn: () => settingsFn({ data: { shopId } }),
  });
  const customers = useQuery({
    queryKey: ["customers-lite", shopId],
    queryFn: async () => {
      const { data } = await supabase.from("customers")
        .select("id, first_name, last_name, company_name, customer_type")
        .eq("shop_id", shopId).is("archived_at", null).order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    },
  });

  const replaceLinesFn = useServerFn(replaceQuoteLines);
  const updateHeaderFn = useServerFn(updateQuoteHeader);
  const issueFn = useServerFn(issueQuote);
  const cancelFn = useServerFn(cancelQuote);
  const tokenFn = useServerFn(createQuoteToken);
  const revokeTokenFn = useServerFn(revokeQuoteToken);
  const convertFn = useServerFn(convertQuoteToInvoice);

  const [lines, setLines] = useState<EditableLine[] | null>(null);
  const [dirty, setDirty] = useState(false);

  if (detail.isLoading) {
    return (
      <PageContainer size="wide">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </PageContainer>
    );
  }
  if (!detail.data) {
    return (
      <PageContainer><EmptyState icon={<FileText className="h-6 w-6" />} title="Devis introuvable" /></PageContainer>
    );
  }

  const q = detail.data.quote as any;
  const currentLines: EditableLine[] = lines ?? (detail.data.lines as any[]).map((l, i) => ({
    id: l.id, line_type: l.line_type, catalog_item_id: l.catalog_item_id,
    description: l.description, quantity: Number(l.quantity), unit: l.unit,
    unit_price_cents: l.unit_price_cents, discount_percent: Number(l.discount_percent),
    tax_rate: Number(l.tax_rate), display_order: l.display_order ?? i,
  }));
  const locked = !!q.locked_at;
  const isDraft = q.status === "draft";
  const canManage = canManageShop(ctx.role);
  const missing = billingSettingsMissing(settings.data);

  async function saveLines() {
    await replaceLinesFn({ data: { shopId, quoteId, lines: currentLines } });
    setDirty(false); setLines(null);
    qc.invalidateQueries({ queryKey: ["quote", shopId, quoteId] });
    toast.success("Lignes enregistrées");
  }

  async function issue() {
    if (currentLines.length === 0) { toast.error("Ajoutez au moins une ligne"); return; }
    if (dirty) await saveLines();
    await issueFn({ data: { shopId, quoteId } });
    qc.invalidateQueries({ queryKey: ["quote", shopId, quoteId] });
    toast.success("Devis émis");
  }

  async function copyPublicLink(token: string) {
    const url = `${window.location.origin}/q/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  }

  const activeToken = (detail.data.tokens as any[]).find((t) => !t.revoked_at);

  return (
    <PageContainer size="wide">
      {missing.length > 0 && <BillingSettingsBanner missing={missing} shopId={shopId} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-electric">Devis</div>
        <QuoteStatusBadge status={q.status} />
      </div>
      <PageHeader
        title={q.quote_number ?? "Brouillon de devis"}
        description={`Émis le ${formatDate(q.issue_date)} · Validité ${formatDate(q.valid_until)} · Total ${formatMoney(q.total_including_tax_cents, q.currency)}`}
        className="pb-2"
        actions={
          <>
            {canManage && isDraft && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button><Send className="mr-2 h-4 w-4" />Émettre</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Émettre ce devis ?</AlertDialogTitle>
                    <AlertDialogDescription>Un numéro définitif sera attribué et les informations d'identité figées.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={issue}>Émettre</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canManage && q.status === "accepted" && (
              <Button
                variant="secondary"
                onClick={async () => {
                  const r = await convertFn({ data: { shopId, quoteId } });
                  toast.success("Facture créée");
                  nav({ to: "/app/shop/$shopId/invoices/$invoiceId", params: { shopId, invoiceId: r.invoiceId } });
                }}
              >
                <FileText className="mr-2 h-4 w-4" />Convertir en facture
              </Button>
            )}
            {canManage && ["draft", "sent", "viewed"].includes(q.status) && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="ghost"><Ban className="mr-2 h-4 w-4" />Annuler</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Annuler ce devis ?</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Retour</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => {
                      await cancelFn({ data: { shopId, quoteId } });
                      qc.invalidateQueries({ queryKey: ["quote", shopId, quoteId] });
                      toast.success("Devis annulé");
                    }}>Confirmer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <DownloadPdfButton shopId={shopId} id={quoteId} kind="quote" />
            <Button variant="ghost" onClick={() => window.print()}>Imprimer</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard title="Client & période">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Client</Label>
                <Select
                  disabled={locked}
                  value={q.customer_id ?? ""}
                  onValueChange={async (v) => {
                    await updateHeaderFn({ data: { shopId, quoteId, customer_id: v || null } });
                    qc.invalidateQueries({ queryKey: ["quote", shopId, quoteId] });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {(customers.data ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.customer_type === "business" ? c.company_name : `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Sans nom"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valide jusqu'au</Label>
                <Input type="date" disabled={locked} defaultValue={q.valid_until ?? ""}
                  onBlur={async (e) => {
                    await updateHeaderFn({ data: { shopId, quoteId, valid_until: e.target.value || null } });
                    qc.invalidateQueries({ queryKey: ["quote", shopId, quoteId] });
                  }} />
              </div>
              <div className="md:col-span-2">
                <Label>Message au client</Label>
                <Textarea disabled={locked} defaultValue={q.customer_message ?? ""}
                  onBlur={async (e) => {
                    await updateHeaderFn({ data: { shopId, quoteId, customer_message: e.target.value } });
                  }} />
              </div>
              <div className="md:col-span-2">
                <Label>Notes internes (non visibles par le client)</Label>
                <Textarea disabled={locked} defaultValue={q.internal_notes ?? ""}
                  onBlur={async (e) => {
                    await updateHeaderFn({ data: { shopId, quoteId, internal_notes: e.target.value } });
                  }} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Lignes"
            action={dirty && !locked ? <Button size="sm" onClick={saveLines}>Enregistrer les lignes</Button> : null}
          >
            <LineItemsEditor
              value={currentLines}
              onChange={(v) => { setLines(v); setDirty(true); }}
              catalog={catalog.data as any}
              disabled={locked}
            />
          </SectionCard>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-md border bg-card p-4 space-y-2">
            <h2 className="font-display text-sm font-semibold">Récapitulatif</h2>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sous-total HT</span>
              <span className="tabular-nums">{formatMoney(q.subtotal_cents ?? 0, q.currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">TVA</span>
              <span className="tabular-nums">{formatMoney(q.tax_total_cents ?? 0, q.currency)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <span className="font-semibold">Total TTC</span>
              <span className="font-display text-lg font-semibold tabular-nums text-electric">
                {formatMoney(q.total_including_tax_cents ?? 0, q.currency)}
              </span>
            </div>
            {dirty && !locked && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Modifications non enregistrées</p>
            )}
          </div>

          <div className="rounded-md border bg-background p-4 space-y-3">
            <h2 className="font-semibold">Lien sécurisé pour le client</h2>
            {!q.quote_number ? (
              <p className="text-sm text-muted-foreground">Émettez le devis pour générer un lien de partage.</p>
            ) : (
              <>
                {activeToken ? (
                  <div className="space-y-2">
                    <div className="rounded bg-muted p-2 text-xs break-all">{`${typeof window !== "undefined" ? window.location.origin : ""}/q/${activeToken.token}`}</div>
                    <div className="text-xs text-muted-foreground">
                      Vue{activeToken.view_count > 1 ? "s" : ""} : {activeToken.view_count}
                      {activeToken.last_viewed_at && ` · dernière ${formatDateTime(activeToken.last_viewed_at)}`}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => copyPublicLink(activeToken.token)}>
                        <Copy className="mr-2 h-4 w-4" />Copier
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`/q/${activeToken.token}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Aperçu</a>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        await revokeTokenFn({ data: { shopId, tokenId: activeToken.id } });
                        qc.invalidateQueries({ queryKey: ["quote", shopId, quoteId] });
                        toast.success("Lien révoqué");
                      }}>Révoquer</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" onClick={async () => {
                    await tokenFn({ data: { shopId, quoteId, ttlDays: 60 } });
                    qc.invalidateQueries({ queryKey: ["quote", shopId, quoteId] });
                    toast.success("Lien créé");
                  }}>Générer un lien sécurisé</Button>
                )}
              </>
            )}
          </div>

          {q.accepted_at && (
            <div className="rounded-md border bg-background p-4 text-sm">
              <div className="font-semibold mb-1">Preuve d'acceptation</div>
              <div>Par : {q.accepted_by_name}</div>
              <div>Le : {formatDateTime(q.accepted_at)}</div>
              {q.accepted_ip && <div className="text-xs text-muted-foreground">IP : {q.accepted_ip}</div>}
              {q.document_hash && <div className="text-xs text-muted-foreground">Empreinte : {q.document_hash.slice(0, 16)}…</div>}
            </div>
          )}

          {q.refused_at && (
            <div className="rounded-md border bg-background p-4 text-sm">
              <div className="font-semibold">Refusé</div>
              <div>Le : {formatDateTime(q.refused_at)}</div>
              {q.refusal_reason && <div className="mt-1 text-muted-foreground">Motif : {q.refusal_reason}</div>}
            </div>
          )}

          {q.repair_id && (
            <div className="text-sm">
              <Link className="underline" to="/app/shop/$shopId/repairs/$repairId" params={{ shopId, repairId: q.repair_id }}>
                Voir la réparation liée →
              </Link>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}