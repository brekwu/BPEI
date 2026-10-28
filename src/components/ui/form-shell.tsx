import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Bloc de formulaire titré, homogène avec SectionCard. */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title ? (
            <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
          ) : null}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Ligne de formulaire responsive : 1 col mobile, 2 col dès sm. */
export function FormRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>{children}</div>
  );
}

/** Pied d'actions formulaire (sticky optionnel). */
export function FormActions({
  children,
  className,
  sticky = false,
  align = "end",
}: {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
  align?: "start" | "end" | "between";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 pt-2",
        align === "end" && "justify-end",
        align === "between" && "justify-between",
        sticky &&
          "sticky bottom-0 -mx-5 border-t border-border bg-card/95 px-5 py-3 backdrop-blur",
        className,
      )}
    >
      {children}
    </div>
  );
}