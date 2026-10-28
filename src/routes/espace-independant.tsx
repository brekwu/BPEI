import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/espace-independant")({
  component: IndependentSpace,
  head: () => ({ meta: [{ title: "Espace indépendant — BPEI" }, { name: "robots", content: "noindex,nofollow" }] }),
});

type Profile = {
  user_id: string;
  display_name: string;
  business_name: string | null;
  siret: string | null;
  city: string | null;
  postal_code: string | null;
  service_radius_km: number | null;
  bio: string | null;
  skills: string[];
  verified_at: string | null;
};

function IndependentSpace() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<Array<{ id: string; title: string; status: string; created_at: string }>>([]);

  async function load(id: string) {
    const db = supabase as any;
    const [p, r] = await Promise.all([
      db.from("independent_profiles").select("*").eq("user_id", id).maybeSingle(),
      db.from("independent_requests").select("id,title,status,created_at").eq("independent_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (p.error || r.error) setError("Impossible de récupérer votre espace. Réessayez ultérieurement.");
    setProfile(p.data ?? null);
    setRequests(r.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      setUserId(data.user?.id ?? null);
      if (data.user) await load(data.user.id);
      else setLoading(false);
    }).catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setPassword("");
    if (result.error || !result.data.user) {
      setError("Connexion impossible. Vérifiez vos identifiants.");
      setLoading(false);
      return;
    }
    setUserId(result.data.user.id);
    await load(result.data.user.id);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId || !profile || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      user_id: userId,
      display_name: profile.display_name.trim(),
      business_name: profile.business_name?.trim() || null,
      siret: profile.siret?.trim() || null,
      city: profile.city?.trim() || null,
      postal_code: profile.postal_code?.trim() || null,
      service_radius_km: profile.service_radius_km,
      bio: profile.bio?.trim() || null,
      skills: profile.skills,
    };
    const { error: saveError } = await (supabase as any).from("independent_profiles").upsert(payload, { onConflict: "user_id" });
    if (saveError) setError("Enregistrement impossible. Vérifiez les champs et vos autorisations.");
    else { setNotice("Profil enregistré."); await load(userId); }
    setSaving(false);
  }

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile(p => p ? { ...p, [key]: value } : p);

  return <PublicShell>
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <h1 className="text-3xl font-bold">Espace technicien indépendant</h1>
      <p className="mt-3 text-muted-foreground">Gérez votre profil et consultez vos demandes personnelles. Les comptes existants sur l'ancienne plateforme ne sont pas transférés automatiquement.</p>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm">{notice}</p>}
      {loading ? <p className="mt-8">Chargement…</p> : !userId ?
        <form onSubmit={signIn} className="mt-8 space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-semibold">Connexion</h2>
          <Input type="email" autoComplete="email" required placeholder="Adresse e-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <Input type="password" autoComplete="current-password" required placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} />
          <Button type="submit">Se connecter</Button>
          <p className="text-sm text-muted-foreground">Les nouvelles inscriptions seront ouvertes après vérification des conditions légales et du processus de validation.</p>
          <Link to="/devenir-partenaire" className="block text-sm underline">Informations pour devenir partenaire</Link>
        </form> :
        <div className="mt-8 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Mon profil</h2>
            <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); setUserId(null); setProfile(null); setRequests([]); }}>Se déconnecter</Button>
          </div>
          {!profile ? <p>Aucun profil indépendant n'est encore associé à ce compte. La création de profil est réservée aux comptes autorisés.</p> :
          <form onSubmit={save} className="space-y-4 rounded-xl border bg-card p-6">
            <p className="text-sm">{profile.verified_at ? "Profil vérifié par BPEI" : "Profil non encore vérifié"}</p>
            <label className="block text-sm">Nom affiché <Input required minLength={2} maxLength={120} value={profile.display_name} onChange={e => update("display_name", e.target.value)} /></label>
            <label className="block text-sm">Nom commercial <Input maxLength={160} value={profile.business_name ?? ""} onChange={e => update("business_name", e.target.value)} /></label>
            <label className="block text-sm">SIRET <Input maxLength={14} value={profile.siret ?? ""} onChange={e => update("siret", e.target.value)} /></label>
            <label className="block text-sm">Ville <Input maxLength={120} value={profile.city ?? ""} onChange={e => update("city", e.target.value)} /></label>
            <label className="block text-sm">Code postal <Input maxLength={12} value={profile.postal_code ?? ""} onChange={e => update("postal_code", e.target.value)} /></label>
            <label className="block text-sm">Rayon d'intervention (km) <Input type="number" min={0} max={500} value={profile.service_radius_km ?? ""} onChange={e => update("service_radius_km", e.target.value === "" ? null : Number(e.target.value))} /></label>
            <label className="block text-sm">Présentation <Textarea maxLength={2000} value={profile.bio ?? ""} onChange={e => update("bio", e.target.value)} /></label>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </form>}
          <section>
            <h2 className="text-xl font-semibold">Mes demandes</h2>
            {requests.length ? <ul className="mt-4 space-y-3">{requests.map(r => <li key={r.id} className="rounded-lg border p-4"><strong>{r.title}</strong><span className="ml-3 text-sm text-muted-foreground">{r.status}</span></li>)}</ul> : <p className="mt-3 text-muted-foreground">Aucune demande attribuée pour l'instant.</p>}
          </section>
        </div>}
    </section>
  </PublicShell>;
}
