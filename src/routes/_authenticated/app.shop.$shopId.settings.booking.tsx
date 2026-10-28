import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import {
  listBusinessHours, upsertBusinessHours, listClosures, createClosure, deleteClosure,
} from "@/lib/appointments.functions";
import { PageContainer, PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/settings/booking")({
  head: () => ({ meta: [{ title: "Paramètres de réservation — BPEI" }] }),
  component: BookingSettings,
});

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

interface HourRow {
  day_of_week: number;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  break_start: string | null;
  break_end: string | null;
}

function BookingSettings() {
  const { shopId } = useShop();
  const qc = useQueryClient();
  const hoursFn = useServerFn(listBusinessHours);
  const saveHoursFn = useServerFn(upsertBusinessHours);
  const closuresFn = useServerFn(listClosures);
  const createClosureFn = useServerFn(createClosure);
  const deleteClosureFn = useServerFn(deleteClosure);

  const hoursQ = useQuery({
    queryKey: ["business-hours", shopId],
    queryFn: () => hoursFn({ data: { shopId } }),
  });
  const closuresQ = useQuery({
    queryKey: ["closures", shopId],
    queryFn: () => closuresFn({ data: { shopId } }),
  });

  const [rows, setRows] = useState<HourRow[]>([]);
  useEffect(() => {
    if (!hoursQ.data) return;
    const byDay = new Map(hoursQ.data.map((h) => [h.day_of_week, h]));
    setRows(Array.from({ length: 7 }, (_, i) => {
      const existing = byDay.get(i);
      return existing ? {
        day_of_week: i,
        is_closed: existing.is_closed,
        opens_at: existing.opens_at,
        closes_at: existing.closes_at,
        break_start: existing.break_start,
        break_end: existing.break_end,
      } : {
        day_of_week: i,
        is_closed: i === 0 || i === 6,
        opens_at: "09:00", closes_at: "18:00", break_start: null, break_end: null,
      };
    }));
  }, [hoursQ.data]);

  const saveMut = useMutation({
    mutationFn: () => saveHoursFn({ data: { shopId, hours: rows } }),
    onSuccess: () => { toast.success("Horaires enregistrés"); qc.invalidateQueries({ queryKey: ["business-hours", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [closureStart, setClosureStart] = useState("");
  const [closureEnd, setClosureEnd] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const addClosureMut = useMutation({
    mutationFn: () => createClosureFn({ data: {
      shopId,
      startsAt: new Date(closureStart).toISOString(),
      endsAt: new Date(closureEnd).toISOString(),
      reason: closureReason || null,
    } }),
    onSuccess: () => {
      toast.success("Fermeture ajoutée");
      setClosureStart(""); setClosureEnd(""); setClosureReason("");
      qc.invalidateQueries({ queryKey: ["closures", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delClosureMut = useMutation({
    mutationFn: (id: string) => deleteClosureFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["closures", shopId] }),
  });

  function updateRow(i: number, patch: Partial<HourRow>) {
    setRows((rs) => rs.map((r, ix) => ix === i ? { ...r, ...patch } : r));
  }

  return (
    <PageContainer>
      <PageHeader
        title="Paramètres de réservation"
        description="Horaires d'ouverture, fermetures exceptionnelles et règles du moteur de créneaux."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/app/shop/$shopId/settings" params={{ shopId }}>
              <ArrowLeft className="mr-2 h-4 w-4" />Paramètres
            </Link>
          </Button>
        }
      />

      <SectionCard title="Horaires d'ouverture" description="Définissez pour chaque jour de la semaine.">
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[120px_100px_1fr_1fr_1fr_1fr] gap-3 items-center border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="font-medium text-sm">{DAYS[r.day_of_week]}</div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={r.is_closed} onChange={(e) => updateRow(i, { is_closed: e.target.checked })} />
                Fermé
              </label>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Ouverture</Label>
                <Input type="time" disabled={r.is_closed} value={r.opens_at ?? ""} onChange={(e) => updateRow(i, { opens_at: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Fermeture</Label>
                <Input type="time" disabled={r.is_closed} value={r.closes_at ?? ""} onChange={(e) => updateRow(i, { closes_at: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Pause début</Label>
                <Input type="time" disabled={r.is_closed} value={r.break_start ?? ""} onChange={(e) => updateRow(i, { break_start: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Pause fin</Label>
                <Input type="time" disabled={r.is_closed} value={r.break_end ?? ""} onChange={(e) => updateRow(i, { break_end: e.target.value || null })} />
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Enregistrer les horaires</Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Fermetures exceptionnelles" description="Congés, jours fériés, événements ponctuels.">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr_auto] gap-3 items-end">
          <div><Label>Du</Label><Input type="datetime-local" value={closureStart} onChange={(e) => setClosureStart(e.target.value)} /></div>
          <div><Label>Au</Label><Input type="datetime-local" value={closureEnd} onChange={(e) => setClosureEnd(e.target.value)} /></div>
          <div><Label>Motif</Label><Input value={closureReason} onChange={(e) => setClosureReason(e.target.value)} placeholder="Congés annuels…" /></div>
          <Button onClick={() => addClosureMut.mutate()} disabled={!closureStart || !closureEnd || addClosureMut.isPending}>Ajouter</Button>
        </div>
        <div className="mt-4 divide-y divide-border">
          {(closuresQ.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-3">Aucune fermeture programmée.</div>
          ) : (closuresQ.data ?? []).map((c) => (
            <div key={c.id} className="py-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {new Date(c.starts_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  {" → "}
                  {new Date(c.ends_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </div>
                {c.reason && <div className="text-xs text-muted-foreground">{c.reason}</div>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => delClosureMut.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Réservation publique" description="Lien à partager avec vos clients.">
        <div className="rounded-md border border-border bg-surface-muted p-3 font-mono text-xs break-all">
          {typeof window !== "undefined" ? `${window.location.origin}/reserver/${shopId}` : `/reserver/${shopId}`}
        </div>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/reserver/${shopId}`); toast.success("Lien copié"); }}>Copier le lien</Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/reserver/$shopId" params={{ shopId }} target="_blank">Ouvrir</Link>
          </Button>
        </div>
      </SectionCard>
    </PageContainer>
  );
}