import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import { canEditSettings } from "@/lib/shop-constants";
import { toast } from "sonner";
import { PageContainer, PageHeader, SectionCard, FormSection, FormRow, FormActions } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MediaUploader } from "@/components/shop/MediaUploader";
import { CheckCircle2, AlertCircle, ExternalLink, Send, Undo2 } from "lucide-react";
import {
  savePublicPage, replaceBusinessHoursMulti,
  requestPublication, unpublishShop, submitLegalDossier,
} from "@/lib/publication.functions";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/settings/public-page")({
  head: () => ({ meta: [{ title: "Page publique — BPEI" }] }),
  component: PublicPageEditor,
});

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DAY_INDEX = [1, 2, 3, 4, 5, 6, 0];

type Slot = { day_of_week: number; slot_index: number; opens_at: string | null; closes_at: string | null; is_closed: boolean };

function PublicPageEditor() {
  const { shopId, role } = useShop();
  const canEdit = canEditSettings(role);
  const qc = useQueryClient();

  const shopQ = useQuery({
    queryKey: ["public-page", shopId],
    queryFn: async () => (await supabase.from("shops").select("*").eq("id", shopId).maybeSingle()).data,
  });
  const hoursQ = useQuery({
    queryKey: ["public-page-hours", shopId],
    queryFn: async () => (await supabase.from("shop_business_hours").select("*").eq("shop_id", shopId).order("day_of_week").order("slot_index")).data ?? [],
  });

  const [publicName, setPublicName] = useState("");
  const [publicDescription, setPublicDescription] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1e3a8a");
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [social, setSocial] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Slot[]>([]);

  const shop = shopQ.data;
  useEffect(() => {
    if (!shop) return;
    setPublicName(shop.public_name ?? shop.name ?? "");
    setPublicDescription(shop.public_description ?? shop.description ?? "");
    setPublicEmail(shop.public_email ?? shop.email ?? "");
    setWebsite(shop.website ?? "");
    setPrimaryColor(shop.theme_primary_color ?? "#1e3a8a");
    setAccentColor(shop.theme_accent_color ?? "#3b82f6");
    const sl = (shop.social_links ?? {}) as Record<string, string>;
    setSocial(sl);
  }, [shop]);

  useEffect(() => {
    if (!hoursQ.data) return;
    if (hoursQ.data.length === 0) {
      // Seed default: single closed slot per day
      setSlots(DAY_INDEX.map((d) => ({ day_of_week: d, slot_index: 0, opens_at: "09:00", closes_at: "18:00", is_closed: d === 0 })));
    } else {
      setSlots(hoursQ.data.map((h) => ({
        day_of_week: h.day_of_week, slot_index: h.slot_index ?? 0,
        opens_at: h.opens_at, closes_at: h.closes_at, is_closed: h.is_closed,
      })));
    }
  }, [hoursQ.data]);

  const savePage = useServerFn(savePublicPage);
  const saveHours = useServerFn(replaceBusinessHoursMulti);
  const reqPub = useServerFn(requestPublication);
  const unpub = useServerFn(unpublishShop);
  const subLegal = useServerFn(submitLegalDossier);

  const saveMut = useMutation({
    mutationFn: async () => {
      await savePage({ data: {
        shopId,
        public_name: publicName || null,
        public_description: publicDescription || null,
        public_email: publicEmail || null,
        website: website || null,
        theme_primary_color: /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : null,
        theme_accent_color: /^#[0-9A-Fa-f]{6}$/.test(accentColor) ? accentColor : null,
        social_links: social,
      } });
      await saveHours({ data: { shopId, slots } });
    },
    onSuccess: () => {
      toast.success("Modifications enregistrées");
      qc.invalidateQueries({ queryKey: ["public-page", shopId] });
      qc.invalidateQueries({ queryKey: ["public-page-hours", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pubMut = useMutation({
    mutationFn: async () => reqPub({ data: { shopId, notes: null } }),
    onSuccess: () => { toast.success("Demande de publication envoyée au patron BPEI"); qc.invalidateQueries({ queryKey: ["public-page", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const unpubMut = useMutation({
    mutationFn: async () => unpub({ data: { shopId } }),
    onSuccess: () => { toast.success("Page dépubliée"); qc.invalidateQueries({ queryKey: ["public-page", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const legalMut = useMutation({
    mutationFn: async () => subLegal({ data: { shopId } }),
    onSuccess: () => { toast.success("Dossier juridique envoyé pour validation"); qc.invalidateQueries({ queryKey: ["public-page", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function addSlot(day: number) {
    const existing = slots.filter((s) => s.day_of_week === day);
    const nextIdx = Math.max(-1, ...existing.map((s) => s.slot_index)) + 1;
    if (nextIdx > 2) return;
    setSlots([...slots, { day_of_week: day, slot_index: nextIdx, opens_at: "14:00", closes_at: "18:00", is_closed: false }]);
  }
  function removeSlot(day: number, idx: number) {
    setSlots(slots.filter((s) => !(s.day_of_week === day && s.slot_index === idx)));
  }
  function updateSlot(day: number, idx: number, patch: Partial<Slot>) {
    setSlots(slots.map((s) => (s.day_of_week === day && s.slot_index === idx) ? { ...s, ...patch } : s));
  }

  if (!shop) {
    return <PageContainer><PageHeader title="Page publique" /><p className="text-sm text-muted-foreground">Chargement…</p></PageContainer>;
  }

  const status = shop.public_profile_status ?? "draft";
  const legalStatus = (shop as any).legal_status ?? "draft";
  const publicationNotes = (shop as any).publication_notes as string | null;

  // Checklist
  const checks = [
    { key: "name", ok: !!publicName?.trim(), label: "Nom public renseigné" },
    { key: "desc", ok: (publicDescription?.length ?? 0) >= 40, label: "Description ≥ 40 caractères" },
    { key: "logo", ok: !!shop.public_logo_url, label: "Logo public téléversé" },
    { key: "cover", ok: !!shop.cover_image_url, label: "Image de couverture téléversée" },
    { key: "address", ok: !!shop.address && !!shop.city, label: "Adresse et ville renseignées" },
    { key: "phone", ok: !!shop.phone, label: "Téléphone renseigné" },
    { key: "hours", ok: slots.some((s) => !s.is_closed && s.opens_at && s.closes_at), label: "Au moins un créneau d'ouverture" },
    { key: "legal", ok: legalStatus === "approved", label: "Dossier juridique validé par BPEI" },
  ];
  const allOk = checks.every((c) => c.ok);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Page publique"
        title="Éditeur de la fiche BPEI"
        description="Personnalisez ce que les clients voient sur votre page BPEI. La publication demande la validation du patron BPEI."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/b/${shopId}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3 w-3" />Prévisualiser</a>
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge variant={status === "published" ? "default" : status === "pending_review" ? "secondary" : "outline"}>
          {status === "published" ? "Publiée" : status === "pending_review" ? "En attente de validation BPEI" : "Brouillon"}
        </Badge>
        <Badge variant={legalStatus === "approved" ? "default" : legalStatus === "submitted" ? "secondary" : "outline"}>
          Juridique : {legalStatus === "approved" ? "validé" : legalStatus === "submitted" ? "en cours" : legalStatus === "rejected" ? "à corriger" : "brouillon"}
        </Badge>
        {publicationNotes && status === "draft" && (
          <span className="text-xs text-destructive">Motif du dernier refus : {publicationNotes}</span>
        )}
      </div>

      <SectionCard title="Identité publique">
        <FormSection>
          <FormRow>
            <div className="space-y-1.5">
              <Label>Nom public *</Label>
              <Input value={publicName} onChange={(e) => setPublicName(e.target.value)} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail public</Label>
              <Input type="email" value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} disabled={!canEdit} />
            </div>
          </FormRow>
          <div className="space-y-1.5">
            <Label>Description publique</Label>
            <Textarea rows={4} value={publicDescription} onChange={(e) => setPublicDescription(e.target.value)} disabled={!canEdit} />
            <p className="text-xs text-muted-foreground">{publicDescription.length} caractères — visez au moins 40 pour être bien référencé.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Site web</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} disabled={!canEdit} placeholder="https://…" />
          </div>
        </FormSection>
      </SectionCard>

      <SectionCard title="Médias" description="Ces images apparaissent sur votre page BPEI publique.">
        <div className="grid gap-4 md:grid-cols-2">
          <MediaUploader shopId={shopId} kind="logo" currentPath={shop.public_logo_url} />
          <MediaUploader shopId={shopId} kind="cover" currentPath={shop.cover_image_url} />
          <MediaUploader shopId={shopId} kind="favicon" currentPath={shop.favicon_url} />
          <MediaUploader shopId={shopId} kind="social" currentPath={shop.social_share_image_url} />
        </div>
      </SectionCard>

      <SectionCard title="Horaires d'ouverture" description="Ajoutez jusqu'à 3 plages par jour (matin, après-midi, soir).">
        <div className="space-y-2">
          {DAY_INDEX.map((d, i) => {
            const daySlots = slots.filter((s) => s.day_of_week === d).sort((a, b) => a.slot_index - b.slot_index);
            const closed = daySlots.every((s) => s.is_closed) && daySlots.length > 0;
            return (
              <div key={d} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-sm">{DAYS[i]}</div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!closed}
                      onCheckedChange={(v) => {
                        if (!v) {
                          setSlots((prev) => prev.filter((s) => s.day_of_week !== d).concat([{ day_of_week: d, slot_index: 0, opens_at: null, closes_at: null, is_closed: true }]));
                        } else {
                          setSlots((prev) => prev.filter((s) => s.day_of_week !== d).concat([{ day_of_week: d, slot_index: 0, opens_at: "09:00", closes_at: "18:00", is_closed: false }]));
                        }
                      }}
                      disabled={!canEdit}
                    />
                    <span className="text-xs text-muted-foreground">{closed ? "Fermé" : "Ouvert"}</span>
                  </div>
                </div>
                {!closed && (
                  <div className="space-y-2">
                    {daySlots.filter((s) => !s.is_closed).map((s) => (
                      <div key={s.slot_index} className="flex items-center gap-2">
                        <Input type="time" value={s.opens_at ?? ""} onChange={(e) => updateSlot(d, s.slot_index, { opens_at: e.target.value })} className="w-28" disabled={!canEdit} />
                        <span className="text-muted-foreground">→</span>
                        <Input type="time" value={s.closes_at ?? ""} onChange={(e) => updateSlot(d, s.slot_index, { closes_at: e.target.value })} className="w-28" disabled={!canEdit} />
                        {daySlots.filter((x) => !x.is_closed).length > 1 && (
                          <Button size="sm" variant="ghost" onClick={() => removeSlot(d, s.slot_index)} disabled={!canEdit}>Retirer</Button>
                        )}
                      </div>
                    ))}
                    {daySlots.filter((s) => !s.is_closed).length < 3 && (
                      <Button size="sm" variant="outline" onClick={() => addSlot(d)} disabled={!canEdit}>+ Ajouter une plage</Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Réseaux sociaux">
        <FormSection>
          <FormRow>
            {(["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"] as const).map((k) => (
              <div key={k} className="space-y-1.5">
                <Label className="capitalize">{k}</Label>
                <Input value={social[k] ?? ""} onChange={(e) => setSocial({ ...social, [k]: e.target.value })} placeholder="https://…" disabled={!canEdit} />
              </div>
            ))}
          </FormRow>
        </FormSection>
      </SectionCard>

      <SectionCard title="Thème (couleurs)" description="Choisissez la couleur principale et une couleur d'accent qui reflètent votre boutique.">
        <FormRow>
          <div className="space-y-1.5">
            <Label>Couleur principale</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-16 rounded border" disabled={!canEdit} />
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-32" disabled={!canEdit} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Couleur d'accent</Label>
            <div className="flex gap-2 items-center">
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 w-16 rounded border" disabled={!canEdit} />
              <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-32" disabled={!canEdit} />
            </div>
          </div>
        </FormRow>
      </SectionCard>

      {canEdit && (
        <FormActions>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Enregistrement…" : "Enregistrer les modifications"}
          </Button>
        </FormActions>
      )}

      <SectionCard title="Dossier juridique" description="Vérifiez votre identité légale dans les paramètres généraux puis soumettez le dossier pour validation.">
        <div className="space-y-3">
          <div className="text-sm">
            <div>Raison sociale : {shop.legal_name || <span className="text-destructive">manquant</span>}</div>
            <div>Forme : {shop.legal_form || <span className="text-destructive">manquant</span>}</div>
            <div>SIRET : {shop.siret || <span className="text-destructive">manquant</span>}</div>
            <div>N° TVA : {shop.vat_number || "—"}</div>
          </div>
          {(shop as any).legal_notes && (
            <p className="text-xs rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
              Retour BPEI : {(shop as any).legal_notes}
            </p>
          )}
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm"><Link to="/app/shop/$shopId/settings" params={{ shopId }}>Modifier l'identité légale</Link></Button>
            <Button size="sm" onClick={() => legalMut.mutate()} disabled={legalMut.isPending || legalStatus === "submitted" || !shop.legal_name || !shop.legal_form || !shop.siret}>
              <Send className="mr-1 h-3 w-3" />
              {legalStatus === "submitted" ? "En cours de validation" : legalStatus === "approved" ? "Validé — soumettre à nouveau" : "Soumettre pour validation"}
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Publication" description="Une fois la checklist complète, demandez la publication au patron BPEI.">
        <ul className="space-y-1.5 text-sm mb-4">
          {checks.map((c) => (
            <li key={c.key} className="flex items-center gap-2">
              {c.ok
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                : <AlertCircle className="h-4 w-4 text-amber-600" />}
              <span className={c.ok ? "" : "text-muted-foreground"}>{c.label}</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          {status !== "published" ? (
            <Button onClick={() => pubMut.mutate()} disabled={pubMut.isPending || !allOk || status === "pending_review"}>
              <Send className="mr-1 h-3 w-3" />
              {status === "pending_review" ? "Demande en attente" : "Demander la publication"}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => unpubMut.mutate()} disabled={unpubMut.isPending}>
              <Undo2 className="mr-1 h-3 w-3" /> Dépublier
            </Button>
          )}
          {!allOk && status !== "published" && (
            <p className="text-xs text-muted-foreground self-center">Complétez la checklist ci-dessus pour débloquer la publication.</p>
          )}
        </div>
      </SectionCard>
    </PageContainer>
  );
}