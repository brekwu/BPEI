import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { listCreditNotes, createCreditNote, issueCreditNote } from "@/lib/credit-notes.functions";
import { listInvoices } from "@/lib/invoices.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatMoney, formatDate, toCents } from "@/lib/money";
import { InvoiceStatusBadge } from "@/components/shop/DocumentStatusBadge";
import { canManageShop } from "@/lib/shop-constants";
import { Plus, Send, Printer, FileMinus } from "lucide-react";
import { PdfDownloadButton } from "@/components/shop/DownloadPdfButton";
import { getCreditNotePdf } from "@/lib/documents-extra.functions";
import {
  PageContainer, PageHeader, DataTableShell, DialogShell, FormSection, FormRow,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/credit-notes")({
  head: () => ({ meta: [{ title: "Avoirs — BPEI" }] }),
  component: CreditNotesPage,
});

function CreditNotesPage() {
  const ctx = useShop();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const listFn = useServerFn(listCreditNotes);
  const invListFn = useServerFn(listInvoices);
  const createFn = useServerFn(createCreditNote);
  const issueFn = useServerFn(issueCreditNote);

  const cns = useQuery({ queryKey: ["credit-notes", ctx.shopId], queryFn: () => listFn({ data: { shopId: ctx.shopId } }) });
  const invs = useQuery({ queryKey: ["invoices-for-cn", ctx.shopId], queryFn: () => invListFn({ data: { shopId: ctx.shopId } }) });
  const canManage = canManageShop(ctx.role);
  const rows = cns.data ?? [];

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Finance"
        title="Avoirs"
        description="Notes de crédit émises sur les factures."
        actions={
          canManage ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Nouvel avoir
            </Button>
          ) : null
        }
      />

      <DataTableShell
        loading={cns.isLoading}
        empty={rows.length === 0}
        emptyIcon={<FileMinus className="h-5 w-5" />}
        emptyTitle="Aucun avoir"
        emptyDescription="Créez un avoir pour annuler tout ou partie d'une facture."
        emptyAction={canManage ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Nouvel avoir
          </Button>
        ) : undefined}
      >
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">N°</th>
              <th className="px-4 py-2.5 text-left font-medium">Date</th>
              <th className="px-4 py-2.5 text-left font-medium">Statut</th>
              <th className="px-4 py-2.5 text-left font-medium">Facture</th>
              <th className="px-4 py-2.5 text-left font-medium">Motif</th>
              <th className="px-4 py-2.5 text-right font-medium">Total TTC</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r: any) => (
              <tr key={r.id} className="transition-colors hover:bg-secondary/40">
                <td className="px-4 py-2.5 font-medium">{r.credit_note_number ?? <span className="text-muted-foreground">Brouillon</span>}</td>
                <td className="px-4 py-2.5">{formatDate(r.issue_date ?? r.created_at)}</td>
                <td className="px-4 py-2.5"><InvoiceStatusBadge status={r.status} /></td>
                <td className="px-4 py-2.5">
                  <Link
                    to="/app/shop/$shopId/invoices/$invoiceId"
                    params={{ shopId: ctx.shopId, invoiceId: r.invoice_id }}
                    className="text-electric hover:underline"
                  >
                    Voir
                  </Link>
                </td>
                <td className="max-w-xs truncate px-4 py-2.5 text-xs text-muted-foreground">{r.reason ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatMoney(r.total_including_tax_cents, r.currency)}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    {canManage && r.status === "draft" && (
                      <Button size="sm" onClick={async () => {
                        await issueFn({ data: { shopId: ctx.shopId, creditNoteId: r.id } });
                        qc.invalidateQueries({ queryKey: ["credit-notes", ctx.shopId] });
                        toast.success("Avoir émis");
                      }}><Send className="mr-2 h-4 w-4" />Émettre</Button>
                    )}
                    {r.status !== "draft" && (
                      <>
                        <PdfDownloadButton
                          fn={getCreditNotePdf}
                          data={{ shopId: ctx.shopId, creditNoteId: r.id }}
                          label="Télécharger l'avoir"
                          fallbackFilename={`${r.credit_note_number ?? "avoir"}.pdf`}
                          compact
                        />
                        <Button size="sm" variant="ghost" onClick={() => window.print()} aria-label="Imprimer">
                          <Printer className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTableShell>

      {open && (
        <NewCreditNoteDialog
          open={open}
          onClose={() => setOpen(false)}
          invoices={(invs.data ?? []).filter((i: any) => i.status !== "draft")}
          onSubmit={async (payload) => {
            await createFn({ data: { shopId: ctx.shopId, ...payload } });
            qc.invalidateQueries({ queryKey: ["credit-notes", ctx.shopId] });
            setOpen(false);
            toast.success("Avoir créé en brouillon");
          }}
        />
      )}
    </PageContainer>
  );
}

function NewCreditNoteDialog({
  open, invoices, onClose, onSubmit,
}: {
  open: boolean;
  invoices: any[]; onClose: () => void;
  onSubmit: (v: any) => Promise<void>;
}) {
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [taxRate, setTaxRate] = useState("20");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        invoiceId, reason: reason || null,
        lines: [{
          description: reason || "Avoir",
          quantity: 1,
          unit_price_cents: toCents(amount),
          tax_rate: Number(taxRate) || 0,
          display_order: 0,
        }],
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Nouvel avoir"
      description="Créer une note de crédit à partir d'une facture émise."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={!invoiceId || !amount || submitting}>
            {submitting ? "Création…" : "Créer"}
          </Button>
        </>
      }
    >
      <FormSection>
        <div className="space-y-1.5">
          <Label>Facture concernée</Label>
          <Select value={invoiceId} onValueChange={setInvoiceId}>
            <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {invoices.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.invoice_number} — {formatMoney(i.total_including_tax_cents, i.currency)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Motif</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. remise commerciale, retour partiel…" />
        </div>
        <FormRow>
          <div className="space-y-1.5">
            <Label>Montant HT à annuler</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>TVA %</Label>
            <Input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </div>
        </FormRow>
      </FormSection>
    </DialogShell>
  );
}