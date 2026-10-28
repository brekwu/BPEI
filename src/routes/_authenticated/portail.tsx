import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { portalOverview, portalLinkAccount } from "@/lib/portal.functions";
import { cancelPortalAppointment } from "@/lib/customer-portal.functions";
import { PageContainer, PageHeader, SectionCard, StatCard, StatusBadge, EmptyState, Skeleton } from "@/components/ui-kit";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/money";
import { publicRepairLabel } from "@/components/shop/RepairTimeline";
import { AppointmentStatusBadge } from "@/components/shop/AppointmentCard";
import { toast } from "sonner";
import { Calendar, Wrench, FileText, Receipt, CreditCard, Star, User, LogOut, Store, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portail")({
  head: () => ({ meta: [{ title: "Mon espace client — BPEI" }] }),
  component: PortalPage,
});

function PortalPage() {
  const overviewFn = useServerFn(portalOverview);
  const linkFn = useServerFn(portalLinkAccount);
  const cancelFn = useServerFn(cancelPortalAppointment);
  const qc = useQueryClient();

  const [email, setEmail] = useState<string>("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? "")); }, []);

  const q = useQuery({
    queryKey: ["portal-overview"],
    queryFn: () => overviewFn(),
  });

  // Auto-attempt account linking on first visit
  useEffect(() => {
    linkFn().then((r) => {
      if (r.linked > 0) qc.invalidateQueries({ queryKey: ["portal-overview"] });
    }).catch(() => { /* silent */ });
  }, [linkFn, qc]);

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { appointmentId: id } }),
    onSuccess: () => {
      toast.success("Rendez-vous annulé");
      qc.invalidateQueries({ queryKey: ["portal-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  if (q.isLoading) {
    return (
      <div className="min-h-dvh bg-surface-muted">
        <PageContainer size="wide">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </PageContainer>
      </div>
    );
  }
  const data = q.data!;



  return (
    <div className="min-h-dvh bg-surface-muted">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-navy text-navy-foreground font-display font-bold">B</div>
            <div className="font-display font-bold text-navy">BPEI · Mon espace</div>
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{email}</div>
            <Button size="sm" variant="ghost" onClick={signOut}><LogOut className="h-4 w-4 mr-1.5" />Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <PageHeader
          title="Bonjour"
          description={email ? `Voici vos réparations, rendez-vous et documents rattachés à ${email}.` : ""}
        />

        {data.links.length === 0 && (
          <div className="bpei-surface p-6 border-warning/40">
            <h2 className="font-semibold mb-2">Aucun dossier rattaché</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Nous n'avons trouvé aucun dossier lié à votre email. Contactez votre boutique pour qu'elle vous ajoute ou vérifie qu'elle a bien saisi la même adresse.
            </p>
            <Button size="sm" variant="outline" onClick={async () => {
              const r = await linkFn();
              toast.success(`${r.linked} dossier(s) trouvé(s)`);
              qc.invalidateQueries({ queryKey: ["portal-overview"] });
            }}>Rechercher à nouveau</Button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Rendez-vous" value={data.appointments.length} icon={<Calendar />} />
          <StatCard label="Réparations" value={data.repairs.length} icon={<Wrench />} />
          <StatCard label="Devis" value={data.quotes.length} icon={<FileText />} />
          <StatCard label="Factures" value={data.invoices.length} icon={<Receipt />} />
        </div>

        <Tabs defaultValue="appointments" className="space-y-4">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto">
            <TabsTrigger value="appointments"><Calendar className="h-4 w-4 mr-1.5" />RDV</TabsTrigger>
            <TabsTrigger value="repairs"><Wrench className="h-4 w-4 mr-1.5" />Réparations</TabsTrigger>
            <TabsTrigger value="quotes"><FileText className="h-4 w-4 mr-1.5" />Devis</TabsTrigger>
            <TabsTrigger value="invoices"><Receipt className="h-4 w-4 mr-1.5" />Factures</TabsTrigger>
            <TabsTrigger value="payments"><CreditCard className="h-4 w-4 mr-1.5" />Paiements</TabsTrigger>
            <TabsTrigger value="reviews"><Star className="h-4 w-4 mr-1.5" />Avis</TabsTrigger>
          </TabsList>

          <TabsContent value="appointments">
            <SectionCard title="Mes rendez-vous">
              {data.appointments.length === 0 ? <EmptyState title="Aucun rendez-vous" description="Prenez rendez-vous depuis la page de votre boutique." /> : (
                <div className="divide-y divide-border">
                  {data.appointments.slice(0, 20).map((a) => {
                    const cancellable = a.status === "pending" || a.status === "confirmed";
                    return (
                      <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{new Date(a.starts_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</div>
                          <div className="text-xs text-muted-foreground">{data.shops.find((s) => s.id === a.shop_id)?.name}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <AppointmentStatusBadge status={a.status} />
                          {cancellable && (
                            <Button size="sm" variant="ghost" onClick={() => { if (confirm("Annuler ce rendez-vous ?")) cancelMut.mutate(a.id); }} disabled={cancelMut.isPending}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="repairs">
            <SectionCard title="Mes réparations">
              {data.repairs.length === 0 ? <EmptyState title="Aucune réparation" description="Vos réparations apparaîtront ici." /> : (
                <div className="divide-y divide-border">
                  {data.repairs.map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium font-mono">{r.repair_number}</div>
                        <div className="text-xs text-muted-foreground">{data.shops.find((s) => s.id === r.shop_id)?.name} · {publicRepairLabel(r.status)}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleDateString("fr-FR")}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="quotes">
            <SectionCard title="Mes devis">
              {data.quotes.length === 0 ? <EmptyState title="Aucun devis" /> : (
                <div className="divide-y divide-border">
                  {data.quotes.map((qq) => (
                    <div key={qq.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{qq.quote_number ?? "Brouillon"}</div>
                        <StatusBadge status={qq.status} size="sm" />
                      </div>
                      <div className="font-semibold tabular-nums shrink-0">{formatMoney(qq.total_including_tax_cents, qq.currency)}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="invoices">
            <SectionCard title="Mes factures">
              {data.invoices.length === 0 ? <EmptyState title="Aucune facture" /> : (
                <div className="divide-y divide-border">
                  {data.invoices.map((f) => (
                    <div key={f.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{f.invoice_number ?? "Brouillon"}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge status={f.status} size="sm" />
                          <span className="text-xs text-muted-foreground tabular-nums">Reste dû {formatMoney(f.amount_due_cents, f.currency)}</span>
                        </div>
                      </div>
                      <div className="font-semibold tabular-nums shrink-0">{formatMoney(f.total_including_tax_cents, f.currency)}</div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="payments">
            <SectionCard title="Mes paiements">
              {data.payments.length === 0 ? <EmptyState title="Aucun paiement" /> : (
                <div className="divide-y divide-border">
                  {data.payments.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium tabular-nums">{formatMoney(p.amount_cents, p.currency)}</div>
                        <div className="text-xs text-muted-foreground">{p.method} · {new Date(p.paid_at).toLocaleDateString("fr-FR")}</div>
                      </div>
                      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="reviews">
            <SectionCard title="Mes avis">
              {data.reviews.length === 0 ? <EmptyState title="Aucun avis déposé" /> : (
                <div className="space-y-3">
                  {data.reviews.map((r) => (
                    <div key={r.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="mb-1 flex items-center gap-2">
                        <div className="flex items-center gap-0.5" aria-label={`Note ${r.rating} sur 5`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "fill-warning text-warning" : "text-border"}`} aria-hidden />
                          ))}
                        </div>
                        <StatusBadge status={r.status} size="sm" />
                      </div>
                      {r.title && <div className="font-medium">{r.title}</div>}
                      {r.comment && <div className="text-xs text-muted-foreground">{r.comment}</div>}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>


        {data.shops.length > 0 && (
          <SectionCard title="Mes boutiques">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.shops.map((s) => (
                <Link key={s.id} to="/reserver/$shopId" params={{ shopId: s.id }} className="rounded-md border border-border p-3 flex items-center gap-3 hover:border-electric transition-colors">
                  <Store className="h-5 w-5 text-electric" />
                  <div>
                    <div className="font-medium text-sm">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.city}</div>
                  </div>
                </Link>
              ))}
            </div>
          </SectionCard>
        )}
      </main>
    </div>
  );
}