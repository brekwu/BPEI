import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(name:string)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");

test("Netlify commercial hosting is configured for Nitro SSR and staging-only by default",()=>{
 const config=read("netlify.toml");
 const vite=read("vite.config.ts");
 const workflow=read(".github/workflows/bpei-tests.yml");
 assert.match(config,/NITRO_PRESET = "netlify"/);
 assert.match(config,/publish = "dist"/);
 assert.match(config,/bun install --frozen-lockfile/);
 assert.match(config,/BPEI_STAGING = "true"/);
 assert.match(config,/BPEI_FORMS_ENABLED = "false"/);
 assert.match(config,/VITE_BPEI_PUBLIC_FORMS_ENABLED = "false"/);
 assert.match(vite,/nitro\(\{ preset: process\.env\.NITRO_PRESET/);
 assert.match(workflow,/netlify-nitro-build:/);
 assert.match(workflow,/test -f \.netlify\/v1\/config\.json/);
 assert.match(workflow,/test -d \.netlify\/v1\/functions/);
});
test("Netlify migration guard requires private repository and OVH DNS preservation",()=>{
 const readme=read("docs/p0/HEBERGEMENT-COMMERCIAL-NETLIFY.md");
 for(const phrase of ["GitHub","Private","MX","SPF","DKIM","DMARC","Netlify Free","VITE_SUPABASE_PUBLISHABLE_KEY","pas une URL fictive"]){
  assert.ok(readme.includes(phrase),phrase);
 }
 assert.doesNotMatch(readme,/sk_live_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/);
});
