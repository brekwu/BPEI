import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { setShopMediaPath, getShopMediaSignedUrl } from "@/lib/shop-media.functions";
import { Trash2, Upload } from "lucide-react";

type Kind = "logo" | "cover" | "favicon" | "social";

const LIMITS: Record<Kind, { max: number; label: string; hint: string }> = {
  logo: { max: 2_000_000, label: "Logo public", hint: "PNG, JPEG ou WebP. 2 Mo max. Idéal 800×800." },
  cover: { max: 5_000_000, label: "Image de couverture", hint: "PNG, JPEG ou WebP. 5 Mo max. Idéal 1920×600." },
  favicon: { max: 200_000, label: "Favicon", hint: "PNG ou WebP carré. 200 Ko max." },
  social: { max: 5_000_000, label: "Image de partage réseaux", hint: "PNG ou JPEG. 5 Mo max. Idéal 1200×630." },
};

const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

interface Props {
  shopId: string;
  kind: Kind;
  currentPath: string | null;
}

export function MediaUploader({ shopId, kind, currentPath }: Props) {
  const qc = useQueryClient();
  const setPath = useServerFn(setShopMediaPath);
  const getUrl = useServerFn(getShopMediaSignedUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const lim = LIMITS[kind];

  const preview = useQuery({
    queryKey: ["shop-media-url", shopId, kind, currentPath],
    queryFn: () => currentPath ? getUrl({ data: { path: currentPath } }) : Promise.resolve({ url: null as string | null }),
    enabled: !!currentPath,
  });

  const remove = useMutation({
    mutationFn: async () => setPath({ data: { shopId, kind, path: null } }),
    onSuccess: () => {
      toast.success("Image supprimée.");
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["onboarding-state", shopId] });
      qc.invalidateQueries({ queryKey: ["shop-media-url", shopId, kind] });
      qc.invalidateQueries({ queryKey: ["shop", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File) {
    // Reject empty / zero-byte files before touching Storage or DB.
    if (!file || !Number.isFinite(file.size) || file.size <= 0) {
      toast.error("Le fichier est vide. Sélectionnez un fichier valide.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      if (inputRef.current) inputRef.current.value = "";
      return toast.error("Format non supporté (PNG, JPEG, WebP)");
    }
    if (file.size > lim.max) {
      if (inputRef.current) inputRef.current.value = "";
      return toast.error(`Fichier trop lourd (max ${Math.round(lim.max / 1024)} Ko)`);
    }
    setBusy(true);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `shops/${shopId}/${kind}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from("shop-public-media").upload(path, file, {
        contentType: file.type, cacheControl: "3600", upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      try {
        await setPath({ data: { shopId, kind, path } });
      } catch (persistErr) {
        // Server rejected (e.g. empty file). Clean up the orphan storage object
        // and keep the previously saved image intact.
        await supabase.storage.from("shop-public-media").remove([path]).catch(() => {});
        throw persistErr;
      }
      toast.success("Image mise à jour");
      qc.invalidateQueries({ queryKey: ["onboarding-state", shopId] });
      qc.invalidateQueries({ queryKey: ["shop-media-url", shopId, kind] });
      qc.invalidateQueries({ queryKey: ["shop", shopId] });
    } catch (e: any) {
      toast.error(e.message ?? "Échec de l'upload");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-md border bg-background p-4 space-y-3">
      <div>
        <div className="text-sm font-semibold">{lim.label}</div>
        <p className="text-xs text-muted-foreground">{lim.hint}</p>
      </div>
      <div className="flex items-center gap-4">
        <div className={`${kind === "cover" ? "h-24 w-48" : "h-24 w-24"} rounded border bg-muted/40 flex items-center justify-center overflow-hidden`}>
          {preview.data?.url ? (
            <img src={preview.data.url} alt={lim.label} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground text-center px-1">Aucune image</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            aria-label={`Sélectionner un fichier pour ${lim.label}`}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
          />
          <Button type="button" variant="secondary" size="sm" disabled={busy}
            onClick={() => inputRef.current?.click()}
            aria-label={currentPath ? `Remplacer ${lim.label}` : `Téléverser ${lim.label}`}>
            <Upload className="mr-2 h-3.5 w-3.5" />
            {busy ? "Envoi…" : currentPath ? "Remplacer" : "Téléverser"}
          </Button>
          {currentPath && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={remove.isPending || busy}
              onClick={() => setConfirmOpen(true)}
              aria-label={`Supprimer ${lim.label}`}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Supprimer
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!remove.isPending) setConfirmOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette image ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'image sera retirée de la page publique de votre boutique. Cette action est immédiate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={(e) => { e.preventDefault(); if (!remove.isPending) remove.mutate(); }}
            >
              {remove.isPending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}