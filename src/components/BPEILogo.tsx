import { cn } from "@/lib/utils";
import bpeiLogo from "@/assets/bpei-logo.png.asset.json";

interface Props {
  className?: string;
  variant?: "light" | "dark";
  /** Hauteur en pixels ; par défaut 36 */
  size?: number;
}

/**
 * Logo officiel BPEI.
 * - variant "dark" : logo tel quel (fond clair).
 * - variant "light" : cartouche blanc arrondi pour lisibilité sur fond sombre.
 */
export function BPEILogo({ className, variant = "dark", size = 36 }: Props) {
  const isLight = variant === "light";
  const img = (
    <img
      src={bpeiLogo.url}
      alt="BPEI"
      style={{ height: size, width: "auto" }}
      className="object-contain"
      draggable={false}
    />
  );

  if (isLight) {
    return (
      <div
        className={cn(
          "inline-flex items-center rounded-md bg-white px-2 py-1 shadow-sm",
          className,
        )}
      >
        {img}
      </div>
    );
  }

  return <div className={cn("inline-flex items-center", className)}>{img}</div>;
}