import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import { importCsv, type ImportKind, type ImportResult } from "@/lib/csv-import.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { canEditSettings } from "@/lib/shop-constants";
import { PageContainer, PageHeader, SectionCard } from "@/components/ui-kit";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/settings/import")({
  head: () => ({ meta: [{ title: "Imports CSV — BPEI" }] }),
  component: ImportPage,
});

const KIND_INFO: Record<ImportKind, { label: string; description: string; headers: string[] }> = {
  customers: {
    label: "Clients",
    description: "Importer un fichier CSV de clients (particuliers ou pros).",
    headers: ["type", "prenom", "nom", "societe", "email", "telephone", "adresse", "code_postal", "ville", "pays"],
  },
  services: {
    label: "Services (catalogue)",
    description: "Prestations facturables ajoutées à votre catalogue de services.",
    headers: ["nom", "description", "categorie", "unite", "prix_ht", "tva", "duree", "reference"],
  },
  stock: {
    label: "Produits en stock",
    description: "Articles ou pièces détachées avec quantités et prix.",
    headers: ["sku", "code_barre", "nom", "description", "categorie", "marque", "unite", "prix_achat", "prix_vente", "tva", "quantite", "seuil", "emplacement"],
  },
};

function downloadTemplate(kind: ImportKind) {
  const headers = KIND_INFO[kind].headers.join(",");
  const csv = headers + "\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bpei-import-${kind}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ImportPage() {
  const { shopId, role } = useShop();
  const canEdit = canEditSettings(role);
  const importFn = useServerFn(importCsv);
  const [kind, setKind] = useState<ImportKind>("customers");
  const [csv, setCsv] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const mut = useMutation({
    mutationFn: () => importFn({ data: { shopId, kind, csv } }),
    onSuccess: (r) => {
      setResult(r);
      if (r.errors.length === 0) toast.success(`${r.inserted} lignes importées`);
      else toast.warning(`${r.inserted}/${r.total} importées, ${r.errors.length} erreur(s)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2_000_000) { toast.error("Fichier trop volumineux (max 2 Mo)"); return; }
    setFileName(f.name);
    setCsv(await f.text());
    setResult(null);
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Paramètres"
        title="Imports CSV"
        description="Importez en masse vos clients, services et articles depuis un fichier CSV (séparateur virgule ou point-virgule)."
      />

      <SectionCard title="1. Choisir le type d'import">
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(KIND_INFO) as ImportKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => { setKind(k); setResult(null); }}
              className={`rounded-lg border p-3 text-left transition ${kind === k ? "border-electric bg-electric-soft" : "border-border hover:border-electric/50"}`}
            >
              <div className="font-medium text-foreground">{KIND_INFO[k].label}</div>
              <div className="text-xs text-muted-foreground">{KIND_INFO[k].description}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Colonnes attendues :</span>
          <code className="rounded bg-secondary px-2 py-1 text-xs">{KIND_INFO[kind].headers.join(", ")}</code>
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(kind)}>
            <FileText className="mr-2 h-4 w-4" />Télécharger un modèle vide
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="2. Charger le fichier">
        {!canEdit && <p className="mb-2 text-sm text-muted-foreground">Seul le responsable peut lancer un import.</p>}
        <div className="space-y-3">
          <div>
            <Label>Fichier CSV</Label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              disabled={!canEdit}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-electric file:px-3 file:py-2 file:text-sm file:text-electric-foreground hover:file:opacity-90"
            />
            {fileName && <p className="mt-1 text-xs text-muted-foreground">{fileName} — {csv.split("\n").length - 1} ligne(s)</p>}
          </div>
          <Button onClick={() => mut.mutate()} disabled={!canEdit || !csv || mut.isPending}>
            <Upload className="mr-2 h-4 w-4" />
            {mut.isPending ? "Import en cours…" : "Lancer l'import"}
          </Button>
        </div>
      </SectionCard>

      {result && (
        <SectionCard title="3. Résultat">
          <div className="flex items-center gap-3">
            {result.errors.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            )}
            <div>
              <div className="font-medium">{result.inserted} / {result.total} lignes importées</div>
              {result.errors.length > 0 && <div className="text-sm text-muted-foreground">{result.errors.length} erreur(s)</div>}
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-4 max-h-64 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs">
                  <tr><th className="px-3 py-2">Ligne</th><th className="px-3 py-2">Erreur</th></tr>
                </thead>
                <tbody>
                  {result.errors.map((e, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 font-mono">{e.row}</td>
                      <td className="px-3 py-2 text-destructive">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </PageContainer>
  );
}