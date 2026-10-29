import { cn } from "@/lib/utils";

type Tone = "neutral" | "info" | "success" | "warning" | "destructive" | "pending" | "muted";

const TONE: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground border-border",
  info: "bg-electric-soft text-electric border-electric/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/25",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-muted text-muted-foreground border-border",
  muted: "bg-muted/50 text-muted-foreground border-border/60",
};

// Mapping des statuts métier BPEI → tonalités visuelles + libellé FR.
// Centralise ici : évite les mappings ad hoc dans chaque page.
const STATUS_MAP: Record<string, { tone: Tone; label: string }> = {
  // Réparations
  received: { tone: "info", label: "Reçue" },
  in_diagnosis: { tone: "info", label: "Diagnostic" },
  awaiting_quote_validation: { tone: "warning", label: "Attente devis" },
  awaiting_parts: { tone: "warning", label: "Attente pièces" },
  in_repair: { tone: "info", label: "En réparation" },
  repair_completed: { tone: "success", label: "Terminée" },
  device_collected: { tone: "success", label: "Retirée" },
  closed: { tone: "muted", label: "Clôturée" },
  cancelled: { tone: "destructive", label: "Annulée" },
  irreparable: { tone: "destructive", label: "Irréparable" },
  // Devis
  draft: { tone: "muted", label: "Brouillon" },
  sent: { tone: "info", label: "Envoyé" },
  accepted: { tone: "success", label: "Accepté" },
  rejected: { tone: "destructive", label: "Refusé" },
  expired: { tone: "muted", label: "Expiré" },
  converted: { tone: "success", label: "Converti" },
  // Factures
  issued: { tone: "info", label: "Émise" },
  partially_paid: { tone: "warning", label: "Partiellement payée" },
  paid: { tone: "success", label: "Payée" },
  overdue: { tone: "destructive", label: "En retard" },
  void: { tone: "muted", label: "Annulée" },
  // Rendez-vous
  pending: { tone: "warning", label: "En attente" },
  confirmed: { tone: "success", label: "Confirmé" },
  in_progress: { tone: "info", label: "En cours" },
  completed: { tone: "success", label: "Terminé" },
  no_show: { tone: "destructive", label: "Absent" },
  // Paiements
  succeeded: { tone: "success", label: "Réussi" },
  failed: { tone: "destructive", label: "Échoué" },
  refunded: { tone: "muted", label: "Remboursé" },
};

interface StatusBadgeProps {
  status: string;
  /** Force un libellé, sinon utilise le mapping */
  label?: string;
  /** Force une tonalité, sinon utilise le mapping */
  tone?: Tone;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, label, tone, className, size = "md" }: StatusBadgeProps) {
  const mapped = STATUS_MAP[status];
  const finalTone = tone ?? mapped?.tone ?? "neutral";
  const finalLabel = label ?? mapped?.label ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONE[finalTone],
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          finalTone === "success" && "bg-success",
          finalTone === "warning" && "bg-warning",
          finalTone === "destructive" && "bg-destructive",
          finalTone === "info" && "bg-electric",
          (finalTone === "neutral" || finalTone === "muted" || finalTone === "pending") &&
            "bg-muted-foreground/60",
        )}
      />
      {finalLabel}
    </span>
  );
}