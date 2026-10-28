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
  const [registration, setRegistration] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<Array<{ id: string; title: string; status: string; created_at: string }>>([]);
  const [application, setApplication] = useState<{ id: string; status: string; created_at: string; message: string } | null>(null);

  async function load(id: string) {
    const db = supabase as any;
    const [p, r, a] = await Promise.all([
      db.from("independent_profiles").select("*").eq("user_id", id).maybeSingle(),
      db.from("independent_requests").select("id,title,status,created_at").eq("independent_id", id).order("created_at", { ascending: false }).limit(50),
      db.from("independent_applications").select("id,status,created_at,message").eq("user_id", id).maybeSingle(),
    ]);
    if (p.error || r.error || a.error) setError("Impossible de récupérer votre espace. Réessayez ultérieurement.");
    setProfile(p.data ?? null);
    setRequests(r.data ?? []);
    setApplication(a.data ?? null);
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
    const result = registration ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
    setPassword("");
    if (result.error || !result.data.user) {
      setError("Connexion impossible. Vérifiez vos identifiants.");
      setLoading(false);
      return;
    }
    if (!result.data.session) { setNotice("Vérifiez votre e-mail pour confirmer le compte."); setLoading(false); return; }
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
      display_name: profile.display_name.trim(),
      business_name: profile.business_name?.trim() || null,
      siret: profile.siret?.trim() || null,
      city: profile.city?.trim() || null,
      postal_code: profile.postal_code?.trim() || null,
      service_radius_km: profile.service_radius_km,
      bio: profile.bio?.trim() || null,
      skills: profile.skills,
    };
    const { error: saveError } = await (supabase as any).from("independent_profiles").update(payload).eq("user_id", userId);
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
          <h2 className="font-semibold">{registration ? "Inscription indépendant" : "Connexion"}</h2>
          <Input type="email" autoComplete="email" required placeholder="Adresse e-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <Input type="password" autoComplete={registration ? "new-password" : "current-password"} minLength={6} required placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} />
          <Button type="submit">{registration ? "Créer mon compte" : "Se connecter"}</Button><button type="button" className="ml-3 underline text-sm" onClick={() => setRegistration(v => !v)}>{registration ? "Se connecter" : "Créer un compte"}</button>
          <p className="text-sm text-muted-foreground">L'inscription ne donne pas le statut vérifié ni accès à des missions. Validation professionnelle obligatoire.</p>
          <Link to="/devenir-partenaire" className="block text-sm underline">Informations pour devenir partenaire</Link>
        </form> :
        <div className="mt-8 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Mon profil</h2>
            <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); setUserId(null); setProfile(null); setApplication(null); setRequests([]); }}>Se déconnecter</Button>
          </div>
          {!profile ? <form className="rounded-xl border p-6 space-y-4" onSubmit={async (event) => {
            event.preventDefault();
            if (!userId || saving) return;
            const form = event.currentTarget;
            const name = (new FormData(form).get("display_name") ?? "").toString().trim();
            if (name.length < 2 || name.length > 120) { setError("Nom professionnel invalide."); return; }
            setSaving(true); setError("");
            const { error: insertError } = await (supabase as any).from("independent_profiles").insert({ user_id: userId, display_name: name });
            if (insertError) setError("La création du profil a échoué.");
            else await load(userId);
            setSaving(false);
          }}>
            <h3 className="font-semibold">Créer mon profil indépendant</h3>
            <p className="text-sm text-muted-foreground">Aucune mission ne sera accessible sans vérification professionnelle.</p>
            <label className="block text-sm">Nom professionnel<Input name="display_name" required minLength={2} maxLength={120}/></label>
            <Button type="submit" disabled={saving}>Créer mon profil</Button>
          </form> :
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
          <section className="rounded-xl border bg-card p-6">
            <div className="flex flex-wrap justify-between gap-2"><h2 className="text-xl font-semibold">Candidature au réseau BPEI</h2><Button variant="outline" size="sm" onClick={() => userId && void load(userId)}>Actualiser</Button></div>
            <p className="mt-2 text-sm text-muted-foreground">Votre candidature sera examinée avant toute mission. La candidature est gratuite et ne garantit aucune attribution.</p>
            {!profile ? <p className="mt-4 text-sm">Créez votre profil professionnel ci-dessus avant de candidater.</p> : application ? <div role="status" className="mt-4 rounded-lg border bg-muted/30 p-4 text-sm"><p><strong>Statut :</strong> {({pending:"En attente d’examen",under_review:"En cours d’examen",approved:"Candidature approuvée",rejected:"Candidature refusée"} as Record<string,string>)[application.status] ?? application.status}</p><p className="mt-2 text-muted-foreground">Candidature déposée le {new Date(application.created_at).toLocaleDateString("fr-FR")}. Vous pouvez modifier votre profil pendant l’examen.</p></div> : <form className="mt-4 space-y-3" onSubmit={async event => {
              event.preventDefault();
              if (!userId || saving) return;
              const message = (new FormData(event.currentTarget).get("message") ?? "").toString().trim();
              if (message.length < 10 || message.length > 3000) { setError("Décrivez votre expérience en 10 à 3000 caractères."); return; }
              setSaving(true); setError(""); setNotice("");
              const { error: applicationError } = await (supabase as any).from("independent_applications").insert({ user_id: userId, message });
              if (applicationError) setError("Candidature déjà déposée ou impossible à enregistrer.");
              else { setNotice("Candidature reçue. Elle reste en attente d'examen."); await load(userId); }
              setSaving(false);
            }}>
              <label className="block text-sm">Votre expérience et vos compétences
                <Textarea name="message" required minLength={10} maxLength={3000} rows={4} />
              </label>
              <Button type="submit" disabled={saving}>Envoyer ma candidature</Button>
            </form>}
          </section>
          <section>
            <h2 className="text-xl font-semibold">Mes demandes</h2>
            {requests.length ? <ul className="mt-4 space-y-3">{requests.map(r => <li key={r.id} className="rounded-lg border p-4">
              <strong>{r.title}</strong><span className="ml-3 text-sm text-muted-foreground">{({new:"Nouvelle mission",accepted:"Acceptée",in_progress:"En cours",completed:"Terminée",cancelled:"Refusée / annulée"} as Record<string,string>)[r.status]??r.status}</span>
              {r.status==="new" && <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={saving} onClick={async()=>{
                  if(!userId)return;setSaving(true);setError("");const {error:e}=await (supabase as any).rpc("respond_independent_request",{p_request_id:r.id,p_response:"accepted"});
                  if(e)setError("Impossible d'accepter cette mission.");else await load(userId);setSaving(false);
                }}>Accepter</Button>
                <Button variant="outline" size="sm" disabled={saving} onClick={async()=>{
                  if(!userId||!window.confirm("Refuser cette mission ? Elle pourra être réattribuée."))return;
                  setSaving(true);setError("");const {error:e}=await (supabase as any).rpc("respond_independent_request",{p_request_id:r.id,p_response:"declined"});
                  if(e)setError("Impossible de refuser cette mission.");else await load(userId);setSaving(false);
                }}>Refuser</Button>
              </div>}
            </li>)}</ul> : <p className="mt-3 text-muted-foreground">Aucune demande attribuée pour l'instant.</p>}
          </section>
        </div>}
    </section>
  </PublicShell>;
}
