// Meta's WhatsApp Business customer-service window: a normal (free) "session" message can only
// be sent within 24 hours of the customer's most recent inbound message. Outside that window,
// Meta rejects a normal message outright — only a pre-approved template message type is allowed,
// which this app doesn't send yet (see the "outside window" branch in run-whatsapp-turn.ts).

export const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** `lastInboundAt` should be the customer's own message timestamp (not when we finished
 * processing it) — a delayed or replayed webhook delivery shouldn't look freshly-within-window
 * just because we happened to process it moments ago. Null (no inbound message on record at
 * all) is always outside the window. `now` is injectable for tests; defaults to the real clock. */
export function isWithinServiceWindow(lastInboundAt: Date | null, now: Date = new Date()): boolean {
  if (!lastInboundAt) return false;
  return now.getTime() - lastInboundAt.getTime() <= WHATSAPP_SERVICE_WINDOW_MS;
}
