import type { CSSProperties, ReactNode } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/;
// Tries the markdown-link form first (well-delimited, so no trailing-punctuation ambiguity),
// then falls back to a bare URL.
const LINK_PATTERN = new RegExp(`${MARKDOWN_LINK_PATTERN.source}|${URL_PATTERN.source}`, "gi");
const TRAILING_PUNCTUATION = /[.,!?;:'")\]}]$/;

// Bold+italic, strikethrough, bold, italic, inline code, hashtag — deliberately not full
// markdown (no nested lists, tables, code fences): chat replies are short. Longest delimiters
// first so "***x***" doesn't get eaten by the "**" pattern first and leave stray asterisks. The
// hashtag branch's lookbehind keeps it from firing mid-word (e.g. "C#", "page#3").
const EMPHASIS_PATTERN =
  /(\*\*\*[^*]+\*\*\*|___[^_]+___|~~[^~]+~~|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|(?<![&\w])#[a-zA-Z][\w-]{0,40})/g;

const CODE_STYLE: CSSProperties = {
  borderRadius: "4px",
  background: "rgba(255,255,255,.12)",
  padding: "1px 5px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.9em",
};

const HASHTAG_STYLE: CSSProperties = { color: "#FF8A3C", fontWeight: 600 };

const HEADING_SIZE: Record<1 | 2 | 3, CSSProperties> = {
  1: { fontSize: "1.15em", fontWeight: 800 },
  2: { fontSize: "1.08em", fontWeight: 700 },
  3: { fontSize: "1.02em", fontWeight: 700 },
};

const LIST_STYLE: CSSProperties = { margin: "4px 0", paddingLeft: "1.3em" };

const BLOCKQUOTE_STYLE: CSSProperties = {
  margin: "4px 0",
  padding: "1px 0 1px 10px",
  borderLeft: "3px solid rgba(255,255,255,.25)",
  opacity: 0.85,
};

const HR_STYLE: CSSProperties = { border: "none", borderTop: "1px solid rgba(255,255,255,.15)", margin: "8px 0" };

const LINK_CHIP_STYLE: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "5px", flexWrap: "wrap" };

const LINK_PREVIEW_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "3px",
  padding: "1px 7px",
  borderRadius: "999px",
  background: "rgba(255,255,255,.08)",
  color: "rgba(255,255,255,.5)",
  fontSize: "0.76em",
  lineHeight: 1.7,
};

/** A small chain-link glyph so a shared link reads as "this opens something," WhatsApp/Telegram
 * link-preview style — without fetching the URL's actual metadata (no server round trip, no
 * risk of hitting an attacker-controlled or internal URL just because it appeared in a chat). */
function LinkGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
      <path
        d="M10 14a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 5.5M14 10a5 5 0 0 0-7.07 0L4.1 12.83a5 5 0 0 0 7.07 7.07L12.5 18.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function renderLinkChip(display: string, href: string, key: string, linkClassName?: string): ReactNode {
  let hostname: string;
  try {
    hostname = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    hostname = href;
  }
  return (
    <span key={key} style={LINK_CHIP_STYLE}>
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
        {display}
      </a>
      <span style={LINK_PREVIEW_STYLE}>
        <LinkGlyph />
        {hostname}
      </span>
    </span>
  );
}

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
    } else if (raw.startsWith("~~")) {
      nodes.push(<s key={nodeKey}>{raw.slice(2, -2)}</s>);
    } else if (raw.startsWith("**") || raw.startsWith("__")) {
      nodes.push(<strong key={nodeKey}>{raw.slice(2, -2)}</strong>);
    } else if (raw.startsWith("`")) {
      nodes.push(
        <code key={nodeKey} style={CODE_STYLE}>
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (raw.startsWith("#")) {
      nodes.push(
        <span key={nodeKey} style={HASHTAG_STYLE}>
          {raw}
        </span>,
      );
    } else {
      nodes.push(<em key={nodeKey}>{raw.slice(1, -1)}</em>);
    }
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/** Inline-level formatting for a single line: links (markdown `[text](url)` or bare
 * http(s)/www) plus emphasis/code/hashtags on everything in between. Block parsing (see
 * formatMessage below) always hands this a single line with any block syntax already
 * stripped off, so headings/lists/quotes never leak into here. */
function renderLine(text: string, keyPrefix: string, linkClassName?: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = new RegExp(LINK_PATTERN);
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    let display: string;
    let href: string;
    let trailing = "";

    if (match[1] !== undefined && match[2] !== undefined) {
      display = match[1];
      href = match[2];
    } else {
      let raw = match[3];
      while (raw.length > 0 && TRAILING_PUNCTUATION.test(raw)) {
        trailing = raw[raw.length - 1] + trailing;
        raw = raw.slice(0, -1);
      }
      if (!raw) continue;
      display = raw;
      href = raw.startsWith("http") ? raw : `https://${raw}`;
    }

    if (match.index > lastIndex) {
      nodes.push(...formatEmphasis(text.slice(lastIndex, match.index), `${keyPrefix}-t${key}`));
    }
    nodes.push(renderLinkChip(display, href, `${keyPrefix}-l${key++}`, linkClassName));
    if (trailing) nodes.push(trailing);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(...formatEmphasis(text.slice(lastIndex), `${keyPrefix}-t${key}`));
  return nodes;
}

const HEADING_PATTERN = /^(#{1,3})\s+(.*)$/;
const HR_PATTERN = /^(-{3,}|\*{3,}|_{3,})$/;
const BLOCKQUOTE_PATTERN = /^>\s?(.*)$/;
const UNORDERED_ITEM_PATTERN = /^[-*+]\s+(.*)$/;
const ORDERED_ITEM_PATTERN = /^\d+\.\s+(.*)$/;

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "hr" }
  | { kind: "blockquote"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "paragraph"; lines: string[] };

/** Groups a message's raw lines into block-level structures (headings, lists, blockquotes, hr,
 * plain paragraphs) — the markdown constructs that need more than an inline regex swap because
 * they depend on where a line starts, not just characters embedded in it. */
function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const heading = HEADING_PATTERN.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      i++;
      continue;
    }

    if (HR_PATTERN.test(line.trim())) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    if (BLOCKQUOTE_PATTERN.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && BLOCKQUOTE_PATTERN.test(lines[i])) {
        quoteLines.push(BLOCKQUOTE_PATTERN.exec(lines[i])![1]);
        i++;
      }
      blocks.push({ kind: "blockquote", lines: quoteLines });
      continue;
    }

    if (UNORDERED_ITEM_PATTERN.test(line)) {
      const items: string[] = [];
      while (i < lines.length && UNORDERED_ITEM_PATTERN.test(lines[i])) {
        items.push(UNORDERED_ITEM_PATTERN.exec(lines[i])![1]);
        i++;
      }
      blocks.push({ kind: "list", ordered: false, items });
      continue;
    }

    if (ORDERED_ITEM_PATTERN.test(line)) {
      const items: string[] = [];
      while (i < lines.length && ORDERED_ITEM_PATTERN.test(lines[i])) {
        items.push(ORDERED_ITEM_PATTERN.exec(lines[i])![1]);
        i++;
      }
      blocks.push({ kind: "list", ordered: true, items });
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !HEADING_PATTERN.test(lines[i]) &&
      !HR_PATTERN.test(lines[i].trim()) &&
      !BLOCKQUOTE_PATTERN.test(lines[i]) &&
      !UNORDERED_ITEM_PATTERN.test(lines[i]) &&
      !ORDERED_ITEM_PATTERN.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "paragraph", lines: paragraphLines });
  }

  return blocks;
}

/**
 * Renders a chat message's plain-text content as real formatting instead of raw markdown
 * characters — models routinely reply with bold/italic/heading/list markup, and without this
 * those asterisks/hashes/dashes just show up literally in the bubble. Also auto-links URLs
 * (bare http(s)/www, or `[text](url)`), wrapping each with a small WhatsApp-style preview chip
 * (a link glyph plus the hostname). Returns plain strings interleaved with formatting elements —
 * safe to drop into JSX same as the raw string was before, no dangerouslySetInnerHTML involved.
 *
 * A single line with nothing to format renders as the exact same plain string as before (no
 * wrapper element) — only messages that actually use block syntax (headings, lists, quotes, hr)
 * get the extra structure.
 */
export function formatMessage(text: string, linkClassName?: string): ReactNode[] {
  const blocks = parseBlocks(text);
  const nodes: ReactNode[] = [];
  let previousKind: Block["kind"] | null = null;

  blocks.forEach((block, blockIndex) => {
    const keyPrefix = `b${blockIndex}`;

    switch (block.kind) {
      case "heading":
        nodes.push(
          <div
            key={keyPrefix}
            style={{ ...HEADING_SIZE[block.level], margin: blockIndex === 0 ? "0 0 4px" : "10px 0 4px" }}
          >
            {renderLine(block.text, keyPrefix, linkClassName)}
          </div>,
        );
        break;

      case "hr":
        nodes.push(<hr key={keyPrefix} style={HR_STYLE} />);
        break;

      case "blockquote":
        nodes.push(
          <blockquote key={keyPrefix} style={BLOCKQUOTE_STYLE}>
            {block.lines.map((line, i) => (
              <span key={i}>
                {renderLine(line, `${keyPrefix}-${i}`, linkClassName)}
                {i < block.lines.length - 1 && <br />}
              </span>
            ))}
          </blockquote>,
        );
        break;

      case "list": {
        const items = block.items.map((item, i) => (
          <li key={i}>{renderLine(item, `${keyPrefix}-${i}`, linkClassName)}</li>
        ));
        nodes.push(
          block.ordered ? (
            <ol key={keyPrefix} style={LIST_STYLE}>
              {items}
            </ol>
          ) : (
            <ul key={keyPrefix} style={LIST_STYLE}>
              {items}
            </ul>
          ),
        );
        break;
      }

      case "paragraph":
        // Two consecutive paragraphs came from a blank line in the source — preserve that gap
        // (block-level elements above/below already carry their own margins for spacing).
        if (previousKind === "paragraph") {
          nodes.push(<br key={`${keyPrefix}-gap1`} />, <br key={`${keyPrefix}-gap2`} />);
        }
        block.lines.forEach((line, i) => {
          nodes.push(...renderLine(line, `${keyPrefix}-${i}`, linkClassName));
          if (i < block.lines.length - 1) nodes.push(<br key={`${keyPrefix}-br${i}`} />);
        });
        break;
    }

    previousKind = block.kind;
  });

  return nodes;
}
