import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { bpeiAuthRedirect, isExplicitBpeiRecoveryLink, isMatchingBpeiImplicitRecoverySession } from "@/lib/bpei-auth-redirect";

export const Route = createFileRoute("/reinitialiser-mot-de-passe")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Réinitialiser mon mot de passe — BPEI" },
      { name: "robots", content: "noindex,nofollow" }
    ]
  })
});

function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Keep SSR controls disabled until React attaches its event listeners.
  // Otherwise fast WebKit users can type before hydration and submit stale state.
  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    let alive = true;
    // Both implicit and PKCE recovery links are handled by supabase-js.
    // Only show the password update form when a valid session is available.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (alive && event === "PASSWORD_RECOVERY" && session) {
        setRecovery(true);
        setNotice("");
        setError("");
      }
    });
    // A pre-existing signed-in session is NOT evidence of a recovery link.
    // The password update form is unlocked only by Supabase's PASSWORD_RECOVERY event.
    if (isExplicitBpeiRecoveryLink(window.location.search,window.location.hash)) {
      setNotice("Vérification du lien en cours. Si le formulaire n'apparaît pas, demandez un nouveau lien.");
      // The SDK may process implicit recovery before this component mounts.
      // A stale, unrelated session must NOT permit changing its password.
      const hash=window.location.hash;
      const fragment=new URLSearchParams(hash.replace(/^#/,""));
      if(fragment.get("type")==="recovery"&&fragment.get("access_token")&&fragment.get("refresh_token")){
        void supabase.auth.getSession().then(({data,error})=>{
          if(alive&&!error&&isMatchingBpeiImplicitRecoverySession(hash,data.session?.access_token)){
            setRecovery(true);
            setNotice("");
            setError("");
          }
        }).catch(()=>{
          if(alive)setError("Lien de récupération invalide ou expiré. Demandez un nouveau lien.");
        });
      }
    }
    return () => { alive = false; subscription.unsubscribe(); };
  }, []);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const redirectTo = bpeiAuthRedirect(window.location.origin, "/reinitialiser-mot-de-passe");
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      if (authError) {
        setError("La demande n'a pas pu être envoyée. Vérifiez le service e-mail et réessayez.");
      } else {
        // Avoid disclosing whether the email belongs to an account.
        setNotice("Si un compte existe avec cette adresse, un lien de réinitialisation sera envoyé.");
      }
    } catch {
      setError("Service temporairement indisponible.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 12 || password !== confirm) {
      setError("Utilisez au moins 12 caractères et deux mots de passe identiques.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("Modification impossible. Ce lien peut être expiré. Demandez un nouveau lien.");
      } else {
        await supabase.auth.signOut();
        setPassword("");
        setConfirm("");
        setDone(true);
        setRecovery(false);
      }
    } catch {
      setError("Service temporairement indisponible. Réessayez ou demandez un nouveau lien.");
    } finally {
      setBusy(false);
    }
  }

  return <PublicShell><main className="mx-auto max-w-md px-4 py-16">
    <h1 className="text-3xl font-bold">Réinitialiser mon mot de passe</h1>
    <p className="mt-3 text-sm text-muted-foreground">Accès réservé aux comptes déjà créés. L'inscription publique peut rester fermée.</p>
    {error && <p role="alert" className="mt-5 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="mt-5 text-sm">{notice}</p>}
    {done ? <div className="mt-8 rounded-lg border p-5">
      <p role="status">Votre mot de passe a été modifié.</p>
      <Link to="/espace-independant" className="mt-3 inline-block underline">Se connecter</Link>
    </div> : recovery ? <form onSubmit={updatePassword} className="mt-8 space-y-5 rounded-xl border bg-card p-6">
      <label className="block text-sm font-medium">Nouveau mot de passe
        <Input type="password" autoComplete="new-password" required minLength={12} value={password} onChange={e=>setPassword(e.target.value)} disabled={!hydrated || busy} />
      </label>
      <label className="block text-sm font-medium">Confirmer le mot de passe
        <Input type="password" autoComplete="new-password" required minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)} disabled={!hydrated || busy} />
      </label>
      <Button type="submit" disabled={busy || !hydrated}>{busy ? "Modification…" : "Enregistrer le mot de passe"}</Button>
    </form> : <form onSubmit={requestReset} className="mt-8 space-y-5 rounded-xl border bg-card p-6">
      <label className="block text-sm font-medium">Adresse e-mail du compte
        <Input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} disabled={!hydrated || busy} />
      </label>
      <Button type="submit" disabled={busy || !hydrated}>{busy ? "Envoi…" : "Recevoir un lien de réinitialisation"}</Button>
    </form>}
    <Link to="/espace-independant" className="mt-6 inline-block text-sm underline">Retour à la connexion</Link>
  </main></PublicShell>;
}
