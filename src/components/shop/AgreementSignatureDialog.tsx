import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { listAgreementVersions, acceptAgreementVersion, checkAgreementConflicts } from "@/lib/partnerships.functions";

interface Props {
  agreementId: string;
  side: "shop" | "independent";
  agreement: {
    id: string;
    status: string;
    current_version: number | null;
    shop_signed_at: string | null;
    independent_signed_at: string | null;
    title: string;
    shop_id?: string;
    independent_shop_id?: string;
  };
  ownShopId?: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invalidateKey?: unknown[];
}

function fmtDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleString("fr-FR") : "—";
}

function fmtValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const FIELDS: Array<{ key: string; label: string }> = [
  { key: "title", label: "Objet" },
  { key: "scope", label: "Périmètre" },
  { key: "specialties", label: "Services concernés" },
  { key: "covered_cities", label: "Villes couvertes" },
  { key: "covered_postal_codes", label: "Codes postaux" },
  { key: "start_date", label: "Date de début" },
  { key: "end_date", label: "Date de fin" },
  { key: "exclusivity_kind", label: "Exclusivité" },
  { key: "compensation_model", label: "Modèle de rémunération" },
  { key: "compensation_details", label: "Détail rémunération" },
  { key: "commission_terms", label: "Commissions contractuelles" },
  { key: "travel_fee", label: "Frais de déplacement" },
  { key: "payment_terms", label: "Délais de paiement" },
  { key: "invoicing_terms", label: "Facturation prévue" },
  { key: "availability_requirements", label: "Disponibilité requise" },
  { key: "quality_requirements", label: "Exigences qualité" },
  { key: "confidentiality", label: "Confidentialité" },
  { key: "termination_terms", label: "Résiliation" },
  { key: "other_terms", label: "Autres conditions" },
];

export function AgreementSignatureDialog({
  agreementId, side, agreement, ownShopId, open, onOpenChange, invalidateKey,
}: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAgreementVersions);
  const acceptFn = useServerFn(acceptAgreementVersion);
  const conflictsFn = useServerFn(checkAgreementConflicts);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: versions, isLoading } = useQuery({
    queryKey: ["agr:versions", agreementId],
    queryFn: () => listFn({ data: { agreementId } }),
    enabled: open,
  });

  const current = (versions ?? []).find((v: any) => v.version_number === agreement.current_version)
    ?? (versions ?? [])[0];

  const scopedShopId = ownShopId
    ?? (side === "shop" ? agreement.shop_id : agreement.independent_shop_id);
  const { data: conflictsRes } = useQuery({
    queryKey: ["agr:conflicts", agreementId, scopedShopId],
    queryFn: () => conflictsFn({ data: {
      shopId: scopedShopId!,
      excludeAgreementId: agreementId,
      snapshot: (current?.snapshot ?? {}) as any,
    } }),
    enabled: open && !!scopedShopId && !!current,
  });
  const conflicts = conflictsRes?.conflicts ?? [];

  const shopAcceptedAt = current?.shop_accepted_at ?? agreement.shop_signed_at;
  const indepAcceptedAt = current?.independent_accepted_at ?? agreement.independent_signed_at;
  const mySide = side === "shop" ? shopAcceptedAt : indepAcceptedAt;
  const otherSide = side === "shop" ? indepAcceptedAt : shopAcceptedAt;
  const bothAccepted = shopAcceptedAt && indepAcceptedAt;

  async function handleAccept() {
    if (!current) return;
    setSubmitting(true);
    try {
      const res = await acceptFn({ data: {
        agreementId,
        versionNumber: current.version_number,
        contentHash: current.content_hash,
      }});
      if (res.status === "active") toast.success("Accord actif — les deux parties ont accepté.");
      else toast.success(`Acceptation enregistrée pour ${side === "shop" ? "la boutique" : "l'indépendant"}.`);
      qc.invalidateQueries({ queryKey: ["agr:versions", agreementId] });
      if (invalidateKey) qc.invalidateQueries({ queryKey: invalidateKey });
      onOpenChange(false);
      setChecked(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Récapitulatif de l'accord</DialogTitle>
          <DialogDescription>
            Relisez attentivement la version proposée avant d'accepter au nom de {side === "shop" ? "la boutique" : "l'indépendant"}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : !current ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
            Aucune version contractuelle n'a encore été proposée pour cet accord. La partie boutique doit d'abord
            créer une version via « Proposer une version ».
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Accord : {agreement.title}</Badge>
              <Badge>Version {current.version_number}</Badge>
              {bothAccepted
                ? <Badge className="bg-emerald-100 text-emerald-800">Accord actif</Badge>
                : shopAcceptedAt
                  ? <Badge className="bg-amber-100 text-amber-800">Accepté par la boutique — en attente de l'indépendant</Badge>
                  : indepAcceptedAt
                    ? <Badge className="bg-amber-100 text-amber-800">Accepté par l'indépendant — en attente de la boutique</Badge>
                    : <Badge variant="outline">En attente de double acceptation</Badge>}
            </div>

            <div className="rounded border p-3">
              <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FIELDS.map((f) => {
                  const v = (current.snapshot as any)?.[f.key];
                  if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
                  return (
                    <div key={f.key}>
                      <dt className="text-xs uppercase text-muted-foreground">{f.label}</dt>
                      <dd className="whitespace-pre-wrap">{fmtValue(v)}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>

            <div className="rounded border p-3 text-xs text-muted-foreground">
              <div><strong>Empreinte du contenu (SHA-256) :</strong> <code className="break-all">{current.content_hash}</code></div>
              <div className="mt-1">Cette empreinte garantit que le contenu ci-dessus n'a pas été modifié depuis sa proposition. Toute modification créera une nouvelle version et invalidera les acceptations.</div>
            </div>

            <div className="rounded border p-3">
              <p className="font-medium">État des acceptations</p>
              <ul className="mt-1 text-xs text-muted-foreground">
                <li>Boutique : {shopAcceptedAt ? `acceptée le ${fmtDate(shopAcceptedAt)}` : "en attente"}</li>
                <li>Indépendant : {indepAcceptedAt ? `accepté le ${fmtDate(indepAcceptedAt)}` : "en attente"}</li>
              </ul>
            </div>

            {conflicts.length > 0 ? (
              <div className={`rounded border p-3 text-sm ${conflicts.some((c) => c.severity === "high") ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
                <p className="font-medium">
                  {conflicts.some((c) => c.severity === "high") ? "⚠️ Conflit d'exclusivité détecté" : "⚠️ Chevauchement avec un accord existant"}
                </p>
                <ul className="mt-1 space-y-2 text-xs">
                  {conflicts.map((c) => (
                    <li key={c.agreementId}>
                      <strong>{c.title}</strong> ({c.status}) — sévérité {c.severity}
                      <ul className="ml-4 list-disc">
                        {c.exclusivityConflict ? <li>Exclusivité en conflit sur la même période et le même périmètre.</li> : null}
                        {c.sharedServices.length > 0 ? <li>Services partagés : {c.sharedServices.join(", ")}</li> : null}
                        {c.sharedCities.length > 0 ? <li>Villes partagées : {c.sharedCities.join(", ")}</li> : null}
                        {c.sharedPostalCodes.length > 0 ? <li>Codes postaux partagés : {c.sharedPostalCodes.join(", ")}</li> : null}
                      </ul>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">Vous pouvez tout de même accepter, mais assurez-vous que ces chevauchements sont assumés.</p>
              </div>
            ) : null}

            {mySide ? (
              <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm">
                Vous avez déjà accepté cette version le {fmtDate(mySide)}.
                {otherSide ? " L'accord est actif." : " En attente de l'autre partie."}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded border p-3">
                <Checkbox id="agree" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
                <label htmlFor="agree" className="text-sm">
                  J'ai lu et j'accepte la version {current.version_number} de cet accord.
                </label>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          {current && !mySide ? (
            <Button onClick={handleAccept} disabled={!checked || submitting}>
              {submitting ? "Enregistrement…" : `Accepter la version ${current.version_number}`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}