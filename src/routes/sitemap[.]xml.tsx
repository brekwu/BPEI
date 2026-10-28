import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://bpei.fr";

interface Entry { path: string; changefreq?: string; priority?: string; lastmod?: string; }

// Mapping document_code -> URL publique publiée.
// Ne lister que des documents dont le status = 'published' ET dont la route publique existe.
const LEGAL_ROUTE_MAP: Record<string, string> = {
  website_terms: "/cgu",
  subscription_terms: "/conditions-abonnement",
  cookie_policy: "/cookies",
  review_policy: "/avis/politique",
  payment_link_terms: "/pay/politique",
  moderation_policy: "/moderation",
  reporting_policy: "/signalement",
  complaint_policy: "/reclamations",
  ranking_policy: "/annuaire/classement",
  verified_badge_rules: "/annuaire/badge-verifie",
  directory_admission: "/annuaire/regles-admission",
  seller_rules: "/vendeurs/regles",
  marketplace_information: "/commandes/role-bpei",
  // functional_annex — pas de page publique dédiée, exclu du sitemap.
};

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Pages statiques publiques indexables
        const entries: Entry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/demander-une-intervention", changefreq: "weekly", priority: "0.9" },
          { path: "/devenir-partenaire", changefreq: "weekly", priority: "0.9" },
          { path: "/candidature-partenaire", changefreq: "weekly", priority: "0.8" },
          { path: "/comment-ca-marche", changefreq: "monthly", priority: "0.7" },
          { path: "/boutiques", changefreq: "daily", priority: "0.9" },
          { path: "/annuaire", changefreq: "daily", priority: "0.9" },
          { path: "/professionnels", changefreq: "weekly", priority: "0.9" },
          { path: "/rejoindre", changefreq: "weekly", priority: "0.8" },
          { path: "/contact", changefreq: "monthly", priority: "0.7" },
          { path: "/juridique", changefreq: "monthly", priority: "0.5" },
          // Documents juridiques publiés — routes publiques existantes
          { path: "/mentions-legales", changefreq: "yearly", priority: "0.3" },
          { path: "/confidentialite", changefreq: "yearly", priority: "0.3" },
          { path: "/cgu", changefreq: "yearly", priority: "0.3" },
          { path: "/cgv", changefreq: "yearly", priority: "0.3" },
          { path: "/cookies", changefreq: "yearly", priority: "0.3" },
          { path: "/conditions-abonnement", changefreq: "yearly", priority: "0.3" },
          { path: "/conditions-beta", changefreq: "yearly", priority: "0.3" },
          { path: "/demande-donnees", changefreq: "yearly", priority: "0.3" },
          { path: "/suspension-recours", changefreq: "yearly", priority: "0.3" },
          { path: "/reclamations", changefreq: "yearly", priority: "0.3" },
          { path: "/moderation", changefreq: "yearly", priority: "0.3" },
          { path: "/signalement", changefreq: "yearly", priority: "0.3" },
          { path: "/avis/politique", changefreq: "yearly", priority: "0.3" },
          { path: "/pay/politique", changefreq: "yearly", priority: "0.3" },
          { path: "/commandes/role-bpei", changefreq: "yearly", priority: "0.3" },
          { path: "/vendeurs/regles", changefreq: "yearly", priority: "0.3" },
          { path: "/annuaire/classement", changefreq: "yearly", priority: "0.3" },
          { path: "/annuaire/badge-verifie", changefreq: "yearly", priority: "0.3" },
          { path: "/annuaire/regles-admission", changefreq: "yearly", priority: "0.3" },
        ];

        try {
          const { createClient } = await import("@supabase/supabase-js");
          const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const supabase = createClient(process.env.SUPABASE_URL!, key, {
            auth: { persistSession: false },
            global: {
              fetch: (input, init) => {
                const h = new Headers(init?.headers);
                if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
                h.set("apikey", key);
                return fetch(input, { ...init, headers: h });
              },
            },
          });

          // Documents juridiques réellement publiés — mappés vers leurs routes existantes.
          const { data: docs } = await supabase
            .from("legal_documents")
            .select("document_code, updated_at, status")
            .eq("status", "published");
          const seen = new Set(entries.map((e) => e.path));
          for (const d of docs ?? []) {
            const path = LEGAL_ROUTE_MAP[d.document_code as string];
            if (!path || seen.has(path)) continue;
            entries.push({ path, changefreq: "yearly", priority: "0.3", lastmod: d.updated_at });
            seen.add(path);
          }

          // Boutiques validées + publiées uniquement (vue shops_public filtre déjà côté RLS).
          const { data: shops } = await supabase
            .from("shops_public")
            .select("id, updated_at, status, public_profile_status")
            .eq("status", "validated")
            .eq("public_profile_status", "published");
          for (const s of shops ?? []) {
            entries.push({ path: `/b/${s.id}`, changefreq: "weekly", priority: "0.7", lastmod: s.updated_at });
          }
        } catch {
          // Fallback silencieux : le sitemap reste valide avec les entrées statiques.
        }

        const urls = entries.map((e) => [
          "  <url>",
          `    <loc>${BASE_URL}${e.path}</loc>`,
          e.lastmod ? `    <lastmod>${new Date(e.lastmod).toISOString().slice(0, 10)}</lastmod>` : null,
          e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
          e.priority ? `    <priority>${e.priority}</priority>` : null,
          "  </url>",
        ].filter(Boolean).join("\n"));

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});