import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';

export default function MarkdownContent({ content }: { content: string }) {
  const parts = content.split(/(```[\w-]*\n?[\s\S]*?```)/g);
  return (
    <div className="space-y-3">
      {parts.map((part, index) => {
        const codeMatch = part.match(/^```([\w-]*)\n?([\s\S]*?)```$/);
        if (!codeMatch)
          return part ? <MarkdownText key={index} text={part} /> : null;
        return (
          <CodeBlock
            key={index}
            language={codeMatch[1] || 'code'}
            code={codeMatch[2].replace(/\n$/, '')}
          />
        );
      })}
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.10] bg-[#0b0d0c] text-left">
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.035] px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/40">
          {language}
        </span>
        <button
          type="button"
          onClick={copyCode}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-white/50 hover:bg-white/[0.08] hover:text-white"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-4 font-mono text-[12px] leading-6 text-[#d5e5d8]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  const consumedTableLines = new Set<number>();

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        if (consumedTableLines.has(index)) return null;
        const dividerIndex = lines[index + 1]?.trim() ? index + 1 : index + 2;
        if (isTableHeader(line) && isTableDivider(lines[dividerIndex])) {
          const rows: string[][] = [splitTableCells(line)];
          let rowIndex = dividerIndex + 1;
          while (rowIndex < lines.length) {
            if (!lines[rowIndex].trim() && isTableRow(lines[rowIndex + 1])) {
              consumedTableLines.add(rowIndex);
              rowIndex += 1;
              continue;
            }
            if (!isTableRow(lines[rowIndex])) break;
            rows.push(splitTableCells(lines[rowIndex]));
            consumedTableLines.add(rowIndex);
            rowIndex += 1;
          }
          consumedTableLines.add(dividerIndex);
          if (dividerIndex !== index + 1) consumedTableLines.add(index + 1);
          return <MarkdownTable key={index} rows={rows} />;
        }

        const heading = line.match(/^(#{1,6})\s+(.+)$/);
        const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
        const bulleted = line.match(/^\s*[-*]\s+(.*)$/);
        const quote = line.match(/^\s*>\s?(.*)$/);
        const divider = /^\s*(\*{3,}|-{3,}|_{3,})\s*$/.test(line);
        if (!line.trim()) return <div key={index} className="h-1" />;
        if (heading)
          return (
            <div
              key={index}
              className={
                heading[1].length <= 2
                  ? 'mt-4 text-lg font-semibold text-white'
                  : 'mt-3 text-sm font-semibold text-white'
              }
            >
              {renderInlineMarkdown(heading[2])}
            </div>
          );
        if (divider) return <hr key={index} className="border-white/[0.12]" />;
        if (quote)
          return (
            <blockquote
              key={index}
              className="border-l-2 border-[var(--accent)]/60 pl-3 text-white/60"
            >
              {renderInlineMarkdown(quote[1])}
            </blockquote>
          );
        if (numbered)
          return (
            <div key={index} className="flex gap-2">
              <span className="shrink-0 text-white/45">{numbered[1]}.</span>
              <span>{renderInlineMarkdown(numbered[2])}</span>
            </div>
          );
        if (bulleted)
          return (
            <div key={index} className="flex gap-2">
              <span className="shrink-0 text-[var(--accent)]">•</span>
              <span>{renderInlineMarkdown(bulleted[1])}</span>
            </div>
          );
        return <p key={index}>{renderInlineMarkdown(line)}</p>;
      })}
    </div>
  );
}

function isTableRow(line: string | undefined) {
  return Boolean(line?.includes('|') && line.trim().replace(/\|/g, '').trim());
}

function isTableHeader(line: string | undefined) {
  return isTableRow(line) && splitTableCells(line ?? '').length >= 2;
}

function isTableDivider(line: string | undefined) {
  if (!isTableRow(line)) return false;
  return splitTableCells(line ?? '').every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitTableCells(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function MarkdownTable({ rows }: { rows: string[][] }) {
  const [header = [], ...body] = rows;
  const columnCount = Math.max(header.length, ...body.map((row) => row.length));

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.10] bg-black/10">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="bg-white/[0.05]">
          <tr>
            {Array.from({ length: columnCount }, (_, index) => (
              <th key={index} className="border-b border-white/[0.10] px-3 py-2.5 font-semibold text-white">
                {renderInlineMarkdown(header[index] ?? '')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={rowIndex} className="even:bg-white/[0.025]">
              {Array.from({ length: columnCount }, (_, index) => (
                <td key={index} className="border-b border-white/[0.06] px-3 py-2.5 align-top leading-relaxed text-white/75">
                  {renderInlineMarkdown(row[index] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderInlineMarkdown(text: string) {
  const tokenPattern =
    /(!\[[^\]]*\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|\/)[^)\s]+\)|https?:\/\/[^\s)]+|\*[^*\n]+\*|_[^_\n]+_)/g;
  return text.split(tokenPattern).map((part, index) => {
    const image = part.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/);
    const bold = part.match(/^\*\*(.+)\*\*$/) || part.match(/^__(.+)__$/);
    const strike = part.match(/^~~(.+)~~$/);
    const code = part.match(/^`(.+)`$/);
    const italic = part.match(/^(\*|_)(.+)\1$/);
    const link = part.match(/^\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)$/);
    const url = part.match(/^(https?:\/\/[^\s)]+)$/);
    if (image)
      return (
        <ProfileImage
          key={index}
          alt={image[1] || 'Profile image'}
          url={image[2]}
        />
      );
    if (bold)
      return (
        <strong key={index} className="font-semibold text-white">
          {bold[1]}
        </strong>
      );
    if (strike)
      return (
        <del key={index} className="text-white/50">
          {strike[1]}
        </del>
      );
    if (code)
      return (
        <code
          key={index}
          className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[0.9em] text-[#e5c07b]"
        >
          {code[1]}
        </code>
      );
    if (italic)
      return (
        <em key={index} className="italic text-white/90">
          {italic[2]}
        </em>
      );
    if (link) return <RouteLink key={index} label={link[1]} url={link[2]} />;
    if (url) return <RouteLink key={index} label={url[1]} url={url[1]} />;
    return part;
  });
}

function RouteLink({ label, url }: { label: string; url: string }) {
  const open = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (url.startsWith('/')) window.location.hash = url;
    else void openUrl(url);
  };
  return (
    <a
      href={url}
      onClick={open}
      className="text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 hover:decoration-[var(--accent)]"
    >
      {label}
    </a>
  );
}

function ProfileImage({ alt, url }: { alt: string; url: string }) {
  const open = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    void openUrl(url);
  };
  return (
    <a
      href={url}
      onClick={open}
      className="my-2 block w-fit max-w-full overflow-hidden rounded-xl border border-white/[0.10] bg-black/20"
    >
      <img
        src={url}
        alt={alt}
        className="max-h-64 max-w-full object-contain"
        loading="lazy"
      />
    </a>
  );
}
