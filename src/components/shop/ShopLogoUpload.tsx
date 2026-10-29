import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getShopLogoSignedUrl, setShopLogoPath } from "@/lib/shop-logo.functions";

const MAX_BYTES = 1_000_000; // 1 Mo
const MIN_SIDE = 128;
const MAX_SIDE = 2000;
// SVG désactivé volontairement : un SVG peut embarquer scripts, handlers et
// ressources externes. Nous ne disposons pas d'un runtime de sanitisation
// (DOMPurify n'est pas fiable côté worker sans DOM). Réactiver seulement
// après avoir intégré une sanitisation stricte côté serveur.
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

interface Props {
  shopId: string;
  canManage: boolean;
}

async function readDimensions(file: File): Promise<{ w: number; h: number } | null> {
  return await new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { w: img.naturalWidth, h: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

export function ShopLogoUpload({ shopId, canManage }: Props) {
  const qc = useQueryClient();
  const getUrl = useServerFn(getShopLogoSignedUrl);
  const setPath = useServerFn(setShopLogoPath);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const q = useQuery({
    queryKey: ["shop-logo", shopId],
    queryFn: () => getUrl({ data: { shopId } }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      // On vide juste la référence : le fichier reste dans le bucket
      // pour que les anciens PDF puissent toujours l'afficher.
      await setPath({ data: { shopId, path: null } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-logo", shopId] });
      qc.invalidateQueries({ queryKey: ["billing-settings", shopId] });
      toast.success("Logo retiré. Les anciens documents conservent leur logo.");
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  async function onFile(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non supporté (PNG, JPEG ou WebP uniquement).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`Fichier trop lourd (max ${Math.round(MAX_BYTES / 1024)} Ko).`);
      return;
    }
    const dims = await readDimensions(file);
    if (!dims) { toast.error("Image illisible."); return; }
    if (dims.w < MIN_SIDE || dims.h < MIN_SIDE) {
      toast.error(`Logo trop petit (min ${MIN_SIDE}×${MIN_SIDE} px).`);
      return;
    }
    if (dims.w > MAX_SIDE || dims.h > MAX_SIDE) {
      toast.error(`Logo trop grand (max ${MAX_SIDE}×${MAX_SIDE} px).`);
      return;
    }
    const ratio = dims.w / dims.h;
    if (ratio < 0.3 || ratio > 5) {
      toast.error("Proportions trop déformées (garder un ratio raisonnable).");
      return;
    }

    setUploading(true);
    try {
      const ext = file.type === "image/png" ? "png"
        : file.type === "image/webp" ? "webp" : "jpg";
      // Nom horodaté : les anciens fichiers restent dans le bucket pour
      // que les PDF déjà émis (snapshots) continuent à afficher leur logo
      // d'origine même après remplacement.
      const path = `${shopId}/logo-${Date.now()}.${ext}`;
      const up = await supabase.storage.from("shop-logos").upload(path, file, {
        contentType: file.type, upsert: false, cacheControl: "3600",
      });
      if (up.error) throw new Error(up.error.message);
      await setPath({ data: { shopId, path } });
      qc.invalidateQueries({ queryKey: ["shop-logo", shopId] });
      qc.invalidateQueries({ queryKey: ["billing-settings", shopId] });
      toast.success("Logo mis à jour. Les anciens documents PDF conservent l'ancien logo.");
    } catch (e: any) {
      toast.error(e.message ?? "Échec de l'upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const url = q.data?.url ?? null;

  return (
    <div className="rounded-md border bg-background p-4 space-y-3">
      <div>
        <Label className="text-sm font-semibold">Logo de la boutique</Label>
        <p className="text-xs text-muted-foreground mt-1">
          PNG, JPEG ou WebP. Entre {MIN_SIDE}×{MIN_SIDE} et {MAX_SIDE}×{MAX_SIDE} px,
          1 Mo max. Affiché sur la fiche publique, le portail client et les documents.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded border bg-muted/40 flex items-center justify-center overflow-hidden">
          {url ? (
            <img src={url} alt="Logo boutique" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground text-center px-1">Aucun logo</span>
          )}
        </div>
        {canManage && (
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "Envoi…" : url ? "Remplacer" : "Téléverser"}
            </Button>
            {url && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                Supprimer
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}