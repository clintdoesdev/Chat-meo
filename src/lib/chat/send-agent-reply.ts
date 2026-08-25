import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/meta-graph";
import { isWithinServiceWindow } from "@/lib/whatsapp/service-window";

/**
 * The actual "send a manual reply" logic, taking an already-authenticated `userId` rather than
 * resolving a session itself — shared by src/lib/actions/inbox.ts's sendAgentReply (the web
 * Server Action, which resolves userId from the NextAuth cookie session) and the mobile REST API
 * (src/app/api/v1/conversations/[id]/messages/route.ts, which resolves it from a Bearer token).
 * Keeping this one function is what stops the two entry points' WhatsApp-sending/service-window/
 * encryption behavior from drifting apart.
 */
export async function sendAgentReplyForUser(
  userId: string,
  conversationId: string,
  content: string,
  replyToId?: string,
): Promise<{ error: string | null }> {
  const trimmed = content.trim();
  if (!trimmed) return { error: "Message can't be empty." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      botId: true,
      visitorId: true,
      lastInboundAt: true,
      bot: { select: { userId: true } },
    },
  });
  if (!conversation || conversation.bot.userId !== userId) return { error: "Conversation not found." };

  const quoted = replyToId
    ? await prisma.message.findUnique({ where: { id: replyToId }, select: { conversationId: true, waMessageId: true } })
    : null;
  const resolvedReplyToId = quoted && quoted.conversationId === conversationId ? replyToId : undefined;

  const isWhatsApp = conversation.lastInboundAt !== null;

  if (isWhatsApp) {
    if (!isWithinServiceWindow(conversation.lastInboundAt)) {
      return { error: "Can't send — outside WhatsApp's 24h reply window. The customer needs to message again first." };
    }

    const connection = await prisma.whatsAppConnection.findUnique({
      where: { botId: conversation.botId },
      select: { phoneNumberId: true, accessToken: true },
    });
    if (!connection?.accessToken) {
      return { error: "This bot's WhatsApp connection isn't active." };
    }

    let sentWaMessageId: string | undefined;
    try {
      sentWaMessageId = await sendWhatsAppTextMessage(
        connection.phoneNumberId,
        conversation.visitorId,
        trimmed,
        decrypt(connection.accessToken),
        resolvedReplyToId ? (quoted?.waMessageId ?? undefined) : undefined,
      );
    } catch (error) {
      console.error("[inbox] failed to send agent reply via WhatsApp", { conversationId, error });
      return { error: "Couldn't send — try again." };
    }

    // Deliberately doesn't touch conversation.status — see sendAgentReply's own comment
    // (src/lib/actions/inbox.ts) for why a manual reply must never force "Needs a human".
    await prisma.message.create({
      data: {
        conversationId,
        role: "AGENT",
        content: trimmed,
        channel: "WHATSAPP",
        replyToId: resolvedReplyToId,
        waMessageId: sentWaMessageId,
        deliveryStatus: sentWaMessageId ? "SENT" : undefined,
      },
    });
    return { error: null };
  }

  await prisma.message.create({
    data: { conversationId, role: "AGENT", content: trimmed, channel: "WEB", replyToId: resolvedReplyToId },
  });

  return { error: null };
}
