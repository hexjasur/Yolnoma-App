import { useState, type ReactNode } from "react";
import { Check, Code2, Copy } from "lucide-react";
import { Button } from "@/shared/ui";

const COMMANDS = new Set([
  "Clear-RecycleBin",
  "ForEach-Object",
  "Get-ChildItem",
  "Get-CimInstance",
  "Get-Command",
  "Join-Path",
  "Remove-Item",
  "Test-Path",
  "Write-Output",
]);
const KEYWORDS = new Set([
  "catch",
  "else",
  "foreach",
  "if",
  "in",
  "throw",
  "try",
]);
const TOKEN = /"(?:[^"`]|`.)*"|'(?:[^']|'')*'|\$[\w:]+|-\w+|\b[\w-]+\b/g;

function highlightLine(line: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const commentAt = line.indexOf("#");
  const source = commentAt < 0 ? line : line.slice(0, commentAt);
  const comment = commentAt < 0 ? "" : line.slice(commentAt);
  let cursor = 0;
  for (const match of source.matchAll(TOKEN)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > cursor) parts.push(source.slice(cursor, start));
    const style = token.startsWith("$")
      ? "syntax-variable"
      : token.startsWith("-")
        ? "syntax-parameter"
        : token.startsWith('"') || token.startsWith("'")
          ? "syntax-string"
          : COMMANDS.has(token)
            ? "syntax-command"
            : KEYWORDS.has(token)
              ? "syntax-keyword"
              : "";
    parts.push(
      style ? (
        <span className={style} key={`${start}-${token}`}>
          {token}
        </span>
      ) : (
        token
      ),
    );
    cursor = start + token.length;
  }
  if (cursor < source.length) parts.push(source.slice(cursor));
  if (comment)
    parts.push(
      <span className="syntax-comment" key="comment">
        {comment}
      </span>,
    );
  return parts;
}

export function ScriptPreview({ script }: { script: string }) {
  const [copied, setCopied] = useState(false);
  const lines = script.split("\n");

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <details className="cleaner-preview">
      <summary>
        <span>
          <Code2 size={16} /> View selected machine script
        </span>
        <span>{lines.length} lines</span>
      </summary>
      <div className="preview-toolbar">
        <span>PowerShell · Same as the executable code</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={copyScript}
          title="Copy the script"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre aria-label="PowerShell script preview">
        <code>
          {lines.map((line, index) => (
            <span className="code-line" key={`${index}-${line}`}>
              <span className="code-line-number" aria-hidden="true">
                {index + 1}
              </span>
              <span>{highlightLine(line)}</span>
            </span>
          ))}
        </code>
      </pre>
    </details>
  );
}
