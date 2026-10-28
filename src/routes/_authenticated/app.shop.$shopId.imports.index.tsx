import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useShop } from "@/components/shop/ShopLayout";
import {
  isAiImportEnabled, listImportJobs, createImportJob, deleteImportJob,
} from "@/lib/imports.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader, SectionCard, EmptyState, Skeleton } from "@/components/ui-kit";
import { toast } from "sonner";
import { Sparkles, Upload, Trash2, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/imports/")({
  head: () => ({ meta: [{ title: "Import intelligent BPEI — Beta" }] }),
  component: ImportsPage,
});

const KIND_LABEL: Record<string, string> = {
  products: "Produits",
  stock: "Stock",
  services: "Services",
  shop_profile: "Profil boutique (prochainement)",
  mixed: "Mixte (produits · services · stock)",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  uploading: "Envoi en cours",
  queued: "En file",
  analyzing: "Analyse IA",
  review: "À réviser",
  importing: "Import en cours",
  completed: "Terminé",
  failed: "Échec",
  cancelled: "Annulé",
  rolled_back: "Annulé (rollback)",
};

function ImportsPage() {
  const { shopId } = useShop();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const flagFn = useServerFn(isAiImportEnabled);
  const listFn = useServerFn(listImportJobs);
  const createFn = useServerFn(createImportJob);
  const deleteFn = useServerFn(deleteImportJob);

  const flagQ = useQuery({ queryKey: ["ai-import-flag"], queryFn: () => flagFn() });
  const jobsQ = useQuery({
    queryKey: ["import-jobs", shopId],
    queryFn: () => listFn({ data: { shopId } }),
  });

  const [kind, setKind] = useState<string>("mixed");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const createMut = useMutation({
    mutationFn: () => createFn({
      data: {
        shopId,
        kind: kind as "mixed",
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
      },
    }),
    onSuccess: ({ id }) => {
      toast.success("Import créé — ajoutez maintenant un fichier CSV/XLSX.");
      setTitle(""); setNotes("");
      qc.invalidateQueries({ queryKey: ["import-jobs", shopId] });
      navigate({ to: "/app/shop/$shopId/imports/$jobId", params: { shopId, jobId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (jobId: string) => deleteFn({ data: { jobId } }),
    onSuccess: () => {
      toast.success("Import supprimé");
      qc.invalidateQueries({ queryKey: ["import-jobs", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const enabled = !!flagQ.data?.enabled;
  const jobs = jobsQ.data ?? [];

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Beta interne"
        title="Import intelligent BPEI"
        description="Importez automatiquement produits, stock, services et informations professionnelles depuis vos fichiers existants. Analyse assistée par IA, révision manuelle systématique."
      />

      {/* Présentation bêta pilote */}
      <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl text-sm">
            <div className="font-semibold">Import intelligent BPEI — bêta pilote</div>
            <p className="mt-1 text-muted-foreground">
              Périmètre actuel : <strong>produits, services et stock</strong>. Formats acceptés : CSV, XLS, XLSX
              (max 20 Mo, 5 000 lignes). L'IA propose une normalisation — la <strong>vérification manuelle
              reste obligatoire</strong> avant toute création dans votre catalogue.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les PDF, images et fichiers clients ne sont pas pris en charge à ce stade.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="/templates/import-produits.csv" download>Télécharger un modèle CSV</a>
            </Button>
          </div>
        </div>
      </div>

      {!enabled && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
          <Info className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold">Module non disponible pour cette boutique</div>
            <div className="mt-1">
              Le module est en bêta pilote : il faut à la fois que la plateforme l'active et que
              votre boutique figure sur la liste blanche. Contactez BPEI pour rejoindre le pilote.
            </div>
          </div>
        </div>
      )}


      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard title="Vos imports">
          {jobsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="Aucun import pour l'instant"
              description="Créez votre premier import en utilisant le formulaire à droite (nécessite l'activation du module)."
            />
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((j) => (
                <li key={j.id} id={`job-${j.id}`} className="flex items-start justify-between gap-3 py-3">
                  <Link
                    to="/app/shop/$shopId/imports/$jobId"
                    params={{ shopId, jobId: j.id }}
                    className="min-w-0 flex-1 hover:opacity-80"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{j.title || KIND_LABEL[j.kind] || "Import"}</span>
                      <Badge variant="outline">{KIND_LABEL[j.kind] ?? j.kind}</Badge>
                      <Badge>{STATUS_LABEL[j.status] ?? j.status}</Badge>
                      {j.bpei_assisted && <Badge variant="secondary">Assisté BPEI</Badge>}
                    </div>
                    {j.notes && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{j.notes}</p>}
                    <div className="mt-1 text-xs text-muted-foreground">
                      Créé {formatDistanceToNow(new Date(j.created_at), { addSuffix: true, locale: fr })}
                    </div>
                    {j.error && <div className="mt-1 text-xs text-destructive">{j.error}</div>}
                  </Link>
                  {["draft", "failed", "cancelled"].includes(j.status) && (
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { if (confirm("Supprimer cet import ?")) delMut.mutate(j.id); }}
                      disabled={delMut.isPending}
                      aria-label="Supprimer l'import"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Nouvel import">
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="import-kind">Type d'import</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="import-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-title">Titre (optionnel)</Label>
              <Input
                id="import-title" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Catalogue printemps 2026" maxLength={160}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="import-notes">Notes internes (optionnel)</Label>
              <Textarea
                id="import-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexte, sources, remarques…" rows={3} maxLength={2000}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!enabled || createMut.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              {createMut.isPending ? "Création…" : "Créer un import"}
            </Button>
            {!enabled && (
              <p className="text-xs text-muted-foreground">
                Bouton désactivé tant que le module n'est pas activé par la plateforme.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Après création : envoyez un fichier CSV/XLSX, l'analyse détectera colonnes,
              doublons et erreurs pour votre relecture manuelle avant tout import réel.
            </p>
          </form>
        </SectionCard>
      </div>

      <div className="mt-8 text-center text-sm text-muted-foreground">
        <Link to="/app/shop/$shopId/dashboard" params={{ shopId }} className="underline hover:text-foreground">
          ← Retour au tableau de bord
        </Link>
      </div>
    </PageContainer>
  );
}