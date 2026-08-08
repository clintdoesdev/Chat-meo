// Meta Graph API calls for the WhatsApp Embedded Signup flow and the inbound webhook. Kept
// apart from the API routes (src/app/api/whatsapp/connect/route.ts,
// src/app/api/webhooks/whatsapp/route.ts) so those stay thin orchestration and this file stays
// free of Next.js/request concerns.
//
// Bump this if Meta deprecates it; there's nothing else version-specific in this file.
import { createHmac, timingSafeEqual } from "crypto";

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
  jsonBody?: unknown,
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

  const response = await fetch(url, {
    method,
    ...(jsonBody !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(jsonBody) }
      : {}),
  });
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

const WHATSAPP_TEXT_MESSAGE_LIMIT = 4096;

/** Splits a reply into pieces that fit WhatsApp's hard 4096-character text message limit —
 * unlike the widget (which just renders one long bubble), a reply here that ignores this limit
 * is rejected outright by the Graph API. Prefers splitting on the nearest preceding newline or
 * space so a chunk boundary doesn't land mid-word; falls back to a hard cut only when there's no
 * such break in the back half of the limit. Exported for direct unit testing. */
export function chunkWhatsAppText(text: string, limit = WHATSAPP_TEXT_MESSAGE_LIMIT): string[] {
  if (text.length <= limit) return [text];

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let splitAt = rest.lastIndexOf("\n", limit);
    if (splitAt < limit / 2) splitAt = rest.lastIndexOf(" ", limit);
    if (splitAt < limit / 2) splitAt = limit;
    chunks.push(rest.slice(0, splitAt).trimEnd());
    rest = rest.slice(splitAt).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/** Sends one engine reply as one or more WhatsApp text messages (see chunkWhatsAppText above),
 * to `to` (the customer's wa_id) from the bot's connected number. Sequential rather than
 * parallel so a multi-chunk reply arrives in reading order. */
export async function sendWhatsAppTextMessage(
  phoneNumberId: string,
  to: string,
  text: string,
  accessToken: string,
): Promise<void> {
  for (const chunk of chunkWhatsAppText(text)) {
    await graphFetch(
      `/${phoneNumberId}/messages`,
      "send message",
      { access_token: accessToken },
      "POST",
      { messaging_product: "whatsapp", to, type: "text", text: { body: chunk } },
    );
  }
}

/** Verifies Meta's X-Hub-Signature-256 header against the raw request body — must pass before
 * anything else touches an inbound webhook payload. Without this check, anyone who finds the
 * webhook URL could post fabricated messages and trigger the runtime engine (at our AI-provider
 * cost) as if they came from a real WhatsApp customer. `rawBody` must be the exact bytes Meta
 * sent, read before JSON.parse — the HMAC is over the raw payload, not any re-serialization of
 * it, so parsing first and re-stringifying would produce a signature mismatch even for a
 * legitimate request. */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  const prefix = "sha256=";
  if (!signatureHeader?.startsWith(prefix)) return false;

  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex"), "hex");
  const provided = Buffer.from(signatureHeader.slice(prefix.length), "hex");
  // timingSafeEqual throws on mismatched lengths rather than returning false — a malformed or
  // wrong-length header must be caught here first, not let this throw out of a security check.
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
