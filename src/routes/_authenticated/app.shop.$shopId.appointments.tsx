import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import FullCalendar from "@fullcalendar/react";
import type { EventDropArg, EventClickArg, DateSelectArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import { useShop } from "@/components/shop/ShopLayout";
import {
  listAppointments, createAppointment, updateAppointment,
  convertAppointmentToRepair, listShopTechnicians,
} from "@/lib/appointments.functions";
import { PageContainer, PageHeader, SectionCard } from "@/components/ui-kit";
import { AppointmentStatusBadge } from "@/components/shop/AppointmentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Plus, Settings, Wrench } from "lucide-react";
import { PdfDownloadButton } from "@/components/shop/DownloadPdfButton";
import { getAppointmentConfirmationPdf } from "@/lib/documents-extra.functions";
import "./_authenticated.app.shop.appointments.css";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/appointments")({
  head: () => ({ meta: [{ title: "Rendez-vous — BPEI" }] }),
  component: AppointmentsPage,
});

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pending:    { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  confirmed:  { bg: "#dcfce7", border: "#22c55e", text: "#166534" },
  in_progress:{ bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  completed:  { bg: "#e0e7ff", border: "#6366f1", text: "#3730a3" },
  cancelled:  { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  no_show:    { bg: "#f3f4f6", border: "#9ca3af", text: "#374151" },
};

type ApptRow = Awaited<ReturnType<typeof listAppointments>>[number];

function AppointmentsPage() {
  const { shopId } = useShop();
  const listFn = useServerFn(listAppointments);
  const techsFn = useServerFn(listShopTechnicians);
  const qc = useQueryClient();
  const calRef = useRef<FullCalendar | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [selected, setSelected] = useState<ApptRow | null>(null);
  const [filterTech, setFilterTech] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterService, setFilterService] = useState<string>("all");
  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    const from = new Date(); from.setMonth(from.getMonth() - 1);
    const to = new Date(); to.setMonth(to.getMonth() + 2);
    return { from: from.toISOString(), to: to.toISOString() };
  });

  const listQ = useQuery({
    queryKey: ["appointments", shopId, range.from, range.to],
    queryFn: () => listFn({ data: { shopId, from: range.from, to: range.to } }),
  });
  const techsQ = useQuery({
    queryKey: ["shop-techs", shopId],
    queryFn: () => techsFn({ data: { shopId } }),
  });
  const servicesQ = useQuery({
    queryKey: ["services-all", shopId],
    queryFn: async () => (await supabase.from("service_catalog")
      .select("id, name, estimated_duration_minutes").eq("shop_id", shopId).eq("active", true)
      .order("name")).data ?? [],
  });

  const filtered = useMemo(() => {
    return (listQ.data ?? []).filter((a) => {
      if (filterTech !== "all" && (a.technician_user_id ?? "none") !== filterTech) return false;
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      if (filterService !== "all" && (a.service_id ?? "none") !== filterService) return false;
      return true;
    });
  }, [listQ.data, filterTech, filterStatus, filterService]);

  const events = useMemo(() => filtered.map((a) => {
    const c = STATUS_COLORS[a.status] ?? STATUS_COLORS.pending;
    const tech = techsQ.data?.find((t) => t.user_id === a.technician_user_id);
    const svc = servicesQ.data?.find((s) => s.id === a.service_id);
    const parts = [a.contact_name, svc?.name, tech ? `${tech.first_name ?? ""} ${tech.last_name ?? ""}`.trim() : null].filter(Boolean);
    return {
      id: a.id,
      title: (a.is_urgent ? "⚡ " : "") + parts.join(" · "),
      start: a.starts_at,
      end: a.ends_at,
      backgroundColor: c.bg,
      borderColor: c.border,
      textColor: c.text,
      extendedProps: a,
    };
  }), [filtered, techsQ.data, servicesQ.data]);

  const updateFn = useServerFn(updateAppointment);
  const dropMut = useMutation({
    mutationFn: (v: { id: string; startsAt: string; endsAt: string }) =>
      updateFn({ data: { id: v.id, startsAt: v.startsAt, endsAt: v.endsAt } }),
    onSuccess: () => { toast.success("Rendez-vous déplacé"); qc.invalidateQueries({ queryKey: ["appointments", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const onEventDrop = (arg: EventDropArg) => {
    if (!arg.event.start || !arg.event.end) { arg.revert(); return; }
    dropMut.mutate(
      { id: arg.event.id, startsAt: arg.event.start.toISOString(), endsAt: arg.event.end.toISOString() },
      { onError: () => arg.revert() },
    );
  };
  const onEventResize = (arg: EventResizeDoneArg) => {
    if (!arg.event.start || !arg.event.end) { arg.revert(); return; }
    dropMut.mutate(
      { id: arg.event.id, startsAt: arg.event.start.toISOString(), endsAt: arg.event.end.toISOString() },
      { onError: () => arg.revert() },
    );
  };
  const onEventClick = (arg: EventClickArg) => {
    const appt = (arg.event.extendedProps as ApptRow);
    setSelected(appt);
  };
  const onSelect = (arg: DateSelectArg) => {
    setPrefill({ start: arg.startStr, end: arg.endStr });
    setOpenCreate(true);
    arg.view.calendar.unselect();
  };
  const [prefill, setPrefill] = useState<{ start?: string; end?: string }>({});

  return (
    <PageContainer size="wide">

      <PageHeader
        title="Calendrier"
        description="Vues jour, semaine, mois et liste. Glissez-déposez pour reprogrammer."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/shop/$shopId/settings/technicians" params={{ shopId }}>
                <Settings className="mr-2 h-4 w-4" />Techniciens
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/shop/$shopId/settings/booking" params={{ shopId }}>
                <CalendarIcon className="mr-2 h-4 w-4" />Horaires
              </Link>
            </Button>
            <Dialog open={openCreate} onOpenChange={(o) => { setOpenCreate(o); if (!o) setPrefill({}); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Nouveau rendez-vous</Button>
              </DialogTrigger>
              <CreateAppointmentDialog
                shopId={shopId}
                techs={techsQ.data ?? []}
                prefillStart={prefill.start}
                prefillEnd={prefill.end}
                onDone={() => { setOpenCreate(false); setPrefill({}); qc.invalidateQueries({ queryKey: ["appointments", shopId] }); }}
              />
            </Dialog>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterTech} onValueChange={setFilterTech}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Technicien" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les techniciens</SelectItem>
            <SelectItem value="none">Non assigné</SelectItem>
            {(techsQ.data ?? []).map((t) => (
              <SelectItem key={t.user_id} value={t.user_id}>
                {[t.first_name, t.last_name].filter(Boolean).join(" ") || "Sans nom"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="confirmed">Confirmé</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="completed">Terminé</SelectItem>
            <SelectItem value="cancelled">Annulé</SelectItem>
            <SelectItem value="no_show">Absent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterService} onValueChange={setFilterService}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Prestation" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes prestations</SelectItem>
            <SelectItem value="none">Sans prestation</SelectItem>
            {(servicesQ.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {Object.entries(STATUS_COLORS).map(([k, c]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: c.bg, border: `1px solid ${c.border}` }} />
              {k}
            </span>
          ))}
        </div>
      </div>

      <div className="bpei-surface p-2 sm:p-3">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
          }}
          buttonText={{ today: "Aujourd'hui", month: "Mois", week: "Semaine", day: "Jour", list: "Liste" }}
          locale={frLocale}
          firstDay={1}
          nowIndicator
          allDaySlot={false}
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          height="auto"
          editable
          eventResizableFromStart
          selectable
          selectMirror
          slotEventOverlap={false}
          events={events}
          eventDrop={onEventDrop}
          eventResize={onEventResize}
          eventClick={onEventClick}
          select={onSelect}
          datesSet={(arg) => setRange({ from: arg.start.toISOString(), to: arg.end.toISOString() })}
        />
      </div>

      {selected && (
        <AppointmentDetailDialog
          appt={selected}
          shopId={shopId}
          techs={techsQ.data ?? []}
          onClose={() => setSelected(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["appointments", shopId] }); setSelected(null); }}
        />
      )}
    </PageContainer>
  );

}

function CreateAppointmentDialog({ shopId, techs, prefillStart, prefillEnd, onDone }: {
  shopId: string;
  techs: Array<{ user_id: string; first_name: string | null; last_name: string | null }>;
  prefillStart?: string; prefillEnd?: string;
  onDone: () => void;
}) {
  const createFn = useServerFn(createAppointment);
  const toLocal = (iso?: string) => {
    if (!iso) { const d = new Date(); d.setHours(9, 0, 0, 0); return d.toISOString().slice(0, 16); }
    const d = new Date(iso); const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16);
  };
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [device, setDevice] = useState("");
  const [problem, setProblem] = useState("");
  const [date, setDate] = useState(() => toLocal(prefillStart));
  const initialDuration = prefillStart && prefillEnd
    ? Math.max(15, Math.round((new Date(prefillEnd).getTime() - new Date(prefillStart).getTime()) / 60000))
    : 30;
  const [duration, setDuration] = useState(initialDuration);
  const [urgent, setUrgent] = useState(false);
  const [tech, setTech] = useState<string>("none");

  const servicesQ = useQuery({
    queryKey: ["services", shopId],
    queryFn: async () => (await supabase.from("service_catalog").select("id, name, estimated_duration_minutes").eq("shop_id", shopId).eq("active", true).order("name")).data ?? [],
  });
  const [serviceId, setServiceId] = useState<string>("none");

  const mut = useMutation({
    mutationFn: async () => {
      const start = new Date(date);
      const end = new Date(start.getTime() + duration * 60_000);
      return createFn({ data: {
        shopId, serviceId: serviceId === "none" ? null : serviceId,
        startsAt: start.toISOString(), endsAt: end.toISOString(),
        contactName: name, contactPhone: phone, contactEmail: email || null,
        deviceDescription: device || null, problemDescription: problem || null,
        technicianUserId: tech === "none" ? null : tech,
        isUrgent: urgent,
      } });
    },
    onSuccess: () => { toast.success("Rendez-vous créé"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Nouveau rendez-vous</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Nom du client *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Téléphone *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Prestation</Label>
            <Select value={serviceId} onValueChange={(v) => {
              setServiceId(v);
              const s = servicesQ.data?.find((x) => x.id === v);
              if (s?.estimated_duration_minutes) setDuration(s.estimated_duration_minutes);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {(servicesQ.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Durée (min)</Label><Input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date & heure *</Label><Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <Label>Technicien</Label>
            <Select value={tech} onValueChange={setTech}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Non assigné</SelectItem>
                {techs.map((t) => (
                  <SelectItem key={t.user_id} value={t.user_id}>{[t.first_name, t.last_name].filter(Boolean).join(" ") || "Sans nom"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Appareil</Label><Input value={device} onChange={(e) => setDevice(e.target.value)} /></div>
        <div><Label>Problème</Label><Textarea rows={2} value={problem} onChange={(e) => setProblem(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />Marquer comme urgent</label>
      </div>
      <DialogFooter>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending || !name || !phone || !date}>Créer</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AppointmentDetailDialog({ appt, shopId, techs, onClose, onSaved }: {
  appt: ApptRow; shopId: string;
  techs: Array<{ user_id: string; first_name: string | null; last_name: string | null }>;
  onClose: () => void; onSaved: () => void;
}) {
  const updateFn = useServerFn(updateAppointment);
  const [status, setStatus] = useState(appt.status);
  const [tech, setTech] = useState<string>(appt.technician_user_id ?? "none");
  const [starts, setStarts] = useState(new Date(appt.starts_at).toISOString().slice(0, 16));
  const [ends, setEnds] = useState(new Date(appt.ends_at).toISOString().slice(0, 16));
  const [notes, setNotes] = useState(appt.internal_notes ?? "");

  const mut = useMutation({
    mutationFn: () => updateFn({ data: {
      id: appt.id, status, startsAt: new Date(starts).toISOString(),
      endsAt: new Date(ends).toISOString(), internalNotes: notes || null,
      technicianUserId: tech === "none" ? null : tech,
    } }),
    onSuccess: () => { toast.success("Enregistré"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const cancelMut = useMutation({
    mutationFn: () => updateFn({ data: { id: appt.id, status: "cancelled", cancellationReason: "Annulé par la boutique" } }),
    onSuccess: () => { toast.success("Annulé"); onSaved(); },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Rendez-vous — {appt.contact_name}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Début</Label><Input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
            <div><Label>Fin</Label><Input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ApptRow["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="completed">Terminé</SelectItem>
                  <SelectItem value="no_show">Absent</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Technicien</Label>
              <Select value={tech} onValueChange={setTech}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non assigné</SelectItem>
                  {techs.map((t) => (
                    <SelectItem key={t.user_id} value={t.user_id}>{[t.first_name, t.last_name].filter(Boolean).join(" ") || "Sans nom"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Notes internes</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div className="rounded-md border border-border bg-surface-muted p-3 text-xs space-y-1">
            <div><span className="text-muted-foreground">Contact :</span> {appt.contact_phone} {appt.contact_email && `· ${appt.contact_email}`}</div>
            {appt.device_description && <div><span className="text-muted-foreground">Appareil :</span> {appt.device_description}</div>}
            {appt.problem_description && <div><span className="text-muted-foreground">Problème :</span> {appt.problem_description}</div>}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground">Statut :</span>
              <AppointmentStatusBadge status={appt.status} />
              {appt.repair_id && (
                <Link to="/app/shop/$shopId/repairs/$repairId" params={{ shopId, repairId: appt.repair_id }} className="text-electric text-xs underline">
                  Voir la réparation liée →
                </Link>
              )}
            </div>
          </div>
          {!appt.repair_id && (
            <ConvertToRepairSection shopId={shopId} appointment={appt} onDone={onSaved} />
          )}
        </div>
        <DialogFooter className="gap-2">
          <PdfDownloadButton
            fn={getAppointmentConfirmationPdf}
            data={{ shopId, appointmentId: appt.id }}
            label="Confirmation PDF"
            fallbackFilename={`rdv-${appt.id.slice(0, 8)}.pdf`}
          />
          <Button variant="outline" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending || status === "cancelled"}>Annuler le RDV</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertToRepairSection({ shopId, appointment, onDone }: {
  shopId: string; appointment: ApptRow; onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [deviceId, setDeviceId] = useState<string>("");
  const [newCustomer, setNewCustomer] = useState(false);
  const [firstName, setFirstName] = useState(appointment.contact_name?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(appointment.contact_name?.split(" ").slice(1).join(" ") ?? "");
  const [customerEmail, setCustomerEmail] = useState(appointment.contact_email ?? "");
  const [customerPhone, setCustomerPhone] = useState(appointment.contact_phone ?? "");
  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceModel, setDeviceModel] = useState(appointment.device_description ?? "");
  const navigate = useNavigate();

  const customersQ = useQuery({
    enabled: open && !newCustomer,
    queryKey: ["customers-mini", shopId],
    queryFn: async () => (await supabase.from("customers")
      .select("id, first_name, last_name, company_name, customer_type")
      .eq("shop_id", shopId).order("last_name", { ascending: true, nullsFirst: false }).limit(200)).data ?? [],
  });
  const devicesQ = useQuery({
    enabled: !!customerId && !newCustomer,
    queryKey: ["devices-mini", customerId],
    queryFn: async () => (await supabase.from("devices")
      .select("id, brand, model, device_type").eq("customer_id", customerId).order("created_at", { ascending: false })).data ?? [],
  });

  const convertFn = useServerFn(convertAppointmentToRepair);
  const mut = useMutation({
    mutationFn: async () => {
      let cid = customerId;
      let did = deviceId;
      if (newCustomer) {
        const { data: c, error: ce } = await supabase.from("customers").insert({
          shop_id: shopId, customer_type: "individual",
          first_name: firstName || null, last_name: lastName || null,
          email: customerEmail || null, phone: customerPhone || null,
        }).select("id").single();
        if (ce) throw ce; cid = c.id;
      }
      if (!did || newCustomer) {
        const { data: d, error: de } = await supabase.from("devices").insert({
          shop_id: shopId, customer_id: cid,
          brand: deviceBrand || "Non précisé",
          model: deviceModel || "Non précisé",
          device_type: "other",
        }).select("id").single();
        if (de) throw de; did = d.id;
      }
      return convertFn({ data: { appointmentId: appointment.id, customerId: cid, deviceId: did } });
    },
    onSuccess: (res) => {
      toast.success("Réparation créée");
      onDone();
      navigate({ to: "/app/shop/$shopId/repairs/$repairId", params: { shopId, repairId: res.repairId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        <Wrench className="mr-2 h-4 w-4" />Convertir en dossier de réparation
      </Button>
    );
  }

  return (
    <div className="rounded-md border border-electric/40 bg-electric-soft/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Créer une réparation</div>
        <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">Annuler</button>
      </div>
      <div className="flex gap-2 text-xs">
        <button className={`px-3 py-1 rounded ${!newCustomer ? "bg-navy text-navy-foreground" : "bg-surface border border-border"}`} onClick={() => setNewCustomer(false)}>Client existant</button>
        <button className={`px-3 py-1 rounded ${newCustomer ? "bg-navy text-navy-foreground" : "bg-surface border border-border"}`} onClick={() => setNewCustomer(true)}>Nouveau client</button>
      </div>
      {newCustomer ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Prénom</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div><Label className="text-xs">Nom</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Email</Label><Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
            <div><Label className="text-xs">Téléphone</Label><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
          </div>
        </div>
      ) : (
        <div>
          <Label className="text-xs">Client</Label>
          <Select value={customerId} onValueChange={(v) => { setCustomerId(v); setDeviceId(""); }}>
            <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
            <SelectContent className="max-h-60">
              {(customersQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.customer_type === "business" ? c.company_name : [c.first_name, c.last_name].filter(Boolean).join(" ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Marque appareil</Label><Input value={deviceBrand} onChange={(e) => setDeviceBrand(e.target.value)} placeholder="Apple, HP…" /></div>
        <div><Label className="text-xs">Modèle</Label><Input value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} /></div>
      </div>
      {!newCustomer && customerId && (devicesQ.data ?? []).length > 0 && (
        <div>
          <Label className="text-xs">Appareil existant (facultatif)</Label>
          <Select value={deviceId} onValueChange={setDeviceId}>
            <SelectTrigger><SelectValue placeholder="Nouveau appareil…" /></SelectTrigger>
            <SelectContent>
              {(devicesQ.data ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>{[d.brand, d.model].filter(Boolean).join(" ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button
        size="sm"
        className="w-full bg-electric text-electric-foreground hover:bg-electric/90"
        onClick={() => mut.mutate()}
        disabled={mut.isPending || (!newCustomer && !customerId) || (newCustomer && !firstName && !lastName)}
      >
        {mut.isPending ? "Création…" : "Créer la réparation"}
      </Button>
    </div>
  );
}