"use server";

import { auth } from "@/auth";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/meta-graph";
import { isWithinServiceWindow } from "@/lib/whatsapp/service-window";

export type ConversationDetail = {
  id: string;
  status: "OPEN" | "RESOLVED" | "HANDOFF";
  visitorId: string;
  createdAt: string;
  botName: string;
  botSlug: string;
  messages: { id: string; role: "BOT" | "USER" | "AGENT"; content: string; createdAt: string }[];
};

/** Full transcript for one conversation, scoped to bots the signed-in user owns. */
export async function getConversationMessages(conversationId: string): Promise<ConversationDetail | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      status: true,
      visitorId: true,
      createdAt: true,
      bot: { select: { name: true, slug: true, userId: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, createdAt: true },
      },
    },
  });

  if (!conversation || conversation.bot.userId !== session.user.id) return null;

  return {
    id: conversation.id,
    status: conversation.status,
    visitorId: conversation.visitorId,
    createdAt: conversation.createdAt.toISOString(),
    botName: conversation.bot.name,
    botSlug: conversation.bot.slug,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/**
 * Lets the seller reply directly from the Inbox, as themselves rather than the bot — the
 * human-takeover counterpart to a handoff node. Always flips the conversation to HANDOFF (even
 * if it was still OPEN/bot-driven) so runWhatsAppTurn's engine stays quiet on this conversation
 * from here on; a seller who jumps in manually clearly doesn't want the bot talking over them.
 *
 * `lastInboundAt` is only ever set by the WhatsApp webhook (see Conversation's schema doc
 * comment) — null means this is a widget conversation, which has no live delivery channel yet,
 * so the reply is only stored for the record rather than actually sent anywhere live.
 */
export async function sendAgentReply(conversationId: string, content: string): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

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
  if (!conversation || conversation.bot.userId !== session.user.id) return { error: "Conversation not found." };

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

    try {
      await sendWhatsAppTextMessage(connection.phoneNumberId, conversation.visitorId, trimmed, decrypt(connection.accessToken));
    } catch (error) {
      console.error("[inbox] failed to send agent reply via WhatsApp", { conversationId, error });
      return { error: "Couldn't send — try again." };
    }
  }

  await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, role: "AGENT", content: trimmed, channel: isWhatsApp ? "WHATSAPP" : "WEB" },
    }),
    prisma.conversation.update({ where: { id: conversationId }, data: { status: "HANDOFF" } }),
  ]);

  return { error: null };
}

/** Hands a conversation back to normal — clears HANDOFF (or just closes out an OPEN one the
 * seller considers done) so the *next* message from this visitor starts a fresh conversation
 * rather than staying pinned to this one forever (see runWhatsAppTurn's HANDOFF handling). */
export async function resolveConversation(conversationId: string): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { bot: { select: { userId: true } } },
  });
  if (!conversation || conversation.bot.userId !== session.user.id) return { error: "Conversation not found." };

  await prisma.conversation.update({ where: { id: conversationId }, data: { status: "RESOLVED" } });
  return { error: null };
}
