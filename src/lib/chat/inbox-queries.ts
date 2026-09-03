import { after } from "next/server";
import { mediaPreview, type MessageContentTypeDto } from "@/lib/message-preview";
import { prisma } from "@/lib/prisma";

export type ConversationSummary = {
  id: string;
  botName: string;
  botSlug: string;
  status: "OPEN" | "RESOLVED" | "HANDOFF";
  visitorId: string;
  messageCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastMessageRole: "BOT" | "USER" | "AGENT" | null;
  archived: boolean;
  blocked: boolean;
  folderId: string | null;
  // Same signal sendAgentReplyForUser already uses to route the reply — a widget conversation
  // never gets a WhatsApp webhook hit, so lastInboundAt stays null for it forever.
  channel: "WHATSAPP" | "WEB";
  // True when the last message is from the customer and the seller hasn't opened this
  // conversation since (see Conversation.lastReadAt's doc comment) — independent of `status`, so
  // a HANDOFF conversation the seller has already looked at doesn't stay flagged forever.
  unread: boolean;
};

const MAX_CONVERSATIONS = 200;

/**
 * Every conversation across every bot the given user owns, newest-activity-first — shared by
 * src/lib/actions/inbox.ts's listConversations (the web Server Action, cookie-session-scoped)
 * and the mobile REST API (src/app/api/v1/conversations/route.ts, Bearer-token-scoped), so both
 * surfaces read the Inbox the exact same way.
 */
export async function listConversationsForUser(userId: string): Promise<ConversationSummary[]> {
  const bots = await prisma.bot.findMany({
    where: { userId },
    select: { id: true, name: true, slug: true },
  });
  if (bots.length === 0) return [];
  const botById = new Map(bots.map((bot) => [bot.id, bot]));

  const conversations = await prisma.conversation.findMany({
    where: { botId: { in: bots.map((bot) => bot.id) } },
    orderBy: { createdAt: "desc" },
    take: MAX_CONVERSATIONS,
    select: {
      id: true,
      botId: true,
      status: true,
      visitorId: true,
      createdAt: true,
      archived: true,
      blocked: true,
      folderId: true,
      lastInboundAt: true,
      lastReadAt: true,
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { role: true, content: true, contentType: true, createdAt: true },
      },
    },
  });

  return conversations
    .map((conversation): ConversationSummary => {
      const bot = botById.get(conversation.botId);
      const lastMessage = conversation.messages[0] ?? null;
      return {
        id: conversation.id,
        botName: bot?.name ?? "Unknown bot",
        botSlug: bot?.slug ?? "",
        status: conversation.status,
        visitorId: conversation.visitorId,
        messageCount: conversation._count.messages,
        lastMessageAt: (lastMessage?.createdAt ?? conversation.createdAt).toISOString(),
        lastMessagePreview: !lastMessage ? "No messages yet" : mediaPreview(lastMessage.contentType, lastMessage.content),
        lastMessageRole: lastMessage?.role ?? null,
        archived: conversation.archived,
        blocked: conversation.blocked,
        folderId: conversation.folderId,
        channel: conversation.lastInboundAt !== null ? "WHATSAPP" : "WEB",
        unread:
          lastMessage?.role === "USER" &&
          (!conversation.lastReadAt || conversation.lastReadAt < lastMessage.createdAt),
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

export type ConversationDetail = {
  id: string;
  status: "OPEN" | "RESOLVED" | "HANDOFF";
  visitorId: string;
  createdAt: string;
  archived: boolean;
  blocked: boolean;
  folderId: string | null;
  channel: "WHATSAPP" | "WEB";
  botName: string;
  botSlug: string;
  messages: {
    id: string;
    role: "BOT" | "USER" | "AGENT";
    content: string;
    contentType: MessageContentTypeDto;
    caption: string | null;
    // Only set for a DOCUMENT message — see Message.fileName's schema doc comment.
    fileName: string | null;
    createdAt: string;
    starred: boolean;
    replyToId: string | null;
    // A lightweight snapshot of the quoted message, for rendering the quote inline — null if
    // this message isn't a reply, or if the message it quoted has since been deleted (replyToId
    // itself stays set to the dangling id in that case only via the FK's SetNull, so in practice
    // a deleted quote just means this comes back null while replyToId is cleared too).
    replyTo: {
      id: string;
      role: "BOT" | "USER" | "AGENT";
      content: string;
      contentType: MessageContentTypeDto;
      caption: string | null;
      fileName: string | null;
    } | null;
    // Emoji each side reacted with — either can be null/absent. See Message.customerReaction and
    // .agentReaction's schema doc comments.
    customerReaction: string | null;
    agentReaction: string | null;
    // Outbound-only (BOT/AGENT + WhatsApp) delivery lifecycle — null for a WEB message or before
    // Meta's first status callback. See Message.deliveryStatus's schema doc comment.
    deliveryStatus: "SENT" | "DELIVERED" | "READ" | "FAILED" | null;
    // True for a message created by the Inbox's "forward" action — see forwardMessage in inbox.ts.
    forwarded: boolean;
  }[];
};

/** Full transcript for one conversation, scoped to bots the given user owns. Shared by
 * getConversationMessages (web) and the mobile REST API the same way listConversationsForUser
 * is — see its doc comment. */
export async function getConversationMessagesForUser(userId: string, conversationId: string): Promise<ConversationDetail | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      status: true,
      visitorId: true,
      createdAt: true,
      archived: true,
      blocked: true,
      folderId: true,
      lastInboundAt: true,
      bot: { select: { name: true, slug: true, userId: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          content: true,
          contentType: true,
          caption: true,
          fileName: true,
          createdAt: true,
          starred: true,
          replyToId: true,
          replyTo: { select: { id: true, role: true, content: true, contentType: true, caption: true, fileName: true } },
          customerReaction: true,
          agentReaction: true,
          deliveryStatus: true,
          forwarded: true,
        },
      },
    },
  });

  if (!conversation || conversation.bot.userId !== userId) return null;

  // Opening a conversation is what "read" means here. Deferred via after() (same pattern as the
  // handoff push in the WhatsApp webhook) rather than awaited or fire-and-forget — a serverless
  // function can freeze/tear down as soon as it returns its response, which would silently drop a
  // bare unawaited promise before this write actually lands.
  after(() =>
    prisma.conversation
      .update({ where: { id: conversationId }, data: { lastReadAt: new Date() } })
      .catch((error) => console.error("[inbox] failed to mark conversation read", { conversationId, error })),
  );

  return {
    id: conversation.id,
    status: conversation.status,
    visitorId: conversation.visitorId,
    createdAt: conversation.createdAt.toISOString(),
    archived: conversation.archived,
    blocked: conversation.blocked,
    folderId: conversation.folderId,
    channel: conversation.lastInboundAt !== null ? "WHATSAPP" : "WEB",
    botName: conversation.bot.name,
    botSlug: conversation.bot.slug,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      contentType: m.contentType,
      caption: m.caption,
      fileName: m.fileName,
      createdAt: m.createdAt.toISOString(),
      starred: m.starred,
      replyToId: m.replyToId,
      replyTo: m.replyTo,
      customerReaction: m.customerReaction,
      agentReaction: m.agentReaction,
      deliveryStatus: m.deliveryStatus,
      forwarded: m.forwarded,
    })),
  };
}

/**
 * Archiving is purely an Inbox organization concept (see Conversation.archived's schema doc
 * comment) — it hides a conversation from the default view without touching `status`, so it has
 * no effect on whether the bot keeps replying. Shared by src/lib/actions/inbox.ts's
 * setConversationArchived (the web Server Action) and the mobile REST API
 * (src/app/api/v1/conversations/[id]/route.ts), same split as listConversationsForUser above.
 */
export async function setConversationArchivedForUser(
  userId: string,
  conversationId: string,
  archived: boolean,
): Promise<{ error: string | null }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { bot: { select: { userId: true } } },
  });
  if (!conversation || conversation.bot.userId !== userId) return { error: "Conversation not found." };

  await prisma.conversation.update({ where: { id: conversationId }, data: { archived } });
  return { error: null };
}

/**
 * Permanently deletes a conversation and its full transcript (Message rows cascade — see the
 * schema). Unlike archiving, this can't be undone. Shared by src/lib/actions/inbox.ts's
 * deleteConversation (the web Server Action) and the mobile REST API
 * (src/app/api/v1/conversations/[id]/route.ts's DELETE handler), same split as every other query
 * in this file.
 */
export async function deleteConversationForUser(userId: string, conversationId: string): Promise<{ error: string | null }> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { bot: { select: { userId: true } } },
  });
  if (!conversation || conversation.bot.userId !== userId) return { error: "Conversation not found." };

  await prisma.conversation.delete({ where: { id: conversationId } });
  return { error: null };
}
