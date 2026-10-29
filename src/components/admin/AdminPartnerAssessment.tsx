import {useCallback,useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {tierName} from "@/lib/bpei-partner-levels";

type Question={level:number;ordinal:number;domain:string;question:string;evaluator_answer:string};
type Level={level:number|null;authorization_state:"candidate"|"active"|"suspended";decision_note:string};
type Assessment={id:string;tested_level:number;knowledge_score:number;practical_score:number;
 interview_score:number;decision:string;summary:string;created_at:string};
export function AdminPartnerAssessment({userId,displayName}:{
 userId:string;displayName:string
}){
 const [questions,setQuestions]=useState<Question[]>([]);
 const [level,setLevel]=useState<Level|null>(null);
 const [history,setHistory]=useState<Assessment[]>([]);
 const [selected,setSelected]=useState(1);
 const [score,setScore]=useState("0");
 const [practical,setPractical]=useState("0");
 const [interview,setInterview]=useState("0");
 const [method,setMethod]=useState("written_practical_video");
 const [decision,setDecision]=useState("not_qualified");
 const [reference,setReference]=useState("");
 const [summary,setSummary]=useState("");
 const [authorizationReason,setAuthorizationReason]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [showAnswers,setShowAnswers]=useState(false);
 const load=useCallback(async()=>{
  const db=supabase as any;
  const [q,l,a]=await Promise.all([
   db.from("bpei_assessment_questions")
    .select("level,ordinal,domain,question,evaluator_answer").eq("level",selected).order("ordinal"),
   db.from("bpei_technician_levels").select("level,authorization_state,decision_note")
    .eq("user_id",userId).maybeSingle(),
   db.from("bpei_technician_assessments")
    .select("id,tested_level,knowledge_score,practical_score,interview_score,decision,summary,created_at")
    .eq("user_id",userId).order("created_at",{ascending:false}).limit(10)
  ]);
  if(q.error||l.error||a.error)throw Error("data unavailable");
  setQuestions(q.data??[]);setLevel(l.data??null);setHistory(a.data??[]);
 },[userId,selected]);
 useEffect(()=>{
  let active=true;
  load().catch(()=>{if(active)setError("Questionnaire indisponible : vérifiez les droits administrateur.");});
  return ()=>{active=false;setQuestions([]);setLevel(null);setHistory([])};
 },[load]);
 async function run(action:()=>Promise<unknown>){
  setBusy(true);setError("");setNotice("");
  try{
   const data=await action();
   if(data&&typeof data==="object"&&"error" in data&&(data as any).error)
    throw Error("server denied");
   await load();
   setNotice("Évaluation ou décision enregistrée par le serveur.");
  }catch{setError("Opération refusée. Vérifiez la preuve, l'aptitude, le statut professionnel et vos droits.");}
  finally{setBusy(false);}
 }
 const numeric=(value:string,max:number)=>/^\d+$/.test(value)&&Number(value)>=0&&Number(value)<=max;
 const canRecord=questions.length===25&&numeric(score,25)&&numeric(practical,20)&&numeric(interview,10)
  &&reference.trim().length>=20&&summary.trim().length>=40;
 function record(){
  if(!canRecord||busy)return;
  if(!window.confirm("Confirmer la notation à partir d'une évaluation réellement réalisée ? Aucune compétence ne doit être inventée."))return;
  void run(()=> (supabase as any).rpc("record_partner_assessment",{
   p_user_id:userId,p_tested_level:selected,p_knowledge_score:Number(score),
   p_practical_score:Number(practical),p_interview_score:Number(interview),
   p_method:method,p_evidence_reference:reference.trim(),p_decision:decision,p_summary:summary.trim()
  }));
 }
 function authorize(action:"activate"|"suspend"){
  if(busy||!level?.level||authorizationReason.trim().length<30)return;
  if(!window.confirm(action==="activate"
   ?"Activer ce partenaire uniquement si son identité, SIRET, RC Pro, contrat et compétences sont réellement validés ?"
   :"Suspendre le partenaire et bloquer l'accès à de nouvelles missions ?"))return;
  void run(()=> (supabase as any).rpc("set_partner_authorization",{
   p_user_id:userId,p_action:action,p_reason:authorizationReason.trim()
  }));
 }
 return <section aria-label={"Évaluation de "+displayName} className="mt-4 rounded-lg border p-4">
  <h4 className="font-semibold">Évaluation technique et niveaux</h4>
  <p className="mt-2 text-sm">Niveau attribué : <strong>{level?.level?tierName(level.level):"Non évalué"}</strong> · Accès aux missions : <strong>{
   level?.authorization_state==="active"?"Autorisé":
   level?.authorization_state==="suspended"?"Suspendu":"Non autorisé"
  }</strong>. Le nombre de missions ne produit pas de promotion automatique.</p>
  <div className="mt-3 flex flex-wrap items-center gap-3">
   <label className="text-sm">Niveau à tester
    <select className="ml-2 rounded border bg-background p-2" value={selected}
     onChange={e=>{setSelected(Number(e.target.value));setShowAnswers(false)}}>
     {[1,2,3,4].map(n=><option value={n} key={n}>{tierName(n)}</option>)}
    </select>
   </label>
   <Button size="sm" type="button" variant="outline" onClick={()=>setShowAnswers(x=>!x)}>
    {showAnswers?"Masquer les corrigés":"Afficher les corrigés administrateur"}
   </Button>
  </div>
  <p className="mt-2 text-xs text-muted-foreground">25 questions par niveau. Les réponses ne sont lisibles que par les administrateurs autorisés en base. Faire passer le test, vérifier la pratique et réaliser l'entretien.</p>
  <details className="mt-3 rounded border p-3">
   <summary className="cursor-pointer text-sm font-medium">Banque de questions — {questions.length}/25</summary>
   <ol className="mt-3 space-y-3 text-sm">
    {questions.map(q=><li key={q.ordinal}>
     <strong>{q.ordinal}. {q.domain}</strong> — {q.question}
     {showAnswers&&<p className="mt-1 border-l-2 pl-2 text-muted-foreground">Réponse évaluateur : {q.evaluator_answer}</p>}
    </li>)}
   </ol>
  </details>
  <div className="mt-4 grid gap-3 sm:grid-cols-3">
   <label className="text-sm">Questionnaire /25<Input type="number" min="0" max="25" value={score} onChange={e=>setScore(e.target.value)}/></label>
   <label className="text-sm">Cas pratique /20<Input type="number" min="0" max="20" value={practical} onChange={e=>setPractical(e.target.value)}/></label>
   <label className="text-sm">Entretien /10<Input type="number" min="0" max="10" value={interview} onChange={e=>setInterview(e.target.value)}/></label>
   <label className="text-sm">Méthode
    <select className="mt-1 w-full rounded border bg-background p-2" value={method} onChange={e=>setMethod(e.target.value)}>
     <option value="written_practical_video">Écrit + pratique + visioconférence</option>
     <option value="oral_practical_video">Oral + pratique + visioconférence</option>
     <option value="in_person">En présentiel</option>
    </select>
   </label>
   <label className="text-sm">Décision
    <select className="mt-1 w-full rounded border bg-background p-2" value={decision} onChange={e=>setDecision(e.target.value)}>
     <option value="not_qualified">Niveau non validé</option>
     <option value="qualified">Niveau validé</option>
    </select>
   </label>
   <label className="text-sm sm:col-span-3">Référence vérifiable de la session (20 à 500 caractères)
    <Input required minLength={20} maxLength={500} value={reference} onChange={e=>setReference(e.target.value)}/></label>
   <label className="text-sm sm:col-span-3">Compte-rendu motivé : compétences, lacunes, cas pratique, expérience (40 à 2000 caractères)
    <Textarea required minLength={40} maxLength={2000} rows={3} value={summary} onChange={e=>setSummary(e.target.value)}/></label>
   <div className="sm:col-span-3"><Button type="button" disabled={!canRecord||busy} onClick={record}>Enregistrer l'évaluation réelle</Button></div>
  </div>
  {level?.level&&<div className="mt-5 space-y-3 border-t pt-4">
   <h5 className="font-semibold">Autorisation indépendante des résultats</h5>
   <p className="text-sm text-muted-foreground">L'activation serveur exige aussi dossier approuvé, SIRET actif, RC Pro en cours, vérification récente et CGU effectivement acceptées.</p>
   <label className="block text-sm">Motif documenté (30 à 2000 caractères)
    <Textarea value={authorizationReason} minLength={30} maxLength={2000} onChange={e=>setAuthorizationReason(e.target.value)}/>
   </label>
   <div className="flex flex-wrap gap-2">
    {level.authorization_state!=="active"&&<Button type="button" disabled={busy||authorizationReason.trim().length<30} onClick={()=>authorize("activate")}>Activer pour les missions</Button>}
    {level.authorization_state==="active"&&<Button type="button" variant="outline" disabled={busy||authorizationReason.trim().length<30} onClick={()=>authorize("suspend")}>Suspendre les missions</Button>}
   </div>
  </div>}
  {history.length>0&&<details className="mt-4 text-sm"><summary>Historique des évaluations ({history.length})</summary>
   <ul className="mt-2 space-y-2">{history.map(h=><li key={h.id} className="border-b pb-2">
    {new Date(h.created_at).toLocaleDateString("fr-FR")} · {tierName(h.tested_level)}
    · {h.knowledge_score}/25 · pratique {h.practical_score}/20 · oral {h.interview_score}/10
    · {h.decision==="qualified"?"validé":"non validé"}
    <p>{h.summary}</p>
   </li>)}</ul>
  </details>}
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
 </section>;
}
