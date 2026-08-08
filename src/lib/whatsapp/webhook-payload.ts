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
        out.push({
          phoneNumberId,
          from: message.from,
          waMessageId: message.id,
          isText,
          content: isText ? message.text!.body : `[unsupported message type: ${message.type}]`,
        });
      }
    }
  }
  return out;
}
