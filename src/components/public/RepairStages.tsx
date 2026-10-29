import { Check, Search, Package, Wrench, PackageCheck } from "lucide-react";
import type { RepairStatus } from "@/lib/shop-constants";

// 4 étapes simplifiées côté client
type Stage = "diagnostic" | "part" | "repair" | "ready";

const STAGE_MAP: Record<string, Stage> = {
  request_received: "diagnostic",
  device_dropped_off: "diagnostic",
  awaiting_diagnosis: "diagnostic",
  diagnosis_in_progress: "diagnostic",
  quote_to_prepare: "diagnostic",
  quote_sent: "diagnostic",
  awaiting_response: "diagnostic",
  quote_accepted: "part",
  awaiting_part: "part",
  part_ordered: "part",
  repair_in_progress: "repair",
  testing_in_progress: "repair",
  repair_completed: "ready",
  ready_for_pickup: "ready",
  customer_notified: "ready",
  device_collected: "ready",
};

const STAGE_ORDER: Stage[] = ["diagnostic", "part", "repair", "ready"];
const STAGE_LABEL: Record<Stage, string> = {
  diagnostic: "Diagnostic",
  part: "Pièce",
  repair: "Réparation",
  ready: "Prêt",
};
const STAGE_ICON: Record<Stage, React.ComponentType<{ className?: string }>> = {
  diagnostic: Search,
  part: Package,
  repair: Wrench,
  ready: PackageCheck,
};

export function RepairStages({ status }: { status: string }) {
  const current = STAGE_MAP[status] ?? "diagnostic";
  const currentIdx = STAGE_ORDER.indexOf(current);
  const isFinal = status === "device_collected";

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4">
      {STAGE_ORDER.map((s, i) => {
        const Icon = STAGE_ICON[s];
        const done = i < currentIdx || isFinal;
        const active = !isFinal && i === currentIdx;
        return (
          <div key={s} className="flex flex-col items-center text-center gap-1.5">
            <div className={`relative grid h-11 w-11 sm:h-14 sm:w-14 place-items-center rounded-full border-2 transition-all
              ${done ? "border-success bg-success text-success-foreground" : active ? "border-electric bg-electric text-electric-foreground shadow-electric" : "border-border bg-surface text-muted-foreground"}`}>
              {done ? <Check className="h-5 w-5 sm:h-6 sm:w-6" /> : <Icon className="h-4 w-4 sm:h-6 sm:w-6" />}
              {active && (
                <span className="absolute inset-0 rounded-full border-2 border-electric animate-ping opacity-30" />
              )}
            </div>
            <div className={`text-[10px] sm:text-xs font-semibold ${done ? "text-success" : active ? "text-electric" : "text-muted-foreground"}`}>
              {STAGE_LABEL[s]}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function stageForStatus(status: string): Stage {
  return STAGE_MAP[status as RepairStatus] ?? "diagnostic";
}