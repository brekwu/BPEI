import {useEffect,useRef,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";

type Notice={id:string;title:string;created_at:string;read_at:string|null};
const PAGE_SIZE=20;

/** The server, not the currently rendered page, counts unread notifications. */
export function BpeiInbox(){
 const [identity,setIdentity]=useState<string|null>(null);
 const [authLoading,setAuthLoading]=useState(true);
 const [items,setItems]=useState<Notice[]>([]);
 const [loadedPage,setLoadedPage]=useState<number|null>(null);
 const [visible,setVisible]=useState(false);
 const [page,setPage]=useState(0);
 const [total,setTotal]=useState(0);
 const [unread,setUnread]=useState(0);
 const [loading,setLoading]=useState(false);
 const [busyId,setBusyId]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [revision,setRevision]=useState(0);
 const fetchEpoch=useRef(0);

 useEffect(()=>{
  let active=true,authEpoch=0;
  function clear(){
   ++fetchEpoch.current;
   setIdentity(null);
   setItems([]);setLoadedPage(null);setPage(0);setTotal(0);setUnread(0);
   setVisible(false);setBusyId(null);setLoading(false);setError("");
  }
  async function verify(){
   const run=++authEpoch;
   try{
    const {data,error:e}=await supabase.auth.getUser();
    if(!active||run!==authEpoch)return;
    if(e||!data.user){
     clear();
     setAuthLoading(false);
     return;
    }
    setIdentity(old=>old===data.user!.id?old:data.user!.id);
    setAuthLoading(false);
   }catch{
    if(active&&run===authEpoch){clear();setAuthLoading(false);}
   }
  }
  const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
   if(!active)return;
   if(event==="SIGNED_OUT"){
    ++authEpoch;
    clear();
    setAuthLoading(false);
   }else if(event==="SIGNED_IN"||event==="USER_UPDATED"){
    ++authEpoch;
    clear();
    setAuthLoading(true);
    // Avoid awaiting the Supabase auth client from inside its own callback.
    setTimeout(()=>{if(active)void verify();},0);
   }
  });
  void verify();
  return ()=>{active=false;++authEpoch;++fetchEpoch.current;subscription.unsubscribe();};
 },[]);

 useEffect(()=>{
  if(!identity)return;
  let active=true;
  const run=++fetchEpoch.current;
  setLoading(true);
  setLoadedPage(null);
  setError("");
  const db=supabase as any;
  (async()=>{
   const [list,count]=await Promise.all([
    db.from("bpei_notifications")
     .select("id,title,created_at,read_at",{count:"exact"})
     .eq("recipient_id",identity)
     .order("created_at",{ascending:false}).order("id",{ascending:false})
     .range(page*PAGE_SIZE,(page+1)*PAGE_SIZE-1),
    db.from("bpei_notifications")
     .select("id",{count:"exact",head:true})
     .eq("recipient_id",identity).is("read_at",null)
   ]);
   if(!active||run!==fetchEpoch.current)return;
   if(list.error||count.error||!Array.isArray(list.data)
      ||typeof list.count!=="number"||typeof count.count!=="number"){
    setItems([]);setLoadedPage(null);setTotal(0);setUnread(0);
    setError("Notifications indisponibles. Réessayez.");
   }else if(page>0&&page*PAGE_SIZE>=list.count){
    setItems([]);setLoadedPage(null);setPage(Math.max(0,Math.ceil(list.count/PAGE_SIZE)-1));
   }else{
    setItems(list.data as Notice[]);
    setLoadedPage(page);
    setTotal(list.count);
    setUnread(count.count);
   }
  })().catch(()=>{
   if(active&&run===fetchEpoch.current){
    setItems([]);setLoadedPage(null);setTotal(0);setUnread(0);
    setError("Connexion aux notifications indisponible. Réessayez.");
   }
  }).finally(()=>{
   if(active&&run===fetchEpoch.current)setLoading(false);
  });
  return ()=>{active=false;++fetchEpoch.current;};
 },[identity,page,revision]);

 async function mark(id:string){
  if(!identity||busyId||loading)return;
  const run=fetchEpoch.current;
  setBusyId(id);setError("");
  try{
   const {data,error:e}=await (supabase as any).rpc("mark_bpei_notification_read",{p_notification_id:id});
   if(run!==fetchEpoch.current)return;
   if(e||data!==true)setError("Impossible de marquer la notification comme lue.");
   else setRevision(n=>n+1);
  }catch{
   if(run===fetchEpoch.current)setError("Service de notifications indisponible. Réessayez.");
  }finally{
   if(run===fetchEpoch.current)setBusyId(null);
  }
 }
 const pageCount=Math.ceil(total/PAGE_SIZE);
 const pageReady=!loading&&loadedPage===page;
 return <section className="rounded-xl border bg-card p-4" aria-label="Notifications BPEI">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h2 className="font-semibold">Notifications {identity&&unread>0?"("+unread+" non lues)":""}</h2>
   <div className="flex gap-2">
    <Button type="button" size="sm" variant="outline" disabled={!identity||authLoading||loading||!!busyId}
     onClick={()=>setRevision(n=>n+1)}>Actualiser</Button>
    <Button type="button" size="sm" variant="outline" disabled={!identity||authLoading}
     onClick={()=>setVisible(v=>!v)}>{visible?"Masquer":"Consulter"}</Button>
   </div>
  </div>
  {authLoading&&<p role="status" className="mt-2 text-sm">Vérification de la session…</p>}
  {!authLoading&&!identity&&<p role="status" className="mt-2 text-sm">Connectez-vous pour consulter vos notifications.</p>}
  {error&&<p role="alert" className="mt-2 text-sm">{error}</p>}
  {identity&&visible&&<div className="mt-3 space-y-2">
   {!pageReady&&!error&&<p role="status" className="text-sm">Chargement des notifications…</p>}
   {pageReady&&!error&&items.length===0&&<p className="text-sm">Aucune notification.</p>}
   {pageReady&&items.map(n=><div key={n.id} className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm">
    <div><strong>{n.title}</strong><p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("fr-FR")}</p></div>
    {!n.read_at&&<Button type="button" size="sm" variant="outline" disabled={!!busyId||loading}
     onClick={()=>void mark(n.id)}>{busyId===n.id?"Enregistrement…":"Marquer lue"}</Button>}
   </div>)}
   {pageReady&&total>0&&<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
    <p role="status" className="text-xs text-muted-foreground">Notifications {page*PAGE_SIZE+1}–{page*PAGE_SIZE+items.length} sur {total} · page {page+1} sur {pageCount}</p>
    <div className="flex gap-2">
     <Button type="button" size="sm" variant="outline" disabled={!!busyId||page===0} onClick={()=>setPage(p=>p-1)}>Précédent</Button>
     <Button type="button" size="sm" variant="outline" disabled={!!busyId||page+1>=pageCount} onClick={()=>setPage(p=>p+1)}>Suivant</Button>
    </div>
   </div>}
  </div>}
 </section>;
}
