import {createFileRoute} from "@tanstack/react-router";
import {PublishedBpeiLegalPage} from "@/components/public/PublishedBpeiLegalPage";
export const Route=createFileRoute("/mentions-legales")({
 head:()=>({meta:[{title:"Mentions légales — BPEI"},{name:"robots",content:"noindex,nofollow"}]}),
 component:()=> <PublishedBpeiLegalPage kind="mentions-legales" title="Mentions légales" />
});
