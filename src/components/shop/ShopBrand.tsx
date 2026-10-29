import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { publicGetShopLogoUrl } from "@/lib/shop-logo.public.functions";
import { BPEILogo } from "@/components/BPEILogo";
import { cn } from "@/lib/utils";

interface Props {
  shopId: string | null | undefined;
  shopName?: string | null;
  className?: string;
  /** hauteur cible en px, largeur libre pour préserver le ratio */
  size?: number;
  variant?: "light" | "dark";
  /** rendu sur fond sombre (portail, header) : ajoute un cartouche clair si logo boutique */
  contrastBackground?: boolean;
}

/**
 * Affiche le logo de la boutique s'il existe, sinon le logo BPEI.
 * - image object-contain (jamais étirée)
 * - taille bornée par `size`
 * - texte alternatif = nom boutique ou "Logo"
 * - fond neutre optionnel pour améliorer la lisibilité
 * - URL signée temporaire (10 min) récupérée côté serveur
 */
export function ShopBrand({
  shopId,
  shopName,
  className,
  size = 40,
  variant = "dark",
  contrastBackground = false,
}: Props) {
  const getFn = useServerFn(publicGetShopLogoUrl);
  const q = useQuery({
    queryKey: ["public-shop-logo", shopId],
    queryFn: () => (shopId ? getFn({ data: { shopId } }) : Promise.resolve({ url: null })),
    enabled: !!shopId,
    staleTime: 5 * 60 * 1000,
  });

  const url = q.data?.url ?? null;

  if (!url) {
    return <BPEILogo variant={variant} className={className} />;
  }

  const alt = shopName ? `Logo ${shopName}` : "Logo boutique";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded",
          contrastBackground && "bg-white/95 p-1.5 shadow-sm",
        )}
        style={{ height: size, minWidth: size }}
      >
        <img
          src={url}
          alt={alt}
          className="max-h-full max-w-full object-contain"
          style={{ maxHeight: size - (contrastBackground ? 12 : 0), maxWidth: size * 3 }}
          loading="lazy"
          decoding="async"
        />
      </div>
      {shopName && (
        <span
          className={cn(
            "text-base font-semibold tracking-tight",
            variant === "light" ? "text-white" : "text-foreground",
          )}
        >
          {shopName}
        </span>
      )}
    </div>
  );
}