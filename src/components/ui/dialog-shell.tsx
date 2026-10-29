import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface DialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

/**
 * Coquille de dialogue standardisée pour tous les modaux BPEI.
 * Header + Body scrollable + Footer optionnel.
 */
export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}: DialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(SIZE[size], "max-h-[90vh] overflow-hidden p-0", className)}>
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle className="font-display text-base font-semibold">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-xs text-muted-foreground">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <DialogFooter className="border-t border-border bg-muted/30 px-6 py-3">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}