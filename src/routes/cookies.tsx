import {createFileRoute} from "@tanstack/react-router";
import {UnpublishedLegalPage} from "@/components/public/UnpublishedLegalPage";
export const Route=createFileRoute("/cookies")({
 head:()=>({meta:[{title:"Politique des cookies — BPEI"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <UnpublishedLegalPage title="Politique des cookies"/>
});
