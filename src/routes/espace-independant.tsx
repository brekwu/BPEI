import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/public/PublicShell";
import { MissionIncidentPanel } from "@/components/independent/MissionIncidentPanel";
import { MissionTimeline } from "@/components/shared/MissionTimeline";
import { BpeiInbox } from "@/components/shared/BpeiInbox";
import { IndependentConnectPanel } from "@/components/independent/IndependentConnectPanel";
import { IndependentLevelStatus } from "@/components/independent/IndependentLevelStatus";
import { PartnerProspectCRM } from "@/components/independent/PartnerProspectCRM";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { missionStatusLabel, nextMissionStatus, canReadMissionClientContact } from "@/lib/bpei-mission-status";
import {formatCents} from "@/lib/bpei-commercial";
import { canRegisterIndependent, isPublishedLegalVersion } from "@/lib/bpei-launch-policy";
import { bpeiAuthRedirect } from "@/lib/bpei-auth-redirect";

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
  training_details:string;
  experience_years:number|null;
  remote_available:boolean;
  availability_notes:string;
  mission_types:string[];
  professional_stage:"preparing"|"registered";
  public_listing_opt_in:boolean;
};

function IndependentSpace() {
  const [userId, setUserId] = useState<string | null>(null);
  const dataEpoch=useRef(0);
  const [loading, setLoading] = useState(true);
  const [spaceReady, setSpaceReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registration, setRegistration] = useState(false);
  const [launch, setLaunch] = useState<{legal_documents_published:boolean;independent_registration_enabled:boolean;legal_version:string|null}|null>(null);
  const [privacyChecked,setPrivacyChecked] = useState(false);
  const [legalAccepted,setLegalAccepted] = useState(false);
  const [acceptChecked,setAcceptChecked] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<Array<{ id: string; title: string; status: string; created_at: string; inquiry_id: string | null }>>([]);
  const [clientContacts, setClientContacts] = useState<Record<string,{ client_name:string; email:string; phone:string|null; city:string|null }>>({});
  const [remunerations,setRemunerations]=useState<Record<string,{
   id:string;request_id:string;status:string;client_price_ht_cents:number;
   technician_ht_cents:number;bpei_ht_cents:number;expense_policy:string;source:string
  }>>({});
  const [application, setApplication] = useState<{ id: string; status: string; created_at: string; message: string } | null>(null);

  function clearPrivateState() {
    setSpaceReady(false);
    setLaunch(null);
    setLegalAccepted(false);
    setProfile(null);
    setRequests([]);
    setApplication(null);
    setClientContacts({});
    setRemunerations({});
  }

  async function load(id: string): Promise<boolean> {
    const epoch=++dataEpoch.current;
    setLoading(true);
    setSpaceReady(false);
    try {
      const db = supabase as any;
      const [p, r, a, gate] = await Promise.all([
        db.from("independent_profiles").select("*").eq("user_id", id).maybeSingle(),
        db.from("independent_requests").select("id,title,status,created_at,inquiry_id").eq("independent_id", id).order("created_at", { ascending: false }).limit(50),
        db.from("independent_applications").select("id,status,created_at,message").eq("user_id", id).maybeSingle(),
        db.from("bpei_launch_controls").select("legal_documents_published,independent_registration_enabled,legal_version").eq("id",true).maybeSingle(),
      ]);
      if(epoch!==dataEpoch.current)return false;
      if (p.error || r.error || a.error || gate.error || !gate.data) {
        clearPrivateState();
        setError("Impossible de récupérer votre espace. Réessayez ultérieurement.");
        return false;
      }

      const currentGate = gate.data;
      const legalVersion = currentGate.legal_documents_published ? currentGate.legal_version : null;
      let accepted = false;
      if (legalVersion) {
        const acceptance = await db.from("bpei_legal_acceptances").select("legal_version")
          .eq("user_id",id).eq("legal_version",legalVersion).maybeSingle();
        if(epoch!==dataEpoch.current)return false;
        if (acceptance.error) {
          clearPrivateState();
          setError("Impossible de vérifier votre acceptation juridique. Réessayez.");
          return false;
        }
        accepted = !!acceptance.data;
      }

      const eligibleIds = (r.data ?? []).filter((item:{status:string;inquiry_id:string|null})=>
        canReadMissionClientContact(item.status) && item.inquiry_id
      ).map((item:{inquiry_id:string})=>item.inquiry_id);

      let contacts: Record<string,{client_name:string;email:string;phone:string|null;city:string|null}> = {};
      let contactError = false;
      if (eligibleIds.length > 0) {
        const result = await db.from("bpei_inquiries").select("id,client_name,email,phone,city").in("id",eligibleIds);
        if(epoch!==dataEpoch.current)return false;
        if (result.error) {
          contactError = true;
        } else {
          contacts = Object.fromEntries((result.data??[]).map((x:{id:string;client_name:string;email:string;phone:string|null;city:string|null})=>[x.id,x]));
        }
      }

      const paymentOfferResult=await db.from("bpei_partner_compensation_proposals")
       .select("id,request_id,status,client_price_ht_cents,technician_ht_cents,bpei_ht_cents,expense_policy,source")
       .eq("partner_id",id).limit(100);
      if(epoch!==dataEpoch.current)return false;
      if(paymentOfferResult.error){clearPrivateState();setError("Rémunération des missions indisponible. Réessayez.");return false;}
      setRemunerations(Object.fromEntries((paymentOfferResult.data??[]).map((o:any)=>[o.request_id,o])));
      setLaunch(currentGate);
      setLegalAccepted(accepted);
      setProfile(p.data ?? null);
      setRequests(r.data ?? []);
      setApplication(a.data ?? null);
      setClientContacts(contacts);
      setError(contactError
        ? "Coordonnées du client indisponibles. Contactez l'administration BPEI."
        : "");
      setSpaceReady(true);
      return true;
    } catch {
      if(epoch!==dataEpoch.current)return false;
      clearPrivateState();
      setError("Service temporairement indisponible. Actualisez votre espace pour réessayer.");
      return false;
    } finally {
      if(epoch===dataEpoch.current)setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const initialEpoch=dataEpoch.current;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(!active)return;
      if(event==="SIGNED_OUT"){
        // Includes sign-out from another tab; no pending request may restore old data.
        dataEpoch.current+=1;
        clearPrivateState();
        setUserId(null);
        setLoading(false);
      }
    });
    (supabase as any).from("bpei_launch_controls").select("legal_documents_published,independent_registration_enabled,legal_version").eq("id",true).maybeSingle().then(({data}:any)=>{
      if(active&&initialEpoch===dataEpoch.current)setLaunch(data ?? null);
    }).catch(()=>{if(active&&initialEpoch===dataEpoch.current)setLaunch(null)});
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (!active||initialEpoch!==dataEpoch.current) return;
      if (error) throw error;
      setUserId(data.user?.id ?? null);
      if (data.user) await load(data.user.id);
      else setLoading(false);
    }).catch(() => {
      if (active&&initialEpoch===dataEpoch.current) {
        clearPrivateState();
        setUserId(null);
        setError("Impossible de vérifier votre session. Réessayez.");
        setLoading(false);
      }
    });
    return () => {
      active = false;
      dataEpoch.current+=1;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if(registration && (!canRegisterIndependent(launch) || !privacyChecked)){
      setError("L'inscription n'est pas ouverte ou les informations juridiques n'ont pas été acceptées.");
      return;
    }
    if(registration && (password.length < 12 || password !== passwordConfirm)){
      setError("Choisissez un mot de passe d'au moins 12 caractères, puis confirmez-le à l'identique.");
      return;
    }
    setLoading(true);
    setNotice("");
    try {
      const result = registration ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: bpeiAuthRedirect(window.location.origin, "/espace-independant"), data: { bpei_legal_version_acknowledged: launch?.legal_version ?? null } } }) : await supabase.auth.signInWithPassword({ email, password });
      if (result.error || !result.data.user) {
        setError("Connexion impossible. Vérifiez vos identifiants et le service d'authentification.");
        return;
      }
      setPassword("");
      setPasswordConfirm("");
      if (!result.data.session) {
        setNotice("Vérifiez votre e-mail pour confirmer le compte.");
        return;
      }
      setUserId(result.data.user.id);
      await load(result.data.user.id);
    } catch {
      setError("Service d'authentification indisponible. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  async function withSaveGuard(action:()=>Promise<void>,fallbackMessage:string) {
    if(saving)return;
    setSaving(true);
    setError("");
    try{await action();}
    catch{setError(fallbackMessage);}
    finally{setSaving(false);}
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId || !profile || saving) return;
    await withSaveGuard(async()=>{
      const payload={
        display_name:profile.display_name.trim(),
        business_name:profile.business_name?.trim()||null,
        siret:profile.siret?.trim()||null,
        city:profile.city?.trim()||null,
        postal_code:profile.postal_code?.trim()||null,
        service_radius_km:profile.service_radius_km,
        bio:profile.bio?.trim()||null,
        skills:profile.skills,
        training_details:profile.training_details.trim(),
        experience_years:profile.experience_years,
        remote_available:profile.remote_available,
        availability_notes:profile.availability_notes.trim(),
        mission_types:profile.mission_types,
        professional_stage:profile.professional_stage,
        public_listing_opt_in:profile.public_listing_opt_in,
      };
      const {error:saveError}=await (supabase as any).from("independent_profiles").update(payload).eq("user_id",userId);
      if(saveError){setError("Enregistrement impossible. Vérifiez les champs et vos autorisations.");return;}
      setNotice("Profil enregistré.");await load(userId);
    },"Service indisponible pendant l'enregistrement. Réessayez.");
  }

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile(p => p ? { ...p, [key]: value } : p);

  return <PublicShell>
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <h1 className="text-3xl font-bold">Espace technicien indépendant</h1>
      <p className="mt-3 text-muted-foreground">Développez votre activité d’indépendant, valorisez vos compétences et consultez vos demandes personnelles. Les comptes existants sur l'ancienne plateforme ne sont pas transférés automatiquement.</p>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm">{notice}</p>}
      {loading ? <p className="mt-8">Chargement…</p> : !userId ?
        <form onSubmit={signIn} className="mt-8 space-y-4 rounded-xl border bg-card p-6">
          <h2 className="font-semibold">{registration ? "Inscription indépendant" : "Connexion"}</h2>
          <Input type="email" autoComplete="email" required placeholder="Adresse e-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <div className="space-y-3">
            <Input type={showPassword ? "text" : "password"} autoComplete={registration ? "new-password" : "current-password"} minLength={registration ? 12 : 1} required placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} />
            {registration && <Input type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} required placeholder="Confirmer le mot de passe" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)} />
              Afficher les mots de passe
            </label>
          </div>
          {registration && <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
            {canRegisterIndependent(launch) ?
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={privacyChecked} onChange={e=>setPrivacyChecked(e.target.checked)} required />
                <span>J'ai pris connaissance de la <Link className="underline" to="/confidentialite">politique de confidentialité</Link> et des <Link className="underline" to="/cgu">conditions d'utilisation</Link> (version {launch?.legal_version}).</span>
              </label> :
              <p role="status">Les nouvelles inscriptions sont suspendues tant que les informations juridiques du réseau n'ont pas été validées et publiées.</p>}
          </div>}
          <Button type="submit" disabled={registration && (!canRegisterIndependent(launch) || !privacyChecked || password.length<12 || password !== passwordConfirm)}>{registration ? "Créer mon compte" : "Se connecter"}</Button><button type="button" className="ml-3 underline text-sm" onClick={() => {setRegistration(v => !v);setPasswordConfirm("");setPrivacyChecked(false);setError("");}}>{registration ? "Se connecter" : "Créer un compte"}</button>
          <p className="text-sm text-muted-foreground">L'inscription ne donne pas le statut vérifié ni accès à des missions. Validation professionnelle obligatoire.</p>
          {!registration && <Link to="/reinitialiser-mot-de-passe" className="block text-sm underline">Mot de passe oublié ?</Link>}
          <Link to="/devenir-partenaire" className="block text-sm underline">Informations pour devenir partenaire</Link>
        </form> :
        !spaceReady ? <div className="mt-8 rounded-lg border bg-muted/30 p-6">
          <p role="status">L'espace indépendant est indisponible tant que vos données et autorisations n'ont pas été entièrement vérifiées.</p>
          <Button className="mt-4" onClick={() => void load(userId)}>Actualiser mon espace</Button>
        </div> :
        <div className="mt-8 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Mon profil</h2>
            <div className="flex gap-2">
              <Button variant="outline" disabled={saving} onClick={() => void load(userId)}>Actualiser mon espace</Button>
              <Button variant="outline" onClick={async () => {
                try {
                  const result = await supabase.auth.signOut();
                  if (result.error) {
                    setError("Déconnexion non confirmée. Réessayez.");
                    return;
                  }
                  dataEpoch.current+=1;
                  setUserId(null);
                  clearPrivateState();
                  setError("");
                } catch {
                  setError("Déconnexion indisponible. Réessayez.");
                }
              }}>Se déconnecter</Button>
            </div>
          </div>
          {!profile ? <form className="rounded-xl border p-6 space-y-4" onSubmit={async (event) => {
            event.preventDefault();
            if (!userId || saving) return;
            if(!legalAccepted){setError("Acceptez les informations juridiques dans la section Candidature avant de créer votre profil.");return;}
            const form = event.currentTarget;
            const name = (new FormData(form).get("display_name") ?? "").toString().trim();
            if (name.length < 2 || name.length > 120) { setError("Nom professionnel invalide."); return; }
            await withSaveGuard(async()=>{
              const {error:insertError}=await (supabase as any).from("independent_profiles").insert({user_id:userId,display_name:name});
              if(insertError){setError("La création du profil a échoué.");return;}
              await load(userId);
            },"Service indisponible pendant la création du profil.");
          }}>
            <h3 className="font-semibold">Créer mon profil indépendant</h3>
            <p className="text-sm text-muted-foreground">Aucune mission ne sera accessible sans vérification professionnelle. Avant de créer votre profil, validez les informations juridiques dans la section Candidature ci-dessous.</p>
            <label className="block text-sm">Nom professionnel<Input name="display_name" required minLength={2} maxLength={120}/></label>
            <Button type="submit" disabled={saving || !legalAccepted}>Créer mon profil</Button>
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
            <label className="block text-sm">Formation et expérience professionnelle
             <Textarea maxLength={2000} value={profile.training_details??""} onChange={e=>update("training_details",e.target.value)} placeholder="Diplômes, formations, interventions réellement pratiquées…"/></label>
            <label className="block text-sm">Années d'expérience (facultatif)
             <Input type="number" min={0} max={70} value={profile.experience_years??""} onChange={e=>update("experience_years",e.target.value===""?null:Number(e.target.value))}/></label>
            <label className="block text-sm">Situation professionnelle
             <select className="mt-1 w-full rounded border bg-background p-2" value={profile.professional_stage}
              onChange={e=>update("professional_stage",e.target.value as "preparing"|"registered")}>
              <option value="preparing">En création d'activité / sans SIRET pour l'instant</option>
              <option value="registered">Entreprise immatriculée (justificatifs à contrôler)</option>
             </select></label>
            <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={profile.remote_available} onChange={e=>update("remote_available",e.target.checked)}/>
             Je peux proposer des interventions informatiques à distance.</label>
            <label className="block text-sm">Disponibilités et types de missions souhaités
             <Textarea maxLength={800} value={profile.availability_notes??""} onChange={e=>update("availability_notes",e.target.value)} placeholder="Indiquez vos préférences librement ; aucun quota ni horaire imposé."/></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={profile.public_listing_opt_in??false}
             onChange={e=>update("public_listing_opt_in",e.target.checked)}/>
             J'autorise BPEI à afficher publiquement mon nom professionnel, mon niveau, ma ville et mes compétences effectivement validées. Cette autorisation n'active pas mon profil sans contrôle professionnel.</label>
            <label className="block text-sm">Types de missions (séparés par une virgule)
             <Input value={(profile.mission_types??[]).join(", ")} onChange={e=>update("mission_types",e.target.value.split(",").map(v=>v.trim()).filter(Boolean).slice(0,20))}
              placeholder="PC, réseaux, sauvegarde, support, distance…"/></label>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </form>}
          <section className="rounded-xl border bg-card p-6">
            <div className="flex flex-wrap justify-between gap-2"><h2 className="text-xl font-semibold">Candidature au réseau BPEI</h2><Button variant="outline" size="sm" onClick={() => userId && void load(userId)}>Actualiser</Button></div>
            <p className="mt-2 text-sm text-muted-foreground">Votre candidature sera examinée avant toute mission. La candidature est gratuite et ne garantit aucune attribution.</p>
            {!isPublishedLegalVersion(launch) ?
              <p className="mt-4 rounded-lg border bg-muted/20 p-4 text-sm">Le dépôt de candidature est suspendu en attendant la publication des informations juridiques BPEI.</p>
              : !legalAccepted ?
              <div className="mt-4 space-y-3 rounded-lg border p-4 text-sm">
                <p>Avant de candidater, prenez connaissance de la <Link to="/confidentialite" className="underline">politique de confidentialité</Link> et des <Link to="/cgu" className="underline">conditions d'utilisation</Link> (version {launch?.legal_version}).</p>
                <label className="flex items-start gap-2"><input type="checkbox" checked={acceptChecked} onChange={e=>setAcceptChecked(e.target.checked)} /><span>J'ai pris connaissance de ces documents et j'accepte les conditions d'utilisation applicables à ma candidature.</span></label>
                <Button type="button" disabled={!acceptChecked || saving} onClick={async()=>{
                  if(!userId || !launch?.legal_version)return;
                  await withSaveGuard(async()=>{
                    const {error:e}=await (supabase as any).from("bpei_legal_acceptances").insert({user_id:userId,legal_version:launch?.legal_version});
                    if(e){setError("Acceptation non enregistrée. Réessayez.");return;}
                    setLegalAccepted(true);setNotice("Informations juridiques acceptées.");
                  },"Service indisponible pendant l'acceptation juridique.");
                }}>Enregistrer mon acceptation</Button>
              </div>
              : !profile ? <p className="mt-4 text-sm">Créez votre profil professionnel ci-dessus avant de candidater.</p> : application ? <div role="status" className="mt-4 rounded-lg border bg-muted/30 p-4 text-sm"><p><strong>Statut :</strong> {({pending:"En attente d’examen",under_review:"En cours d’examen",approved:"Candidature approuvée",rejected:"Candidature refusée"} as Record<string,string>)[application.status] ?? application.status}</p><p className="mt-2 text-muted-foreground">Candidature déposée le {new Date(application.created_at).toLocaleDateString("fr-FR")}. Vous pouvez modifier votre profil pendant l’examen.</p></div> : <form className="mt-4 space-y-3" onSubmit={async event => {
              event.preventDefault();
              if (!userId || saving) return;
              const message = (new FormData(event.currentTarget).get("message") ?? "").toString().trim();
              if (message.length < 10 || message.length > 3000) { setError("Décrivez votre expérience en 10 à 3000 caractères."); return; }
              await withSaveGuard(async()=>{
                const {error:applicationError}=await (supabase as any).from("independent_applications").insert({user_id:userId,message});
                if(applicationError){setError("Candidature déjà déposée ou impossible à enregistrer.");return;}
                setNotice("Candidature reçue. Elle reste en attente d'examen.");await load(userId);
              },"Service indisponible pendant l'envoi de la candidature.");
            }}>
              <label className="block text-sm">Votre expérience et vos compétences
                <Textarea name="message" required minLength={10} maxLength={3000} rows={4} />
              </label>
              <Button type="submit" disabled={saving}>Envoyer ma candidature</Button>
            </form>}
          </section>
          {profile?.verified_at&&application?.status==="approved"&&legalAccepted&&<IndependentConnectPanel/>}
          <IndependentLevelStatus userId={userId}/>
          <PartnerProspectCRM userId={userId}/>
          <BpeiInbox />
          <section>
            <h2 className="text-xl font-semibold">Mes demandes</h2>
            {requests.length ? <ul className="mt-4 space-y-3">{requests.map(r => <li key={r.id} className="rounded-lg border p-4">
              <strong>{r.title}</strong><span className="ml-3 text-sm text-muted-foreground">{missionStatusLabel(r.status)}</span>
              <MissionIncidentPanel requestId={r.id} status={r.status} />
              <MissionTimeline missionId={r.id} />
              {r.inquiry_id && canReadMissionClientContact(r.status) && clientContacts[r.inquiry_id] && <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Contact du client — mission acceptée</p>
                <p>{clientContacts[r.inquiry_id].client_name} — {clientContacts[r.inquiry_id].city||"ville non indiquée"}</p>
                <p><a className="underline" href={"mailto:"+clientContacts[r.inquiry_id].email}>{clientContacts[r.inquiry_id].email}</a></p>
                {clientContacts[r.inquiry_id].phone && <p><a className="underline" href={"tel:"+clientContacts[r.inquiry_id].phone}>{clientContacts[r.inquiry_id].phone}</a></p>}
              </div>}
              {nextMissionStatus(r.status) !== null && <div className="mt-3">
                <Button size="sm" disabled={saving} onClick={async()=>{
                  if(!userId)return;
                  await withSaveGuard(async()=>{
                    const {error:e}=await (supabase as any).rpc("advance_independent_request",{p_request_id:r.id,p_next_status:nextMissionStatus(r.status)});
                    if(e){setError("Changement de statut impossible.");return;}
                    await load(userId);
                  },"Service indisponible pendant le changement de statut.");
                }}>{r.status==="accepted"?"Démarrer l'intervention":"Marquer l'intervention terminée"}</Button>
              </div>}
              {r.status==="new"&&remunerations[r.id]&&<div className="mt-3 rounded-md border p-3 text-sm">
               <h4 className="font-semibold">Rémunération proposée, HT</h4>
               <p>Prix client : {formatCents(remunerations[r.id].client_price_ht_cents)}
                · Votre part : <strong>{formatCents(remunerations[r.id].technician_ht_cents)}</strong>
                · BPEI : {formatCents(remunerations[r.id].bpei_ht_cents)}</p>
               <p>Origine : {remunerations[r.id].source==="partner"?"Client apporté par le technicien":remunerations[r.id].source==="bpei"?"Client apporté par BPEI":"Client apporté par un autre partenaire"}</p>
               <p>Déplacements et frais : {remunerations[r.id].expense_policy}</p>
               <p>Accord : {remunerations[r.id].status==="accepted"?"Votre rémunération est acceptée":remunerations[r.id].status==="declined"?"Rémunération refusée":"Votre décision est nécessaire"}</p>
               {remunerations[r.id].status==="proposed"&&<div className="mt-2 flex gap-2">
                <Button type="button" size="sm" disabled={saving} onClick={async()=>{
                 if(!userId||!window.confirm("Accepter les conditions de rémunération proposées avant de décider pour la mission ?"))return;
                 await withSaveGuard(async()=>{
                  const {error:e}=await (supabase as any).rpc("respond_partner_compensation",{
                   p_proposal_id:remunerations[r.id].id,p_decision:"accepted"});
                  if(e){setError("Rémunération non acceptée.");return;}
                  await load(userId);
                 },"Service indisponible pendant l'accord de rémunération.");
                }}>Accepter cette rémunération</Button>
                <Button type="button" size="sm" variant="outline" disabled={saving} onClick={async()=>{
                 if(!userId||!window.confirm("Refuser cette rémunération ? Vous restez libre de refuser la mission."))return;
                 await withSaveGuard(async()=>{
                  const {error:e}=await (supabase as any).rpc("respond_partner_compensation",{
                   p_proposal_id:remunerations[r.id].id,p_decision:"declined"});
                  if(e){setError("Refus non enregistré.");return;}
                  await load(userId);
                 },"Service indisponible pendant la décision de rémunération.");
                }}>Refuser cette rémunération</Button>
               </div>}
              </div>}
              {r.status==="new"&&!remunerations[r.id]&&<p className="mt-3 text-sm text-muted-foreground">
               Les conditions de rémunération et de déplacement doivent être transmises avant que vous puissiez accepter cette mission.
              </p>}
              {r.status==="new" && <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={saving||remunerations[r.id]?.status!=="accepted"} onClick={async()=>{
                  if(!userId)return;await withSaveGuard(async()=>{
                    const {error:e}=await (supabase as any).rpc("respond_independent_request",{p_request_id:r.id,p_response:"accepted"});
                    if(e){setError("Impossible d'accepter cette mission.");return;}
                    await load(userId);
                  },"Service indisponible pendant l'acceptation de la mission.");
                }}>Accepter la mission</Button>
                <Button variant="outline" size="sm" disabled={saving} onClick={async()=>{
                  if(!userId||!window.confirm("Refuser cette mission ? Elle pourra être réattribuée."))return;
                  await withSaveGuard(async()=>{
                    const {error:e}=await (supabase as any).rpc("respond_independent_request",{p_request_id:r.id,p_response:"declined"});
                    if(e){setError("Impossible de refuser cette mission.");return;}
                    await load(userId);
                  },"Service indisponible pendant le refus de la mission.");
                }}>Refuser</Button>
              </div>}
            </li>)}</ul> : <p className="mt-3 text-muted-foreground">Aucune demande attribuée pour l'instant.</p>}
          </section>
        </div>}
    </section>
  </PublicShell>;
}
