import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { canEditSettings } from "@/lib/shop-constants";
import { PageContainer, PageHeader, SectionCard } from "@/components/ui-kit";
import { ShieldCheck, ShieldAlert, ShieldQuestion, FileText, Trash2, Download, Upload } from "lucide-react";
import {
  listVerificationDocuments,
  submitVerificationRequest,
  deleteVerificationDocument,
  getVerificationDocumentSignedUrl,
} from "@/lib/verification.functions";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/settings/verification")({
  head: () => ({ meta: [{ title: "Vérification BPEI — Paramètres" }] }),
  component: VerificationSettings,
});

const DOC_TYPES = [
  { value: "kbis", label: "K-bis / SIRET (extrait)" },
  { value: "insurance", label: "Attestation d'assurance professionnelle" },
  { value: "id_card", label: "Pièce d'identité du dirigeant" },
  { value: "vat_certificate", label: "Certificat TVA" },
  { value: "domicile_proof", label: "Justificatif de domicile professionnel" },
  { value: "other", label: "Autre justificatif" },
];

const STATUS_LABEL: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  not_submitted: { label: "Non soumis", className: "bg-slate-100 text-slate-700", icon: <ShieldQuestion className="h-4 w-4" /> },
  pending: { label: "En cours d'examen", className: "bg-amber-100 text-amber-800", icon: <ShieldQuestion className="h-4 w-4" /> },
  verified: { label: "Vérifié BPEI", className: "bg-emerald-100 text-emerald-800", icon: <ShieldCheck className="h-4 w-4" /> },
  rejected: { label: "Refusé", className: "bg-red-100 text-red-800", icon: <ShieldAlert className="h-4 w-4" /> },
  suspended: { label: "Suspendu", className: "bg-orange-100 text-orange-800", icon: <ShieldAlert className="h-4 w-4" /> },
};

const MAX_BYTES = 5_000_000;
const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

function VerificationSettings() {
  const { shopId, role } = useShop();
  const canEdit = canEditSettings(role);
  const qc = useQueryClient();

  const listFn = useServerFn(listVerificationDocuments);
  const submitFn = useServerFn(submitVerificationRequest);
  const deleteFn = useServerFn(deleteVerificationDocument);
  const signFn = useServerFn(getVerificationDocumentSignedUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["verification-documents", shopId],
    queryFn: () => listFn({ data: { shopId } }),
  });

  const [docType, setDocType] = useState<string>("kbis");
  const [notes, setNotes] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non accepté (PDF, PNG, JPG ou WebP).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Fichier trop lourd (5 Mo max).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `verification/${shopId}/${docType}_${Date.now()}.${ext}`;
      const up = await supabase.storage.from("shop-verification").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase.from("verification_documents").insert({
        shop_id: shopId,
        document_type: docType,
        storage_path: path,
        original_filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        notes: notes || null,
      });
      if (error) throw new Error(error.message);
      toast.success("Document ajouté.");
      setNotes("");
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["verification-documents", shopId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'envoi");
    } finally {
      setUploading(false);
    }
  }

  const submitMut = useMutation({
    mutationFn: () => submitFn({ data: { shopId, notes: requestNotes || undefined } }),
    onSuccess: () => {
      toast.success("Dossier soumis. Le patron BPEI vous répondra.");
      setRequestNotes("");
      qc.invalidateQueries({ queryKey: ["verification-documents", shopId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const deleteMut = useMutation({
    mutationFn: (documentId: string) => deleteFn({ data: { documentId } }),
    onSuccess: () => {
      toast.success("Document supprimé.");
      qc.invalidateQueries({ queryKey: ["verification-documents", shopId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  async function openSigned(documentId: string) {
    try {
      const { url } = await signFn({ data: { documentId } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    }
  }

  const status = data?.shop?.verification_status ?? "not_submitted";
  const statusMeta = STATUS_LABEL[status] ?? STATUS_LABEL.not_submitted;
  const docs = data?.documents ?? [];
  const isMobile = data?.shop?.business_type === "mobile_independent";
  const canSubmit = canEdit && docs.length > 0 && status !== "pending" && status !== "verified";

  return (
    <PageContainer>
      <PageHeader
        title="Vérification BPEI"
        description="Faites vérifier votre boutique ou activité pour obtenir le badge « Vérifié BPEI » sur votre fiche publique."
      />

      <SectionCard title="Statut">
        <div className="flex items-center gap-3">
          <Badge className={statusMeta.className}>
            <span className="flex items-center gap-1.5">{statusMeta.icon}{statusMeta.label}</span>
          </Badge>
          {data?.shop?.verification_submitted_at ? (
            <span className="text-xs text-muted-foreground">
              Soumis le {new Date(data.shop.verification_submitted_at).toLocaleDateString("fr-FR")}
            </span>
          ) : null}
        </div>
        {data?.shop?.verification_notes ? (
          <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <strong className="text-xs uppercase text-muted-foreground">Notes BPEI :</strong>
            <p className="mt-1 whitespace-pre-wrap">{data.shop.verification_notes}</p>
          </div>
        ) : null}
        {isMobile ? (
          <p className="mt-3 text-xs text-muted-foreground">
            En tant qu'indépendant à domicile, votre adresse administrative reste confidentielle : seules vos zones d'intervention sont publiées.
          </p>
        ) : null}
      </SectionCard>

      {canEdit ? (
        <SectionCard title="Ajouter un justificatif" description="PDF, PNG, JPG ou WebP — 5 Mo maximum par fichier.">
          <div className="grid gap-3 sm:grid-cols-[240px_1fr]">
            <div className="space-y-1.5">
              <Label>Type de document</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (facultatif)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input ref={fileRef} type="file" accept={ACCEPTED.join(",")} className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />{uploading ? "Envoi…" : "Choisir un fichier"}
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={`Documents (${docs.length})`}>
        {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p>
          : docs.length === 0 ? <p className="text-sm text-muted-foreground">Aucun document.</p>
          : (
            <ul className="divide-y divide-border">
              {docs.map((d) => {
                const t = DOC_TYPES.find((x) => x.value === d.document_type)?.label ?? d.document_type;
                return (
                  <li key={d.id} className="flex items-center gap-3 py-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {d.original_filename ?? d.storage_path.split("/").pop()}
                        {" · "}{new Date(d.created_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {d.review_status === "accepted" ? "Accepté"
                        : d.review_status === "rejected" ? "Refusé" : "En attente"}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => openSigned(d.id)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    {canEdit && status !== "verified" ? (
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm("Supprimer ce document ?")) deleteMut.mutate(d.id);
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
      </SectionCard>

      {canEdit ? (
        <SectionCard
          title="Soumettre le dossier"
          description="Une fois vos justificatifs déposés, envoyez la demande de vérification au patron BPEI."
        >
          <div className="space-y-2">
            <Label>Notes pour le patron BPEI (facultatif)</Label>
            <Textarea rows={3} value={requestNotes} onChange={(e) => setRequestNotes(e.target.value)} maxLength={2000} />
          </div>
          <div className="mt-3">
            <Button onClick={() => submitMut.mutate()} disabled={!canSubmit || submitMut.isPending}>
              {submitMut.isPending ? "Envoi…" : "Soumettre le dossier"}
            </Button>
            {!canSubmit && docs.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Ajoutez au moins un document pour pouvoir soumettre.</p>
            ) : null}
            {status === "pending" ? (
              <p className="mt-2 text-xs text-muted-foreground">Dossier déjà en cours d'examen.</p>
            ) : null}
            {status === "verified" ? (
              <p className="mt-2 text-xs text-emerald-700">Vous êtes vérifié. Contactez BPEI pour toute mise à jour.</p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}
    </PageContainer>
  );
}