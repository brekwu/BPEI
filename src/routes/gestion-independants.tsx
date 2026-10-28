import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBpeiAdminAccess } from "@/lib/use-bpei-admin-access";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";
import { AdminInquiries } from "@/components/admin/AdminInquiries";
import { AdminLegalDocuments } from "@/components/admin/AdminLegalDocuments";
import { ProfessionalVerificationPanel } from "@/components/admin/ProfessionalVerificationPanel";
import { isVerificationCurrent, type ProfessionalCheck } from "@/lib/bpei-professional-verification";

export const Route = createFileRoute("/gestion-independants")({
  component: IndependentReview,
  head: () => ({ meta: [{ title: "Gestion des candidatures — BPEI" }, { name: "robots", content: "noindex,nofollow" }] }),
});

type Candidate = {
  id: string; user_id: string; status: string; message: string; created_at: string;
  reviewed_at: string | null;
};
type Profile = {
  user_id: string; display_name: string; business_name: string | null;
  siret: string | null; city: string | null; verified_at: string | null;
};

function IndependentReview() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [applications, setApplications] = useState<Candidate[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [checks, setChecks] = useState<Record<string, ProfessionalCheck>>({});
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const access = useBpeiAdminAccess();
  const loadEpoch = useRef(0);

  function clearAdminData() {
    setApplications([]);
    setProfiles({});
    setChecks({});
  }

  async function load(): Promise<boolean> {
    if (access !== "allowed") return false;
    const run = ++loadEpoch.current;
    const current = () => run === loadEpoch.current;
    setLoading(true);
    setMessage("");
    try {
      const user = await supabase.auth.getUser();
      if (!current()) return false;
      if (user.error) {
        setAuthorized(false);
        clearAdminData();
        setMessage("Impossible de vérifier la session. Réessayez.");
        return false;
      }
      if (!user.data.user) {
        setAuthorized(false);
        clearAdminData();
        return false;
      }
      const db = supabase as any;
      const permission = await db.from("independent_admins")
        .select("user_id").eq("user_id", user.data.user.id).maybeSingle();
      if (!current()) return false;
      if (permission.error) {
        setAuthorized(false);
        clearAdminData();
        setMessage("Impossible de vérifier les droits administrateur. Réessayez.");
        return false;
      }
      if (!permission.data) {
        setAuthorized(false);
        clearAdminData();
        return false;
      }
      setAuthorized(true);
      const [a, p, v] = await Promise.all([
        db.from("independent_applications").select("id,user_id,status,message,created_at,reviewed_at").order("created_at", { ascending: false }).limit(200),
        db.from("independent_profiles").select("user_id,display_name,business_name,siret,city,verified_at").limit(200),
        db.from("independent_verification_checks").select("user_id,siret,checked_at,evidence_source,evidence_reference,insurance_confirmed,insurance_expires_on,insurance_evidence_reference").limit(200),
      ]);
      if (!current()) return false;
      if (a.error || p.error || v.error) {
        clearAdminData();
        setMessage("Lecture impossible. Vérifiez vos autorisations et réessayez.");
        return false;
      }
      setApplications(a.data ?? []);
      const byId: Record<string, Profile> = {};
      for (const row of (p.data ?? []) as Profile[]) byId[row.user_id] = row;
      setProfiles(byId);
      setChecks(Object.fromEntries((v.data??[]).map((check:ProfessionalCheck)=>[check.user_id,check])));
      return true;
    } catch {
      if (!current()) return false;
      setAuthorized(false);
      clearAdminData();
      setMessage("Service d'administration temporairement indisponible. Réessayez.");
      return false;
    } finally {
      if (current()) setLoading(false);
    }
  }

  useEffect(() => {
    if (access === "allowed") {
      void load();
    } else {
      // Clear cached applications, profiles and verification checks on auth transitions.
      ++loadEpoch.current;
      setAuthorized(false);
      clearAdminData();
      setMessage("");
      setLoading(false);
    }
  }, [access]);

  async function review(id: string, next: "under_review" | "approved" | "rejected") {
    if (busyId || !authorized || access !== "allowed") return;
    if(next==="approved"){
      const candidate=applications.find(a=>a.id===id);
      const verified=!!candidate && isVerificationCurrent(checks[candidate.user_id],profiles[candidate.user_id]?.siret);
      if(!verified){setMessage("Une vérification officielle récente de l'entreprise et de l'identité est obligatoire avant l'approbation.");return;}
      if(typeof window!=="undefined" && !window.confirm("Approuver cette candidature après vérification des justificatifs ?"))return;
    }
    if (next === "rejected" && typeof window !== "undefined" &&
        !window.confirm("Confirmer le refus de cette candidature ?")) return;
    setBusyId(id);
    setMessage("");
    try {
      const { error } = await (supabase as any).rpc("review_independent_application", {
        p_application_id: id, p_new_status: next,
      });
      if (error) {
        setMessage("Action refusée : compte administrateur ou vérification professionnelle non conforme.");
        return;
      }
      if (await load()) setMessage("Statut mis à jour.");
      else setMessage("Décision enregistrée, mais sa confirmation est indisponible. Actualisez avant de réessayer.");
    } catch {
      setMessage("Impossible de confirmer l'opération. Actualisez avant de réessayer.");
    } finally {
      setBusyId(null);
    }
  }

  return <PublicShell><main className="mx-auto max-w-5xl px-4 py-12 md:px-6">
    <h1 className="text-3xl font-bold">Gestion des indépendants BPEI</h1>
    <p className="mt-2 text-sm text-muted-foreground">Accès réservé aux administrateurs explicitement autorisés. Les approbations doivent suivre une vérification humaine.</p>
    <p className="mt-3"><Link to="/espace-independant" className="text-sm underline">Espace indépendant</Link></p>
    {access === "loading" || loading ? <p className="mt-8" role="status">Chargement des candidatures…</p> :
      access !== "allowed" || !authorized ? <div className="mt-8 rounded-lg border bg-muted/30 p-5" role="alert">
        <p>Accès administrateur non autorisé pour ce compte.</p>
        {message && <p className="mt-2 text-sm">La vérification a échoué temporairement. Vous pouvez réessayer.</p>}
        <Button variant="outline" className="mt-3" onClick={() => void load()}>Réessayer</Button>
      </div> :
      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Candidatures ({applications.length})</h2>
          <Button variant="outline" onClick={() => void load()}>Actualiser</Button>
        </div>
        {applications.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Aucune candidature reçue.</p>}
        <div className="mt-5 space-y-4">
          {applications.map(a => {
            const p = profiles[a.user_id];
            return <article key={a.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div><h3 className="font-semibold">{p?.display_name ?? "Profil manquant"}</h3>
                  <p className="text-sm text-muted-foreground">{p?.city ?? "Ville non indiquée"} · SIRET : {p?.siret ?? "non fourni"}</p>
                  {p?.business_name && <p className="text-sm">{p.business_name}</p>}
                </div>
                <span className="text-sm font-medium">{a.status} {p?.verified_at ? "· Vérifié" : ""}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{a.message}</p>
              <p className="mt-3 text-xs text-muted-foreground">Déposée le {new Date(a.created_at).toLocaleDateString("fr-FR")}</p>
              <ProfessionalVerificationPanel userId={a.user_id} siret={p?.siret??null} check={checks[a.user_id]} onRecorded={load}/>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" disabled={!!busyId || a.status === "under_review"} onClick={() => void review(a.id, "under_review")}>Examiner</Button>
                <Button disabled={!!busyId || a.status === "approved" || !isVerificationCurrent(checks[a.user_id],p?.siret)} onClick={() => void review(a.id, "approved")}>Approuver</Button>
                <Button variant="destructive" disabled={!!busyId || a.status === "rejected"} onClick={() => void review(a.id, "rejected")}>Refuser</Button>
              </div>
            </article>;
          })}
        </div>
        <AdminInquiries />
        <AdminLegalDocuments />
      </section>}
    {message && <p className="mt-5 text-sm" role="status">{message}</p>}
  </main></PublicShell>;
}
