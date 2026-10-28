import {createFileRoute} from "@tanstack/react-router";
export const Route=createFileRoute("/sitemap.xml")({
 server:{handlers:{GET:async()=>{
 const paths=["/","/devenir-partenaire","/comment-ca-marche"];
 const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
 paths.map(p=>"<url><loc>https://bpei.fr"+p+"</loc></url>").join("")+"</urlset>";
 return new Response(xml,{headers:{"Content-Type":"application/xml; charset=utf-8","Cache-Control":"public, max-age=3600"}});
 }}},
 component:()=>null
});
