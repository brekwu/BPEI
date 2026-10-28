import {useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {isVerificationCurrent,type ProfessionalCheck} from "@/lib/bpei-professional-verification";

type Source = "annuaire_entreprises" | "rne_inpi" | "repertoire_sirene";

export function ProfessionalVerificationPanel({
 userId,siret,check,onRecorded
}:{
 userId:string; siret:string|null;check:ProfessionalCheck|undefined;onRecorded:()=>Promise<void>
}) {
 const [source,setSource]=useState<Source>("annuaire_entreprises");
 const [reference,setReference]=useState("");
 const [enterpriseActive,setEnterpriseActive]=useState(false);
 const [establishmentActive,setEstablishmentActive]=useState(false);
 const [identityConfirmed,setIdentityConfirmed]=useState(false);
 const [sending,setSending]=useState(false);
 const [feedback,setFeedback]=useState("");
 const current=isVerificationCurrent(check,siret);
 const ready=!!siret&&/^[0-9]{14}$/.test(siret)&&enterpriseActive&&establishmentActive&&identityConfirmed&&reference.trim().length>=20&&reference.trim().length<=700;
 async function save() {
  if(!ready || sending || !siret)return;
  if(!window.confirm("Je confirme avoir examiné une source officielle récente, vérifié l'activité de l'entreprise et de l'établissement, et contrôlé le lien entre le candidat et l'entreprise."))return;
  setSending(true);setFeedback("");
  const {error}=await (supabase as any).rpc("record_independent_verification",{
    p_user_id:userId,p_siret:siret,
    p_enterprise_active:enterpriseActive,p_establishment_active:establishmentActive,
    p_identity_confirmed:identityConfirmed,p_evidence_source:source,
    p_evidence_reference:reference.trim()
  });
  setSending(false);
  if(error){setFeedback("Enregistrement refusé. Vérifiez le compte du candidat, le SIRET, les justificatifs et vos droits administrateur.");return;}
  setFeedback("Contrôle documenté enregistré. L'approbation peut maintenant être examinée.");
  setEnterpriseActive(false);setEstablishmentActive(false);setIdentityConfirmed(false);setReference("");
  await onRecorded();
 }
 return <section className="mt-4 rounded-lg border bg-muted/20 p-4" aria-label="Contrôle du professionnel">
  <h4 className="text-sm font-semibold">Vérification de l'entreprise et de l'identité</h4>
  {current ? <p className="mt-2 text-sm" role="status">Contrôle enregistré le {new Date(check.checked_at).toLocaleDateString("fr-FR")} — SIRET correspondant. Validité maximale : 30 jours.</p> :
   <p className="mt-2 text-sm text-muted-foreground">Aucune vérification récente valable pour le SIRET actuel. Impossible d'approuver sans justificatifs.</p>}
  {!siret || !/^[0-9]{14}$/.test(siret) ? <p className="mt-2 text-sm text-destructive">Le candidat doit d'abord renseigner un SIRET à 14 chiffres.</p> :
  <>
   <p className="mt-2 text-sm">SIRET à vérifier : <strong>{siret}</strong>. Ouvrez les registres officiels et comparez les données et justificatifs du candidat.</p>
   <div className="mt-2 flex flex-wrap gap-4 text-sm">
    <a className="underline" href="https://annuaire-entreprises.data.gouv.fr/" target="_blank" rel="noopener noreferrer">Annuaire des Entreprises</a>
    <a className="underline" href="https://data.inpi.fr/" target="_blank" rel="noopener noreferrer">Registre national des entreprises (INPI)</a>
   </div>
   <label className="mt-3 block text-sm">Source utilisée
    <select className="mt-1 block w-full max-w-md rounded-md border bg-background p-2" value={source} onChange={e=>setSource(e.target.value as Source)}>
     <option value="annuaire_entreprises">Annuaire des Entreprises (DINUM)</option>
     <option value="rne_inpi">RNE / INPI</option>
     <option value="repertoire_sirene">Répertoire Sirene</option>
    </select>
   </label>
   <label className="mt-3 block text-sm">Référence contrôlable du justificatif (20 à 700 caractères)
    <textarea required rows={3} minLength={20} maxLength={700} className="mt-1 block w-full rounded-md border bg-background p-2 text-sm" placeholder="Date, référence officielle, dénomination et type de pièce examinée. Ne collez pas de pièce d'identité ni de données sensibles." value={reference} onChange={e=>setReference(e.target.value)}/>
   </label>
   <div className="mt-3 space-y-2 text-sm">
    <label className="flex gap-2"><input type="checkbox" checked={enterpriseActive} onChange={e=>setEnterpriseActive(e.target.checked)}/>Entreprise active confirmée dans une source officielle</label>
    <label className="flex gap-2"><input type="checkbox" checked={establishmentActive} onChange={e=>setEstablishmentActive(e.target.checked)}/>Établissement correspondant au SIRET actif</label>
    <label className="flex gap-2"><input type="checkbox" checked={identityConfirmed} onChange={e=>setIdentityConfirmed(e.target.checked)}/>Lien entre le candidat et l'entreprise vérifié sur justificatifs</label>
   </div>
   <Button className="mt-4" size="sm" disabled={!ready||sending} variant="outline" onClick={()=>void save()}>{sending?"Enregistrement…":"Enregistrer la vérification"}</Button>
  </>}
  {feedback&&<p className="mt-3 text-sm" role="status">{feedback}</p>}
 </section>;
}
