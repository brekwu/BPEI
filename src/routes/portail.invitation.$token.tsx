import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { acceptPortalInvitation } from "@/lib/customer-portal.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/portail/invitation/$token")({
  head: () => ({ meta: [{ title: "Invitation portail — BPEI" }, { name: "robots", content: "noindex" }] }),
  component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const acceptFn = useServerFn(acceptPortalInvitation);
  const [state, setState] = useState<"checking" | "need-auth" | "accepting" | "ok" | "error">("checking");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) setState("need-auth");
        return;
      }
      if (cancelled) return;
      setState("accepting");
      try {
        await acceptFn({ data: { token } });
        if (cancelled) return;
        setState("ok");
        setTimeout(() => navigate({ to: "/portail" }), 1200);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erreur");
        setState("error");
      }
    })();
    return () => { cancelled = true; };
  }, [acceptFn, navigate, token]);

  return (
    <div className="min-h-dvh bg-surface-muted grid place-items-center px-4">
      <div className="bpei-surface max-w-md w-full p-8 text-center space-y-4">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-electric/10 text-electric">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-bold text-navy">Invitation portail client</h1>

        {state === "checking" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Vérification…
          </div>
        )}

        {state === "need-auth" && (
          <>
            <p className="text-sm text-muted-foreground">
              Pour accepter cette invitation, connectez-vous ou créez un compte. Vous serez redirigé automatiquement.
            </p>
            <Button asChild className="bg-electric text-electric-foreground hover:bg-electric/90 w-full">
              <Link to="/auth" search={{ redirect: `/portail/invitation/${token}` } as never}>
                Se connecter / créer un compte
              </Link>
            </Button>
          </>
        )}

        {state === "accepting" && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Activation de votre accès…
          </div>
        )}

        {state === "ok" && (
          <>
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <p className="text-sm">Accès activé. Redirection vers votre espace…</p>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className="h-10 w-10 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{error}</p>
            <Button asChild variant="outline" className="w-full">
              <Link to="/portail">Aller à mon espace</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}