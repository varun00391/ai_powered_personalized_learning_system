import { Children, isValidElement, useEffect, useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

let mermaidInitialized = false;

/** Fix common LLM Mermaid mistakes (esp. flowchart edge labels). */
export function sanitizeMermaidSource(raw) {
  let s = String(raw || "").trim();
  if (!s) return s;

  // Strip accidental inner fences
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:mermaid)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  }

  // Wrong: -->|label|> N   (extra > after edge label) — Mermaid expects -->|label| N
  s = s.replace(/(-->|-\.->|==>)(\|[^|\r\n]+\|)>/g, "$1$2 ");

  // Same pattern with optional spaces: --> | label | > 
  s = s.replace(/(-->|-\.->|==>)\s*(\|\s*[^|\r\n]+\s*\|)\s*>/g, "$1$2 ");

  // Broken "arrow" written as --->|x|> 
  s = s.replace(/(---+>)(\|[^|\r\n]+\|)>/g, "$1$2 ");

  // LLMs often insert double spaces after edge labels: -->|feeds|  B — Mermaid 11 can fail with "got 'SPACE'"
  s = s.replace(/((?:-->|-\.->|==>)(\|[^|\r\n]+\|))[ \t]{2,}/g, "$1 ");
  // Same for unlabeled edges on one line: A -->  B (only spaces/tabs, not newlines)
  s = s.replace(/(-->|-\.->|==>)[ \t]{2,}(?=[A-Za-z0-9_"(\[\u201c])/g, "$1 ");

  // Prefer flowchart keyword (graph is legacy). Only at string start — avoid touching lines named "graph".
  s = s.replace(/^\s*graph(\s+)/i, "flowchart$1");

  const firstNonEmpty = s.split("\n").find((l) => l.trim())?.trim() || "";
  const hasDiagramDecl =
    /^(graph\b|flowchart\b|sequenceDiagram\b|classDiagram\b|stateDiagram-v2\b|stateDiagram\b|erDiagram\b|mindmap\b|timeline\b|pie\b|gitGraph\b|C4Context\b|quadrantChart\b|journey\b|sankey-beta\b|block-beta\b|architecture-beta\b)/i.test(
      firstNonEmpty
    );
  if (!hasDiagramDecl) {
    s = `flowchart TB\n${s}`;
  }

  return s.trim();
}

async function getMermaid() {
  const mermaid = (await import("mermaid")).default;
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      suppressErrorRendering: true,
    });
    mermaidInitialized = true;
  }
  return mermaid;
}

function isSafeImageSrc(src) {
  if (!src || typeof src !== "string") return false;
  try {
    const u = new URL(src, window.location.origin);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function MermaidChart({ chart }) {
  const reactId = useId().replace(/:/g, "");
  const [svgHtml, setSvgHtml] = useState(null);
  const [err, setErr] = useState(null);
  const [sourceOpen, setSourceOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const trimmed = chart?.trim();
    if (!trimmed) {
      setSvgHtml(null);
      setErr(null);
      return undefined;
    }

    const fixed = sanitizeMermaidSource(trimmed);

    (async () => {
      setErr(null);
      setSvgHtml(null);
      try {
        const mermaid = await getMermaid();
        const id = `m-${reactId}-${Math.random().toString(36).slice(2, 9)}`;
        const { svg } = await mermaid.render(id, fixed);
        if (!cancelled) setSvgHtml(svg);
      } catch (e) {
        if (!cancelled) {
          const msg = String(e?.message || e || "Invalid diagram");
          setErr(msg.replace(/\s*mermaid\s*version\s*[\d.]+/gi, "").trim() || "Invalid Mermaid syntax.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (!chart?.trim()) return null;

  if (err) {
    return (
      <div
        className="my-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100/90"
        aria-label="Diagram error"
      >
        <p className="font-medium text-amber-200">Diagram could not be rendered</p>
        <p className="mt-1 text-xs text-amber-100/70">{err}</p>
        <button
          type="button"
          onClick={() => setSourceOpen((o) => !o)}
          className="mt-3 text-xs text-indigo-300 underline decoration-indigo-500/40 hover:text-indigo-200"
        >
          {sourceOpen ? "Hide" : "Show"} Mermaid source (for debugging)
        </button>
        {sourceOpen ? (
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
            {sanitizeMermaidSource(chart)}
          </pre>
        ) : null}
      </div>
    );
  }

  if (!svgHtml) {
    return (
      <div className="my-5 rounded-xl border border-white/10 bg-slate-950/80 p-4 text-xs text-slate-500" aria-busy="true">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      className="my-5 overflow-x-auto rounded-xl border border-indigo-500/20 bg-slate-950/80 p-4 [&_svg]:max-w-full"
      aria-label="Diagram"
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}

const mdComponents = {
  h1: ({ children }) => (
    <h1 className="mb-3 font-display text-xl font-semibold text-white">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-6 font-display text-lg font-semibold text-indigo-200 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-indigo-300/90">{children}</h3>
  ),
  h4: ({ children }) => <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-200">{children}</h4>,
  p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-slate-300 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 list-inside list-disc space-y-1.5 text-sm text-slate-300">{children}</ul>,
  ol: ({ children }) => (
    <ol className="mb-3 list-inside list-decimal space-y-1.5 text-sm text-slate-300">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
  em: ({ children }) => <em className="text-slate-200">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-indigo-500/50 bg-white/[0.03] py-2 pl-4 text-sm text-slate-400">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-300 underline decoration-indigo-500/40 underline-offset-2 hover:text-indigo-200"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) =>
    isSafeImageSrc(src) ? (
      <figure className="my-4">
        <img
          src={src}
          alt={alt || ""}
          className="max-h-96 w-full rounded-lg border border-white/10 object-contain"
          loading="lazy"
        />
        {alt ? <figcaption className="mt-1 text-center text-xs text-slate-500">{alt}</figcaption> : null}
      </figure>
    ) : null,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full min-w-[280px] border-collapse text-left text-sm text-slate-300">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-white/10">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => <th className="border-b border-white/10 px-3 py-2 font-semibold text-slate-200">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
  hr: () => <hr className="my-6 border-white/10" />,
  pre: ({ children }) => {
    try {
      const child = Children.only(children);
      if (
        isValidElement(child) &&
        typeof child.props?.className === "string" &&
        child.props.className.includes("language-mermaid")
      ) {
        const chart = String(child.props.children).replace(/\n$/, "");
        return <MermaidChart chart={chart} />;
      }
    } catch {
      /* multiple children */
    }
    return (
      <pre className="my-4 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 font-mono text-xs leading-relaxed text-slate-300">
        {children}
      </pre>
    );
  },
  code: ({ inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-cyan-200" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export default function StudyGuideMarkdown({ content }) {
  if (!content) return null;
  return (
    <div className="study-guide-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
