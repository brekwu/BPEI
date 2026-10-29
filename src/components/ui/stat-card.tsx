import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  accent?: "default" | "electric" | "success" | "warning" | "destructive";
  loading?: boolean;
  className?: string;
}

const ACCENT: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "bg-secondary text-navy",
  electric: "bg-electric-soft text-electric",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning-foreground",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({
  label,
  value,
  icon,
  hint,
  trend,
  accent = "default",
  loading,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="font-display text-3xl font-bold leading-none tracking-tight text-foreground">
            {loading ? <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" /> : value}
          </div>
        </div>
        {icon ? (
          <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", ACCENT[accent])}>
            {icon}
          </div>
        ) : null}
      </div>
      {(trend || hint) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium",
                trend.direction === "up" && "bg-success/10 text-success",
                trend.direction === "down" && "bg-destructive/10 text-destructive",
                trend.direction === "flat" && "bg-muted text-muted-foreground",
              )}
            >
              {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "•"} {trend.value}
            </span>
          ) : null}
          {hint ? <span className="text-muted-foreground">{hint}</span> : null}
        </div>
      )}
    </div>
  );
}