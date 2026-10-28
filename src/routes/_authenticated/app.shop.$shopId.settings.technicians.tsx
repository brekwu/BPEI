import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useShop } from "@/components/shop/ShopLayout";
import { listShopTechnicians } from "@/lib/appointments.functions";
import {
  listTechnicianAvailability, upsertTechnicianAvailability,
  listTechnicianTimeOff, createTechnicianTimeOff, deleteTechnicianTimeOff,
  listBlockedSlots, createBlockedSlot, deleteBlockedSlot,
} from "@/lib/technicians.functions";
import { PageContainer, PageHeader, SectionCard, EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Plus, CalendarOff, Ban } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/settings/technicians")({
  head: () => ({ meta: [{ title: "Techniciens — BPEI" }] }),
  component: TechniciansPage,
});

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

type Slot = { day_of_week: number; opens_at: string; closes_at: string; is_available: boolean };

function TechniciansPage() {
  const { shopId } = useShop();
  const techsFn = useServerFn(listShopTechnicians);
  const techsQ = useQuery({ queryKey: ["shop-techs", shopId], queryFn: () => techsFn({ data: { shopId } }) });
  const [selectedTech, setSelectedTech] = useState<string>("");

  const selectableTechs = techsQ.data ?? [];
  const currentTech = selectableTechs.find((t) => t.user_id === selectedTech);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Paramètres"
        title="Techniciens & disponibilités"
        description="Définissez les jours et heures travaillés, les congés et les créneaux bloqués."
      />

      <SectionCard
        title="Équipe"
        description="Sélectionnez un membre pour configurer ses disponibilités."
      >
        {selectableTechs.length === 0 ? (
          <EmptyState title="Aucun technicien" description="Invitez des membres depuis les paramètres de la boutique." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectableTechs.map((t) => {
              const name = [t.first_name, t.last_name].filter(Boolean).join(" ") || "Sans nom";
              const active = selectedTech === t.user_id;
              return (
                <button
                  key={t.user_id}
                  onClick={() => setSelectedTech(t.user_id)}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${active ? "border-electric bg-electric-soft text-navy" : "border-border bg-surface hover:border-electric/50"}`}
                >
                  <div className="font-medium">{name}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t.role}</div>
                </button>
              );
            })}
          </div>
        )}
      </SectionCard>

      {currentTech && (
        <Tabs defaultValue="availability" className="space-y-4">
          <TabsList>
            <TabsTrigger value="availability">Disponibilités hebdomadaires</TabsTrigger>
            <TabsTrigger value="timeoff">Congés & absences</TabsTrigger>
            <TabsTrigger value="blocks">Créneaux bloqués</TabsTrigger>
          </TabsList>
          <TabsContent value="availability">
            <AvailabilityEditor shopId={shopId} userId={currentTech.user_id} />
          </TabsContent>
          <TabsContent value="timeoff">
            <TimeOffEditor shopId={shopId} userId={currentTech.user_id} />
          </TabsContent>
          <TabsContent value="blocks">
            <BlockedSlotsEditor shopId={shopId} technicianUserId={currentTech.user_id} />
          </TabsContent>
        </Tabs>
      )}
    </PageContainer>
  );
}

function AvailabilityEditor({ shopId, userId }: { shopId: string; userId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTechnicianAvailability);
  const saveFn = useServerFn(upsertTechnicianAvailability);
  const q = useQuery({
    queryKey: ["tech-availability", shopId, userId],
    queryFn: () => listFn({ data: { shopId, userId } }),
  });
  const initial = useMemo<Slot[]>(() => {
    return Array.from({ length: 7 }, (_, dow) => {
      const rows = (q.data ?? []).filter((r) => r.day_of_week === dow);
      if (rows.length === 0) return { day_of_week: dow, opens_at: "09:00", closes_at: "18:00", is_available: false };
      const r = rows[0];
      return { day_of_week: dow, opens_at: r.opens_at.slice(0, 5), closes_at: r.closes_at.slice(0, 5), is_available: r.is_available };
    });
  }, [q.data]);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const current = slots ?? initial;

  const mut = useMutation({
    mutationFn: () => saveFn({ data: { shopId, userId, slots: current.filter((s) => s.is_available) } }),
    onSuccess: () => {
      toast.success("Disponibilités enregistrées");
      qc.invalidateQueries({ queryKey: ["tech-availability", shopId, userId] });
      setSlots(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (i: number, patch: Partial<Slot>) => {
    const next = current.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    setSlots(next);
  };

  return (
    <SectionCard title="Semaine type" description="Jours et heures travaillés. Décochez pour marquer non travaillé.">
      <div className="divide-y divide-border">
        {current.map((s, i) => (
          <div key={s.day_of_week} className="flex items-center gap-3 py-2.5">
            <label className="flex items-center gap-2 w-24">
              <input type="checkbox" checked={s.is_available} onChange={(e) => update(i, { is_available: e.target.checked })} />
              <span className="text-sm font-medium">{DAYS[s.day_of_week]}</span>
            </label>
            <Input type="time" className="w-28" value={s.opens_at} disabled={!s.is_available} onChange={(e) => update(i, { opens_at: e.target.value })} />
            <span className="text-muted-foreground">→</span>
            <Input type="time" className="w-28" value={s.closes_at} disabled={!s.is_available} onChange={(e) => update(i, { closes_at: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-3">
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Enregistrer</Button>
      </div>
    </SectionCard>
  );
}

function TimeOffEditor({ shopId, userId }: { shopId: string; userId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTechnicianTimeOff);
  const createFn = useServerFn(createTechnicianTimeOff);
  const delFn = useServerFn(deleteTechnicianTimeOff);
  const q = useQuery({ queryKey: ["tech-timeoff", shopId], queryFn: () => listFn({ data: { shopId } }) });
  const filtered = (q.data ?? []).filter((r) => r.user_id === userId);
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [reason, setReason] = useState("");
  const mut = useMutation({
    mutationFn: () => createFn({ data: { shopId, userId, startsAt: new Date(starts).toISOString(), endsAt: new Date(ends).toISOString(), reason: reason || null } }),
    onSuccess: () => { toast.success("Ajouté"); setStarts(""); setEnds(""); setReason(""); qc.invalidateQueries({ queryKey: ["tech-timeoff", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dmut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Supprimé"); qc.invalidateQueries({ queryKey: ["tech-timeoff", shopId] }); },
  });
  return (
    <SectionCard title="Congés & absences" description="Ces plages bloquent l'affectation de rendez-vous à ce technicien.">
      <div className="grid gap-2 sm:grid-cols-4 items-end">
        <div><Label className="text-xs">Début</Label><Input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
        <div><Label className="text-xs">Fin</Label><Input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
        <div><Label className="text-xs">Motif</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Congés annuels…" /></div>
        <Button onClick={() => mut.mutate()} disabled={!starts || !ends || mut.isPending}><Plus className="mr-2 h-4 w-4" />Ajouter</Button>
      </div>
      <div className="mt-4 divide-y divide-border">
        {filtered.length === 0 ? (
          <EmptyState icon={<CalendarOff className="h-5 w-5" />} title="Aucun congé enregistré" />
        ) : filtered.map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-2 text-sm">
            <div className="flex-1">
              <div className="font-medium">{new Date(r.starts_at).toLocaleString("fr-FR")} → {new Date(r.ends_at).toLocaleString("fr-FR")}</div>
              {r.reason && <div className="text-xs text-muted-foreground">{r.reason}</div>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => dmut.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function BlockedSlotsEditor({ shopId, technicianUserId }: { shopId: string; technicianUserId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listBlockedSlots);
  const createFn = useServerFn(createBlockedSlot);
  const delFn = useServerFn(deleteBlockedSlot);
  const q = useQuery({ queryKey: ["blocked-slots", shopId], queryFn: () => listFn({ data: { shopId } }) });
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<"tech" | "shop">("tech");
  const mut = useMutation({
    mutationFn: () => createFn({ data: {
      shopId, startsAt: new Date(starts).toISOString(), endsAt: new Date(ends).toISOString(),
      technicianUserId: scope === "tech" ? technicianUserId : null,
      reason: reason || null,
    } }),
    onSuccess: () => { toast.success("Créneau bloqué"); setStarts(""); setEnds(""); setReason(""); qc.invalidateQueries({ queryKey: ["blocked-slots", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dmut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Débloqué"); qc.invalidateQueries({ queryKey: ["blocked-slots", shopId] }); },
  });
  return (
    <SectionCard title="Créneaux bloqués" description="Impossibilité ponctuelle de prendre un rendez-vous (formation, réunion, panne…).">
      <div className="grid gap-2 sm:grid-cols-5 items-end">
        <div><Label className="text-xs">Début</Label><Input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
        <div><Label className="text-xs">Fin</Label><Input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
        <div>
          <Label className="text-xs">Portée</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as "tech" | "shop")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tech">Ce technicien</SelectItem>
              <SelectItem value="shop">Toute la boutique</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Motif</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <Button onClick={() => mut.mutate()} disabled={!starts || !ends || mut.isPending}><Plus className="mr-2 h-4 w-4" />Bloquer</Button>
      </div>
      <div className="mt-4 divide-y divide-border">
        {(q.data ?? []).length === 0 ? (
          <EmptyState icon={<Ban className="h-5 w-5" />} title="Aucun créneau bloqué" />
        ) : (q.data ?? []).map((r) => (
          <div key={r.id} className="flex items-center gap-3 py-2 text-sm">
            <div className="flex-1">
              <div className="font-medium">{new Date(r.starts_at).toLocaleString("fr-FR")} → {new Date(r.ends_at).toLocaleString("fr-FR")}</div>
              <div className="text-xs text-muted-foreground">
                {r.technician_user_id ? "Technicien" : "Boutique entière"}{r.reason && ` · ${r.reason}`}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => dmut.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}