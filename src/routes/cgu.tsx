import {createFileRoute} from "@tanstack/react-router";
import {PublishedBpeiLegalPage} from "@/components/public/PublishedBpeiLegalPage";
export const Route=createFileRoute("/cgu")({
 head:()=>({meta:[{title:"Conditions générales d'utilisation — BPEI"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <PublishedBpeiLegalPage kind="cgu" title="Conditions générales d'utilisation" />
});
