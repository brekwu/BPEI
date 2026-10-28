import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useShop } from "@/components/shop/ShopLayout";
import { canManageShop } from "@/lib/shop-constants";
import { listQuarantine, listQuarantineMovements, quarantineAction } from "@/lib/purchasing.functions";
import {
  PageContainer, PageHeader, SectionCard, StatCard, DataTableShell,
  DialogShell, FormActions, EmptyState,
} from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, RotateCcw, PackageX, Undo2, Search } from "lucide-react";
import { formatDate } from "@/lib/money";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/stock/quarantine")({
  head: () => ({
    meta: [
      { title: "Quarantaine — Stock" },
      { name: "description", content: "Traitement des unités reçues endommagées : retour fournisseur, destruction ou réintégration contrôlée." },
    ],
  }),
  component: QuarantinePage,
});

type Action = "return_supplier" | "destroy" | "release";

function QuarantinePage() {
  const { shopId, role } = useShop();
  const canManage = canManageShop(role);
  const qc = useQueryClient();
  const listFn = useServerFn(listQuarantine);
  const movsFn = useServerFn(listQuarantineMovements);
  const actionFn = useServerFn(quarantineAction);

  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [actionState, setActionState] = useState<{ item: any; action: Action } | null>(null);

  const items = useQuery({
    queryKey: ["quarantine", shopId, search],
    queryFn: () => listFn({ data: { shopId, search: search || undefined } }),
  });

  const movs = useQuery({
    queryKey: ["quarantine-movements", shopId, selectedItem?.id],
    queryFn: () => movsFn({ data: { shopId, itemId: selectedItem?.id } }),
    enabled: !!selectedItem,
  });

  const totalQty = useMemo(
    () => (items.data ?? []).reduce((s: number, r: any) => s + Number(r.quarantine_quantity ?? 0), 0),
    [items.data]
  );

  return (
    <PageContainer>
      <PageHeader
        title="Quarantaine"
        description="Unités reçues endommagées, à traiter (retour fournisseur, destruction ou réintégration)."
        actions={
          <Link to="/app/shop/$shopId/stock" params={{ shopId }}>
            <Button variant="outline" size="sm">Retour au stock</Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Articles concernés" value={String((items.data ?? []).length)} />
        <StatCard icon={<PackageX className="h-4 w-4" />} label="Unités totales en quarantaine" value={String(totalQty)} />
        <StatCard icon={<Undo2 className="h-4 w-4" />} label="Boutique" value={shopId.slice(0, 8) + "…"} />
      </div>

      <SectionCard
        title="Articles en quarantaine"
        description="Le stock en quarantaine n'est jamais inclus dans le stock disponible."
      >
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher (nom, SKU, code-barres)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {items.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Chargement…</div>
        ) : (items.data ?? []).length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Aucune unité en quarantaine"
            description="Les unités endommagées à la réception apparaîtront ici."
          />
        ) : (
          <DataTableShell>
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Article</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2 text-right">Quarantaine</th>
                  <th className="px-3 py-2 text-right">Disponible</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(items.data ?? []).map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">
                      <button
                        className="text-left hover:underline"
                        onClick={() => setSelectedItem(r)}
                      >
                        {r.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.sku ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Badge variant="outline" className="border-warning text-warning">
                        {Number(r.quarantine_quantity)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {Number(r.quantity) - Number(r.reserved_quantity ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        {canManage && (
                          <>
                            <Button
                              size="sm" variant="ghost" title="Retour fournisseur"
                              onClick={() => setActionState({ item: r, action: "return_supplier" })}
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm" variant="ghost" title="Destruction"
                              onClick={() => setActionState({ item: r, action: "destroy" })}
                            >
                              <PackageX className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                            <Button
                              size="sm" variant="ghost" title="Réintégrer au stock"
                              onClick={() => setActionState({ item: r, action: "release" })}
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-success" />
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
        )}
      </SectionCard>

      {selectedItem && (
        <DialogShell
          open={true}
          onOpenChange={(v) => { if (!v) setSelectedItem(null); }}
          title={`Historique — ${selectedItem.name}`}
          size="xl"
        >
          <Tabs defaultValue="movements">
            <TabsList>
              <TabsTrigger value="movements">Mouvements ({movs.data?.length ?? 0})</TabsTrigger>
            </TabsList>
            <TabsContent value="movements">
              {(movs.data ?? []).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Aucun mouvement.</div>
              ) : (
                <div className="max-h-96 overflow-auto rounded border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2 text-right">Quantité</th>
                        <th className="px-3 py-2">Motif</th>
                        <th className="px-3 py-2">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(movs.data ?? []).map((m: any) => (
                        <tr key={m.id}>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(m.created_at)}</td>
                          <td className="px-3 py-2 text-xs">
                            <Badge variant="outline">{m.kind}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{Number(m.quantity)}</td>
                          <td className="px-3 py-2 text-xs">{m.reason ?? "—"}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{m.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogShell>
      )}

      {actionState && (
        <QuarantineActionDialog
          state={actionState}
          onClose={() => setActionState(null)}
          onConfirm={async (qty, note) => {
            await actionFn({
              data: {
                shopId,
                itemId: actionState.item.id,
                quantity: qty,
                action: actionState.action,
                note: note || null,
              },
            });
            toast.success("Action enregistrée");
            qc.invalidateQueries({ queryKey: ["quarantine", shopId] });
            qc.invalidateQueries({ queryKey: ["quarantine-movements", shopId] });
            setActionState(null);
          }}
        />
      )}
    </PageContainer>
  );
}

function QuarantineActionDialog({
  state, onClose, onConfirm,
}: {
  state: { item: any; action: Action };
  onClose: () => void;
  onConfirm: (qty: number, note: string) => Promise<void>;
}) {
  const max = Number(state.item.quarantine_quantity ?? 0);
  const [qty, setQty] = useState(String(max));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const label = {
    return_supplier: { title: "Retour fournisseur", verb: "Retourner", tone: "warning" as const },
    destroy: { title: "Destruction", verb: "Détruire", tone: "destructive" as const },
    release: { title: "Réintégration au stock", verb: "Réintégrer", tone: "success" as const },
  }[state.action];

  const q = Number(qty);
  const valid = q > 0 && q <= max;

  return (
    <DialogShell
      open={true}
      onOpenChange={(v) => { if (!v && !busy) onClose(); }}
      title={label.title}
      description={`Article : ${state.item.name} (${max} unités en quarantaine)`}
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Quantité</Label>
          <Input
            type="number" min={1} max={max} step={1}
            value={qty} onChange={(e) => setQty(e.target.value)}
          />
          {!valid && <p className="text-xs text-destructive">Quantité entre 1 et {max}.</p>}
        </div>
        <div className="space-y-1.5">
          <Label>
            {state.action === "release" ? "Justification / contrôle effectué" : "Motif / note"}
            {state.action === "release" && <span className="text-destructive"> *</span>}
          </Label>
          <Textarea
            value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={
              state.action === "return_supplier" ? "Référence retour, motif, date prévue…" :
              state.action === "destroy" ? "Motif de destruction, personne responsable…" :
              "Contrôle effectué, personne responsable de la réintégration…"
            }
            rows={3}
          />
        </div>

        {state.action === "destroy" && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            Action irréversible : les unités seront définitivement retirées.
          </div>
        )}
        {state.action === "release" && (
          <div className="rounded-md border border-success/40 bg-success/10 p-2 text-xs text-success">
            Les unités seront réintégrées dans le stock disponible après contrôle.
          </div>
        )}

        <FormActions>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
          <Button
            disabled={!valid || busy || (state.action === "release" && !note.trim())}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(q, note); }
              catch (e: any) { toast.error(e.message); setBusy(false); }
            }}
          >
            {busy ? "…" : label.verb}
          </Button>
        </FormActions>
      </div>
    </DialogShell>
  );
}