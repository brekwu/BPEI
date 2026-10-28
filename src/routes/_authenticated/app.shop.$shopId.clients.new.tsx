import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logActivity } from "@/lib/activity";
import { ArrowLeft } from "lucide-react";
import { PageContainer, PageHeader, SectionCard, FormSection, FormRow, FormActions } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/clients/new")({
  head: () => ({ meta: [{ title: "Nouveau client — BPEI" }] }),
  component: NewClient,
});

const schema = z.object({
  customer_type: z.enum(["individual", "business"]),
  company_name: z.string().max(200).optional(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  email: z.string().max(255).email("E-mail invalide").optional().or(z.literal("")),
  phone: z.string().max(30).optional(),
  address_line_1: z.string().max(200).optional(),
  postal_code: z.string().max(20).optional(),
  city: z.string().max(100).optional(),
  internal_notes: z.string().max(2000).optional(),
}).refine(
  (d) => (d.customer_type === "business" ? !!d.company_name?.trim() : !!(d.first_name?.trim() || d.last_name?.trim())),
  { message: "Renseignez une raison sociale ou un nom", path: ["last_name"] },
);
type FormData = z.infer<typeof schema>;

function NewClient() {
  const { shopId } = useShop();
  const base = `/app/shop/${shopId}`;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { customer_type: "individual" } });

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      const { data: u } = await supabase.auth.getUser();
      const insert = {
        shop_id: shopId,
        customer_type: values.customer_type,
        company_name: values.company_name || null,
        first_name: values.first_name || null,
        last_name: values.last_name || null,
        email: values.email || null,
        phone: values.phone || null,
        address_line_1: values.address_line_1 || null,
        postal_code: values.postal_code || null,
        city: values.city || null,
        internal_notes: values.internal_notes || null,
        created_by: u.user?.id,
      };
      const { data, error } = await supabase.from("customers").insert(insert).select("id").single();
      if (error) throw error;
      await logActivity({ shopId, entityType: "customer", entityId: data.id, action: "customer.created" });
      return data.id;
    },
    onSuccess: (id) => {
      toast.success("Client créé");
      qc.invalidateQueries({ queryKey: ["customers", shopId] });
      navigate({ to: `${base}/clients/${id}` });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const type = form.watch("customer_type");

  return (
    <PageContainer>
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
        <Link to={`${base}/clients`}><ArrowLeft className="mr-2 h-4 w-4" />Retour</Link>
      </Button>
      <PageHeader
        title="Nouveau client"
        description="Créez une fiche particulier ou professionnel pour lui rattacher appareils, dossiers et documents."
      />
      <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <SectionCard title="Identité">
          <FormSection>
            <div>
              <Label>Type de client</Label>
              <Select value={type} onValueChange={(v) => form.setValue("customer_type", v as "individual" | "business")}>
                <SelectTrigger aria-label="Type de client"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Particulier</SelectItem>
                  <SelectItem value="business">Professionnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "business" && (
              <div>
                <Label htmlFor="company_name">Raison sociale *</Label>
                <Input id="company_name" {...form.register("company_name")} />
              </div>
            )}
            <FormRow>
              <div>
                <Label htmlFor="first_name">Prénom{type === "individual" && " *"}</Label>
                <Input id="first_name" {...form.register("first_name")} />
              </div>
              <div>
                <Label htmlFor="last_name">Nom{type === "individual" && " *"}</Label>
                <Input id="last_name" {...form.register("last_name")} />
                {form.formState.errors.last_name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.last_name.message}</p>}
              </div>
            </FormRow>
          </FormSection>
        </SectionCard>

        <SectionCard title="Contact">
          <FormRow>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
              {form.formState.errors.email && <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" type="tel" autoComplete="tel" {...form.register("phone")} />
            </div>
          </FormRow>
        </SectionCard>

        <SectionCard title="Adresse">
          <FormSection>
            <div>
              <Label htmlFor="address_line_1">Adresse</Label>
              <Input id="address_line_1" autoComplete="street-address" {...form.register("address_line_1")} />
            </div>
            <FormRow>
              <div>
                <Label htmlFor="postal_code">Code postal</Label>
                <Input id="postal_code" autoComplete="postal-code" {...form.register("postal_code")} />
              </div>
              <div>
                <Label htmlFor="city">Ville</Label>
                <Input id="city" autoComplete="address-level2" {...form.register("city")} />
              </div>
            </FormRow>
          </FormSection>
        </SectionCard>

        <SectionCard title="Notes internes" description="Non visible par le client.">
          <div>
            <Label htmlFor="internal_notes" className="sr-only">Notes internes</Label>
            <Textarea id="internal_notes" rows={3} {...form.register("internal_notes")} />
          </div>
        </SectionCard>

        <FormActions sticky>
          <Button type="button" variant="ghost" asChild><Link to={`${base}/clients`}>Annuler</Link></Button>
          <Button type="submit" disabled={mutation.isPending} className="bg-electric text-electric-foreground hover:bg-electric/90">
            {mutation.isPending ? "Création…" : "Créer le client"}
          </Button>
        </FormActions>
      </form>
    </PageContainer>
  );
}