import { cn } from "@/lib/utils";

const LABEL: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  no_show: "Absent",
  completed: "Terminé",
};

const CLS: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  confirmed: "bg-success/15 text-success border-success/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  no_show: "bg-muted text-muted-foreground border-border",
  completed: "bg-electric-soft text-electric border-electric/30",
};

export function AppointmentStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", CLS[status] ?? "bg-secondary text-secondary-foreground border-border")}>
      {LABEL[status] ?? status}
    </span>
  );
}

export interface AppointmentLike {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  is_urgent?: boolean;
  contact_name?: string | null;
  problem_description?: string | null;
  device_description?: string | null;
}

export function AppointmentCard({ appt, onClick }: { appt: AppointmentLike; onClick?: () => void }) {
  const start = new Date(appt.starts_at);
  const end = new Date(appt.ends_at);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-md border border-border bg-surface p-2.5 hover:border-electric hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-navy">
          {start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          <span className="text-muted-foreground"> → {end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
        </span>
        <AppointmentStatusBadge status={appt.status} />
      </div>
      <div className="text-sm font-medium truncate">{appt.contact_name ?? "Sans nom"}</div>
      {appt.device_description && <div className="text-xs text-muted-foreground truncate">{appt.device_description}</div>}
      {appt.is_urgent && <div className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wider text-destructive">Urgent</div>}
    </button>
  );
}