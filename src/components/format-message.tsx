import type { ReactNode } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:'")\]}]$/;

// Bold+italic, bold, italic, inline code — deliberately not full markdown (no headings, lists,
// links-by-syntax, code fences): chat replies are short, and URLs are already auto-linked below
// without needing `[text](url)` syntax. Longest delimiters first so "***x***" doesn't get eaten
// by the "**" pattern first and leave stray asterisks.
const EMPHASIS_PATTERN = /(\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;

function formatEmphasis(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = new RegExp(EMPHASIS_PATTERN);
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const raw = match[0];
    const nodeKey = `${keyPrefix}-e${key++}`;

    if (raw.startsWith("***") || raw.startsWith("___")) {
      nodes.push(
        <strong key={nodeKey}>
          <em>{raw.slice(3, -3)}</em>
        </strong>,
      );
    } else if (raw.startsWith("**") || raw.startsWith("__")) {
      nodes.push(<strong key={nodeKey}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith("`")) {
      nodes.push(
        <code key={nodeKey} className="rounded bg-white/[.12] px-1 py-0.5 font-mono text-[0.92em]">
          {raw.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<em key={nodeKey}>{raw.slice(1, -1)}</em>);
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/**
 * Renders a chat message's plain-text content as real formatting instead of raw markdown
 * characters — models routinely reply with bold/italic emphasis markup, and without this
 * those asterisks/underscores just show up literally in the bubble. Also auto-links URLs
 * (http(s):// or bare www.), same behavior this replaces linkify() with. Returns plain strings
 * interleaved with <strong>/<em>/<code>/<a> elements — safe to drop into JSX same as the raw
 * string was before, no dangerouslySetInnerHTML involved.
 *
 * URL-splitting runs first and emphasis parsing only sees the text segments between links, so a
 * URL embedded *inside* an emphasis span (e.g. "**see https://x.com**") won't format — an
 * acceptable gap for short chat replies, not worth a full unified tokenizer.
 */
export function formatMessage(text: string, linkClassName?: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = new RegExp(URL_PATTERN);
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    let raw = match[0];
    let trailing = "";
    while (raw.length > 0 && TRAILING_PUNCTUATION.test(raw)) {
      trailing = raw[raw.length - 1] + trailing;
      raw = raw.slice(0, -1);
    }
    if (!raw) continue;

    if (match.index > lastIndex) {
      nodes.push(...formatEmphasis(text.slice(lastIndex, match.index), `t${key}`));
    }
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    nodes.push(
      <a key={`l${key++}`} href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        {raw}
      </a>,
    );
    if (trailing) nodes.push(trailing);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(...formatEmphasis(text.slice(lastIndex), `t${key}`));
  return nodes;
}
