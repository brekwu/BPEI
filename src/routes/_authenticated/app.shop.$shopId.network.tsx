import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { canEditSettings } from "@/lib/shop-constants";
import { ShieldCheck } from "lucide-react";
import {
  listAvailableOpportunities, listMyApplications, applyToOpportunity, withdrawApplication,
  listAgreementsForShop, terminateAgreement,
} from "@/lib/partnerships.functions";
import { AgreementSignatureDialog } from "@/components/shop/AgreementSignatureDialog";
import { AgreementVersionsDialog } from "@/components/shop/AgreementVersionsDialog";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/network")({
  head: () => ({ meta: [{ title: "Réseau BPEI — Opportunités" }] }),
  component: NetworkPage,
});

const AGR_COLOR: Record<string, string> = {
  proposed: "bg-slate-100 text-slate-700",
  shop_signed: "bg-amber-100 text-amber-800",
  independent_signed: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  terminated: "bg-red-100 text-red-800",
  expired: "bg-red-100 text-red-800",
  suspended: "bg-orange-100 text-orange-800",
};

function NetworkPage() {
  const ctx = useShop();
  const { shopId, role, subscription, businessType } = ctx;
  const canEdit = canEditSettings(role);
  const plan = String(subscription?.plan ?? "");
  const bt = String(businessType ?? "");
  const indepCapable = plan === "independent_partner"
    && ["mobile_independent","hybrid_business"].includes(bt);

  if (!indepCapable) {
    return (
      <PageContainer>
        <PageHeader
          title="Développer mon activité"
          description="Le module Opportunités réseau est réservé aux indépendants Partenaire Premium."
        />
        <SectionCard title="Passer à Partenaire Premium">
          <p className="text-sm text-muted-foreground">
            Consultez les missions publiées par les boutiques du réseau BPEI, candidatez et négociez des accords
            encadrés. L'abonnement Partenaire Premium donne accès aux opportunités ; il ne garantit ni mission ni exclusivité.
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
        title="Réseau BPEI"
        description="Parcourez les opportunités publiées par les boutiques, candidatez et suivez vos accords."
      />
      <Tabs defaultValue="opps">
        <TabsList>
          <TabsTrigger value="opps">Opportunités</TabsTrigger>
          <TabsTrigger value="apps">Mes candidatures</TabsTrigger>
          <TabsTrigger value="agrs">Accords</TabsTrigger>
        </TabsList>
        <TabsContent value="opps"><OppsBrowseTab shopId={shopId} canEdit={canEdit} /></TabsContent>
        <TabsContent value="apps"><MyAppsTab shopId={shopId} canEdit={canEdit} /></TabsContent>
        <TabsContent value="agrs"><AgreementsTab shopId={shopId} canEdit={canEdit} /></TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function OppsBrowseTab({ shopId, canEdit }: { shopId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAvailableOpportunities);
  const applyFn = useServerFn(applyToOpportunity);
  const [q, setQ] = useState("");
  const [applyOpen, setApplyOpen] = useState<null | any>(null);
  const [form, setForm] = useState({ message: "", proposedRate: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["network:opps"],
    queryFn: () => listFn(),
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data ?? [];
    return (data ?? []).filter((o: any) =>
      [o.title, o.description, ...(o.specialties ?? []), ...(o.covered_cities ?? []), o.shop?.public_name, o.shop?.city]
        .filter(Boolean).some((v: string) => String(v).toLowerCase().includes(s))
    );
  }, [data, q]);

  const apply = useMutation({
    mutationFn: () => applyFn({ data: {
      opportunityId: applyOpen!.id,
      independentShopId: shopId,
      message: form.message || undefined,
      proposedRate: form.proposedRate || undefined,
    } }),
    onSuccess: () => {
      toast.success("Candidature envoyée.");
      setApplyOpen(null); setForm({ message: "", proposedRate: "" });
      qc.invalidateQueries({ queryKey: ["network:apps", shopId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <div className="space-y-4">
      <SectionCard title="Rechercher une opportunité">
        <Input placeholder="Ville, spécialité, boutique…" value={q} onChange={(e) => setQ(e.target.value)} />
      </SectionCard>
      <SectionCard title={`Opportunités publiées (${filtered.length})`}>
        {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p>
          : filtered.length === 0 ? <p className="text-sm text-muted-foreground">Aucune opportunité disponible.</p>
          : (
            <ul className="divide-y divide-border">
              {filtered.map((o: any) => (
                <li key={o.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{o.title}</strong>
                    {o.requires_exclusivity ? <Badge variant="outline">Exclusivité</Badge> : null}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {o.shop?.public_name || o.shop?.name} · {o.shop?.city ?? ""}
                      {o.shop?.verification_status === "verified" ? (
                        <span className="ml-1 inline-flex items-center gap-1 text-sky-700"><ShieldCheck className="h-3 w-3" />Vérifié</span>
                      ) : null}
                    </span>
                  </div>
                  {o.description ? <p className="mt-1 text-sm text-muted-foreground">{o.description}</p> : null}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {(o.specialties ?? []).join(" · ")}
                    {o.covered_cities?.length ? ` — ${o.covered_cities.join(", ")}` : ""}
                    {o.compensation_model ? ` — ${o.compensation_model}` : ""}
                    {o.min_availability ? ` — ${o.min_availability}` : ""}
                  </div>
                  {canEdit ? (
                    <div className="mt-2">
                      <Button size="sm" onClick={() => setApplyOpen(o)}>Candidater</Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
      </SectionCard>

      <Dialog open={!!applyOpen} onOpenChange={(o) => !o && setApplyOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Candidater — {applyOpen?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Message</Label>
              <Textarea rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Présentez votre expérience, vos disponibilités…" />
            </div>
            <div>
              <Label>Tarif proposé (facultatif)</Label>
              <Input value={form.proposedRate} onChange={(e) => setForm({ ...form, proposedRate: e.target.value })} placeholder="ex. 45 €/h ou 30 % commission" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(null)}>Annuler</Button>
            <Button onClick={() => apply.mutate()} disabled={apply.isPending}>
              {apply.isPending ? "Envoi…" : "Envoyer la candidature"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MyAppsTab({ shopId, canEdit }: { shopId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyApplications);
  const withdrawFn = useServerFn(withdrawApplication);

  const { data, isLoading } = useQuery({
    queryKey: ["network:apps", shopId],
    queryFn: () => listFn({ data: { independentShopId: shopId } }),
  });

  return (
    <SectionCard title={`Mes candidatures (${data?.length ?? 0})`}>
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p>
        : (data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Vous n'avez encore candidaté à aucune opportunité.</p>
        : (
          <ul className="divide-y divide-border">
            {data!.map((a: any) => (
              <li key={a.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{a.opportunity?.title ?? "—"}</strong>
                  <Badge variant="outline">{a.status}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {a.shop?.public_name || a.shop?.name} · {new Date(a.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
                {a.message ? <p className="mt-1 text-sm">{a.message}</p> : null}
                {a.proposed_rate ? <p className="mt-1 text-xs text-muted-foreground">Tarif proposé : {a.proposed_rate}</p> : null}
                {a.review_notes ? <p className="mt-1 text-xs text-muted-foreground">Réponse : {a.review_notes}</p> : null}
                {canEdit && a.status === "pending" ? (
                  <div className="mt-2">
                    <Button size="sm" variant="destructive" onClick={() => {
                      if (!confirm("Retirer cette candidature ?")) return;
                      withdrawFn({ data: { applicationId: a.id } })
                        .then(() => { toast.success("Retirée."); qc.invalidateQueries({ queryKey: ["network:apps", shopId] }); })
                        .catch((e) => toast.error(e.message));
                    }}>Retirer</Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
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
    queryKey: ["network:agrs", shopId],
    queryFn: () => listFn({ data: { shopId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["network:agrs", shopId] });

  return (
    <SectionCard title={`Mes accords (${data?.length ?? 0})`}>
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p>
        : (data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">Aucun accord.</p>
        : (
          <ul className="divide-y divide-border">
            {data!.map((a: any) => {
              const isIndep = a.independent_shop_id === shopId;
              const alreadySigned = isIndep ? !!a.independent_signed_at : !!a.shop_signed_at;
              const other = isIndep ? a.shop : a.independent;
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
                      avec {other?.public_name || other?.name || "—"}
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
          side={signOpen.independent_shop_id === shopId ? "independent" : "shop"}
          agreement={signOpen}
          ownShopId={shopId}
          open={!!signOpen}
          onOpenChange={(o) => { if (!o) setSignOpen(null); }}
          invalidateKey={["network:agrs", shopId]}
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