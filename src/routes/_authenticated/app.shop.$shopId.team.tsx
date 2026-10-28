import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/components/shop/ShopLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canManageTeam, SHOP_ROLE_LABEL, type ShopRole } from "@/lib/shop-constants";
import { logActivity } from "@/lib/activity";
import { UserPlus, Trash2, Copy, Users, Mail } from "lucide-react";
import {
  PageContainer, PageHeader, SectionCard, EmptyState, DialogShell, FormSection, Skeleton,
} from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/team")({
  head: () => ({ meta: [{ title: "Équipe — BPEI" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { shopId, role } = useShop();
  const canManage = canManageTeam(role);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["team", shopId],
    queryFn: async () => {
      const [memRes, invRes, shopRes] = await Promise.all([
        supabase.from("shop_memberships").select("id, user_id, role, created_at").eq("shop_id", shopId),
        supabase.from("shop_invitations").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
        supabase.from("shops").select("owner_user_id").eq("id", shopId).maybeSingle(),
      ]);
      const mem = memRes.data ?? [];
      const ownerId = shopRes.data?.owner_user_id ?? null;
      const ids = Array.from(new Set([...mem.map((m) => m.user_id), ownerId].filter(Boolean))) as string[];
      const profiles = ids.length ? (await supabase.from("profiles").select("id, first_name, last_name").in("id", ids)).data ?? [] : [];
      const pmap = new Map(profiles.map((p) => [p.id, p]));
      return {
        ownerId,
        members: mem.map((m) => ({ ...m, profile: pmap.get(m.user_id) })),
        invitations: invRes.data ?? [],
      };
    },
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shop_memberships").delete().eq("id", id);
      if (error) throw error;
      await logActivity({ shopId, entityType: "membership", entityId: id, action: "member.removed" });
    },
    onSuccess: () => { toast.success("Membre retiré"); qc.invalidateQueries({ queryKey: ["team", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: ShopRole }) => {
      const { error } = await supabase.from("shop_memberships").update({ role }).eq("id", id);
      if (error) throw error;
      await logActivity({ shopId, entityType: "membership", entityId: id, action: "member.role_changed", metadata: { role } });
    },
    onSuccess: () => { toast.success("Rôle mis à jour"); qc.invalidateQueries({ queryKey: ["team", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeInv = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shop_invitations").update({ status: "revoked" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invitation révoquée"); qc.invalidateQueries({ queryKey: ["team", shopId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const otherMembers = (data?.members ?? []).filter((m) => m.user_id !== data?.ownerId);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Boutique"
        title="Équipe"
        description="Gérez les membres de la boutique et leurs rôles."
        actions={canManage ? (
          <InviteDialog shopId={shopId} onCreated={() => qc.invalidateQueries({ queryKey: ["team", shopId] })} />
        ) : null}
      />

      <SectionCard title="Membres" padded={false}>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : (!data?.ownerId && otherMembers.length === 0) ? (
          <div className="p-6">
            <EmptyState icon={<Users className="h-5 w-5" />} title="Aucun membre" className="border-0 bg-transparent" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data?.ownerId && (
              <li className="flex items-center gap-3 px-5 py-3.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">
                    {(() => { const p = data.members.find((m) => m.user_id === data.ownerId)?.profile;
                      return p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || "Propriétaire" : "Propriétaire";
                    })()}
                  </div>
                  <div className="text-xs text-muted-foreground">Propriétaire de la boutique</div>
                </div>
                <Badge variant="outline" className="border-electric/40 text-electric">Propriétaire</Badge>
              </li>
            )}
            {otherMembers.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{m.profile ? [m.profile.first_name, m.profile.last_name].filter(Boolean).join(" ") || m.user_id.slice(0, 8) : m.user_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">Ajouté le {new Date(m.created_at).toLocaleDateString("fr-FR")}</div>
                </div>
                {canManage ? (
                  <Select value={m.role} onValueChange={(v) => roleMut.mutate({ id: m.id, role: v as ShopRole })}>
                    <SelectTrigger className="h-8 w-40" aria-label="Rôle du membre"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["employee", "technician", "shop_manager"] as ShopRole[]).map((r) => (
                        <SelectItem key={r} value={r}>{SHOP_ROLE_LABEL[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline">{SHOP_ROLE_LABEL[m.role]}</Badge>
                )}
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={() => removeMut.mutate(m.id)} aria-label="Retirer le membre">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {canManage && (
        <SectionCard title="Invitations" description="Liens en attente de validation." padded={false}>
          {(data?.invitations.length ?? 0) === 0 ? (
            <div className="p-6">
              <EmptyState icon={<Mail className="h-5 w-5" />} title="Aucune invitation en cours" description="Invitez un nouveau membre depuis le bouton en haut." className="border-0 bg-transparent" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data!.invitations.map((inv) => {
                const link = `${typeof window !== "undefined" ? window.location.origin : ""}/rejoindre?invitation=${inv.token}`;
                return (
                  <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{inv.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {SHOP_ROLE_LABEL[inv.role]} · expire le {new Date(inv.expires_at).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize">{inv.status}</Badge>
                    {inv.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Lien copié"); }}>
                          <Copy className="mr-2 h-4 w-4" />Copier le lien
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revokeInv.mutate(inv.id)}>Révoquer</Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      )}
    </PageContainer>
  );
}

function InviteDialog({ shopId, onCreated }: { shopId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShopRole>("employee");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!email.trim()) return;
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase.from("shop_invitations").insert({
      shop_id: shopId, email: email.trim().toLowerCase(), role, token, invited_by: u.user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logActivity({ shopId, entityType: "invitation", action: "invitation.created", metadata: { email, role } });
    toast.success("Invitation créée");
    setOpen(false);
    setEmail("");
    onCreated();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-2 h-4 w-4" />Inviter
      </Button>
      <DialogShell
        open={open}
        onOpenChange={setOpen}
        title="Inviter un membre"
        description="La personne recevra un lien à ouvrir avec l'adresse ci-dessous."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving || !email.trim()}>
              {saving ? "Création…" : "Créer l'invitation"}
            </Button>
          </>
        }
      >
        <FormSection>
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="collaborateur@boutique.fr" />
          </div>
          <div className="space-y-1.5">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as ShopRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["employee", "technician", "shop_manager"] as ShopRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{SHOP_ROLE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FormSection>
      </DialogShell>
    </>
  );
}