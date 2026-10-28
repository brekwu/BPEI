import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  REPAIR_STATUS_LABEL, REPAIR_PRIORITY_LABEL,
  DONE_STATUSES, IN_PROGRESS_STATUSES, READY_STATUSES,
  type RepairStatus, type RepairPriority,
} from "@/lib/shop-constants";

const STATUS_TONE: Partial<Record<RepairStatus, string>> = {
  ready_for_pickup: "bg-success/15 text-success border-success/30",
  customer_notified: "bg-success/15 text-success border-success/30",
  device_collected: "bg-muted text-muted-foreground border-border",
  not_repairable: "bg-destructive/10 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  warranty_return: "bg-warning/15 text-warning border-warning/30",
};

export function StatusBadge({ status }: { status: RepairStatus }) {
  let tone = STATUS_TONE[status];
  if (!tone) {
    if (IN_PROGRESS_STATUSES.includes(status)) tone = "bg-electric/10 text-electric border-electric/30";
    else if (READY_STATUSES.includes(status)) tone = "bg-success/15 text-success border-success/30";
    else if (DONE_STATUSES.includes(status)) tone = "bg-muted text-muted-foreground border-border";
    else tone = "bg-navy/10 text-navy border-navy/20";
  }
  return (
    <Badge variant="outline" className={cn("font-normal", tone)}>
      {REPAIR_STATUS_LABEL[status]}
    </Badge>
  );
}

const PRIORITY_TONE: Record<RepairPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  normal: "bg-navy/10 text-navy border-navy/20",
  high: "bg-warning/15 text-warning border-warning/30",
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
};

export function PriorityBadge({ priority }: { priority: RepairPriority }) {
  return (
    <Badge variant="outline" className={cn("font-normal", PRIORITY_TONE[priority])}>
      {REPAIR_PRIORITY_LABEL[priority]}
    </Badge>
  );
}