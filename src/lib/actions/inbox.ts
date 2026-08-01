"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
