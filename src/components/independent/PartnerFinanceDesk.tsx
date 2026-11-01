import {useEffect,useState,type FormEvent} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {euroToCents,formatCents} from "@/lib/bpei-commercial";
type Entry={id:string;entry_kind:"revenue"|"expense";entry_date:string;category:string;
 amount_cents:number;vat_cents:number;evidence_reference:string;notes:string;status:string;created_at:string};
function csvCell(v:unknown):string{
 const raw=String(v??"").replaceAll("\r"," ").replaceAll("\n"," ").trim();
 const safe=/^[=+@\-]/.test(raw)?"'"+raw:raw;
 return '"'+safe.replaceAll('"','""')+'"';
}
export function PartnerFinanceDesk({userId}:{userId:string}){
 const [entries,setEntries]=useState<Entry[]>([]);
 const [kind,setKind]=useState<"revenue"|"expense">("revenue");
 const [date,setDate]=useState(new Date().toISOString().slice(0,10));
 const [category,setCategory]=useState("");
 const [amount,setAmount]=useState("");
 const [vat,setVat]=useState("0");
 const [reference,setReference]=useState("");
 const [notes,setNotes]=useState("");
 const [rate,setRate]=useState("");
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
 async function refresh(){
  const {data,error:e}=await (supabase as any).from("bpei_partner_finance_entries")
   .select("id,entry_kind,entry_date,category,amount_cents,vat_cents,evidence_reference,notes,status,created_at")
   .eq("owner_id",userId).order("entry_date",{ascending:false}).limit(300);
  if(e)throw Error("Finance unavailable");
  setEntries((data??[]) as Entry[]);
 }
 useEffect(()=>{
  let active=true;
  refresh().catch(()=>{if(active)setError("Le registre comptable n'est pas disponible.")});
  const {data:{subscription}}=supabase.auth.onAuthStateChange(ev=>{
   if(ev==="SIGNED_OUT")setEntries([]);
  });
  return ()=>{active=false;subscription.unsubscribe();setEntries([])};
 },[userId]);
 const total=euroToCents(amount);
 const taxValue=vat.trim()==="0"?0:euroToCents(vat);
 const valid=total!==null&&taxValue!==null&&taxValue<=total&&date.length===10
  &&category.trim().length>=3&&reference.trim().length>=12;
 const active=entries.filter(e=>e.status==="active");
 const income=active.filter(e=>e.entry_kind==="revenue")
  .reduce((s,e)=>s+Number(e.amount_cents)-Number(e.vat_cents),0);
 const expenses=active.filter(e=>e.entry_kind==="expense")
  .reduce((s,e)=>s+Number(e.amount_cents)-Number(e.vat_cents),0);
 const rateValue=rate.trim()===""?null:Number(rate.replace(",","."));
 const estimate=rateValue!==null&&Number.isFinite(rateValue)&&rateValue>=0&&rateValue<=100
  ?Math.round(income*rateValue/100):null;
 async function submit(e:FormEvent){
  e.preventDefault();if(busy||!valid||total===null||taxValue===null)return;
  if(!window.confirm("Confirmer un mouvement réellement encaissé ou payé, avec son justificatif, sans entrer de données bancaires sensibles ?"))return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error:dbError}=await (supabase as any).from("bpei_partner_finance_entries").insert({
    owner_id:userId,entry_kind:kind,entry_date:date,category:category.trim(),
    amount_cents:total,vat_cents:taxValue,evidence_reference:reference.trim(),
    notes:notes.trim(),status:"active"
   });
   if(dbError)throw Error("insert denied");
   setAmount("");setVat("0");setReference("");setNotes("");
   await refresh();setNotice("Écriture enregistrée manuellement. BPEI n'a effectué aucun mouvement bancaire.");
  }catch{setError("Écriture refusée : doublon de justificatif, informations manquantes ou conditions non validées.");}
  finally{setBusy(false)}
 }
 async function voidEntry(entry:Entry){
  if(busy||!window.confirm("Annuler cette écriture sans effacer sa trace comptable ?"))return;
  const reason=window.prompt("Motif précis de l'annulation (15 caractères minimum) :")?.trim();
  if(!reason||reason.length<15||reason.length>400)return;
  setBusy(true);setError("");setNotice("");
  try{
   const {error:e}=await (supabase as any).from("bpei_partner_finance_entries")
    .update({status:"void",void_reason:reason,voided_at:new Date().toISOString()})
    .eq("id",entry.id).eq("owner_id",userId).eq("status","active");
   if(e)throw Error("void rejected");
   await refresh();setNotice("Écriture annulée avec conservation de sa trace.");
  }catch{setError("Annulation refusée. Réessayez après contrôle de la session.");}
  finally{setBusy(false)}
 }
 function exportCsv(){
  const headers=["Date","Type","Catégorie","Montant TTC cents","TVA cents","Justificatif","Notes","Statut"];
  const body=[headers.map(csvCell).join(";"),...entries.map(e=>[
   e.entry_date,e.entry_kind,e.category,e.amount_cents,e.vat_cents,
   e.evidence_reference,e.notes,e.status].map(csvCell).join(";"))].join("\r\n");
  const blob=new Blob(["\uFEFF",body],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download="bpei-registre-financier.csv";
  a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="rounded-xl border bg-card p-6" aria-label="Mon registre financier indépendant">
  <h2 className="text-xl font-semibold">Mes recettes et dépenses</h2>
  <p className="mt-2 text-sm text-muted-foreground">Registre personnel volontaire, indépendant de tout virement Stripe. Ne saisissez que des mouvements réellement effectués avec justificatifs. Les montants ne sont ni certifiés ni déclarés automatiquement par BPEI.</p>
  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
   <div className="rounded border p-3"><p className="text-sm">Recettes HT enregistrées</p><strong>{formatCents(income)}</strong></div>
   <div className="rounded border p-3"><p className="text-sm">Dépenses HT enregistrées</p><strong>{formatCents(expenses)}</strong></div>
   <div className="rounded border p-3"><p className="text-sm">Différence indicative</p><strong>{formatCents(income-expenses)}</strong></div>
  </div>
  <form onSubmit={e=>void submit(e)} className="mt-5 grid gap-3 sm:grid-cols-2">
   <label className="text-sm">Nature
    <select className="mt-1 w-full rounded border bg-background p-2" value={kind} onChange={e=>setKind(e.target.value as "revenue"|"expense")}>
     <option value="revenue">Recette encaissée</option><option value="expense">Dépense payée</option>
    </select></label>
   <label className="text-sm">Date réelle *<Input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label className="text-sm">Catégorie *<Input required minLength={3} maxLength={100} value={category} onChange={e=>setCategory(e.target.value)} placeholder="Dépannage, matériel, logiciel…"/></label>
   <label className="text-sm">Montant TTC (€) *<Input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="90,00"/></label>
   <label className="text-sm">TVA incluse (€), 0 si non applicable *<Input inputMode="decimal" value={vat} onChange={e=>setVat(e.target.value)}/></label>
   <label className="text-sm">Référence de justificatif unique *<Input required minLength={12} maxLength={200} value={reference} onChange={e=>setReference(e.target.value)}/></label>
   <label className="text-sm sm:col-span-2">Notes facultatives (sans données bancaires sensibles)<Textarea value={notes} maxLength={800} onChange={e=>setNotes(e.target.value)} rows={2}/></label>
   <div className="sm:col-span-2"><Button type="submit" disabled={!valid||busy}>Enregistrer le mouvement</Button></div>
  </form>
  <div className="mt-5 space-y-3 border-t pt-4">
   <h3 className="font-semibold">Simulation de cotisations Urssaf (non officielle)</h3>
   <p className="text-sm text-muted-foreground">Indiquez vous-même un taux applicable à votre situation, vérifié auprès de l'Urssaf. La simulation applique ce taux aux recettes HT déclarées manuellement. Les dépenses ne sont pas déduites de l'assiette pour le calcul ci-dessous. Ne remplace pas un calcul fiscal ou une déclaration.</p>
   <label className="block max-w-xs text-sm">Taux de cotisations choisi (%)<Input inputMode="decimal" value={rate} onChange={e=>setRate(e.target.value)} placeholder="À vérifier selon votre activité"/></label>
   {estimate!==null&&<p className="text-sm">Estimation sur recettes HT saisies : <strong>{formatCents(estimate)}</strong> · Taux choisi : {rateValue} %.</p>}
   <a className="inline-block text-sm underline" href="https://www.autoentrepreneur.urssaf.fr/" target="_blank" rel="noopener noreferrer">Vérifier mon régime, mes taux et mes échéances auprès de l'Urssaf</a>
  </div>
  <div className="mt-5 space-y-3 border-t pt-4">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <h3 className="font-semibold">Écritures ({entries.length})</h3>
    <Button type="button" size="sm" variant="outline" disabled={entries.length===0} onClick={exportCsv}>Exporter mon CSV</Button>
   </div>
   {entries.map(e=><article key={e.id} className="rounded border p-3 text-sm">
    <p><strong>{e.entry_kind==="revenue"?"Recette":"Dépense"} : {formatCents(Number(e.amount_cents))} TTC</strong> · {e.entry_date} · {e.category}</p>
    <p>TVA : {formatCents(Number(e.vat_cents))} · Justificatif : {e.evidence_reference} · {e.status==="void"?"Annulé":"Actif"}</p>
    {e.status==="active"&&<Button type="button" className="mt-2" size="sm" variant="outline" disabled={busy} onClick={()=>void voidEntry(e)}>Annuler avec motif</Button>}
   </article>)}
  </div>
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  {notice&&<p role="status" className="mt-3 text-sm">{notice}</p>}
 </section>;
}
