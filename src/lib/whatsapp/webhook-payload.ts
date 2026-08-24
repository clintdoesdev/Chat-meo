// Parses Meta's WhatsApp Business webhook payload (POST /api/webhooks/whatsapp). Deliberately
// permissive: a single delivery can bundle multiple entries/changes, and besides "messages"
// changes Meta also sends "statuses" (delivery/read receipts) and other change types this app
// doesn't act on yet — those are silently skipped rather than treated as errors, since a
// malformed-looking (to us) but legitimately-signed payload shouldn't make the endpoint 400.
import { z } from "zod";

const WebhookMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  /// Present on an image message — `id` is a media id (see getWhatsAppMediaUrl/
  /// downloadWhatsAppMedia in meta-graph.ts), not a fetchable URL by itself. `caption` is the
  /// optional text WhatsApp lets a customer attach alongside a photo.
  image: z.object({ id: z.string().min(1), caption: z.string().optional() }).optional(),
  /// Present on a `type: "reaction"` message — the customer tapping an emoji onto an earlier
  /// message (which can be one of ours or one of theirs). `emoji` is omitted/empty when the
  /// customer removed their reaction rather than set one.
  reaction: z.object({ message_id: z.string().min(1), emoji: z.string().optional() }).optional(),
  /// Unix epoch seconds, as a string, per Meta's own convention — when the customer actually
  /// sent this message, not when we received/parsed it. See InboundWhatsAppMessage.receivedAt.
  timestamp: z.string().optional(),
});

const WebhookStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["sent", "delivered", "read", "failed"]),
});

const WebhookChangeValueSchema = z.object({
  metadata: z.object({ phone_number_id: z.string().min(1) }).optional(),
  messages: z.array(WebhookMessageSchema).optional(),
  /// Delivery/read receipts for messages *we* sent — a separate array from `messages` above
  /// (which is only ever inbound). See extractStatusUpdates.
  statuses: z.array(WebhookStatusSchema).optional(),
});

const WebhookPayloadSchema = z.object({
  entry: z
    .array(
      z.object({
        changes: z.array(z.object({ value: WebhookChangeValueSchema })).optional(),
      }),
    )
    .optional(),
});

export type InboundWhatsAppMessage = {
  /** Our WhatsApp Business number's phone_number_id — what WhatsAppConnection is looked up by,
   * not the customer's number. */
  phoneNumberId: string;
  /** The customer's wa_id — used as this conversation's visitorId. */
  from: string;
  waMessageId: string;
  /** True only for a plain "text" message with a body. Non-text types (image, audio, location,
   * button replies, ...) still get a placeholder `content` so something sensible lands in the
   * seller's inbox, but the engine is never run for them — the flow-walking engine only knows
   * how to consume plain text input. */
  isText: boolean;
  content: string;
  /** Set only for an inbound "image" message — the Meta media id needed to actually download the
   * bytes (see getWhatsAppMediaUrl/downloadWhatsAppMedia in meta-graph.ts). Null for every other
   * message type, including text. */
  imageMediaId: string | null;
  /** The optional caption WhatsApp lets a customer attach to a photo. Null unless imageMediaId is
   * set and a caption was actually provided. */
  caption: string | null;
  /** When the customer actually sent this, from Meta's own `timestamp` field — used (not our
   * processing time) to track the 24h service window (see service-window.ts), so a delayed or
   * replayed webhook delivery doesn't look freshly-within-window just because we happened to
   * process it moments ago. Falls back to now if Meta's timestamp is missing or unparseable. */
  receivedAt: Date;
};

/** Pulls every actual inbound message out of one webhook delivery, ignoring anything that isn't
 * a "messages" change (status/receipt updates, etc.) or that fails the loose shape check above. */
export function extractInboundMessages(payload: unknown): InboundWhatsAppMessage[] {
  const parsed = WebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) return [];

  const out: InboundWhatsAppMessage[] = [];
  for (const entry of parsed.data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      for (const message of change.value.messages ?? []) {
        // Reactions and any other non-content message types (reaction, button-reply metadata
        // etc.) aren't messages of their own in our Inbox — reactions specifically are pulled out
        // separately by extractInboundReactions, applied to the message they target rather than
        // stored as a new row.
        if (message.type === "reaction") continue;
        const isText = message.type === "text" && Boolean(message.text?.body);
        const imageMediaId = message.type === "image" ? (message.image?.id ?? null) : null;
        const timestampMs = message.timestamp && /^\d+$/.test(message.timestamp) ? Number(message.timestamp) * 1000 : NaN;
        out.push({
          phoneNumberId,
          from: message.from,
          waMessageId: message.id,
          isText,
          content: isText
            ? message.text!.body
            : imageMediaId
              ? "[image]"
              : `[unsupported message type: ${message.type}]`,
          imageMediaId,
          caption: imageMediaId ? (message.image?.caption ?? null) : null,
          receivedAt: Number.isFinite(timestampMs) ? new Date(timestampMs) : new Date(),
        });
      }
    }
  }
  return out;
}

export type InboundWhatsAppReaction = {
  phoneNumberId: string;
  /** The customer's wa_id — same use as InboundWhatsAppMessage.from. */
  from: string;
  /** The waMessageId of the message being reacted to — may be one of ours or one of theirs. */
  targetWaMessageId: string;
  /** Empty/omitted means the customer removed their reaction rather than set one — see
   * Message.customerReaction's doc comment. */
  emoji: string;
};

/** Pulls WhatsApp reaction events (a customer tapping/removing an emoji on a message) out of one
 * webhook delivery — a `type: "reaction"` entry in the same `messages` array extractInboundMessages
 * reads, but never emitted by that function (see its own skip for this type) since a reaction
 * updates an existing Message row rather than creating a new one. */
export function extractInboundReactions(payload: unknown): InboundWhatsAppReaction[] {
  const parsed = WebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) return [];

  const out: InboundWhatsAppReaction[] = [];
  for (const entry of parsed.data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      for (const message of change.value.messages ?? []) {
        if (message.type !== "reaction" || !message.reaction) continue;
        out.push({
          phoneNumberId,
          from: message.from,
          targetWaMessageId: message.reaction.message_id,
          emoji: message.reaction.emoji ?? "",
        });
      }
    }
  }
  return out;
}

export type WhatsAppStatusUpdate = {
  phoneNumberId: string;
  /** The waMessageId of the message this status is about — always one *we* sent (Meta only
   * reports delivery/read status for outbound messages). */
  waMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
};

/** Pulls delivery/read-receipt status updates for our own sent messages out of one webhook
 * delivery — a separate `statuses` array from `messages`, so this never overlaps with
 * extractInboundMessages/extractInboundReactions's output. */
export function extractStatusUpdates(payload: unknown): WhatsAppStatusUpdate[] {
  const parsed = WebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) return [];

  const out: WhatsAppStatusUpdate[] = [];
  for (const entry of parsed.data.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      for (const status of change.value.statuses ?? []) {
        out.push({ phoneNumberId, waMessageId: status.id, status: status.status });
      }
    }
  }
  return out;
}

// A separate, deliberately loose schema for "account_update" changes — a different webhook field
// from "messages" above (only delivered if the WABA's webhook subscription includes it; see the
// README's WhatsApp webhook setup section), keyed by the WABA id on the entry rather than a
// phone_number_id in the change value. Meta doesn't publish a machine-checkable schema for this
// field the way it does for "messages", so every value field below is read defensively rather
// than validated by shape.
const LooseChangeSchema = z.object({ field: z.string().optional(), value: z.unknown() });
const LoosePayloadSchema = z.object({
  entry: z.array(z.object({ id: z.string().optional(), changes: z.array(LooseChangeSchema).optional() })).optional(),
});

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export type WhatsAppAccountEvent = {
  /** The WABA id an "account_update" delivery is keyed by (entry.id) — matched against
   * WhatsAppConnection.wabaId, not phoneNumberId, since Meta doesn't include a phone number here. */
  wabaId: string;
  kind: "BANNED" | "REINSTATED";
  /** Meta's own state string (e.g. "DISABLE"/"REINSTATE"), kept for the alert email's detail line
   * so a seller sees exactly what Meta reported rather than just our own label for it. */
  detail: string;
};

/**
 * Pulls WABA ban/reinstate events out of "account_update" webhook deliveries. Best-effort against
 * Meta's documented shape for this field (entry[].id = WABA id, changes[].value.banned_info
 * .waba_ban_state = "DISABLE" | "SCHEDULE_FOR_DISABLE" | "REINSTATE", sometimes alongside a
 * top-level value.event = "DISABLED") — has not been verified against a live delivery, so this
 * intentionally only acts on the two states it's confident about (DISABLE and REINSTATE) rather
 * than guessing at every possible shape Meta might send.
 */
export function extractAccountEvents(payload: unknown): WhatsAppAccountEvent[] {
  const parsed = LoosePayloadSchema.safeParse(payload);
  if (!parsed.success) return [];

  const out: WhatsAppAccountEvent[] = [];
  for (const entry of parsed.data.entry ?? []) {
    const wabaId = entry.id;
    if (!wabaId) continue;

    for (const change of entry.changes ?? []) {
      if (change.field !== "account_update") continue;
      const value = asRecord(change.value);
      const banState = asString(asRecord(value?.banned_info)?.waba_ban_state);
      const event = asString(value?.event);

      if (banState === "DISABLE" || event === "DISABLED") {
        out.push({ wabaId, kind: "BANNED", detail: banState ?? event ?? "DISABLE" });
      } else if (banState === "REINSTATE") {
        out.push({ wabaId, kind: "REINSTATED", detail: banState });
      }
    }
  }
  return out;
}
