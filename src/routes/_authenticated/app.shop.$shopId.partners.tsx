import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useShop } from "@/components/shop/ShopLayout";
import { PageContainer, PageHeader, SectionCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canEditSettings } from "@/lib/shop-constants";
import { Plus, Trash2, Edit3, ShieldCheck } from "lucide-react";
import {
  listMyOpportunities, upsertOpportunity, setOpportunityStatus, deleteOpportunity,
  listApplicationsForShop, acceptApplication, rejectApplication,
  listAgreementsForShop, terminateAgreement,
} from "@/lib/partnerships.functions";
import { AgreementSignatureDialog } from "@/components/shop/AgreementSignatureDialog";
import { AgreementVersionsDialog } from "@/components/shop/AgreementVersionsDialog";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/partners")({
  head: () => ({ meta: [{ title: "Partenariats — BPEI" }] }),
  component: PartnersPage,
});

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  closed: "bg-red-100 text-red-800",
  filled: "bg-sky-100 text-sky-800",
};

const AGR_COLOR: Record<string, string> = {
  proposed: "bg-slate-100 text-slate-700",
  shop_signed: "bg-amber-100 text-amber-800",
  independent_signed: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  terminated: "bg-red-100 text-red-800",
  expired: "bg-red-100 text-red-800",
  suspended: "bg-orange-100 text-orange-800",
};

function PartnersPage() {
  const ctx = useShop();
  const { shopId, role, subscription, businessType } = ctx;
  const canEdit = canEditSettings(role);
  const plan = String(subscription?.plan ?? "");
  const bt = String(businessType ?? "");
  const shopCapable = ["shop_pro","shop_network","pro","network"].includes(plan)
    && ["physical_shop","hybrid_business","multi_location_network"].includes(bt);

  if (!shopCapable) {
    return (
      <PageContainer>
        <PageHeader
          title="Découvrir le réseau BPEI"
          description="Le module Partenariats est réservé aux abonnements Boutique Pro / Réseau (profil boutique physique ou hybride)."
        />
        <SectionCard title="Débloquer les partenariats">
          <p className="text-sm text-muted-foreground">
            Passez à l'abonnement Boutique Pro pour publier des opportunités, recevoir des candidatures d'indépendants
            vérifiés et gérer des accords structurés avec versionnage, double signature et récapitulatif PDF.
          </p>
          <div className="mt-4">
            <a href="/tarifs" className="text-navy underline">Voir les formules</a>
          </div>
        </SectionCard>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Partenariats"
        description="Publiez des opportunités, recevez des candidatures d'indépendants et gérez vos accords."
      />
      <Tabs defaultValue="opps">
        <TabsList>
          <TabsTrigger value="opps">Mes opportunités</TabsTrigger>
          <TabsTrigger value="apps">Candidatures reçues</TabsTrigger>
          <TabsTrigger value="agrs">Accords</TabsTrigger>
        </TabsList>
        <TabsContent value="opps"><OpportunitiesTab shopId={shopId} canEdit={canEdit} /></TabsContent>
        <TabsContent value="apps"><ApplicationsTab shopId={shopId} canEdit={canEdit} /></TabsContent>
        <TabsContent value="agrs"><AgreementsTab shopId={shopId} canEdit={canEdit} /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function OpportunitiesTab({ shopId, canEdit }: { shopId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyOpportunities);
  const upsertFn = useServerFn(upsertOpportunity);
  const statusFn = useServerFn(setOpportunityStatus);
  const deleteFn = useServerFn(deleteOpportunity);

  const { data, isLoading } = useQuery({
    queryKey: ["partners:opps", shopId],
    queryFn: () => listFn({ data: { shopId } }),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>(emptyForm());
  function emptyForm() {
    return {
      title: "", description: "", specialtiesText: "", citiesText: "",
      compensation_model: "forfait", compensation_details: "",
      requires_exclusivity: false, min_availability: "",
    };
  }

  const save = useMutation({
    mutationFn: () => upsertFn({ data: {
      id: editing?.id, shopId,
      title: form.title, description: form.description,
      specialties: form.specialtiesText.split(",").map((s: string) => s.trim()).filter(Boolean),
      covered_cities: form.citiesText.split(",").map((s: string) => s.trim()).filter(Boolean),
      compensation_model: form.compensation_model,
      compensation_details: form.compensation_details,
      requires_exclusivity: form.requires_exclusivity,
      min_availability: form.min_availability,
      status: editing?.status ?? "draft",
    } }),
    onSuccess: () => { toast.success("Enregistré."); setOpen(false); qc.invalidateQueries({ queryKey: ["partners:opps", shopId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  function openNew() { setEditing(null); setForm(emptyForm()); setOpen(true); }
  function openEdit(o: any) {
    setEditing(o);
    setForm({
      title: o.title, description: o.description ?? "",
      specialtiesText: (o.specialties ?? []).join(", "),
      citiesText: (o.covered_cities ?? []).join(", "),
      compensation_model: o.compensation_model ?? "forfait",
      compensation_details: o.compensation_details ?? "",
      requires_exclusivity: !!o.requires_exclusivity,
      min_availability: o.min_availability ?? "",
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <SectionCard
        title={`Opportunités (${data?.length ?? 0})`}
        action={canEdit ? <Button onClick={openNew} size="sm"><Plus className="mr-1 h-4 w-4" /> Nouvelle</Button> : null}
      >
        {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p>
          : (data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Aucune opportunité publiée.</p>
          : (
            <ul className="divide-y divide-border">
              {data!.map((o: any) => (
                <li key={o.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{o.title}</strong>
                    <Badge className={STATUS_COLOR[o.status] ?? ""}>{o.status}</Badge>
                    {o.requires_exclusivity ? <Badge variant="outline">Exclusivité</Badge> : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  {o.description ? <p className="mt-1 text-sm text-muted-foreground">{o.description}</p> : null}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {(o.specialties ?? []).join(" · ")}
                    {o.covered_cities?.length ? ` — ${o.covered_cities.join(", ")}` : ""}
                    {o.compensation_model ? ` — ${o.compensation_model}` : ""}
                  </div>
                  {canEdit ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Select value={o.status} onValueChange={(v) =>
                        statusFn({ data: { id: o.id, status: v as any } })
                          .then(() => qc.invalidateQueries({ queryKey: ["partners:opps", shopId] }))
                          .catch((e) => toast.error(e.message))
                      }>
                        <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Brouillon</SelectItem>
                          <SelectItem value="published">Publié</SelectItem>
                          <SelectItem value="paused">En pause</SelectItem>
                          <SelectItem value="closed">Fermé</SelectItem>
                          <SelectItem value="filled">Pourvu</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(o)}><Edit3 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        if (confirm("Supprimer cette opportunité ?")) {
                          deleteFn({ data: { id: o.id } })
                            .then(() => qc.invalidateQueries({ queryKey: ["partners:opps", shopId] }))
                            .catch((e) => toast.error(e.message));
                        }
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Modifier l'opportunité" : "Nouvelle opportunité"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titre *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Spécialités (séparées par des virgules)</Label>
                <Input value={form.specialtiesText} onChange={(e) => setForm({ ...form, specialtiesText: e.target.value })} placeholder="iPhone, MacBook, PC portable" />
              </div>
              <div>
                <Label>Villes couvertes</Label>
                <Input value={form.citiesText} onChange={(e) => setForm({ ...form, citiesText: e.target.value })} placeholder="Nice, Cannes" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Modèle de rémunération</Label>
                <Select value={form.compensation_model} onValueChange={(v) => setForm({ ...form, compensation_model: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="forfait">Forfait</SelectItem>
                    <SelectItem value="commission">Commission</SelectItem>
                    <SelectItem value="horaire">Horaire</SelectItem>
                    <SelectItem value="mixte">Mixte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Disponibilité minimale</Label>
                <Input value={form.min_availability} onChange={(e) => setForm({ ...form, min_availability: e.target.value })} placeholder="2 jours/semaine" />
              </div>
            </div>
            <div>
              <Label>Conditions de rémunération</Label>
              <Textarea rows={2} value={form.compensation_details} onChange={(e) => setForm({ ...form, compensation_details: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.requires_exclusivity} onCheckedChange={(v) => setForm({ ...form, requires_exclusivity: v })} />
              <Label>Exige l'exclusivité</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplicationsTab({ shopId, canEdit }: { shopId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listApplicationsForShop);
  const acceptFn = useServerFn(acceptApplication);
  const rejectFn = useServerFn(rejectApplication);

  const { data, isLoading } = useQuery({
    queryKey: ["partners:apps", shopId],
    queryFn: () => listFn({ data: { shopId } }),
  });

  const [acceptOpen, setAcceptOpen] = useState<null | any>(null);
  const [form, setForm] = useState({ title: "", scope: "", compensation_details: "", requires_exclusivity: false });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["partners:apps", shopId] });
    qc.invalidateQueries({ queryKey: ["partners:agrs", shopId] });
  };

  const accept = useMutation({
    mutationFn: () => acceptFn({ data: {
      applicationId: acceptOpen!.id,
      title: form.title || `Partenariat — ${acceptOpen!.opportunity_title}`,
      scope: form.scope || undefined,
      compensation_details: form.compensation_details || undefined,
      requires_exclusivity: form.requires_exclusivity,
    } }),
    onSuccess: () => { toast.success("Accord créé."); setAcceptOpen(null); invalidate(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <SectionCard title={`Candidatures reçues (${data?.length ?? 0})`}>
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p>
        : (data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Aucune candidature pour le moment.</p>
        : (
          <ul className="divide-y divide-border">
            {data!.map((a: any) => (
              <li key={a.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{a.independent?.public_name || a.independent?.name || "—"}</strong>
                  {a.independent?.verification_status === "verified" ? (
                    <Badge className="bg-sky-100 text-sky-800"><ShieldCheck className="mr-1 h-3 w-3" />Vérifié</Badge>
                  ) : null}
                  <Badge variant="outline">{a.status}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    Sur : {a.opportunity_title} · {new Date(a.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                {a.message ? <p className="mt-1 text-sm">{a.message}</p> : null}
                {a.proposed_rate ? <p className="mt-1 text-xs text-muted-foreground">Tarif proposé : {a.proposed_rate}</p> : null}
                {canEdit && a.status === "pending" ? (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => {
                      setForm({ title: `Partenariat — ${a.opportunity_title}`, scope: "", compensation_details: "", requires_exclusivity: false });
                      setAcceptOpen(a);
                    }}>Accepter → créer un accord</Button>
                    <Button size="sm" variant="destructive" onClick={() => {
                      const notes = prompt("Motif du refus (facultatif) :") ?? undefined;
                      rejectFn({ data: { applicationId: a.id, notes } })
                        .then(() => { toast.success("Refusée."); invalidate(); })
                        .catch((e) => toast.error(e.message));
                    }}>Refuser</Button>
                  </div>
                ) : null}
                {a.review_notes ? <p className="mt-1 text-xs text-muted-foreground">Notes : {a.review_notes}</p> : null}
              </li>
            ))}
          </ul>
        )}
      <Dialog open={!!acceptOpen} onOpenChange={(o) => !o && setAcceptOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Créer l'accord</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titre de l'accord *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Périmètre</Label>
              <Textarea rows={2} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} />
            </div>
            <div>
              <Label>Conditions de rémunération</Label>
              <Textarea rows={2} value={form.compensation_details} onChange={(e) => setForm({ ...form, compensation_details: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.requires_exclusivity} onCheckedChange={(v) => setForm({ ...form, requires_exclusivity: v })} />
              <Label>Exige l'exclusivité</Label>
            </div>
            <p className="text-xs text-muted-foreground">Cet accord sera créé en brouillon avec une version 1. Les deux parties devront ensuite accepter explicitement cette version via la modale « Consulter et accepter » pour qu'il devienne actif.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptOpen(null)}>Annuler</Button>
            <Button onClick={() => accept.mutate()} disabled={!form.title || accept.isPending}>
              {accept.isPending ? "Création…" : "Créer l'accord"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

function AgreementsTab({ shopId, canEdit }: { shopId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAgreementsForShop);
  const termFn = useServerFn(terminateAgreement);
  const [signOpen, setSignOpen] = useState<any | null>(null);
  const [historyOpen, setHistoryOpen] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["partners:agrs", shopId],
    queryFn: () => listFn({ data: { shopId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["partners:agrs", shopId] });

  return (
    <SectionCard title={`Accords (${data?.length ?? 0})`}>
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p>
        : (data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Aucun accord.</p>
        : (
          <ul className="divide-y divide-border">
            {data!.map((a: any) => {
              const isShopSide = a.shop_id === shopId;
              const alreadySigned = isShopSide ? !!a.shop_signed_at : !!a.independent_signed_at;
              const other = isShopSide ? a.independent : a.shop;
              const bothAccepted = a.shop_signed_at && a.independent_signed_at;
              const statusLabel = bothAccepted
                ? "Accord actif"
                : a.shop_signed_at
                  ? "Accepté par la boutique — en attente de l'indépendant"
                  : a.independent_signed_at
                    ? "Accepté par l'indépendant — en attente de la boutique"
                    : "En attente de double acceptation";
              return (
                <li key={a.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{a.title}</strong>
                    <Badge className={AGR_COLOR[a.status] ?? ""}>{a.status}</Badge>
                    {a.current_version ? <Badge variant="outline">v{a.current_version}</Badge> : null}
                    {a.requires_exclusivity ? <Badge variant="outline">Exclusivité</Badge> : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {isShopSide ? "avec" : "boutique :"} {other?.public_name || other?.name || "—"}
                    </span>
                  </div>
                  {a.scope ? <p className="mt-1 text-sm">{a.scope}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">{statusLabel}</p>
                  {canEdit ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSignOpen(a)}>
                        {alreadySigned ? "Consulter" : "Consulter et accepter"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(a)}>
                        Historique &amp; PDF
                      </Button>
                      {a.status !== "terminated" && a.status !== "expired" ? (
                        <Button size="sm" variant="destructive" onClick={() => {
                          const reason = prompt("Motif de résiliation :") ?? undefined;
                          termFn({ data: { agreementId: a.id, reason } })
                            .then(() => { toast.success("Résilié."); invalidate(); })
                            .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"));
                        }}>Résilier</Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      {signOpen ? (
        <AgreementSignatureDialog
          agreementId={signOpen.id}
          side={signOpen.shop_id === shopId ? "shop" : "independent"}
          agreement={signOpen}
          ownShopId={shopId}
          open={!!signOpen}
          onOpenChange={(o) => { if (!o) setSignOpen(null); }}
          invalidateKey={["partners:agrs", shopId]}
        />
      ) : null}
      {historyOpen ? (
        <AgreementVersionsDialog
          agreementId={historyOpen.id}
          agreementTitle={historyOpen.title}
          open={!!historyOpen}
          onOpenChange={(o) => { if (!o) setHistoryOpen(null); }}
        />
      ) : null}
    </SectionCard>
  );
}