// Meta Graph API calls for the WhatsApp Embedded Signup flow and the inbound webhook. Kept
// apart from the API routes (src/app/api/whatsapp/connect/route.ts,
// src/app/api/webhooks/whatsapp/route.ts) so those stay thin orchestration and this file stays
// free of Next.js/request concerns.
//
// Bump this if Meta deprecates it; there's nothing else version-specific in this file.
import { createHmac, randomInt, timingSafeEqual } from "crypto";

const GRAPH_API_VERSION = "v23.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly step: string,
    // Meta's numeric error code (e.g. 133010), when the response included one — lets callers
    // recognize specific known failure modes (like "already registered") without parsing message
    // text, which Meta doesn't guarantee the wording of.
    public readonly code?: number,
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

/** Builds the URL that starts WhatsApp Embedded Signup as a full-page redirect (Meta's
 * `/dialog/oauth` endpoint) rather than the Facebook JS SDK's popup — the popup relies on a live
 * `window.opener` reference to hand the result back, which mobile browsers frequently break
 * (the popup completes but the tab that opened it never hears about it). A redirect has no such
 * dependency: the browser navigates away and Meta redirects it straight back to `redirectUri`
 * with `?code=...&state=...` (or `?error=...` if the seller cancels), exactly like any other
 * OAuth provider. `state` is the caller's responsibility to generate and verify on the way back
 * — see src/app/api/whatsapp/connect/start/route.ts. */
export function buildEmbeddedSignupUrl(params: { redirectUri: string; state: string }): string {
  const { appId, configId } = requireMetaAppConfig();
  const url = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("config_id", configId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("override_default_response_type", "true");
  url.searchParams.set("state", params.state);
  return url.toString();
}

async function graphFetch<T>(
  path: string,
  step: string,
  params?: Record<string, string>,
  method: "GET" | "POST" | "DELETE" = "GET",
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
    const errorObj =
      json && typeof json === "object" && "error" in json && json.error && typeof json.error === "object"
        ? (json.error as { message?: unknown; code?: unknown })
        : undefined;
    const message = String(errorObj?.message ?? response.statusText);
    const code = typeof errorObj?.code === "number" ? errorObj.code : undefined;
    throw new MetaGraphError(`Meta API error during ${step}: ${message}`, step, code);
  }
  return json as T;
}

/** Step 1 of the token exchange: the `code` the OAuth callback hands back is short-lived and
 * tied to this specific app+redirect_uri pair — Meta rejects the exchange unless `redirect_uri`
 * here is byte-for-byte identical to the one used in the original `/dialog/oauth` request (see
 * buildEmbeddedSignupUrl), even though the browser has already left that URL by this point. */
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
  const { appId, appSecret } = requireMetaAppConfig();
  const json = await graphFetch<{ access_token?: string }>("/oauth/access_token", "code exchange", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
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

/** Resolves which WABA this token was actually granted for — the only way to find out, now that
 * this flow is a plain OAuth redirect rather than the JS SDK popup (which could hand this over
 * directly via a postMessage 'FINISH' event). `/me/businesses` and the client/owned WABA edges
 * all need the separate `business_management` permission, which the WhatsApp Embedded Signup
 * configuration never grants — it only requests `whatsapp_business_management` and
 * `whatsapp_business_messaging` (Meta rejects those calls with "(#100) Missing Permission"
 * otherwise). The Access Token Debugger doesn't have that problem: it's authenticated with the
 * *app's* own credentials rather than the user token's permissions, and echoes back exactly which
 * WABA(s) whatsapp_business_management was granted for as `granular_scopes` — precisely the
 * signal Embedded Signup is documented to hand over out-of-band from the token itself. */
export async function discoverWhatsAppAssets(accessToken: string): Promise<WhatsAppAssets> {
  const { appId, appSecret } = requireMetaAppConfig();
  const debug = await graphFetch<{
    data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] };
  }>("/debug_token", "WABA discovery", {
    input_token: accessToken,
    access_token: `${appId}|${appSecret}`,
  });
  const wabaId = debug.data?.granular_scopes?.find((s) => s.scope === "whatsapp_business_management")
    ?.target_ids?.[0];
  if (!wabaId) {
    throw new MetaGraphError(
      "No WhatsApp Business Account was granted to this token — the signup may not have finished.",
      "WABA discovery",
    );
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

// Meta's error code for "this number already has two-step verification set up" — thrown when
// registerPhoneNumber's generated PIN doesn't match one already on file. That's not a failure
// here: it means the number was already registered on the WhatsApp network by a previous
// connection attempt or (for Coexistence) by the WhatsApp Business App itself, so registration
// has nothing left to do.
const ALREADY_REGISTERED_ERROR_CODE = 133010;

/** Finishes activating a phone number on the Cloud API / WhatsApp network. Embedded Signup hands
 * back a phone_number_id once the seller picks a number, but a brand-new number (not linked via
 * Coexistence to an existing WhatsApp Business App number, which is already registered) still
 * needs this call before it's actually reachable — otherwise it sits associated with the WABA in
 * the Graph API while every WhatsApp client reports it as "not on WhatsApp". Safe to call
 * unconditionally: an already-registered number just rejects our made-up PIN with
 * ALREADY_REGISTERED_ERROR_CODE, which we treat as success rather than a real failure. */
export async function registerPhoneNumber(phoneNumberId: string, accessToken: string): Promise<void> {
  try {
    await graphFetch(
      `/${phoneNumberId}/register`,
      "phone number registration",
      { access_token: accessToken },
      "POST",
      { messaging_product: "whatsapp", pin: String(randomInt(0, 1_000_000)).padStart(6, "0") },
    );
  } catch (error) {
    if (error instanceof MetaGraphError && error.code === ALREADY_REGISTERED_ERROR_CODE) return;
    throw error;
  }
}

/** Registers our app to receive webhook events (inbound messages, status updates) for this WABA
 * — without this, the connection is stored but nothing ever arrives at our webhook. */
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<void> {
  await graphFetch(`/${wabaId}/subscribed_apps`, "webhook subscription", { access_token: accessToken }, "POST");
}

/** The Disconnect action's counterpart to subscribeAppToWaba — revokes our app's webhook
 * subscription for this WABA, so Meta stops delivering inbound messages here at all. This is
 * what actually distinguishes "disconnected" from "paused": pausing (WhatsAppConnection.isActive)
 * only stops us from running the engine on messages we still receive; disconnecting stops Meta
 * from sending them in the first place. */
export async function unsubscribeAppFromWaba(wabaId: string, accessToken: string): Promise<void> {
  await graphFetch(`/${wabaId}/subscribed_apps`, "webhook unsubscription", { access_token: accessToken }, "DELETE");
}

/** Converts an engine reply's Markdown (the same syntax the Studio/widget render properly) down
 * to plain text for WhatsApp. Deliberately doesn't translate to WhatsApp's own *bold* syntax:
 * a long reply can get split across multiple WhatsApp messages (see chunkWhatsAppText below),
 * which can separate a formatting marker's opening half from its closing half and leave literal
 * asterisks visible on the customer's phone — dropping the markers entirely instead is simpler
 * and always correct. Only applied to bot-generated replies (AI/Logic), never to a seller's own
 * typed Inbox reply — see the two call sites. Exported for direct unit testing. */
export function toWhatsAppText(markdown: string): string {
  let text = markdown;
  // [label](url) -> "label: url" — stripped of any emphasis markers inside the label itself,
  // since the emphasis passes below only run on what's left *outside* this replacement.
  text = text.replace(/\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) => {
    const cleanLabel = label.replace(/[*_`]/g, "").trim();
    return cleanLabel && cleanLabel !== url ? `${cleanLabel}: ${url}` : url;
  });
  // "- item" / "* item" bullets -> "• item", before the "*" emphasis pass below would otherwise
  // treat a bullet marker as the start of a bold/italic span.
  text = text.replace(/^[ \t]*[-*][ \t]+/gm, "• ");
  // Heading markers ("# ", "## ", …)
  text = text.replace(/^#{1,6}[ \t]+/gm, "");
  // Bold, italic, strikethrough, inline code — order matters: ** before single * so a bold span
  // doesn't get read as two adjacent italic ones.
  text = text.replace(/\*\*(.+?)\*\*/g, "$1");
  text = text.replace(/(?<![\w*])\*(?!\s)([^*]+?)(?<!\s)\*(?![\w*])/g, "$1");
  text = text.replace(/(?<!\w)_(?!\s)([^_]+?)(?<!\s)_(?!\w)/g, "$1");
  text = text.replace(/~~(.+?)~~/g, "$1");
  text = text.replace(/`([^`]+)`/g, "$1");
  return text;
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
 * parallel so a multi-chunk reply arrives in reading order. `preview_url: true` is what makes
 * WhatsApp actually fetch and render an OG-info card for a link in the text — without it, Meta
 * sends the message as plain text with no preview at all, regardless of how long the customer
 * waits. */
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
      { messaging_product: "whatsapp", to, type: "text", text: { body: chunk, preview_url: true } },
    );
  }
}

/** Marks the customer's inbound message as read and shows the "typing…" indicator on their side
 * for up to 25 seconds (or until we actually send a reply, whichever comes first) — Meta's
 * combined read-receipt-plus-typing-indicator call. Best-effort by design: called right before
 * the engine runs (which can take a few seconds for an AI node's LLM call), so a customer isn't
 * left staring at silence; callers should catch rather than let a failure here block the reply
 * that follows. */
export async function markWhatsAppMessageReadWithTyping(
  phoneNumberId: string,
  waMessageId: string,
  accessToken: string,
): Promise<void> {
  await graphFetch(
    `/${phoneNumberId}/messages`,
    "typing indicator",
    { access_token: accessToken },
    "POST",
    { messaging_product: "whatsapp", status: "read", message_id: waMessageId, typing_indicator: { type: "text" } },
  );
}

/** Step 1 of downloading an inbound image (or any other media type): a webhook payload only ever
 * hands over a media *id*, not a URL — this resolves it to a direct download URL, valid for a few
 * minutes. */
export async function getWhatsAppMediaUrl(mediaId: string, accessToken: string): Promise<string> {
  const json = await graphFetch<{ url?: string }>(`/${mediaId}`, "media lookup", { access_token: accessToken });
  if (!json.url) {
    throw new MetaGraphError("Meta did not return a download URL for this media.", "media lookup");
  }
  return json.url;
}

/** Step 2: downloads the actual bytes from the URL getWhatsAppMediaUrl returned. Unlike every
 * other call in this file, the URL isn't a `/v23.0/...` Graph API path (Meta hands back a full
 * CDN-style URL), so it can't go through graphFetch — but it still needs the same access token,
 * as a Bearer header this time rather than an `access_token` query param. Returns a `data:` URI
 * ready to store directly in Message.content — no blob storage in this app (see Bot.avatarUrl's
 * schema doc comment), so an inbound image's bytes live directly in the database, same as an
 * uploaded avatar's. */
export async function downloadWhatsAppMedia(mediaUrl: string, accessToken: string): Promise<string> {
  const response = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) {
    throw new MetaGraphError(`Meta API error during media download: ${response.statusText}`, "media download");
  }
  const mimeType = response.headers.get("content-type") ?? "application/octet-stream";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

export type WhatsAppBusinessProfile = {
  /** Current verified display name, if Meta has one on file yet. */
  name: string | null;
  /** Meta's review state for `name` (e.g. "APPROVED", "PENDING_REVIEW", "REJECTED") — whatever
   * string Meta returns, passed through as-is rather than mapped to our own enum, since this is
   * display-only and Meta's exact set of values isn't stable/documented enough to lock in. */
  nameStatus: string | null;
  profilePictureUrl: string | null;
};

/** Reads this number's live verified display name (and Meta's review status for it) plus the
 * current profile picture URL. Always fetched fresh rather than cached anywhere — name_status in
 * particular changes asynchronously as Meta's own review completes, so a stale cache would show
 * the wrong thing right when it matters most. */
export async function getWhatsAppBusinessProfile(
  phoneNumberId: string,
  accessToken: string,
): Promise<WhatsAppBusinessProfile> {
  const [numberInfo, profile] = await Promise.all([
    graphFetch<{ verified_name?: string; name_status?: string }>(`/${phoneNumberId}`, "business profile lookup", {
      access_token: accessToken,
      fields: "verified_name,name_status",
    }),
    graphFetch<{ data?: { profile_picture_url?: string }[] }>(
      `/${phoneNumberId}/whatsapp_business_profile`,
      "business profile lookup",
      { access_token: accessToken, fields: "profile_picture_url" },
    ),
  ]);
  return {
    name: numberInfo.verified_name ?? null,
    nameStatus: numberInfo.name_status ?? null,
    profilePictureUrl: profile.data?.[0]?.profile_picture_url ?? null,
  };
}

/** Step 1+2 of Meta's Resumable Upload API: registers an upload session sized for this exact
 * file against our own app id, then uploads the full byte payload to that session in one shot —
 * a profile picture is small enough that Meta's chunked/resumable retry dance (meant for large
 * media) isn't worth the complexity here. Returns the resulting file handle, which is short-lived
 * and only good for the one follow-up call that actually sets it as the profile picture. */
async function uploadMediaForHandle(bytes: Buffer, mimeType: string, accessToken: string): Promise<string> {
  const { appId } = requireMetaAppConfig();
  // file_name is required by this endpoint (confirmed against Meta's own curl example) even
  // though nothing downstream ever displays it — any name with the right extension satisfies it.
  const extension = mimeType.split("/")[1]?.split("+")[0] || "jpg";
  const session = await graphFetch<{ id?: string }>(
    `/${appId}/uploads`,
    "profile picture upload session",
    {
      file_name: `profile-picture.${extension}`,
      file_length: String(bytes.length),
      file_type: mimeType,
      access_token: accessToken,
    },
    "POST",
  );
  if (!session.id) {
    throw new MetaGraphError("Meta did not return an upload session id.", "profile picture upload session");
  }

  // The session id is the next request's path, and that request wants the raw bytes as its body
  // with an OAuth-style auth header — different enough from every other call in this file (JSON
  // body, access_token query param) that it can't reuse graphFetch. Meta's own docs show the id
  // already carrying its "upload:" prefix, but this tolerates either shape rather than silently
  // sending a malformed path if that's ever not the case.
  const sessionPath = session.id.startsWith("upload:") ? session.id : `upload:${session.id}`;
  const response = await fetch(new URL(`${GRAPH_BASE}/${sessionPath}`), {
    method: "POST",
    headers: { Authorization: `OAuth ${accessToken}`, file_offset: "0" },
    body: new Uint8Array(bytes),
  });
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const errorObj =
      json && typeof json === "object" && "error" in json && json.error && typeof json.error === "object"
        ? (json.error as { message?: unknown })
        : undefined;
    throw new MetaGraphError(
      `Meta API error during profile picture upload: ${String(errorObj?.message ?? response.statusText)}`,
      "profile picture upload",
    );
  }
  const handle = (json as { h?: string } | null)?.h;
  if (!handle) {
    throw new MetaGraphError("Meta did not return a file handle for the uploaded image.", "profile picture upload");
  }
  return handle;
}

/** Uploads a new profile picture and sets it as this number's WhatsApp Business Profile photo —
 * two Graph API calls under the hood (see uploadMediaForHandle above): get a file handle for the
 * bytes, then hand that handle to whatsapp_business_profile. Takes effect immediately, no review
 * required (unlike the display name below). */
export async function updateWhatsAppProfilePicture(
  phoneNumberId: string,
  imageBytes: Buffer,
  mimeType: string,
  accessToken: string,
): Promise<void> {
  const handle = await uploadMediaForHandle(imageBytes, mimeType, accessToken);
  await graphFetch(
    `/${phoneNumberId}/whatsapp_business_profile`,
    "profile picture update",
    { access_token: accessToken },
    "POST",
    { messaging_product: "whatsapp", profile_picture_handle: handle },
  );
}

/** Best-effort request to change this number's verified display name. Unlike everything else in
 * this file, changing a WhatsApp display name isn't a plain instant PATCH: Meta reviews every
 * change (typically up to ~24h, and only once the WABA's messaging limit has been raised past the
 * starter tier), and a display name is limited to 10 changes per rolling 30 days. There's also no
 * fully public, stable Cloud API endpoint for *submitting* the change documented outside Meta's
 * own WhatsApp Manager UI — this targets the same phone-number resource and field name
 * (verified_name) that number *creation* uses, the most REST-consistent shape Meta uses elsewhere
 * in this API for partial updates, but treat a failure here as a real possibility, not a bug:
 * callers must surface Meta's own error message rather than assume this always works. A
 * successful call means "submitted for review," never "changed immediately." */
export async function requestWhatsAppDisplayNameChange(
  phoneNumberId: string,
  newName: string,
  accessToken: string,
): Promise<void> {
  await graphFetch(
    `/${phoneNumberId}`,
    "display name change request",
    { access_token: accessToken },
    "POST",
    { messaging_product: "whatsapp", verified_name: newName },
  );
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
