/**
 * CORS headers for the public chat endpoints. The widget iframe itself talks to /api/chat and
 * /api/chat/history same-origin (the iframe is served from this app, so its own fetches never
 * hit CORS at all) — these headers exist for a "headless" integration that calls the API
 * directly from the embedding page's own origin instead of going through the iframe.
 *
 * Only ever reflects an origin that already passed the domain-allowlist check (never '*'),
 * since these endpoints return conversation content, not public data.
 */
export function corsHeaders(origin: string | null): HeadersInit {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Embed-Host",
    Vary: "Origin",
  };
}
