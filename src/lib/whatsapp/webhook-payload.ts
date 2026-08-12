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
  /// Unix epoch seconds, as a string, per Meta's own convention — when the customer actually
  /// sent this message, not when we received/parsed it. See InboundWhatsAppMessage.receivedAt.
  timestamp: z.string().optional(),
});

const WebhookChangeValueSchema = z.object({
  metadata: z.object({ phone_number_id: z.string().min(1) }).optional(),
  messages: z.array(WebhookMessageSchema).optional(),
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
