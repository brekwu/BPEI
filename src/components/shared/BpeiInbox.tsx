import {useEffect,useState} from "react";
import {supabase} from "@/integrations/supabase/client";
import {Button} from "@/components/ui/button";
type Notice={id:string;title:string;created_at:string;read_at:string|null};
export function BpeiInbox(){
 const [items,setItems]=useState<Notice[]>([]);
 const [visible,setVisible]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function refresh(){
  const {data,error:e}=await (supabase as any).from("bpei_notifications")
   .select("id,title,created_at,read_at").order("created_at",{ascending:false}).limit(30);
  if(e)setError("Notifications indisponibles.");
  else {setItems(data??[]);setError("");}
 }
 useEffect(()=>{void refresh()},[]);
 async function mark(id:string){
  if(busy)return;setBusy(true);
  const {data,error:e}=await (supabase as any).rpc("mark_bpei_notification_read",{p_notification_id:id});
  if(e||data!==true)setError("Impossible de marquer la notification comme lue.");
  else await refresh();
  setBusy(false);
 }
 const unread=items.filter(n=>!n.read_at).length;
 return <section className="rounded-xl border bg-card p-4" aria-label="Notifications BPEI">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <h2 className="font-semibold">Notifications {unread>0?"("+unread+" non lues)":""}</h2>
   <div className="flex gap-2">
    <Button type="button" size="sm" variant="outline" onClick={()=>void refresh()}>Actualiser</Button>
    <Button type="button" size="sm" variant="outline" onClick={()=>setVisible(v=>!v)}>{visible?"Masquer":"Consulter"}</Button>
   </div>
  </div>
  {error&&<p role="alert" className="mt-2 text-sm">{error}</p>}
  {visible&&<div className="mt-3 space-y-2">
   {!items.length&&<p className="text-sm">Aucune notification.</p>}
   {items.map(n=><div key={n.id} className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm">
    <div><strong>{n.title}</strong><p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("fr-FR")}</p></div>
    {!n.read_at&&<Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void mark(n.id)}>Marquer lue</Button>}
   </div>)}
  </div>}
 </section>;
}
