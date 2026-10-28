import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";
import { customerDisplayName, CUSTOMER_TYPE_LABEL, DEVICE_TYPE_LABEL } from "@/lib/shop-constants";
import { StatusBadge } from "@/components/shop/StatusBadge";
import { PortalInvitations } from "@/components/shop/PortalInvitations";
import { PageContainer, PageHeader, SectionCard, EmptyState } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Archive, RotateCcw, Smartphone, Wrench, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/clients/$clientId")({
  head: () => ({ meta: [{ title: "Fiche client — BPEI" }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { shopId } = useShop();
  const { clientId } = Route.useParams();
  const base = `/app/shop/${shopId}`;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["customer", clientId],
    queryFn: async () => {
      const [cRes, dRes, rRes] = await Promise.all([
        supabase.from("customers").select("*").eq("id", clientId).maybeSingle(),
        supabase.from("devices").select("id, device_type, brand, model, serial_number, archived_at").eq("customer_id", clientId).order("created_at", { ascending: false }),
        supabase.from("repairs").select("id, repair_number, status, created_at").eq("customer_id", clientId).order("created_at", { ascending: false }).limit(20),
      ]);
      if (cRes.error) throw cRes.error;
      return { customer: cRes.data, devices: dRes.data ?? [], repairs: rRes.data ?? [] };
    },
  });

  const archiveMut = useMutation({
    mutationFn: async (archive: boolean) => {
      const { error } = await supabase.from("customers").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", clientId);
      if (error) throw error;
      await logActivity({ shopId, entityType: "customer", entityId: clientId, action: archive ? "customer.archived" : "customer.restored" });
    },
    onSuccess: () => {
      toast.success("Client mis à jour");
      qc.invalidateQueries({ queryKey: ["customer", clientId] });
      qc.invalidateQueries({ queryKey: ["customers", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <PageContainer size="wide">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </PageContainer>
    );
  }
  if (!data?.customer) {
    return (
      <PageContainer>
        <EmptyState icon={<User className="h-6 w-6" />} title="Client introuvable" description="Ce client n'existe plus ou a été supprimé." action={<Button asChild variant="outline"><Link to="/app/shop/$shopId/clients" params={{ shopId }}>Retour à la liste</Link></Button>} />
      </PageContainer>
    );
  }
  const c = data.customer;
  const fullAddress = [c.address_line_1, c.address_line_2, c.postal_code, c.city, c.country].filter(Boolean).join(" · ");

  return (
    <PageContainer size="wide">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/app/shop/$shopId/clients" params={{ shopId }}><ArrowLeft className="mr-2 h-4 w-4" />Retour aux clients</Link>
      </Button>

      <PageHeader
        eyebrow={CUSTOMER_TYPE_LABEL[c.customer_type]}
        title={customerDisplayName(c)}
        description={c.archived_at ? "Ce client est archivé." : "Vue d'ensemble du dossier client."}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/shop/$shopId/devices/new" params={{ shopId }} search={{ customerId: c.id } as never}><Plus className="mr-2 h-4 w-4" />Ajouter appareil</Link>
            </Button>
            <Button asChild className="bg-electric text-electric-foreground hover:bg-electric/90" size="sm">
              <Link to="/app/shop/$shopId/repairs/new" params={{ shopId }} search={{ customerId: c.id } as never}><Plus className="mr-2 h-4 w-4" />Nouvelle réparation</Link>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" aria-label={c.archived_at ? "Restaurer le client" : "Archiver le client"}>
                  {c.archived_at ? <><RotateCcw className="mr-2 h-4 w-4" />Restaurer</> : <><Archive className="mr-2 h-4 w-4" />Archiver</>}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{c.archived_at ? "Restaurer ce client ?" : "Archiver ce client ?"}</AlertDialogTitle>
                  <AlertDialogDescription>L'archivage n'affecte pas les dossiers déjà créés pour ce client.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => archiveMut.mutate(!c.archived_at)}>Confirmer</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />

      {c.archived_at && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
          Client archivé le {new Date(c.archived_at).toLocaleDateString("fr-FR")}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Coordonnées" className="lg:col-span-2">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="E-mail" value={c.email} />
            <Row label="Téléphone" value={c.phone} />
            <Row label="Téléphone secondaire" value={c.secondary_phone} />
            <Row label="Créé le" value={new Date(c.created_at).toLocaleDateString("fr-FR")} />
            <Row label="Adresse" value={fullAddress} full />
          </dl>
        </SectionCard>
        <SectionCard title="Notes internes">
          <p className="whitespace-pre-wrap text-sm">
            {c.internal_notes || <span className="text-muted-foreground">Aucune note.</span>}
          </p>
        </SectionCard>
      </div>

      <PortalInvitations customerId={c.id} customerEmail={c.email} />

      <SectionCard
        title={`Appareils (${data.devices.length})`}
        action={<Button asChild size="sm" variant="outline"><Link to="/app/shop/$shopId/devices/new" params={{ shopId }} search={{ customerId: c.id } as never}><Plus className="mr-1.5 h-4 w-4" />Ajouter</Link></Button>}
        padded={false}
      >
        {data.devices.length === 0 ? (
          <EmptyState icon={<Smartphone className="h-6 w-6" />} title="Aucun appareil enregistré" description="Ajoutez le premier appareil de ce client." className="border-0 rounded-none" />
        ) : (
          <ul className="divide-y divide-border">
            {data.devices.map((d) => (
              <li key={d.id}>
                <Link to="/app/shop/$shopId/devices/$deviceId" params={{ shopId, deviceId: d.id }} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/60 focus-visible:outline-none">
                  <Smartphone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{DEVICE_TYPE_LABEL[d.device_type]} · {[d.brand, d.model].filter(Boolean).join(" ") || "—"}</span>
                  {d.serial_number && <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{d.serial_number}</span>}
                  {d.archived_at && <Badge variant="outline" className="shrink-0 text-muted-foreground">Archivé</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={`Réparations (${data.repairs.length})`} padded={false}>
        {data.repairs.length === 0 ? (
          <EmptyState icon={<Wrench className="h-6 w-6" />} title="Aucun dossier" description="Aucune réparation liée à ce client." className="border-0 rounded-none" />
        ) : (
          <ul className="divide-y divide-border">
            {data.repairs.map((r) => (
              <li key={r.id}>
                <Link to="/app/shop/$shopId/repairs/$repairId" params={{ shopId, repairId: r.id }} className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-secondary/40 focus-visible:bg-secondary/60 focus-visible:outline-none">
                  <span className="font-mono text-xs">{r.repair_number}</span>
                  <span className="flex-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                  <StatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
}

function Row({ label, value, full }: { label: string; value: string | null | undefined; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}