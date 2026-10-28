import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { SHARE_TEXTS } from "@/lib/network-content";

export const Route = createFileRoute("/kit-partage")({
  head: () => ({
    meta: [
      { title: "Kit de présentation BPEI — Textes à partager" },
      { name: "description", content: "Textes prêts à copier pour présenter BPEI sur les réseaux sociaux, à France Travail et aux techniciens indépendants." },
      { property: "og:title", content: "Kit de présentation BPEI" },
      { property: "og:description", content: "Textes prêts à partager pour présenter le réseau national BPEI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KitPage,
});

function KitPage() {
  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Texte copié"),
      () => toast.error("Copie impossible, sélectionnez le texte manuellement"),
    );
  }
  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <h1 className="text-3xl font-bold md:text-4xl">Kit de présentation BPEI</h1>
        <p className="mt-3 text-muted-foreground">
          Textes prêts à copier pour les réseaux sociaux, France Travail et les techniciens indépendants.
          Les liens contiennent un suivi de provenance (utm) pour savoir d'où viennent les demandes.
          Remplacez les éléments entre crochets avant envoi.
        </p>
        <div className="mt-8 space-y-6">
          {SHARE_TEXTS.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{t.title}</h2>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.audience}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copy(t.text)}>
                    <Copy className="mr-2 h-4 w-4" />Copier
                  </Button>
                </div>
                <pre className="mt-4 whitespace-pre-wrap break-words rounded-md bg-secondary/50 p-4 font-sans text-sm leading-relaxed">{t.text}</pre>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">
          Liens utiles : <Link to="/demander-une-intervention" className="underline">Demander une intervention</Link> ·{" "}
          <Link to="/devenir-partenaire" className="underline">Devenir partenaire</Link> ·{" "}
          <Link to="/comment-ca-marche" className="underline">Comment ça marche</Link>
        </p>
      </div>
    </PublicShell>
  );
}