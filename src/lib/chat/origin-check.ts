import type { NextRequest } from "next/server";

function extractHostname(value: string): string {
  try {
    return new URL(value).hostname;
  } catch {
    return value.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function matchesAllowlist(hostname: string, allowedDomains: string[]): boolean {
  return allowedDomains.some((entry) => {
    const allowedHost = extractHostname(entry);
    if (allowedHost.startsWith("*.")) {
      return hostname === allowedHost.slice(2) || hostname.endsWith(allowedHost.slice(1));
    }
    return hostname === allowedHost;
  });
}

/**
 * An empty allowedDomains list means the bot owner hasn't restricted embedding yet — permissive
 * by design. Once at least one domain is configured, `origin` (a full Origin-header-style URL)
 * must match one of them (supporting a "*.example.com" wildcard entry for subdomains).
 */
export function isOriginAllowed(origin: string | null, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;
  if (!origin) return false;

  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  return matchesAllowlist(hostname, allowedDomains);
}

/**
 * The public chat endpoints' actual gate: permissive only while a bot is still in test mode
 * *and* has no domains configured yet (so a fresh bot can be tried from the dashboard preview
 * or test-embed.html before the owner has set anything up). The moment either a domain gets
 * added (testMode flips off, see addAllowedDomain) or the bot is no longer fresh, this requires
 * a real hostname match. `hostname` (not a full Origin URL) is expected — see
 * resolveEmbedHostname, which is what actually produces it for a request.
 */
export function isChatRequestAllowed(
  hostname: string | null,
  access: { allowedDomains: string[]; testMode: boolean },
): boolean {
  if (access.allowedDomains.length === 0) {
    // No domains configured yet: fine while still testing, a hard no once the owner has left
    // test mode — they need to add at least one domain before this bot can serve real traffic.
    return access.testMode;
  }
  if (!hostname) return false;
  return matchesAllowlist(hostname, access.allowedDomains);
}

/**
 * Figures out which domain a public chat request is really coming from.
 *
 * The naive approach — read the request's own Origin/Referer header — doesn't work for this
 * widget: the chat UI runs inside an iframe served FROM this app (chatmeo.com), so its own
 * fetch() calls to /api/chat are same-origin to us no matter what third-party site embedded
 * that iframe. The browser has no header that carries "the page that framed me" on an
 * initiating document's own outgoing requests.
 *
 * What the browser *does* set correctly is `document.referrer` read from inside the iframe
 * itself — that reflects the parent page's URL. The widget page reads it client-side and sends
 * it along as X-Embed-Host (see src/components/widget/widget-chat.tsx); this function prefers
 * that, then falls back to a real Origin/Referer header for any caller that isn't going through
 * the iframe at all (e.g. a future direct/headless integration, where Origin *would* correctly
 * reflect the caller's own domain since that request is genuinely cross-origin).
 *
 * None of this is cryptographically unspoofable — a non-browser client can send any header it
 * likes — but that's an inherent limit of client-observable-origin checks in general, not
 * something specific to this approach; it correctly stops the common cases (widget pasted on
 * the wrong site, embed snippet copied somewhere it shouldn't be) that domain allowlisting is
 * actually meant to catch.
 */
export function resolveEmbedHostname(request: NextRequest): string | null {
  const embedHost = request.headers.get("x-embed-host");
  if (embedHost) return embedHost.toLowerCase();

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).hostname;
    } catch {
      // fall through
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).hostname;
    } catch {
      // fall through
    }
  }

  return null;
}

/** True when the resolved hostname is this app's own — the dashboard's "Get embed" live
 * preview runs the widget in an iframe on our own domain, and that should always work
 * regardless of a bot's configured allowedDomains/testMode state. */
export function isOwnHost(hostname: string | null, request: NextRequest): boolean {
  if (!hostname) return false;
  const appHost = request.headers.get("host");
  return appHost ? hostname === appHost.split(":")[0] : false;
}
