import {createFileRoute} from "@tanstack/react-router";
import {UnpublishedLegalPage} from "@/components/public/UnpublishedLegalPage";
export const Route=createFileRoute("/cgu")({
 head:()=>({meta:[{title:"Conditions générales d'utilisation — BPEI"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <UnpublishedLegalPage title="Conditions générales d'utilisation"/>
});
