import { after, NextResponse, type NextRequest } from "next/server";
import { classifierLlm, providerLlm } from "@/engine/llm";
import { runWhatsAppTurn } from "@/lib/chat/run-whatsapp-turn";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { markWhatsAppMessageReadWithTyping, sendWhatsAppTextMessage, verifyWebhookSignature } from "@/lib/whatsapp/meta-graph";
import { extractInboundMessages, type InboundWhatsAppMessage } from "@/lib/whatsapp/webhook-payload";

/**
 * Meta's verification handshake, run once when this URL is registered (or re-verified) as the
 * WABA's webhook in the App Dashboard. Meta calls this with hub.mode=subscribe and a
 * hub.verify_token it expects to match what we configured on our end — echoing back
 * hub.challenge proves we're the same party that set that token, not just any URL.
 */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!expectedToken || mode !== "subscribe" || token !== expectedToken || !challenge) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse(challenge, { status: 200 });
}

/**
 * Looks up the bot this number belongs to, stores the inbound message, and — only when the
 * connection is active — runs it through the same runtime engine the widget uses and sends
 * back whatever it replies with. One connection lookup + one runWhatsAppTurn call per inbound
 * message; called from POST below, after the response to Meta has already been sent (see
 * after() there), so nothing here can make this webhook miss Meta's delivery timeout.
 */
async function processInboundMessage(message: InboundWhatsAppMessage): Promise<void> {
  const connection = await prisma.whatsAppConnection.findUnique({
    where: { phoneNumberId: message.phoneNumberId },
    select: { botId: true, isActive: true, accessToken: true },
  });

  // No WhatsAppConnection for this phone_number_id means there's no bot to attach the message
  // to at all (not even for the inbox) — this shouldn't happen for a number that legitimately
  // completed Embedded Signup, but Meta can retry/replay deliveries after a number is
  // disconnected on our side, so this is a log line, not an error.
  if (!connection) {
    console.warn("[whatsapp webhook] no WhatsAppConnection for phone_number_id", {
      phoneNumberId: message.phoneNumberId,
    });
    return;
  }

  // Paused connections and non-text message types (image, audio, location, button replies, ...)
  // both land in the inbox without ever reaching the engine — the flow-walking engine only
  // knows how to consume plain text input, so there's nothing sensible to feed it for the latter.
  if (!connection.isActive || !message.isText) {
    await runWhatsAppTurn(
      {
        botId: connection.botId,
        visitorId: message.from,
        message: message.content,
        receivedAt: message.receivedAt,
        runEngine: false,
      },
      { llm: providerLlm, classify: classifierLlm },
    );
    return;
  }

  // isActive and accessToken are only ever cleared together (see disconnectWhatsApp), so this
  // shouldn't happen for a connection that just passed the isActive check above — guarded
  // anyway since a null token has nothing to decrypt.
  if (!connection.accessToken) {
    console.error("[whatsapp webhook] active connection has no access token", { botId: connection.botId });
    return;
  }
  const accessToken = decrypt(connection.accessToken);

  // Best-effort and fire-before-the-engine-runs: an AI node's LLM call can take a few seconds,
  // so this gives the customer a "typing…" indicator to look at instead of dead air. A failure
  // here (rate limit, transient network) shouldn't block the reply that follows.
  await markWhatsAppMessageReadWithTyping(message.phoneNumberId, message.waMessageId, accessToken).catch((error) => {
    console.error("[whatsapp webhook] failed to send typing indicator", {
      botId: connection.botId,
      phoneNumberId: message.phoneNumberId,
      error,
    });
  });

  const result = await runWhatsAppTurn(
    { botId: connection.botId, visitorId: message.from, message: message.content, receivedAt: message.receivedAt },
    { llm: providerLlm, classify: classifierLlm },
  );
  // Outside the 24h window, runWhatsAppTurn already persisted a warning in place of the reply
  // (see OUTSIDE_WINDOW_WARNING there) — Graph API would just reject a normal send anyway, so
  // there's nothing left to do here but leave it unsent.
  if (result.kind !== "success" || result.replies.length === 0 || !result.withinWindow) return;

  for (const reply of result.replies) {
    await sendWhatsAppTextMessage(message.phoneNumberId, message.from, reply.content, accessToken).catch((error) => {
      // Reply is already persisted to Message by runWhatsAppTurn regardless of delivery — a
      // failed send shows up in the seller's inbox either way, just not on the customer's phone.
      console.error("[whatsapp webhook] failed to send reply", {
        botId: connection.botId,
        phoneNumberId: message.phoneNumberId,
        error,
      });
    });
  }
}

/**
 * Receives inbound WhatsApp message deliveries. Verifies the request actually came from Meta
 * before touching the payload, then acknowledges immediately — Meta expects a fast 200 and will
 * retry (and eventually disable the webhook) if it doesn't get one — and does the real work
 * (which may involve an LLM call, a network round trip to Graph API, several DB writes) in
 * next/server's after(), which keeps running after the response has already gone out. No
 * external queue: at beta scale, "don't block the response" is enough.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as unknown;
  const messages = extractInboundMessages(payload);

  after(async () => {
    for (const message of messages) {
      await processInboundMessage(message).catch((error) => {
        console.error("[whatsapp webhook] failed to process inbound message", {
          phoneNumberId: message.phoneNumberId,
          waMessageId: message.waMessageId,
          error,
        });
      });
    }
  });

  return NextResponse.json({ received: true });
}
