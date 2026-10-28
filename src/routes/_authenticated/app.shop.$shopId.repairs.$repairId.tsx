import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge, PriorityBadge } from "@/components/shop/StatusBadge";
import {
  REPAIR_STATUS_LABEL, REPAIR_PRIORITY_LABEL, customerDisplayName,
  type RepairStatus, type RepairPriority,
} from "@/lib/shop-constants";
import { logActivity } from "@/lib/activity";
import { PageContainer, SectionCard, EmptyState } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Archive, FileText, FileDown, Wrench } from "lucide-react";
import { QrTokenCard } from "@/components/shop/QrTokenCard";
import { PdfDownloadButton } from "@/components/shop/DownloadPdfButton";
import { getRepairPdf } from "@/lib/documents-extra.functions";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/repairs/$repairId")({
  head: () => ({ meta: [{ title: "Dossier — BPEI" }] }),
  component: RepairDetail,
});

function RepairDetail() {
  const { shopId } = useShop();
  const { repairId } = Route.useParams();
  const base = `/app/shop/${shopId}`;
  const qc = useQueryClient();

  const { data: repair, isLoading } = useQuery({
    queryKey: ["repair", repairId],
    queryFn: async () => {
      const { data, error } = await supabase.from("repairs")
        .select("*, customers(id, customer_type, company_name, first_name, last_name), devices(id, brand, model, device_type, serial_number)")
        .eq("id", repairId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["repair-history", repairId],
    queryFn: async () => (await supabase.from("repair_status_history").select("*").eq("repair_id", repairId).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: notes } = useQuery({
    queryKey: ["repair-notes", repairId],
    queryFn: async () => (await supabase.from("repair_notes").select("*").eq("repair_id", repairId).order("created_at", { ascending: false })).data ?? [],
  });

  const { data: team } = useQuery({
    queryKey: ["team-select", shopId],
    queryFn: async () => {
      const { data: mem } = await supabase.from("shop_memberships").select("user_id, role").eq("shop_id", shopId);
      if (!mem || mem.length === 0) return [] as { id: string; label: string }[];
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", mem.map((m) => m.user_id));
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return mem.map((m) => ({
        id: m.user_id,
        label: (map.get(m.user_id) ? [map.get(m.user_id)!.first_name, map.get(m.user_id)!.last_name].filter(Boolean).join(" ") : "") || m.user_id.slice(0, 8),
      }));
    },
  });

  const updateMut = useMutation({
    mutationFn: async (patch: Partial<{ status: RepairStatus; priority: RepairPriority; assigned_technician_id: string | null; technical_diagnosis: string; work_performed: string; internal_notes: string; customer_visible_notes: string; archived_at: string | null; completed_at: string | null; collected_at: string | null }>) => {
      const { error } = await supabase.from("repairs").update(patch).eq("id", repairId);
      if (error) throw error;
      for (const [k, v] of Object.entries(patch)) {
        await logActivity({ shopId, entityType: "repair", entityId: repairId, action: `repair.${k}.updated`, metadata: { value: v as never } });
      }
    },
    onSuccess: () => {
      toast.success("Dossier mis à jour");
      qc.invalidateQueries({ queryKey: ["repair", repairId] });
      qc.invalidateQueries({ queryKey: ["repair-history", repairId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <PageContainer size="wide">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }
  if (!repair) {
    return (
      <PageContainer>
        <EmptyState icon={<Wrench className="h-6 w-6" />} title="Dossier introuvable" action={<Button asChild variant="outline"><Link to={`${base}/repairs`}>Retour</Link></Button>} />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to={`${base}/repairs`}><ArrowLeft className="mr-2 h-4 w-4" />Retour aux réparations</Link>
      </Button>

      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="font-mono text-xs uppercase tracking-wider text-electric">
            {repair.repair_number}
          </div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {repair.devices ? [repair.devices.brand, repair.devices.model].filter(Boolean).join(" ") || "Réparation" : "Réparation"}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={repair.status} />
            <PriorityBadge priority={repair.priority} />
            {repair.archived_at && <Badge variant="outline" className="text-muted-foreground">Archivé</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-56">
            <Select value={repair.status} onValueChange={(v) => updateMut.mutate({ status: v as RepairStatus })}>
              <SelectTrigger aria-label="Changer le statut"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REPAIR_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="outline" size="sm"><Archive className="mr-2 h-4 w-4" />{repair.archived_at ? "Restaurer" : "Archiver"}</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{repair.archived_at ? "Restaurer ?" : "Archiver ce dossier ?"}</AlertDialogTitle>
                <AlertDialogDescription>L'archivage préserve l'historique.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => updateMut.mutate({ archived_at: repair.archived_at ? null : new Date().toISOString() })}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Informations" className="lg:col-span-2">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Row label="Client" value={repair.customers ? customerDisplayName(repair.customers) : "—"} link={repair.customers ? `${base}/clients/${repair.customers.id}` : undefined} />
            <Row label="Appareil" value={repair.devices ? [repair.devices.brand, repair.devices.model].filter(Boolean).join(" ") : "—"} link={repair.devices ? `${base}/devices/${repair.devices.id}` : undefined} />
            <Row label="Créé" value={new Date(repair.created_at).toLocaleString("fr-FR")} />
            <Row label="Prévu" value={repair.estimated_completion_at ? new Date(repair.estimated_completion_at).toLocaleString("fr-FR") : null} />
            <Row label="Canal" value={repair.intake_channel} />
            <div>
              <dt className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Priorité</dt>
              <Select value={repair.priority} onValueChange={(v) => updateMut.mutate({ priority: v as RepairPriority })}>
                <SelectTrigger className="h-8" aria-label="Changer la priorité"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REPAIR_PRIORITY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <dt className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Technicien</dt>
              <Select value={repair.assigned_technician_id ?? "__none"} onValueChange={(v) => updateMut.mutate({ assigned_technician_id: v === "__none" ? null : v })}>
                <SelectTrigger className="h-8" aria-label="Attribuer un technicien"><SelectValue placeholder="Non attribué" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Non attribué</SelectItem>
                  {(team ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </dl>
        </SectionCard>
        <div className="space-y-4">
          <SectionCard title="Actions">
            <div className="space-y-2">
              <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => updateMut.mutate({ status: "repair_completed", completed_at: new Date().toISOString() })}>Marquer terminée</Button>
              <Button size="sm" variant="outline" className="w-full justify-start" onClick={() => updateMut.mutate({ status: "device_collected", collected_at: new Date().toISOString() })}>Marquer récupérée</Button>
              <CreateQuoteFromRepair shopId={shopId} repairId={repairId}
                customerId={repair.customer_id} deviceId={repair.device_id} />
              <PdfDownloadButton
                fn={getRepairPdf}
                data={{ shopId, repairId, kind: "intake" }}
                label="Bon de dépôt"
                icon={FileText}
                fallbackFilename={`bon-depot-${repair.repair_number ?? repairId.slice(0, 8)}.pdf`}
                size="sm"
                className="w-full justify-start"
              />
              <PdfDownloadButton
                fn={getRepairPdf}
                data={{ shopId, repairId, kind: "sheet" }}
                label="Fiche de réparation"
                icon={FileDown}
                fallbackFilename={`fiche-reparation-${repair.repair_number ?? repairId.slice(0, 8)}.pdf`}
                size="sm"
                className="w-full justify-start"
              />
            </div>
          </SectionCard>
          <QrTokenCard repairId={repairId} />
        </div>
      </div>

      <SectionCard title="Diagnostic & suivi">
        <div className="-my-2">
          <EditableSection label="Panne décrite par le client" field="customer_issue" repair={repair} onSave={(v) => updateMut.mutate({ [`customer_issue`]: v } as never)} />
          <EditableSection label="Diagnostic technique" field="technical_diagnosis" repair={repair} onSave={(v) => updateMut.mutate({ technical_diagnosis: v })} />
          <EditableSection label="Travail effectué" field="work_performed" repair={repair} onSave={(v) => updateMut.mutate({ work_performed: v })} />
          <EditableSection label="Notes internes" field="internal_notes" repair={repair} onSave={(v) => updateMut.mutate({ internal_notes: v })} />
          <EditableSection label="Notes visibles par le client" field="customer_visible_notes" repair={repair} onSave={(v) => updateMut.mutate({ customer_visible_notes: v })} />
        </div>
      </SectionCard>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Historique des statuts</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-4">
          <SectionCard padded={false}>
            {(history?.length ?? 0) === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">Aucun changement enregistré.</p>
            ) : (
              <ol className="divide-y divide-border">
                {history!.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("fr-FR")}</span>
                    {h.old_status && <StatusBadge status={h.old_status} />}
                    <span className="text-muted-foreground" aria-hidden>→</span>
                    <StatusBadge status={h.new_status} />
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </TabsContent>
        <TabsContent value="notes" className="mt-4">
          <NotesSection shopId={shopId} repairId={repairId} notes={notes ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["repair-notes", repairId] })} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function Row({ label, value, link }: { label: string; value: string | null | undefined; link?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">
        {value ? (link ? <Link to={link} className="text-electric hover:underline">{value}</Link> : value) : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

function EditableSection({
  label, field, repair, onSave,
}: { label: string; field: string; repair: Record<string, unknown>; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState<string>((repair[field] as string) ?? "");
  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{label}</div>
        {editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setVal((repair[field] as string) ?? ""); setEditing(false); }}>Annuler</Button>
            <Button size="sm" onClick={() => { onSave(val); setEditing(false); }}>Enregistrer</Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Modifier</Button>
        )}
      </div>
      {editing ? (
        <Textarea rows={3} className="mt-2" value={val} onChange={(e) => setVal(e.target.value)} />
      ) : (
        <div className="mt-2 whitespace-pre-wrap text-sm">
          {(repair[field] as string) || <span className="text-muted-foreground">—</span>}
        </div>
      )}
    </div>
  );
}

function NotesSection({ shopId, repairId, notes, onChange }: {
  shopId: string; repairId: string; notes: Array<{ id: string; content: string; visibility: "internal" | "customer"; created_at: string }>; onChange: () => void;
}) {
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "customer">("internal");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!content.trim()) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("repair_notes").insert({
      shop_id: shopId, repair_id: repairId, content: content.trim(), visibility, created_by: u.user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setContent("");
    onChange();
    await logActivity({ shopId, entityType: "repair_note", entityId: repairId, action: "note.added", metadata: { visibility } });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          <Label>Nouvelle note</Label>
          <Textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button type="button" onClick={() => setVisibility("internal")} className={`rounded-md border px-3 py-1 text-xs ${visibility === "internal" ? "border-navy bg-navy text-navy-foreground" : "border-border"}`}>Interne</button>
              <button type="button" onClick={() => setVisibility("customer")} className={`rounded-md border px-3 py-1 text-xs ${visibility === "customer" ? "border-navy bg-navy text-navy-foreground" : "border-border"}`}>Visible client</button>
            </div>
            <Button size="sm" onClick={add} disabled={saving || !content.trim()}>Ajouter</Button>
          </div>
        </div>
        <div className="divide-y divide-border">
          {notes.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Aucune note.</p> : notes.map((n) => (
            <div key={n.id} className="py-3">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{new Date(n.created_at).toLocaleString("fr-FR")}</span>
                <Badge variant="outline" className="font-normal">{n.visibility === "internal" ? "Interne" : "Client"}</Badge>
              </div>
              <div className="whitespace-pre-wrap text-sm">{n.content}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateQuoteFromRepair({
  shopId, repairId, customerId, deviceId,
}: { shopId: string; repairId: string; customerId: string | null; deviceId: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button size="sm" variant="secondary" className="w-full justify-start" disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { createQuoteDraft } = await import("@/lib/quotes.functions");
          const row = await createQuoteDraft({ data: { shopId, repairId, customerId, deviceId } });
          window.location.href = `/app/shop/${shopId}/quotes/${(row as any).id}`;
        } catch (e: any) {
          toast.error(e.message ?? "Erreur");
          setBusy(false);
        }
      }}>
      {busy ? "Création…" : "Créer un devis"}
    </Button>
  );
}