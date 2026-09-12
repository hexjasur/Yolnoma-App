import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import hljs from 'highlight.js/lib/common';

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-content max-w-none text-sm leading-7 text-white/80">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-4 mt-6 text-2xl font-semibold tracking-tight text-white first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 mt-6 text-xl font-semibold tracking-tight text-white">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-5 text-lg font-semibold text-white">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-2 mt-4 text-base font-semibold text-white">{children}</h4>,
  h5: ({ children }) => <h5 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-white/90">{children}</h5>,
  h6: ({ children }) => <h6 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-white/70">{children}</h6>,
  p: ({ children }) => <p className="my-3">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  em: ({ children }) => <em className="text-white/90">{children}</em>,
  del: ({ children }) => <del className="text-white/45">{children}</del>,
  hr: () => <hr className="my-6 border-white/[0.12]" />,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-[var(--accent)]/70 bg-[var(--accent-glow)] px-4 py-2 text-white/65">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6 marker:text-[var(--accent)]">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6 marker:text-white/50">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  input: ({ checked, type }) => (
    <input
      type={type}
      checked={checked}
      readOnly
      disabled
      className="mr-2 accent-[var(--accent)]"
    />
  ),
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-white/[0.10] bg-black/10">
      <table className="min-w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.06]">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-white/[0.06]">{children}</tbody>,
  tr: ({ children }) => <tr className="even:bg-white/[0.025]">{children}</tr>,
  th: ({ children }) => <th className="border-b border-white/[0.12] px-4 py-3 font-semibold text-white">{children}</th>,
  td: ({ children }) => <td className="border-b border-white/[0.06] px-4 py-3 align-top leading-relaxed text-white/75">{children}</td>,
  a: ({ href, children }) => {
    const open = (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (href?.startsWith('/')) window.location.hash = href;
      else if (href) void openUrl(href);
    };
    return <a href={href} onClick={open} className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 hover:decoration-[var(--accent)]">{children}</a>;
  },
  img: ({ src, alt }) => (
    <a
      href={src}
      onClick={(event) => {
        event.preventDefault();
        if (src) void openUrl(src);
      }}
      className="my-3 block w-fit max-w-full overflow-hidden rounded-xl border border-white/[0.10] bg-black/20"
    >
      <img src={src} alt={alt ?? ''} loading="lazy" className="max-h-96 max-w-full object-contain" />
    </a>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const code = String(children).replace(/\n$/, '');
    const language = className?.replace('language-', '') || 'code';
    if (!className && !String(children).includes('\n')) {
      return <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[0.9em] text-[#e5c07b]">{children}</code>;
    }
    return <CodeBlock language={language} code={code} />;
  },
};

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-white/[0.10] bg-[#0b0d0c] text-left">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.035] px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">{language}</span>
        <button type="button" onClick={copyCode} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/50 hover:bg-white/[0.08] hover:text-white">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-[32rem] overflow-auto p-4 font-mono text-[12px] leading-6 text-[#d5e5d8]">
        <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightCode(language, code) }} />
      </pre>
    </div>
  );
}

function highlightCode(language: string, code: string) {
  try {
    if (language !== 'code' && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return escapeHtml(code);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] ?? character);
}
