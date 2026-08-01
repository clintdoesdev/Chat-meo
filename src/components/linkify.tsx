import type { ReactNode } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION = /[.,!?;:'")\]}]$/;

/**
 * Splits chat message text on URLs (http(s):// or bare www.) and renders each as a real
 * anchor, trimming trailing sentence punctuation so "see https://x.com." doesn't link the
 * period. Returns plain strings interleaved with <a> elements — safe to drop into JSX same
 * as the raw string was before, no dangerouslySetInnerHTML involved.
 */
export function linkify(text: string, linkClassName?: string): ReactNode[] {
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
      nodes.push(text.slice(lastIndex, match.index));
    }
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    nodes.push(
      <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        {raw}
      </a>,
    );
    if (trailing) nodes.push(trailing);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
