"use server";

import { auth } from "@/auth";
import { resolveIsPublicHost } from "@/lib/link-preview/ssrf-guard";

const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 512_000;

export type LinkPreviewData = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string;
};

function extractMetaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const forward = new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i").exec(html);
  if (forward) return forward[1];
  const backward = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["']`, "i").exec(html);
  return backward ? backward[1] : null;
}

function extractTitleTag(html: string): string | null {
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return match ? match[1].trim() || null : null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Fetches `startUrl`'s HTML, following redirects manually (so each hop can be re-validated —
 * see resolveIsPublicHost) up to MAX_REDIRECTS, capping how much body is actually read. Returns
 * null for anything that doesn't cleanly resolve to a small, public, HTML response — a link
 * preview is a nice-to-have, so any failure here just means no card, not an error surfaced to
 * the seller. */
async function safeFetchHtml(startUrl: string): Promise<{ html: string; finalUrl: string } | null> {
  let current = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = new URL(current);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!(await resolveIsPublicHost(url.hostname))) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ChatmeoLinkPreview/1.0)" },
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      current = new URL(location, url).toString();
      continue;
    }

    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(value);
    }
    const html = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
    return { html, finalUrl: url.toString() };
  }
  return null;
}

/** Builds an OpenGraph-style preview card (title/description/image) for a URL found in an Inbox
 * message — session-gated (never a public open proxy) and defended against SSRF (see
 * ssrf-guard.ts). Returns null for anything that fails or has nothing worth showing; the Inbox
 * just renders the message as plain text in that case. */
export async function getLinkPreview(rawUrl: string): Promise<LinkPreviewData | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const result = await safeFetchHtml(parsed.toString()).catch(() => null);
  if (!result) return null;

  const title = extractMetaContent(result.html, "og:title") ?? extractTitleTag(result.html);
  const description = extractMetaContent(result.html, "og:description");
  const image = extractMetaContent(result.html, "og:image");
  const siteName = extractMetaContent(result.html, "og:site_name");

  if (!title && !description && !image) return null;

  let resolvedImage: string | null = null;
  if (image) {
    try {
      resolvedImage = new URL(image, result.finalUrl).toString();
    } catch {
      resolvedImage = null;
    }
  }

  return {
    url: result.finalUrl,
    title: title ? decodeHtmlEntities(title) : null,
    description: description ? decodeHtmlEntities(description) : null,
    image: resolvedImage,
    siteName: siteName ? decodeHtmlEntities(siteName) : new URL(result.finalUrl).hostname,
  };
}
