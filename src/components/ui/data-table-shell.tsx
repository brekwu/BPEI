import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface DataTableShellProps {
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: ReactNode;
  skeletonRows?: number;
  className?: string;
}

/**
 * Coquille standardisée autour d'un <table>.
 * Gère toolbar, loading, empty state et footer de pagination.
 */
export function DataTableShell({
  toolbar,
  children,
  footer,
  loading,
  empty,
  emptyTitle = "Aucun résultat",
  emptyDescription,
  emptyAction,
  emptyIcon,
  skeletonRows = 6,
  className,
}: DataTableShellProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-xs",
        className,
      )}
    >
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          {toolbar}
        </div>
      ) : null}
      <div className="relative overflow-x-auto">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: skeletonRows }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : empty ? (
          <div className="p-6">
            <EmptyState
              icon={emptyIcon}
              title={emptyTitle}
              description={emptyDescription}
              action={emptyAction}
              className="border-0 bg-transparent py-8"
            />
          </div>
        ) : (
          children
        )}
      </div>
      {footer ? (
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </div>
  );
}