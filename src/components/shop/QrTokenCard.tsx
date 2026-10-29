import { QRCodeCanvas } from "qrcode.react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrCreateRepairToken, revokeRepairToken } from "@/lib/appointments.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Download, RefreshCw, ShieldOff, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  repairId: string;
}

export function QrTokenCard({ repairId }: Props) {
  const qc = useQueryClient();
  const getFn = useServerFn(getOrCreateRepairToken);
  const revokeFn = useServerFn(revokeRepairToken);

  const tokenQ = useQuery({
    queryKey: ["repair-token-meta", repairId],
    queryFn: async () => {
      const { data } = await supabase.from("repair_public_tokens")
        .select("token, created_at, expires_at, revoked_at, view_count, last_viewed_at")
        .eq("repair_id", repairId).maybeSingle();
      return data;
    },
  });

  const createMut = useMutation({
    mutationFn: () => getFn({ data: { repairId } }),
    onSuccess: () => { toast.success("Lien de suivi actif"); qc.invalidateQueries({ queryKey: ["repair-token-meta", repairId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeMut = useMutation({
    mutationFn: () => revokeFn({ data: { repairId } }),
    onSuccess: () => { toast.success("Lien révoqué"); qc.invalidateQueries({ queryKey: ["repair-token-meta", repairId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const token = tokenQ.data?.token;
  const revoked = tokenQ.data?.revoked_at != null;
  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/suivi/${token}` : "";
  const active = token && !revoked;

  async function copy() {
    await navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  }
  function downloadQr() {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-qr-repair]");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `suivi-${repairId.slice(0, 8)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="bpei-surface p-5 space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-electric" />
        <div>
          <div className="font-semibold text-sm">Suivi client par QR code</div>
          <div className="text-xs text-muted-foreground">Le client scanne, il suit sa réparation sans compte.</div>
        </div>
      </div>

      {!token && (
        <Button size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending} className="w-full">
          {createMut.isPending ? "Génération…" : "Générer un lien de suivi"}
        </Button>
      )}

      {token && (
        <>
          <div className="flex justify-center rounded-lg border border-border bg-white p-4">
            <QRCodeCanvas value={url} size={180} data-qr-repair="1" level="M" includeMargin={false} />
          </div>
          <div className="rounded-md border border-border bg-surface-muted p-2 text-[11px] font-mono break-all">
            {url}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={copy}><Copy className="h-3.5 w-3.5 mr-1.5" />Copier</Button>
            <Button size="sm" variant="outline" onClick={downloadQr}><Download className="h-3.5 w-3.5 mr-1.5" />QR PNG</Button>
            <Button size="sm" variant="outline" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Régénérer
            </Button>
            <Button size="sm" variant="outline" onClick={() => revokeMut.mutate()} disabled={!active || revokeMut.isPending}>
              <ShieldOff className="h-3.5 w-3.5 mr-1.5" />Révoquer
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>État : <span className={active ? "text-success font-medium" : "text-destructive font-medium"}>{active ? "Actif" : "Révoqué"}</span></div>
            <div>Créé le : {tokenQ.data?.created_at ? new Date(tokenQ.data.created_at).toLocaleString("fr-FR") : "—"}</div>
            <div>Vues : {tokenQ.data?.view_count ?? 0}</div>
          </div>
        </>
      )}
    </div>
  );
}