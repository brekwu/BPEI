import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createPortalInvitation,
  listPortalInvitations,
  revokePortalInvitation,
  removePortalLink,
} from "@/lib/customer-portal.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Mail, ShieldCheck, Trash2, UserRoundCheck } from "lucide-react";

type Props = { customerId: string; customerEmail: string | null };

function invitationLink(token: string) {
  if (typeof window === "undefined") return `/portail/invitation/${token}`;
  return `${window.location.origin}/portail/invitation/${token}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  revoked: "Révoquée",
  expired: "Expirée",
};

export function PortalInvitations({ customerId, customerEmail }: Props) {
  const listFn = useServerFn(listPortalInvitations);
  const createFn = useServerFn(createPortalInvitation);
  const revokeFn = useServerFn(revokePortalInvitation);
  const removeLinkFn = useServerFn(removePortalLink);
  const qc = useQueryClient();
  const [lastToken, setLastToken] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["portal-invitations", customerId],
    queryFn: () => listFn({ data: { customerId } }),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { customerId } }),
    onSuccess: (res) => {
      setLastToken(res.token);
      toast.success("Invitation créée. Copiez le lien et transmettez-le au client.");
      qc.invalidateQueries({ queryKey: ["portal-invitations", customerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Invitation révoquée");
      qc.invalidateQueries({ queryKey: ["portal-invitations", customerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => removeLinkFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Accès portail retiré");
      qc.invalidateQueries({ queryKey: ["portal-invitations", customerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(invitationLink(token));
      toast.success("Lien copié");
    } catch {
      toast.error("Impossible de copier");
    }
  }

  const canInvite = !!customerEmail;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-electric" />
          Portail client
        </CardTitle>
        <Button
          size="sm"
          onClick={() => createMut.mutate()}
          disabled={!canInvite || createMut.isPending}
          className="bg-electric text-electric-foreground hover:bg-electric/90"
        >
          <Mail className="mr-2 h-4 w-4" />
          Inviter
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canInvite && (
          <p className="text-xs text-muted-foreground">
            Ajoutez un email au client pour pouvoir l'inviter à son portail.
          </p>
        )}

        {lastToken && (
          <div className="rounded-md border border-electric/40 bg-electric/5 p-3 text-xs space-y-2">
            <div className="font-medium">Lien d'invitation à transmettre :</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-surface px-2 py-1 font-mono">{invitationLink(lastToken)}</code>
              <Button size="sm" variant="outline" onClick={() => copyLink(lastToken)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-muted-foreground">
              Ce lien est à usage unique. Le client doit se créer un compte (ou se connecter) puis cliquer sur ce lien.
            </p>
          </div>
        )}

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
            <UserRoundCheck className="h-3.5 w-3.5" />
            Accès actifs ({q.data?.links.length ?? 0})
          </div>
          {q.data?.links.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun compte client rattaché.</p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {q.data?.links.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div>
                    <div className="font-mono">{l.user_id.slice(0, 8)}…</div>
                    <div className="text-muted-foreground">
                      {l.linked_via === "invite" ? "Par invitation" : l.linked_via === "email_match" ? "Auto (email)" : "Manuel"} · {new Date(l.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeMut.mutate(l.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Invitations</div>
          {q.data?.invitations.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune invitation envoyée.</p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {q.data?.invitations.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{i.email}</div>
                    <div className="text-muted-foreground">
                      Expire {new Date(i.expires_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <Badge variant="outline" className={i.status === "accepted" ? "border-success/40 text-success" : i.status === "pending" ? "border-electric/40 text-electric" : "text-muted-foreground"}>
                    {STATUS_LABEL[i.status] ?? i.status}
                  </Badge>
                  {i.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => copyLink(i.token)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => revokeMut.mutate(i.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}