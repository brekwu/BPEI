import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

/**
 * Bloc H2b — Rendu Markdown restreint pour les documents juridiques publiés.
 *
 * Autorisé : titres h2-h4, paragraphes, listes, gras, italique, liens (http/https/mailto),
 * séparateurs, tableaux GFM.
 * Interdit : HTML brut, scripts, iframes, images distantes non contrôlées, styles inline,
 *            événements JS, URLs javascript:/data:.
 */

const schema = {
  ...defaultSchema,
  tagNames: [
    "h2", "h3", "h4", "p", "strong", "em", "ul", "ol", "li", "a", "hr", "br",
    "blockquote", "code", "pre",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: [["href"], ["title"]],
    th: [["align"]],
    td: [["align"]],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto"],
  },
  clobberPrefix: "md-",
};

export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="prose prose-slate max-w-none text-sm leading-relaxed text-foreground/90 prose-headings:font-semibold prose-h2:mt-8 prose-h2:text-xl prose-h3:mt-6 prose-h3:text-lg prose-h4:mt-4 prose-a:text-electric hover:prose-a:underline prose-table:text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        skipHtml
        components={{
          a: ({ href, children, ...props }) => {
            const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
            return (
              <a
                href={href}
                {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}