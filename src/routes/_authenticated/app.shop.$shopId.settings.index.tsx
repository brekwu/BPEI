import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { canEditSettings } from "@/lib/shop-constants";
import { logActivity } from "@/lib/activity";
import { CalendarClock, Users, Receipt, ChevronRight, Globe, MessageSquare, Upload, ShieldCheck } from "lucide-react";
import {
  PageContainer, PageHeader, SectionCard, FormSection, FormRow, FormActions, Skeleton,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/settings/")({
  head: () => ({ meta: [{ title: "Paramètres — BPEI" }] }),
  component: SettingsPage,
});

const schema = z.object({
  name: z.string().min(1, "Requis").max(200),
  description: z.string().max(2000).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(255).email("E-mail invalide").optional().or(z.literal("")),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  website: z.string().max(300).optional(),
  legal_name: z.string().max(200).optional(),
  legal_form: z.string().max(60).optional(),
  siren: z.string().max(20).optional(),
  siret: z.string().max(30).optional(),
  vat_number: z.string().max(30).optional(),
});
type FormData = z.infer<typeof schema>;

function SettingsPage() {
  const { shopId, role } = useShop();
  const canEdit = canEditSettings(role);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["shop-settings", shopId],
    queryFn: async () => (await supabase.from("shops").select("*").eq("id", shopId).maybeSingle()).data,
  });

  const form = useForm<FormData>({ resolver: zodResolver(schema), values: data ? {
    name: data.name, description: data.description ?? "", phone: data.phone ?? "",
    email: data.email ?? "", address: data.address ?? "", city: data.city ?? "",
    postal_code: data.postal_code ?? "", website: data.website ?? "",
    legal_name: data.legal_name ?? "", legal_form: data.legal_form ?? "",
    siren: data.siren ?? "", siret: data.siret ?? "", vat_number: data.vat_number ?? "",
  } : undefined });

  const mut = useMutation({
    mutationFn: async (v: FormData) => {
      const { error } = await supabase.from("shops").update({
        name: v.name, description: v.description || null, phone: v.phone || null,
        email: v.email || null, address: v.address || null, city: v.city || null,
        postal_code: v.postal_code || null, website: v.website || null,
        legal_name: v.legal_name || null, legal_form: v.legal_form || null,
        siren: v.siren || null, siret: v.siret || null, vat_number: v.vat_number || null,
      }).eq("id", shopId);
      if (error) throw error;
      await logActivity({ shopId, entityType: "shop", entityId: shopId, action: "shop.settings.updated" });
    },
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      qc.invalidateQueries({ queryKey: ["shop-settings", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Boutique"
        title="Paramètres"
        description="Informations publiques et coordonnées de la boutique."
      />

      {isLoading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <SectionCard title="Informations générales">
            <form onSubmit={form.handleSubmit((v) => mut.mutate(v))}>
              <fieldset disabled={!canEdit} className="space-y-6">
                <FormSection>
                  <div className="space-y-1.5">
                    <Label>Nom commercial *</Label>
                    <Input {...form.register("name")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea rows={3} {...form.register("description")} />
                  </div>
                  <FormRow>
                    <div className="space-y-1.5">
                      <Label>Téléphone</Label>
                      <Input {...form.register("phone")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>E-mail</Label>
                      <Input type="email" {...form.register("email")} />
                    </div>
                  </FormRow>
                  <div className="space-y-1.5">
                    <Label>Adresse</Label>
                    <Input {...form.register("address")} />
                  </div>
                  <FormRow>
                    <div className="space-y-1.5">
                      <Label>Code postal</Label>
                      <Input {...form.register("postal_code")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Ville</Label>
                      <Input {...form.register("city")} />
                    </div>
                  </FormRow>
                  <div className="space-y-1.5">
                    <Label>Site web</Label>
                    <Input {...form.register("website")} />
                  </div>
                </FormSection>

                <FormSection title="Identité légale" description="Utilisée pour les documents (factures, devis) et vérifiée à la validation du dossier.">
                  <FormRow>
                    <div className="space-y-1.5">
                      <Label>Raison sociale</Label>
                      <Input {...form.register("legal_name")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Forme juridique</Label>
                      <Input placeholder="SARL, SAS…" {...form.register("legal_form")} />
                    </div>
                  </FormRow>
                  <FormRow>
                    <div className="space-y-1.5">
                      <Label>SIREN</Label>
                      <Input inputMode="numeric" {...form.register("siren")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>SIRET</Label>
                      <Input inputMode="numeric" {...form.register("siret")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>N° TVA intracom.</Label>
                      <Input {...form.register("vat_number")} />
                    </div>
                  </FormRow>
                </FormSection>



                {canEdit ? (
                  <FormActions>
                    <Button type="submit" disabled={mut.isPending}>
                      {mut.isPending ? "Enregistrement…" : "Enregistrer"}
                    </Button>
                  </FormActions>
                ) : (
                  <p className="text-xs text-muted-foreground">Seul le responsable de la boutique peut modifier ces informations.</p>
                )}
              </fieldset>
            </form>
          </SectionCard>

          <SectionCard title="Autres paramètres" description="Ouvrez une section pour la configurer.">
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { href: `/app/shop/${shopId}/settings/public-page`, icon: Globe, title: "Page publique BPEI", desc: "Éditeur de la fiche publique : identité, médias, horaires, thème, publication." },
                { href: `/app/shop/${shopId}/settings/booking`, icon: CalendarClock, title: "Réservation & horaires", desc: "Horaires d'ouverture, fermetures exceptionnelles, lien public." },
                { href: `/app/shop/${shopId}/settings/technicians`, icon: Users, title: "Techniciens & disponibilités", desc: "Semaines type, congés, absences et créneaux bloqués." },
                { href: `/app/shop/${shopId}/settings/billing`, icon: Receipt, title: "Facturation", desc: "Identité légale, TVA, préfixes de numérotation, logo." },
                { href: `/app/shop/${shopId}/settings/message-templates`, icon: MessageSquare, title: "Modèles de messages", desc: "SMS, e-mails et notes internes réutilisables." },
                { href: `/app/shop/${shopId}/settings/import`, icon: Upload, title: "Imports CSV", desc: "Importer en masse vos clients, services et articles." },
                { href: `/app/shop/${shopId}/settings/verification`, icon: ShieldCheck, title: "Vérification BPEI", desc: "Soumettez vos justificatifs pour obtenir le badge « Vérifié BPEI »." },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-all hover:border-electric hover:shadow-sm focus:border-electric focus:outline-none"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-electric-soft text-electric">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </SectionCard>
        </>
      )}
    </PageContainer>
  );
}