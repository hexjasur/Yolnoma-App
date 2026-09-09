import { useEffect, useRef, useState } from 'react';
import { Code2, RotateCcw, Save } from 'lucide-react';
import MarkdownContent from '@/features/ai/components/MarkdownContent';
import { ToolCard, ToolTitle } from './ToolShell';

const initialMarkdown = `# Markdown workspace

Write documentation with a live preview. This renderer supports **strong text**, *emphasis*, ~~strikethrough~~, links, images, tables, task lists, blockquotes, and fenced code blocks.

## Example table

| Feature | Status | Notes |
| --- | :---: | --- |
| GitHub Flavored Markdown | ✅ | Tables and task lists included |
| Code blocks | ✅ | Copy-ready with language labels |
| Responsive layout | ✅ | Wide tables scroll on small screens |

> Tip: use the editor on the left and keep the preview open while you write.

- [x] Add a heading
- [ ] Add a code example

\`\`\`ts
const greeting = 'Hello, Markdown';
console.log(greeting);
\`\`\``;

const MARKDOWN_DRAFT_KEY = 'yolnoma.developer-tools.markdown-draft';

function loadDraft() {
  try {
    return localStorage.getItem(MARKDOWN_DRAFT_KEY) ?? initialMarkdown;
  } catch {
    return initialMarkdown;
  }
}

export default function MarkdownStudioTool() {
  const [markdown, setMarkdown] = useState(loadDraft);
  const [savedAt, setSavedAt] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const syncingScroll = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(MARKDOWN_DRAFT_KEY, markdown);
        setSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch {
        // Browser storage may be unavailable in restricted environments.
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [markdown]);

  const reset = () => {
    setMarkdown(initialMarkdown);
    try {
      localStorage.removeItem(MARKDOWN_DRAFT_KEY);
    } catch {
      // Browser storage may be unavailable in restricted environments.
    }
    setSavedAt('Reset to default');
  };

  const syncScroll = (source: HTMLTextAreaElement | HTMLElement, target: HTMLTextAreaElement | HTMLElement) => {
    if (syncingScroll.current) return;
    syncingScroll.current = true;
    const sourceMax = source.scrollHeight - source.clientHeight;
    const targetMax = target.scrollHeight - target.clientHeight;
    target.scrollTop = (sourceMax > 0 ? source.scrollTop / sourceMax : 0) * Math.max(0, targetMax);
    window.requestAnimationFrame(() => { syncingScroll.current = false; });
  };

  return <ToolCard><ToolTitle icon={Code2} text="Markdown Studio" subtitle="A full GitHub-Flavored Markdown preview with tables, task lists, links, images, quotes, and code blocks." /><div className="mt-6 flex items-center justify-between gap-3 border border-white/[0.08] bg-black/10 px-4 py-3"><span className="flex items-center gap-2 text-xs text-white/40"><Save size={13} className="text-emerald-300/70" /> {savedAt ? `Autosaved ${savedAt}` : 'Autosave enabled'}</span><button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-xs text-white/45 hover:text-white"><RotateCcw size={13} /> Reset default</button></div><div className="mt-4 grid gap-4 xl:grid-cols-2"><div className="overflow-hidden border border-white/[0.08] bg-[#0d0d0a]"><div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Editor</span><span className="text-[10px] text-white/25">{markdown.length} chars · {markdown.split('\n').length} lines</span></div><textarea ref={editorRef} onScroll={() => editorRef.current && previewRef.current && syncScroll(editorRef.current, previewRef.current)} value={markdown} onChange={(event) => setMarkdown(event.target.value)} className="block h-[620px] w-full resize-none overflow-y-auto bg-transparent p-5 font-mono text-[13px] leading-6 text-white/80 outline-none" spellCheck={false} /></div><div className="overflow-hidden border border-white/[0.08] bg-[#0d0d0a]"><div className="border-b border-white/[0.08] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Preview</div><article ref={previewRef} onScroll={() => editorRef.current && previewRef.current && syncScroll(previewRef.current, editorRef.current)} className="h-[620px] overflow-y-auto p-5 md:p-7"><MarkdownContent content={markdown} /></article></div></div></ToolCard>;
}
