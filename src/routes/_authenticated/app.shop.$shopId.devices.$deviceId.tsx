import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/shop/StatusBadge";
import { logActivity } from "@/lib/activity";
import { DEVICE_TYPE_LABEL, customerDisplayName } from "@/lib/shop-constants";
import { PageContainer, PageHeader, SectionCard, EmptyState } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Plus, Archive, RotateCcw, Wrench,
  Smartphone, Laptop, Tablet, Watch, Gamepad2, Monitor, HardDrive,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const DEVICE_ICON: Record<string, LucideIcon> = {
  phone: Smartphone, smartphone: Smartphone,
  laptop: Laptop, computer: Monitor, desktop: Monitor,
  tablet: Tablet, watch: Watch, console: Gamepad2,
};

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/devices/$deviceId")({
  head: () => ({ meta: [{ title: "Appareil — BPEI" }] }),
  component: DeviceDetail,
});

function DeviceDetail() {
  const { shopId } = useShop();
  const { deviceId } = Route.useParams();
  const base = `/app/shop/${shopId}`;
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["device", deviceId],
    queryFn: async () => {
      const [dRes, rRes] = await Promise.all([
        supabase.from("devices").select("*, customers(id, customer_type, company_name, first_name, last_name)").eq("id", deviceId).maybeSingle(),
        supabase.from("repairs").select("id, repair_number, status, created_at").eq("device_id", deviceId).order("created_at", { ascending: false }),
      ]);
      if (dRes.error) throw dRes.error;
      return { device: dRes.data, repairs: rRes.data ?? [] };
    },
  });

  const archiveMut = useMutation({
    mutationFn: async (archive: boolean) => {
      const { error } = await supabase.from("devices").update({ archived_at: archive ? new Date().toISOString() : null }).eq("id", deviceId);
      if (error) throw error;
      await logActivity({ shopId, entityType: "device", entityId: deviceId, action: archive ? "device.archived" : "device.restored" });
    },
    onSuccess: () => { toast.success("Appareil mis à jour"); qc.invalidateQueries({ queryKey: ["device", deviceId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <PageContainer size="wide">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </PageContainer>
    );
  }
  if (!data?.device) {
    return (
      <PageContainer>
        <EmptyState icon={<Smartphone className="h-6 w-6" />} title="Appareil introuvable" action={<Button asChild variant="outline"><Link to="/app/shop/$shopId/devices" params={{ shopId }}>Retour</Link></Button>} />
      </PageContainer>
    );
  }
  const d = data.device;
  const DeviceIcon = DEVICE_ICON[d.device_type as string] ?? HardDrive;
  const title = [d.brand, d.model].filter(Boolean).join(" ") || "Appareil";

  return (
    <PageContainer size="wide">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to="/app/shop/$shopId/devices" params={{ shopId }}><ArrowLeft className="mr-2 h-4 w-4" />Retour aux appareils</Link>
      </Button>

      <div className="flex flex-wrap items-start gap-5">
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-electric-soft text-electric">
          <DeviceIcon className="h-10 w-10" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-electric">
            {DEVICE_TYPE_LABEL[d.device_type]}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {d.customers && (
              <Link to="/app/shop/$shopId/clients/$clientId" params={{ shopId, clientId: d.customers.id }} className="text-electric hover:underline">
                {customerDisplayName(d.customers)}
              </Link>
            )}
            {d.serial_number && <span className="font-mono text-xs">S/N {d.serial_number}</span>}
            {d.archived_at && <Badge variant="outline" className="text-muted-foreground">Archivé</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="bg-electric text-electric-foreground hover:bg-electric/90" size="sm">
            <Link to="/app/shop/$shopId/repairs/new" params={{ shopId }} search={{ deviceId: d.id, customerId: d.customer_id } as never}><Plus className="mr-2 h-4 w-4" />Nouvelle réparation</Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" aria-label={d.archived_at ? "Restaurer l'appareil" : "Archiver l'appareil"}>
                {d.archived_at ? <><RotateCcw className="mr-2 h-4 w-4" />Restaurer</> : <><Archive className="mr-2 h-4 w-4" />Archiver</>}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{d.archived_at ? "Restaurer ?" : "Archiver ?"}</AlertDialogTitle>
                <AlertDialogDescription>L'archivage n'affecte pas l'historique.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => archiveMut.mutate(!d.archived_at)}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <SectionCard title="Caractéristiques">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Propriétaire" value={d.customers ? customerDisplayName(d.customers) : "—"} link={d.customers ? `${base}/clients/${d.customers.id}` : undefined} />
          <Row label="N° série" value={d.serial_number} mono />
          <Row label="IMEI" value={d.imei} mono />
          <Row label="Couleur" value={d.color} />
          <Row label="Système" value={d.operating_system} />
          <Row label="Fin de garantie" value={d.warranty_end_date ? new Date(d.warranty_end_date).toLocaleDateString("fr-FR") : null} />
        </dl>
      </SectionCard>

      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard title="Description client">
          <p className="whitespace-pre-wrap text-sm">{d.customer_description || <span className="text-muted-foreground">—</span>}</p>
        </SectionCard>
        <SectionCard title="Notes internes">
          <p className="whitespace-pre-wrap text-sm">{d.internal_notes || <span className="text-muted-foreground">—</span>}</p>
        </SectionCard>
      </div>

      <SectionCard title={`Historique des réparations (${data.repairs.length})`} padded={false}>
        {data.repairs.length === 0 ? (
          <EmptyState icon={<Wrench className="h-6 w-6" />} title="Aucune réparation" description="Aucun dossier n'a encore été ouvert pour cet appareil." className="border-0 rounded-none" />
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

function Row({ label, value, link, mono }: { label: string; value: string | null | undefined; link?: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>
        {value ? (link ? <Link to={link} className="text-electric hover:underline">{value}</Link> : value) : <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}