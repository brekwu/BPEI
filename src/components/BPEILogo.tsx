import { useState } from "react";
import { cn } from "@/lib/utils";
import bpeiLogo from "@/assets/bpei-logo.png.asset.json";

interface Props {
  className?: string;
  variant?: "light" | "dark";
  /** Hauteur en pixels ; par défaut 36 */
  size?: number;
}

/**
 * Logo officiel BPEI ; en dehors de l'hébergement Lovable, la référence
 * d'image interne peut devenir indisponible. Afficher alors le mot-symbole.
 */
export function BPEILogo({ className, variant = "dark", size = 36 }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const isLight = variant === "light";
  const logo = !imageFailed ? (
    <img
      src={bpeiLogo.url}
      alt="BPEI"
      style={{ height: size, width: "auto" }}
      className="object-contain"
      draggable={false}
      onError={() => setImageFailed(true)}
    />
  ) : (
    <span
      role="img"
      aria-label="BPEI"
      className="inline-flex items-center font-extrabold tracking-tight text-navy"
      style={{ height: size, fontSize: Math.max(14, size * 0.5) }}
    >
      BPEI
    </span>
  );

  return isLight ? (
    <div className={cn("inline-flex items-center rounded-md bg-white px-2 py-1 shadow-sm", className)}>
      {logo}
    </div>
  ) : (
    <div className={cn("inline-flex items-center", className)}>{logo}</div>
  );
}
