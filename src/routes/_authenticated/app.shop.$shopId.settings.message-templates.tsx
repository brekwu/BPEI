import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useShop } from "@/components/shop/ShopLayout";
import {
  listMessageTemplates, upsertMessageTemplate, deleteMessageTemplate,
} from "@/lib/message-templates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { canEditSettings } from "@/lib/shop-constants";
import { PageContainer, PageHeader, SectionCard, EmptyState, Skeleton } from "@/components/ui-kit";
import { MessageSquare, Plus, Trash2, Pencil, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/settings/message-templates")({
  head: () => ({ meta: [{ title: "Modèles de messages — BPEI" }] }),
  component: TemplatesPage,
});

interface Draft {
  id?: string;
  name: string;
  channel: "note" | "email" | "sms";
  subject: string;
  body: string;
  category: string;
}
const emptyDraft: Draft = { name: "", channel: "note", subject: "", body: "", category: "" };

function TemplatesPage() {
  const { shopId, role } = useShop();
  const canEdit = canEditSettings(role);
  const qc = useQueryClient();
  const listFn = useServerFn(listMessageTemplates);
  const saveFn = useServerFn(upsertMessageTemplate);
  const delFn = useServerFn(deleteMessageTemplate);
  const [draft, setDraft] = useState<Draft | null>(null);

  const q = useQuery({
    queryKey: ["message-templates", shopId],
    queryFn: () => listFn({ data: { shopId } }),
  });

  const saveMut = useMutation({
    mutationFn: (d: Draft) => saveFn({ data: {
      id: d.id ?? null, shopId, name: d.name, channel: d.channel,
      subject: d.subject || null, body: d.body, category: d.category || null,
    } }),
    onSuccess: () => {
      toast.success("Modèle enregistré");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["message-templates", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Modèle supprimé"); qc.invalidateQueries({ queryKey: ["message-templates", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];

  return (
    <PageContainer size="wide">
      <PageHeader
        eyebrow="Paramètres"
        title="Modèles de messages"
        description="Enregistrez des modèles réutilisables (SMS, e-mail, notes internes) pour vos réponses courantes."
        actions={canEdit ? (
          <Button onClick={() => setDraft({ ...emptyDraft })} disabled={!!draft}>
            <Plus className="mr-2 h-4 w-4" />Nouveau modèle
          </Button>
        ) : undefined}
      />

      {draft && canEdit && (
        <SectionCard title={draft.id ? "Modifier le modèle" : "Nouveau modèle"}>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nom *</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.channel}
                  onChange={(e) => setDraft({ ...draft, channel: e.target.value as Draft["channel"] })}
                >
                  <option value="note">Note interne</option>
                  <option value="email">E-mail</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie</Label>
                <Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Ex: Devis, Réparation, Relance…" />
              </div>
              {draft.channel === "email" && (
                <div className="space-y-1.5">
                  <Label>Objet</Label>
                  <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Message *</Label>
              <Textarea rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder="Bonjour {{prenom}}, votre réparation…" />
              <p className="text-xs text-muted-foreground">Astuce : utilisez des balises comme {"{{prenom}}"} ou {"{{numero}}"} pour personnaliser à l'envoi.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => saveMut.mutate(draft)} disabled={saveMut.isPending || !draft.name || !draft.body}>
                {saveMut.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button variant="outline" onClick={() => setDraft(null)}>
                <X className="mr-2 h-4 w-4" />Annuler
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard title="Vos modèles">
        {q.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<MessageSquare className="h-6 w-6" />} title="Aucun modèle" description="Créez vos premiers modèles pour gagner du temps sur vos réponses." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{t.name}</span>
                    <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase text-secondary-foreground">{t.channel}</span>
                    {t.category && <span className="text-xs text-muted-foreground">· {t.category}</span>}
                  </div>
                  {t.subject && <div className="text-xs text-muted-foreground">Objet : {t.subject}</div>}
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{t.body}</p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setDraft({
                      id: t.id, name: t.name, channel: (t.channel as Draft["channel"]) ?? "note",
                      subject: t.subject ?? "", body: t.body, category: t.category ?? "",
                    })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Supprimer ce modèle ?")) delMut.mutate(t.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
}