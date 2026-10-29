import { Button } from "@/components/ui/button";
import { Download, Loader2, type LucideIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { getInvoicePdf, getQuotePdf } from "@/lib/documents.functions";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

function base64ToBlob(base64: string, type = "application/pdf"): Blob {
  if (!base64 || typeof base64 !== "string" || !/^[A-Za-z0-9+/=\r\n]+$/.test(base64.slice(0, 64))) {
    throw new Error("Réponse PDF invalide (base64 manquant)");
  }
  const clean = base64.replace(/\s+/g, "");
  let bin: string;
  try { bin = atob(clean); } catch { throw new Error("Réponse PDF corrompue (base64 invalide)"); }
  if (bin.length === 0) throw new Error("PDF vide reçu du serveur");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ============ Generic PdfDownloadButton ============ */
type ServerFn<D> = (args: { data: D }) => Promise<{ base64: string; filename: string }>;

export interface PdfDownloadButtonProps<D> {
  fn: ServerFn<D>;
  data: D;
  label?: string;
  icon?: LucideIcon;
  fallbackFilename?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  onError?: (err: Error) => void;
  children?: ReactNode;
}

export function PdfDownloadButton<D>({
  fn, data, label = "Télécharger PDF", icon: Icon = Download,
  fallbackFilename = "document.pdf", size, variant = "outline",
  className, compact = false, disabled, onError, children,
}: PdfDownloadButtonProps<D>) {
  const invoke = useServerFn(fn);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);

  async function onClick() {
    if (inFlight.current || loading || disabled) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await invoke({ data });
      if (!res || typeof res.base64 !== "string") throw new Error("Réponse serveur vide");
      const blob = base64ToBlob(res.base64);
      if (blob.size === 0) throw new Error("PDF vide");
      triggerDownload(blob, res.filename || fallbackFilename);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      const msg = /unauthor|forbidden|not allowed|permission|rls|denied/i.test(err.message)
        ? "Vous n'avez pas l'autorisation pour ce document"
        : err.message || "Impossible de générer le PDF";
      toast.error(msg);
      onError?.(err);
    } finally {
      setLoading(false);
      // Petite pause anti double-clic
      setTimeout(() => { inFlight.current = false; }, 400);
    }
  }

  const compactSize = compact ? "sm" : (size ?? "default");
  return (
    <Button
      type="button"
      variant={variant}
      size={compactSize}
      className={className}
      onClick={onClick}
      disabled={loading || disabled}
      aria-busy={loading}
      title={label}
    >
      {loading ? <Loader2 className={compact ? "h-4 w-4 animate-spin" : "mr-2 h-4 w-4 animate-spin"} />
               : <Icon className={compact ? "h-4 w-4" : "mr-2 h-4 w-4"} />}
      {!compact && (children ?? label)}
    </Button>
  );
}

/* ============ Backward-compat wrapper (invoice/quote) ============ */
interface LegacyProps { shopId: string; id: string; kind: "invoice" | "quote"; label?: string }

export function DownloadPdfButton({ shopId, id, kind, label }: LegacyProps) {
  if (kind === "invoice") {
    return <PdfDownloadButton
      fn={getInvoicePdf}
      data={{ shopId, invoiceId: id }}
      label={label ?? "Télécharger la facture"}
      fallbackFilename="facture.pdf"
    />;
  }
  return <PdfDownloadButton
    fn={getQuotePdf}
    data={{ shopId, quoteId: id }}
    label={label ?? "Télécharger le devis"}
    fallbackFilename="devis.pdf"
  />;
}