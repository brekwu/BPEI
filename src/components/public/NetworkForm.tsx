import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export function Field({
  label, error, hint, className, children,
}: {
  label: string; error?: string; hint?: string; className?: string;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>;
}) {
  const id = useId();
  const errId = `${id}-err`;
  const child = isValidElement(children)
    ? cloneElement(Children.only(children), {
        id: children.props.id ?? id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errId : undefined,
      })
    : children;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={children.props.id ?? id} className="text-sm">{label}</Label>
      {child}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={errId} className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function FormSection({ step, title, desc, children }: { step?: number; title: string; desc?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="flex items-center gap-3">
        {step != null && (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-navy-foreground">{step}</span>
        )}
        <span className="text-lg font-semibold">{title}</span>
      </legend>
      {desc && <p className="-mt-2 text-sm text-muted-foreground">{desc}</p>}
      {children}
    </fieldset>
  );
}

export function ChoiceCard({
  active, onClick, title, desc, icon,
}: { active: boolean; onClick: () => void; title: string; desc: string; icon?: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "relative flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors",
        active ? "border-electric bg-electric/5" : "border-border bg-card hover:border-electric/50",
      )}
    >
      {icon && <span className="mt-0.5 text-electric">{icon}</span>}
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{desc}</span>
      </span>
      {active && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-electric" />}
    </button>
  );
}

export function ChipToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-2 text-sm transition-colors",
        active ? "border-electric bg-electric text-electric-foreground" : "border-border bg-card hover:border-electric/50",
      )}
    >
      {children}
    </button>
  );
}

export const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";