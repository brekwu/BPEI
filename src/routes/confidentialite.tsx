import {createFileRoute} from "@tanstack/react-router";
import {PublishedBpeiLegalPage} from "@/components/public/PublishedBpeiLegalPage";
export const Route=createFileRoute("/confidentialite")({
 head:()=>({meta:[{title:"Politique de confidentialité — BPEI"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <PublishedBpeiLegalPage kind="confidentialite" title="Politique de confidentialité" />
});
