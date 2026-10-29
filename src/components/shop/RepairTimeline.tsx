import { REPAIR_STATUS_LABEL, type RepairStatus } from "@/lib/shop-constants";

// Public-facing simplified status mapping.
const PUBLIC_LABEL: Partial<Record<RepairStatus, string>> = {
  request_received: "Demande reçue",
  device_dropped_off: "Appareil pris en charge",
  awaiting_diagnosis: "Diagnostic à venir",
  diagnosis_in_progress: "Diagnostic en cours",
  quote_to_prepare: "Devis en préparation",
  quote_sent: "Devis à consulter",
  awaiting_response: "En attente de votre réponse",
  quote_accepted: "Devis accepté",
  quote_rejected: "Devis refusé",
  awaiting_part: "Pièce en attente",
  part_ordered: "Pièce commandée",
  repair_in_progress: "Réparation en cours",
  testing_in_progress: "Tests en cours",
  repair_completed: "Réparation terminée",
  ready_for_pickup: "Appareil prêt à récupérer",
  customer_notified: "Prêt — vous avez été notifié",
  device_collected: "Récupéré, merci !",
  not_repairable: "Non réparable",
  cancelled: "Annulé",
  warranty_return: "Retour SAV",
};

export function publicRepairLabel(status: string) {
  return PUBLIC_LABEL[status as RepairStatus] ?? REPAIR_STATUS_LABEL[status as RepairStatus] ?? status;
}

export function RepairTimeline({
  history,
  currentStatus,
}: {
  history: Array<{ old_status: string | null; new_status: string; changed_at: string }>;
  currentStatus: string;
}) {
  const items = [...history].reverse();
  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">Historique à venir.</div>;
  }
  return (
    <ol className="relative border-l-2 border-border pl-5 space-y-4">
      {items.map((h, i) => {
        const isLast = i === items.length - 1;
        return (
          <li key={i} className="relative">
            <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-2 ring-surface ${isLast && h.new_status === currentStatus ? "bg-electric" : "bg-border"}`} />
            <div className="text-sm font-medium">{publicRepairLabel(h.new_status)}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(h.changed_at).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}