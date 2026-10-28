import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  REPAIR_PRIORITY_LABEL, customerDisplayName,
  type RepairPriority,
} from "@/lib/shop-constants";
import { logActivity } from "@/lib/activity";
import { ArrowLeft } from "lucide-react";
import { PageContainer, PageHeader, SectionCard, FormSection, FormRow, FormActions } from "@/components/ui-kit";

const searchSchema = z.object({ customerId: z.string().optional(), deviceId: z.string().optional() });

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/repairs/new")({
  head: () => ({ meta: [{ title: "Nouvelle réparation — BPEI" }] }),
  validateSearch: searchSchema,
  component: NewRepair,
});

const schema = z.object({
  customer_id: z.string().uuid("Sélectionnez un client"),
  device_id: z.string().uuid("Sélectionnez un appareil"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  assigned_technician_id: z.string().optional(),
  intake_channel: z.string().max(50).optional(),
  customer_issue: z.string().max(2000).optional(),
  initial_condition: z.string().max(1000).optional(),
  accessories_received: z.string().max(500).optional(),
  estimated_completion_at: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

function NewRepair() {
  const { shopId } = useShop();
  const base = `/app/shop/${shopId}`;
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      customer_id: search.customerId ?? "",
      device_id: search.deviceId ?? "",
      priority: "normal",
    },
  });
  const customerId = form.watch("customer_id");

  const { data: customers } = useQuery({
    queryKey: ["customers-select", shopId],
    queryFn: async () => (await supabase.from("customers").select("id, customer_type, company_name, first_name, last_name").eq("shop_id", shopId).is("archived_at", null).order("created_at", { ascending: false }).limit(500)).data ?? [],
  });
  const { data: devices } = useQuery({
    queryKey: ["devices-of-customer", customerId],
    enabled: !!customerId,
    queryFn: async () => (await supabase.from("devices").select("id, device_type, brand, model, serial_number").eq("customer_id", customerId).is("archived_at", null).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: team } = useQuery({
    queryKey: ["team-select", shopId],
    queryFn: async () => {
      const { data: mem } = await supabase.from("shop_memberships").select("user_id, role").eq("shop_id", shopId);
      if (!mem || mem.length === 0) return [] as { id: string; label: string }[];
      const ids = mem.map((m) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ids);
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      return mem.map((m) => {
        const p = map.get(m.user_id);
        const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : "";
        return { id: m.user_id, label: (name || m.user_id.slice(0, 8)) + " (" + m.role + ")" };
      });
    },
  });

  const mutation = useMutation({
    mutationFn: async (v: FormData) => {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("repairs").insert({
        shop_id: shopId,
        customer_id: v.customer_id, device_id: v.device_id,
        priority: v.priority,
        assigned_technician_id: v.assigned_technician_id || null,
        intake_channel: v.intake_channel || null,
        customer_issue: v.customer_issue || null,
        initial_condition: v.initial_condition || null,
        accessories_received: v.accessories_received || null,
        estimated_completion_at: v.estimated_completion_at || null,
        created_by: u.user?.id,
        repair_number: "",
      } as never).select("id, repair_number").single();
      if (error) throw error;
      await logActivity({ shopId, entityType: "repair", entityId: data.id, action: "repair.created", metadata: { repair_number: data.repair_number } });
      return data.id;
    },
    onSuccess: (id) => {
      toast.success("Dossier créé");
      qc.invalidateQueries({ queryKey: ["repairs", shopId] });
      navigate({ to: `${base}/repairs/${id}` });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to={`${base}/repairs`}><ArrowLeft className="mr-2 h-4 w-4" />Retour</Link>
      </Button>
      <PageHeader
        title="Nouveau dossier de réparation"
        description="Ouvrez un dossier lié à un client et un de ses appareils. Le numéro est attribué automatiquement."
      />
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <SectionCard title="Client & appareil">
          <FormRow>
            <div>
              <Label>Client *</Label>
              <Select value={customerId} onValueChange={(v) => { form.setValue("customer_id", v, { shouldValidate: true }); form.setValue("device_id", ""); }}>
                <SelectTrigger aria-label="Client"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{customerDisplayName(c)}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="mt-1 text-xs">
                <Link to={`${base}/clients/new`} className="text-electric hover:underline">+ Créer un client</Link>
              </div>
              {form.formState.errors.customer_id && <p className="mt-1 text-xs text-destructive">{form.formState.errors.customer_id.message}</p>}
            </div>
            <div>
              <Label>Appareil *</Label>
              <Select value={form.watch("device_id")} onValueChange={(v) => form.setValue("device_id", v, { shouldValidate: true })}>
                <SelectTrigger disabled={!customerId} aria-label="Appareil"><SelectValue placeholder={customerId ? "Sélectionner" : "Choisir un client d'abord"} /></SelectTrigger>
                <SelectContent>
                  {(devices ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{[d.brand, d.model].filter(Boolean).join(" ") || d.device_type}</SelectItem>)}
                </SelectContent>
              </Select>
              {customerId && (
                <div className="mt-1 text-xs">
                  <Link to={`${base}/devices/new`} search={{ customerId } as never} className="text-electric hover:underline">+ Créer un appareil</Link>
                </div>
              )}
              {form.formState.errors.device_id && <p className="mt-1 text-xs text-destructive">{form.formState.errors.device_id.message}</p>}
            </div>
          </FormRow>
        </SectionCard>

        <SectionCard title="Priorisation & attribution">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Priorité</Label>
              <Select value={form.watch("priority")} onValueChange={(v) => form.setValue("priority", v as RepairPriority)}>
                <SelectTrigger aria-label="Priorité"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REPAIR_PRIORITY_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Technicien</Label>
              <Select value={form.watch("assigned_technician_id") ?? "__none"} onValueChange={(v) => form.setValue("assigned_technician_id", v === "__none" ? undefined : v)}>
                <SelectTrigger aria-label="Technicien"><SelectValue placeholder="Non attribué" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Non attribué</SelectItem>
                  {(team ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="estimated_completion_at">Date prévisionnelle</Label>
              <Input id="estimated_completion_at" type="datetime-local" {...form.register("estimated_completion_at")} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Diagnostic d'entrée">
          <FormSection>
            <div>
              <Label htmlFor="customer_issue">Panne décrite par le client</Label>
              <Textarea id="customer_issue" rows={3} {...form.register("customer_issue")} />
            </div>
            <FormRow>
              <div>
                <Label htmlFor="initial_condition">État visuel initial</Label>
                <Textarea id="initial_condition" rows={2} {...form.register("initial_condition")} />
              </div>
              <div>
                <Label htmlFor="accessories_received">Accessoires reçus</Label>
                <Textarea id="accessories_received" rows={2} {...form.register("accessories_received")} />
              </div>
            </FormRow>
          </FormSection>
        </SectionCard>

        <FormActions sticky>
          <Button type="button" variant="ghost" asChild><Link to={`${base}/repairs`}>Annuler</Link></Button>
          <Button type="submit" disabled={mutation.isPending} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {mutation.isPending ? "Création…" : "Créer le dossier"}
          </Button>
        </FormActions>
      </form>
    </PageContainer>
  );
}