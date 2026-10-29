import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  listAgreementVersions, diffAgreementVersions, getAgreementVersionPdf,
} from "@/lib/partnerships.functions";

interface Props {
  agreementId: string;
  agreementTitle: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const FIELD_LABELS: Record<string, string> = {
  title: "Objet",
  scope: "Périmètre",
  specialties: "Services concernés",
  covered_cities: "Villes couvertes",
  covered_postal_codes: "Codes postaux",
  start_date: "Date de début",
  end_date: "Date de fin",
  exclusivity_kind: "Exclusivité",
  compensation_model: "Modèle de rémunération",
  compensation_details: "Détail rémunération",
  commission_terms: "Commissions",
  travel_fee: "Frais de déplacement",
  payment_terms: "Délais de paiement",
  invoicing_terms: "Facturation",
  availability_requirements: "Disponibilité",
  quality_requirements: "Qualité",
  confidentiality: "Confidentialité",
  termination_terms: "Résiliation",
  other_terms: "Autres conditions",
};

function fmtDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleString("fr-FR") : "—";
}

function downloadBase64Pdf(base64: string, filename: string) {
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const blob = new Blob([buf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function AgreementVersionsDialog({ agreementId, agreementTitle, open, onOpenChange }: Props) {
  const listFn = useServerFn(listAgreementVersions);
  const diffFn = useServerFn(diffAgreementVersions);
  const pdfFn = useServerFn(getAgreementVersionPdf);
  const [fromV, setFromV] = useState<string>("");
  const [toV, setToV] = useState<string>("");
  const [busy, setBusy] = useState<number | null>(null);

  const { data: versions, isLoading } = useQuery({
    queryKey: ["agr:versions:full", agreementId],
    queryFn: () => listFn({ data: { agreementId } }),
    enabled: open,
  });

  const sorted = useMemo(() => (versions ?? []).slice().sort((a: any, b: any) => a.version_number - b.version_number), [versions]);

  const canDiff = fromV && toV && fromV !== toV;
  const { data: diff, isFetching: diffLoading } = useQuery({
    queryKey: ["agr:diff", agreementId, fromV, toV],
    queryFn: () => diffFn({ data: { agreementId, fromVersion: Number(fromV), toVersion: Number(toV) } }),
    enabled: !!canDiff,
  });

  async function handleDownload(versionNumber: number) {
    setBusy(versionNumber);
    try {
      const res = await pdfFn({ data: { agreementId, versionNumber } });
      downloadBase64Pdf(res.base64, res.filename);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur PDF");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historique des versions — {agreementTitle}</DialogTitle>
          <DialogDescription>
            Toute modification de contenu crée une nouvelle version figée avec sa propre empreinte SHA-256.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune version enregistrée.</p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              {sorted.map((v: any) => {
                const active = v.shop_accepted_at && v.independent_accepted_at;
                return (
                  <div key={v.id} className="rounded border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>Version {v.version_number}</Badge>
                      {active ? (
                        <Badge className="bg-emerald-100 text-emerald-800">Signée par les deux parties</Badge>
                      ) : v.shop_accepted_at ? (
                        <Badge className="bg-amber-100 text-amber-800">Signée boutique</Badge>
                      ) : v.independent_accepted_at ? (
                        <Badge className="bg-amber-100 text-amber-800">Signée indépendant</Badge>
                      ) : (
                        <Badge variant="outline">En attente</Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        Créée le {fmtDate(v.created_at)}
                      </span>
                    </div>
                    {v.change_summary ? (
                      <p className="mt-1 text-xs text-muted-foreground">Résumé : {v.change_summary}</p>
                    ) : null}
                    <p className="mt-1 text-xs">
                      <span className="text-muted-foreground">Empreinte :</span>{" "}
                      <code className="break-all">{v.content_hash}</code>
                    </p>
                    <div className="mt-2">
                      <Button
                        size="sm" variant="outline"
                        disabled={busy === v.version_number}
                        onClick={() => handleDownload(v.version_number)}
                      >
                        {busy === v.version_number ? "Génération…" : "Télécharger le PDF"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {sorted.length >= 2 ? (
              <div className="rounded border p-3">
                <p className="font-medium text-sm">Comparer deux versions</p>
                <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
                  <div>
                    <label className="text-xs text-muted-foreground">De</label>
                    <Select value={fromV} onValueChange={setFromV}>
                      <SelectTrigger className="w-32"><SelectValue placeholder="Version" /></SelectTrigger>
                      <SelectContent>
                        {sorted.map((v: any) => (
                          <SelectItem key={v.id} value={String(v.version_number)}>v{v.version_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Vers</label>
                    <Select value={toV} onValueChange={setToV}>
                      <SelectTrigger className="w-32"><SelectValue placeholder="Version" /></SelectTrigger>
                      <SelectContent>
                        {sorted.map((v: any) => (
                          <SelectItem key={v.id} value={String(v.version_number)}>v{v.version_number}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {canDiff ? (
                  diffLoading ? (
                    <p className="mt-3 text-sm text-muted-foreground">Calcul du diff…</p>
                  ) : diff && diff.changes.length === 0 ? (
                    <p className="mt-3 text-sm text-emerald-700">Aucun changement détecté entre v{diff.from.version} et v{diff.to.version}.</p>
                  ) : diff ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        {diff.changes.length} champ(s) modifié(s) entre v{diff.from.version} et v{diff.to.version}.
                      </p>
                      {diff.changes.map((c) => (
                        <div key={c.key} className="rounded border p-2 text-sm">
                          <p className="font-medium">{FIELD_LABELS[c.key] ?? c.key}</p>
                          <div className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                            <div className="rounded bg-red-50 p-2 text-red-900">
                              <span className="text-xs uppercase">Avant (v{diff.from.version})</span>
                              <p className="whitespace-pre-wrap">{c.before || "—"}</p>
                            </div>
                            <div className="rounded bg-emerald-50 p-2 text-emerald-900">
                              <span className="text-xs uppercase">Après (v{diff.to.version})</span>
                              <p className="whitespace-pre-wrap">{c.after || "—"}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}