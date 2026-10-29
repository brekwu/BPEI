import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://bpei.fr";
// Référencer seulement les pages publiques du réseau indépendant.
// Les anciennes boutiques, fiches marchandes, produits et liens de paiement sont exclus.
const PUBLIC_PAGES = ["/", "/devenir-partenaire", "/comment-ca-marche", "/contact"] as const;

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = PUBLIC_PAGES.map(path => `<url><loc>${BASE_URL}${path}</loc></url>`).join("");
        return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
