// Meta Graph API calls for the WhatsApp Embedded Signup flow. Kept apart from the API route
// (src/app/api/whatsapp/connect/route.ts) so that route stays thin orchestration — auth, then
// call these in order, then persist — and this file stays free of Next.js/request concerns.
//
// Bump this if Meta deprecates it; there's nothing else version-specific in this file.
const GRAPH_API_VERSION = "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly step: string,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}

export type MetaAppConfig = { appId: string; appSecret: string; configId: string };

/** Reads the three Meta app identifiers this integration needs. Throws with a specific message
 * naming whichever is missing, rather than a generic "not configured" — these come from three
 * different places in the Meta App Dashboard (see README), so knowing which one is blank saves a
 * trip back through all of them. */
export function requireMetaAppConfig(): MetaAppConfig {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const configId = process.env.META_CONFIG_ID;
  if (!appId) throw new Error("META_APP_ID is not configured.");
  if (!appSecret) throw new Error("META_APP_SECRET is not configured.");
  if (!configId) throw new Error("META_CONFIG_ID is not configured.");
  return { appId, appSecret, configId };
}

/** Same as requireMetaAppConfig, but returns null instead of throwing — for read paths (like the
 * "is WhatsApp connect even set up?" check the Studio tab uses) that want to degrade gracefully
 * rather than 500. */
export function getMetaAppConfig(): MetaAppConfig | null {
  try {
    return requireMetaAppConfig();
  } catch {
    return null;
  }
}

async function graphFetch<T>(
  path: string,
  step: string,
  params?: Record<string, string>,
  method: "GET" | "POST" = "GET",
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url, { method });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      json && typeof json === "object" && "error" in json && json.error && typeof json.error === "object"
        ? String((json.error as { message?: unknown }).message ?? response.statusText)
        : response.statusText;
    throw new MetaGraphError(`Meta API error during ${step}: ${message}`, step);
  }
  return json as T;
}

/** Step 1 of the token exchange: the `code` FB.login's callback hands back is short-lived and
 * tied to this specific app+redirect — exchange it for a short-lived user access token before it
 * can be used for anything else. */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const { appId, appSecret } = requireMetaAppConfig();
  const json = await graphFetch<{ access_token?: string }>("/oauth/access_token", "code exchange", {
    client_id: appId,
    client_secret: appSecret,
    code,
  });
  if (!json.access_token) {
    throw new MetaGraphError("Meta did not return an access token for this code.", "code exchange");
  }
  return json.access_token;
}

/** Step 2: trade the short-lived token for a long-lived one (~60 days, auto-renewing on use) —
 * what actually gets stored, since a short-lived token would need re-authing constantly. */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  const { appId, appSecret } = requireMetaAppConfig();
  const json = await graphFetch<{ access_token?: string }>("/oauth/access_token", "long-lived token exchange", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  if (!json.access_token) {
    throw new MetaGraphError("Meta did not return a long-lived access token.", "long-lived token exchange");
  }
  return json.access_token;
}

export type WhatsAppAssets = { wabaId: string; phoneNumberId: string; displayPhoneNumber: string };

/** Resolves which WABA and phone number this token was actually granted for. The Embedded
 * Signup postMessage 'FINISH' event (see the connect button component) hands these over
 * directly on the happy path — this discovery call is the fallback for when that event's data
 * didn't make it through (dropped message, browser quirk, older SDK build), so a connection
 * doesn't just fail outright. Assumes a Tech Provider setup, where the signed-up WABA shows up
 * under the shared business's *client* WhatsApp accounts, not owned ones — adjust the edge below
 * if this app is configured as a Solution Partner instead. */
export async function discoverWhatsAppAssets(accessToken: string): Promise<WhatsAppAssets> {
  const businesses = await graphFetch<{ data?: { id: string }[] }>("/me/businesses", "business discovery", {
    access_token: accessToken,
  });
  const businessId = businesses.data?.[0]?.id;
  if (!businessId) {
    throw new MetaGraphError(
      "No shared business found for this token — the signup may not have finished granting access.",
      "business discovery",
    );
  }

  const wabas = await graphFetch<{ data?: { id: string }[] }>(
    `/${businessId}/client_whatsapp_business_accounts`,
    "WABA discovery",
    { access_token: accessToken },
  );
  const wabaId = wabas.data?.[0]?.id;
  if (!wabaId) {
    throw new MetaGraphError("No WhatsApp Business Account found for this business.", "WABA discovery");
  }

  const phoneNumbers = await graphFetch<{ data?: { id: string; display_phone_number: string }[] }>(
    `/${wabaId}/phone_numbers`,
    "phone number discovery",
    { access_token: accessToken },
  );
  const phone = phoneNumbers.data?.[0];
  if (!phone) {
    throw new MetaGraphError("No phone number found for this WhatsApp Business Account.", "phone number discovery");
  }

  return { wabaId, phoneNumberId: phone.id, displayPhoneNumber: phone.display_phone_number };
}

/** Looks up just the display phone number for a WABA/phone number pair the client already
 * handed us (the common case) — cheaper than the full discovery walk above when we already know
 * which WABA and phone number, just not how to show it. */
export async function fetchDisplayPhoneNumber(phoneNumberId: string, accessToken: string): Promise<string> {
  const json = await graphFetch<{ display_phone_number?: string }>(
    `/${phoneNumberId}`,
    "phone number lookup",
    { access_token: accessToken, fields: "display_phone_number" },
  );
  if (!json.display_phone_number) {
    throw new MetaGraphError("Meta didn't return a display phone number for this number.", "phone number lookup");
  }
  return json.display_phone_number;
}

/** Registers our app to receive webhook events (inbound messages, status updates) for this WABA
 * — without this, the connection is stored but nothing ever arrives at our webhook. */
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
  await graphFetch(`/${wabaId}/subscribed_apps`, "webhook subscription", { access_token: accessToken }, "POST");
}
