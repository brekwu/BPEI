import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logActivity } from "@/lib/activity";
import { DEVICE_TYPE_LABEL, customerDisplayName, type DeviceType } from "@/lib/shop-constants";
import { ArrowLeft } from "lucide-react";
import { PageContainer, PageHeader, SectionCard, FormSection, FormRow, FormActions } from "@/components/ui-kit";

const searchSchema = z.object({ customerId: z.string().optional() });

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/devices/new")({
  head: () => ({ meta: [{ title: "Nouvel appareil — BPEI" }] }),
  validateSearch: searchSchema,
  component: NewDevice,
});

const schema = z.object({
  customer_id: z.string().uuid("Sélectionnez un client"),
  device_type: z.enum(["laptop","desktop","mac","phone","tablet","console","printer","server","peripheral","other"]),
  brand: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  serial_number: z.string().max(100).optional(),
  imei: z.string().max(50).optional(),
  color: z.string().max(50).optional(),
  operating_system: z.string().max(100).optional(),
  warranty_end_date: z.string().optional(),
  customer_description: z.string().max(1000).optional(),
  internal_notes: z.string().max(2000).optional(),
});
type FormData = z.infer<typeof schema>;

function NewDevice() {
  const { shopId } = useShop();
  const base = `/app/shop/${shopId}`;
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ["customers-select", shopId],
    queryFn: async () => {
      const { data } = await supabase.from("customers")
        .select("id, customer_type, company_name, first_name, last_name")
        .eq("shop_id", shopId).is("archived_at", null).order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { customer_id: search.customerId ?? "", device_type: "laptop" },
  });

  const mutation = useMutation({
    mutationFn: async (v: FormData) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("devices").insert({
        shop_id: shopId, customer_id: v.customer_id, device_type: v.device_type,
        brand: v.brand || null, model: v.model || null, serial_number: v.serial_number || null,
        imei: v.imei || null, color: v.color || null, operating_system: v.operating_system || null,
        warranty_end_date: v.warranty_end_date || null,
        customer_description: v.customer_description || null,
        internal_notes: v.internal_notes || null,
        created_by: u.user?.id,
      }).select("id").single();
      if (error) throw error;
      await logActivity({ shopId, entityType: "device", entityId: data.id, action: "device.created" });
      return data.id;
    },
    onSuccess: (id) => {
      toast.success("Appareil créé");
      qc.invalidateQueries({ queryKey: ["devices", shopId] });
      navigate({ to: `${base}/devices/${id}` });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to={`${base}/devices`}><ArrowLeft className="mr-2 h-4 w-4" />Retour</Link>
      </Button>
      <PageHeader
        title="Nouvel appareil"
        description="Rattachez un appareil à un client pour ouvrir ensuite un dossier de réparation."
      />
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <SectionCard title="Client & type">
          <FormSection>
            <div>
              <Label>Client *</Label>
              <Select value={form.watch("customer_id")} onValueChange={(v) => form.setValue("customer_id", v, { shouldValidate: true })}>
                <SelectTrigger aria-label="Client"><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.formState.errors.customer_id && <p className="mt-1 text-xs text-destructive">{form.formState.errors.customer_id.message}</p>}
            </div>
            <div>
              <Label>Type d'appareil *</Label>
              <Select value={form.watch("device_type")} onValueChange={(v) => form.setValue("device_type", v as DeviceType)}>
                <SelectTrigger aria-label="Type d'appareil"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DEVICE_TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </FormSection>
        </SectionCard>

        <SectionCard title="Identification">
          <FormRow>
            <div><Label htmlFor="brand">Marque</Label><Input id="brand" {...form.register("brand")} /></div>
            <div><Label htmlFor="model">Modèle</Label><Input id="model" {...form.register("model")} /></div>
            <div><Label htmlFor="serial_number">N° de série</Label><Input id="serial_number" {...form.register("serial_number")} /></div>
            <div><Label htmlFor="imei">IMEI</Label><Input id="imei" {...form.register("imei")} /></div>
            <div><Label htmlFor="color">Couleur</Label><Input id="color" {...form.register("color")} /></div>
            <div><Label htmlFor="operating_system">Système d'exploitation</Label><Input id="operating_system" {...form.register("operating_system")} /></div>
            <div><Label htmlFor="warranty_end_date">Fin de garantie</Label><Input id="warranty_end_date" type="date" {...form.register("warranty_end_date")} /></div>
          </FormRow>
        </SectionCard>

        <SectionCard title="Contexte">
          <FormSection>
            <div>
              <Label htmlFor="customer_description">Description du problème (client)</Label>
              <Textarea id="customer_description" rows={2} {...form.register("customer_description")} />
            </div>
            <div>
              <Label htmlFor="internal_notes">Notes internes</Label>
              <Textarea id="internal_notes" rows={2} {...form.register("internal_notes")} />
            </div>
          </FormSection>
        </SectionCard>

        <FormActions sticky>
          <Button type="button" variant="ghost" asChild><Link to={`${base}/devices`}>Annuler</Link></Button>
          <Button type="submit" disabled={mutation.isPending} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {mutation.isPending ? "Création…" : "Créer l'appareil"}
          </Button>
        </FormActions>
      </form>
    </PageContainer>
  );
}