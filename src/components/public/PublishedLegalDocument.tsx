import { PublicShell } from "@/components/public/PublicShell";
import { SafeMarkdown } from "@/components/public/SafeMarkdown";
import { AlertCircle } from "lucide-react";

export type PublishedLegalDoc = {
  id: string;
  code: string;
  title: string | null;
  version: number;
  content: string;
  summary: string | null;
  effective_date: string | null;
  published_at: string | null;
  content_hash: string | null;
  language: string;
};

/**
 * Bloc H2 — Rendu public d'un document juridique publié.
 * - Si `doc` est null → état neutre, aucun fallback inventé.
 * - Rendu du contenu ligne à ligne (whitespace-pre-wrap), sans HTML injecté.
 */
export function PublishedLegalDocument({
  fallbackTitle,
  doc,
}: {
  fallbackTitle: string;
  doc: PublishedLegalDoc | null;
}) {
  if (!doc) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{fallbackTitle}</h1>
          <div
            role="status"
            className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            <div>
              <p className="font-medium text-foreground">Document en cours de finalisation.</p>
              <p className="mt-1">
                Aucune version publiée n'est disponible pour l'instant. Ce document sera mis en ligne dès sa validation
                officielle. En attendant, aucune version brouillon n'est diffusée.
              </p>
              <p className="mt-2">
                Pour toute question, utilisez la page{" "}
                <a href="/contact" className="underline">
                  Contact
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <article className="mx-auto max-w-3xl px-4 py-12 md:px-6">
        <header className="mb-6 border-b border-border pb-4">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{doc.title ?? fallbackTitle}</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Version {doc.version}
            {doc.effective_date && <> · Applicable à partir du {formatDate(doc.effective_date)}</>}
            {doc.published_at && <> · Publiée le {formatDate(doc.published_at)}</>}
            {doc.content_hash && <> · Empreinte : {doc.content_hash.slice(0, 12)}…</>}
          </p>
          {doc.summary && <p className="mt-3 text-sm text-foreground/80">{doc.summary}</p>}
        </header>
        <SafeMarkdown>{doc.content}</SafeMarkdown>
      </article>

    </PublicShell>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return iso;
  }
}