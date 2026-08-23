import { after, NextResponse, type NextRequest } from "next/server";
import { classifierLlm, providerLlm } from "@/engine/llm";
import { runWhatsAppTurn } from "@/lib/chat/run-whatsapp-turn";
import { decrypt } from "@/lib/crypto";
import { sendSecurityAlertEmail } from "@/lib/email/send";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push/send";
import {
  downloadWhatsAppMedia,
  getWhatsAppMediaUrl,
  markWhatsAppMessageReadWithTyping,
  sendWhatsAppTextMessage,
  toWhatsAppText,
  verifyWebhookSignature,
} from "@/lib/whatsapp/meta-graph";
import {
  extractAccountEvents,
  extractInboundMessages,
  type InboundWhatsAppMessage,
  type WhatsAppAccountEvent,
} from "@/lib/whatsapp/webhook-payload";

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

/** Resolves an inbound image message's media id to its actual bytes (see getWhatsAppMediaUrl/
 * downloadWhatsAppMedia in meta-graph.ts), for runWhatsAppTurn to persist directly. Best-effort:
 * a failure here (expired media, transient network) shouldn't drop the whole inbound message —
 * runWhatsAppTurn just falls back to storing the "[image]" placeholder text instead. */
const MESSAGE_PREVIEW_LENGTH = 140;

/** Best-effort "new message" push to the bot's owner — called for every inbound message
 * regardless of whether the engine ran, same as the Message row itself is always persisted. */
async function notifyNewInboxMessage(userId: string, botName: string, content: string): Promise<void> {
  const body = content.length > MESSAGE_PREVIEW_LENGTH ? `${content.slice(0, MESSAGE_PREVIEW_LENGTH)}…` : content;
  await sendPushToUser(userId, { title: `New message · ${botName}`, body, url: "/app/inbox" }).catch((error) => {
    console.error("[whatsapp webhook] failed to send new-message push", { error });
  });
}

/** Best-effort "needs a human" push — only called when runWhatsAppTurn reports a fresh
 * transition into HANDOFF (see the call sites below; a conversation already in HANDOFF never
 * reaches the engine again, so this never fires twice for the same handoff). */
async function notifyHandoff(userId: string, botName: string, visitorId: string): Promise<void> {
  await sendPushToUser(userId, {
    title: `${botName} needs a human`,
    body: `${visitorId} needs your help.`,
    url: "/app/inbox",
  }).catch((error) => {
    console.error("[whatsapp webhook] failed to send handoff push", { error });
  });
}

async function downloadInboundImage(
  message: InboundWhatsAppMessage,
  accessToken: string,
): Promise<{ dataUri: string; caption: string | null } | undefined> {
  if (!message.imageMediaId) return undefined;
  try {
    const mediaUrl = await getWhatsAppMediaUrl(message.imageMediaId, accessToken);
    const dataUri = await downloadWhatsAppMedia(mediaUrl, accessToken);
    return { dataUri, caption: message.caption };
  } catch (error) {
    console.error("[whatsapp webhook] failed to download inbound image", {
      phoneNumberId: message.phoneNumberId,
      waMessageId: message.waMessageId,
      error,
    });
    return undefined;
  }
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
    select: { botId: true, isActive: true, accessToken: true, bot: { select: { name: true, userId: true } } },
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

  // Present for every message type, not just active+text, since an inbound image needs it for
  // both the "connection paused" and "active but non-text" branches below.
  const accessToken = connection.accessToken ? decrypt(connection.accessToken) : null;

  // Paused connections and non-text message types (image, audio, location, button replies, ...)
  // both land in the inbox without ever reaching the engine — the flow-walking engine only
  // knows how to consume plain text input, so there's nothing sensible to feed it for the latter.
  if (!connection.isActive || !message.isText) {
    const image = message.imageMediaId && accessToken ? await downloadInboundImage(message, accessToken) : undefined;
    await runWhatsAppTurn(
      {
        botId: connection.botId,
        visitorId: message.from,
        message: message.content,
        receivedAt: message.receivedAt,
        runEngine: false,
        image,
      },
      { llm: providerLlm, classify: classifierLlm },
    );
    await notifyNewInboxMessage(connection.bot.userId, connection.bot.name, message.content);
    return;
  }

  // isActive and accessToken are only ever cleared together (see disconnectWhatsApp), so this
  // shouldn't happen for a connection that just passed the isActive check above — guarded
  // anyway since a null token has nothing to decrypt.
  if (!accessToken) {
    console.error("[whatsapp webhook] active connection has no access token", { botId: connection.botId });
    return;
  }

  const result = await runWhatsAppTurn(
    { botId: connection.botId, visitorId: message.from, message: message.content, receivedAt: message.receivedAt },
    { llm: providerLlm, classify: classifierLlm },
  );
  await notifyNewInboxMessage(connection.bot.userId, connection.bot.name, message.content);
  if (result.kind === "success" && result.status === "HANDOFF") {
    await notifyHandoff(connection.bot.userId, connection.bot.name, message.from);
  }
  // Outside the 24h window, runWhatsAppTurn already persisted a warning in place of the reply
  // (see OUTSIDE_WINDOW_WARNING there) — Graph API would just reject a normal send anyway, so
  // there's nothing left to do here but leave it unsent. Same for a locked AI node (see
  // logicLocked in engine/types.ts) that had nothing matching to say this turn: zero replies.
  if (result.kind !== "success" || result.replies.length === 0 || !result.withinWindow) return;

  // Only marked as read (the customer-visible blue double-tick) once a reply is actually about
  // to go out — doing this up front, before knowing whether the engine would even reply, made
  // the business look like it saw the message and chose to ignore it whenever no reply followed.
  // Best-effort: a failure here shouldn't block the reply itself.
  await markWhatsAppMessageReadWithTyping(message.phoneNumberId, message.waMessageId, accessToken).catch((error) => {
    console.error("[whatsapp webhook] failed to send read receipt/typing indicator", {
      botId: connection.botId,
      phoneNumberId: message.phoneNumberId,
      error,
    });
  });

  for (const reply of result.replies) {
    // Markdown is what the engine/Studio speak natively (Logic rule replies, LLM output) — WhatsApp
    // itself gets the plain-text conversion (see toWhatsAppText) so a link or **bold** doesn't show
    // up as literal brackets/asterisks on the customer's phone; the stored Message keeps the
    // original Markdown, same as every other channel, so the Inbox still renders it properly.
    await sendWhatsAppTextMessage(message.phoneNumberId, message.from, toWhatsAppText(reply.content), accessToken).catch((error) => {
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
 * Reacts to a WABA-level ban/reinstate event (see extractAccountEvents) by flagging every
 * connection on that WABA as BANNED — forcing isActive off so the engine stops trying to send
 * through a number Meta has cut off — and emailing the bot's owner. Gated on the connection's
 * current status so a duplicate/retried webhook delivery (Meta doesn't guarantee at-most-once)
 * doesn't re-send the alert or stomp a status change that already happened for another reason.
 */
async function processAccountEvent(event: WhatsAppAccountEvent): Promise<void> {
  const connections = await prisma.whatsAppConnection.findMany({
    where: { wabaId: event.wabaId, status: { notIn: ["DISCONNECTED"] } },
    select: {
      id: true,
      botId: true,
      status: true,
      displayPhoneNumber: true,
      bot: { select: { name: true, user: { select: { email: true } } } },
    },
  });

  for (const connection of connections) {
    if (event.kind === "BANNED" && connection.status !== "BANNED") {
      await prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: "BANNED", isActive: false },
      });
      await sendSecurityAlertEmail(
        connection.bot.user.email,
        "WhatsApp number banned",
        `Meta has disabled the WhatsApp connection for "${connection.bot.name}" (${connection.displayPhoneNumber}, reported state: ${event.detail}). The bot has been paused automatically — it can't send messages through this number until the ban is resolved. Check WhatsApp Manager (business.facebook.com/wa/manage) for the reason and how to appeal.`,
      ).catch((error) => {
        console.error("[whatsapp webhook] failed to send ban alert email", { botId: connection.botId, error });
      });
    } else if (event.kind === "REINSTATED" && connection.status === "BANNED") {
      await prisma.whatsAppConnection.update({
        where: { id: connection.id },
        data: { status: "CONNECTED", isActive: true },
      });
      await sendSecurityAlertEmail(
        connection.bot.user.email,
        "WhatsApp number reinstated",
        `Meta has reinstated the WhatsApp connection for "${connection.bot.name}" (${connection.displayPhoneNumber}) — the bot has been resumed automatically.`,
      ).catch((error) => {
        console.error("[whatsapp webhook] failed to send reinstated email", { botId: connection.botId, error });
      });
    }
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
  const accountEvents = extractAccountEvents(payload);

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
    for (const event of accountEvents) {
      await processAccountEvent(event).catch((error) => {
        console.error("[whatsapp webhook] failed to process account event", { wabaId: event.wabaId, error });
      });
    }
  });

  return NextResponse.json({ received: true });
}
