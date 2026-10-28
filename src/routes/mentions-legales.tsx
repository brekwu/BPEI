import {createFileRoute} from "@tanstack/react-router";
import {UnpublishedLegalPage} from "@/components/public/UnpublishedLegalPage";
export const Route=createFileRoute("/mentions-legales")({
 head:()=>({meta:[{title:"Mentions légales — BPEI"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <UnpublishedLegalPage title="Mentions légales"/>
});
