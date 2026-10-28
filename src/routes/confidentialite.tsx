import {createFileRoute} from "@tanstack/react-router";
import {UnpublishedLegalPage} from "@/components/public/UnpublishedLegalPage";
export const Route=createFileRoute("/confidentialite")({
 head:()=>({meta:[{title:"Politique de confidentialité — BPEI"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <UnpublishedLegalPage title="Politique de confidentialité"/>
});
