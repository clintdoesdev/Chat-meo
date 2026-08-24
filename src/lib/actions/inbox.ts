"use server";

import { auth } from "@/auth";
import { adaptPersistedGraph } from "@/engine/adapt-graph";
import { createInitialState } from "@/engine/executor";
import { Prisma } from "@/generated/prisma/client";
import { decrypt } from "@/lib/crypto";
import { parseFlowGraph } from "@/lib/flow-schema";
import { defaultFlowGraph } from "@/lib/flow-types";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppImageMessage, sendWhatsAppReaction, sendWhatsAppTextMessage } from "@/lib/whatsapp/meta-graph";
import { isWithinServiceWindow } from "@/lib/whatsapp/service-window";

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
  // Same signal sendAgentReply already uses to route the reply — a widget conversation never gets
  // a WhatsApp webhook hit, so lastInboundAt stays null for it forever.
  channel: "WHATSAPP" | "WEB";
};

const MAX_CONVERSATIONS = 200;

/** Every conversation across every bot this seller owns, newest-activity-first — the Inbox list's
 * data source, both for the initial page load and for InboxView's polling refresh (see its
 * useEffect) so an incoming message shows up without a manual reload. */
export async function listConversations(): Promise<ConversationSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const bots = await prisma.bot.findMany({
    where: { userId: session.user.id },
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
        lastMessagePreview: !lastMessage
          ? "No messages yet"
          : lastMessage.contentType === "IMAGE"
            ? "📷 Photo"
            : lastMessage.content,
        lastMessageRole: lastMessage?.role ?? null,
        archived: conversation.archived,
        blocked: conversation.blocked,
        folderId: conversation.folderId,
        channel: conversation.lastInboundAt !== null ? "WHATSAPP" : "WEB",
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
    contentType: "TEXT" | "IMAGE";
    caption: string | null;
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
      contentType: "TEXT" | "IMAGE";
      caption: string | null;
    } | null;
    // Emoji each side reacted with — either can be null/absent. See Message.customerReaction and
    // .agentReaction's schema doc comments.
    customerReaction: string | null;
    agentReaction: string | null;
    // Outbound-only (BOT/AGENT + WhatsApp) delivery lifecycle — null for a WEB message or before
    // Meta's first status callback. See Message.deliveryStatus's schema doc comment.
    deliveryStatus: "SENT" | "DELIVERED" | "READ" | "FAILED" | null;
    // True for a message created by the Inbox's "forward" action — see forwardMessage below.
    forwarded: boolean;
  }[];
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
          createdAt: true,
          starred: true,
          replyToId: true,
          replyTo: { select: { id: true, role: true, content: true, contentType: true, caption: true } },
          customerReaction: true,
          agentReaction: true,
          deliveryStatus: true,
          forwarded: true,
        },
      },
    },
  });

  if (!conversation || conversation.bot.userId !== session.user.id) return null;

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
 * Lets the seller reply directly from the Inbox, as themselves rather than the bot — the
 * human-takeover counterpart to a handoff node. Always flips the conversation to HANDOFF (even
 * if it was still OPEN/bot-driven) so runWhatsAppTurn's engine stays quiet on this conversation
 * from here on; a seller who jumps in manually clearly doesn't want the bot talking over them.
 *
 * `lastInboundAt` is only ever set by the WhatsApp webhook (see Conversation's schema doc
 * comment) — null means this is a widget conversation, which has no live delivery channel yet,
 * so the reply is only stored for the record rather than actually sent anywhere live.
 *
 * `replyToId`, when given (the Inbox's swipe/reply-to-message action), is stored on the new
 * Message so the Inbox can render it as a quoted reply — and, when the quoted message has a
 * stored `waMessageId` (an inbound WhatsApp message), passed through to Meta as
 * `context.message_id` so the reply shows as a real quoted reply on the customer's phone too.
 * Silently ignored (not an error) if it doesn't resolve to a message in this same conversation.
 */
export async function sendAgentReply(
  conversationId: string,
  content: string,
  replyToId?: string,
): Promise<{ error: string | null }> {
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

    await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          role: "AGENT",
          content: trimmed,
          channel: "WHATSAPP",
          replyToId: resolvedReplyToId,
          waMessageId: sentWaMessageId,
          deliveryStatus: sentWaMessageId ? "SENT" : undefined,
        },
      }),
      prisma.conversation.update({ where: { id: conversationId }, data: { status: "HANDOFF" } }),
    ]);
    return { error: null };
  }

  await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, role: "AGENT", content: trimmed, channel: "WEB", replyToId: resolvedReplyToId },
    }),
    prisma.conversation.update({ where: { id: conversationId }, data: { status: "HANDOFF" } }),
  ]);

  return { error: null };
}

/** Stars or unstars a single message — purely an Inbox organization concept (like
 * Conversation.archived), no effect on engine/bot behavior. Scoped to bots the signed-in user
 * owns via the conversation → bot relation. */
export async function toggleMessageStar(messageId: string, starred: boolean): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversation: { select: { bot: { select: { userId: true } } } } },
  });
  if (!message || message.conversation.bot.userId !== session.user.id) return { error: "Message not found." };

  await prisma.message.update({ where: { id: messageId }, data: { starred } });
  return { error: null };
}

/** Permanently deletes a single message — the per-message counterpart to deleteConversation.
 * Unlike deleting a whole conversation, this only removes this one row from the transcript (any
 * reply that quoted it just loses its quote, per replyToId's onDelete: SetNull); it does not
 * un-send anything already delivered on WhatsApp. */
export async function deleteMessage(messageId: string): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { conversation: { select: { bot: { select: { userId: true } } } } },
  });
  if (!message || message.conversation.bot.userId !== session.user.id) return { error: "Message not found." };

  await prisma.message.delete({ where: { id: messageId } });
  return { error: null };
}

/** Sets (or clears, with `emoji: null`) the seller's own reaction to a message — the Inbox's
 * counterpart to a customer's own native WhatsApp reaction (see Message.agentReaction and
 * .customerReaction's schema doc comments). Sent to WhatsApp via sendWhatsAppReaction when the
 * message has a stored waMessageId to react to; a WEB-channel message (no such concept) or one
 * without a waMessageId yet just updates locally. */
export async function setMessageReaction(messageId: string, emoji: string | null): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      waMessageId: true,
      conversation: {
        select: { botId: true, visitorId: true, lastInboundAt: true, bot: { select: { userId: true } } },
      },
    },
  });
  if (!message || message.conversation.bot.userId !== session.user.id) return { error: "Message not found." };

  const isWhatsApp = message.conversation.lastInboundAt !== null;
  if (isWhatsApp && message.waMessageId) {
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { botId: message.conversation.botId },
      select: { phoneNumberId: true, accessToken: true },
    });
    if (connection?.accessToken) {
      try {
        await sendWhatsAppReaction(
          connection.phoneNumberId,
          message.conversation.visitorId,
          message.waMessageId,
          emoji ?? "",
          decrypt(connection.accessToken),
        );
      } catch (error) {
        console.error("[inbox] failed to send reaction via WhatsApp", { messageId, error });
        return { error: "Couldn't send the reaction — try again." };
      }
    }
  }

  await prisma.message.update({ where: { id: messageId }, data: { agentReaction: emoji } });
  return { error: null };
}

/** Forwards one message's content to a different conversation — possibly a different bot,
 * anything the signed-in seller owns. Actually delivers it (same send path as sendAgentReply) on
 * a WhatsApp target, and always persists a copy in the target conversation tagged `forwarded`
 * (see Message.forwarded's schema doc comment) so it reads distinctly from a typed reply. */
export async function forwardMessage(messageId: string, targetConversationId: string): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const [source, target] = await Promise.all([
    prisma.message.findUnique({
      where: { id: messageId },
      select: {
        content: true,
        contentType: true,
        caption: true,
        conversation: { select: { bot: { select: { userId: true } } } },
      },
    }),
    prisma.conversation.findUnique({
      where: { id: targetConversationId },
      select: { id: true, botId: true, visitorId: true, lastInboundAt: true, bot: { select: { userId: true } } },
    }),
  ]);

  if (!source || source.conversation.bot.userId !== session.user.id) return { error: "Message not found." };
  if (!target || target.bot.userId !== session.user.id) return { error: "Conversation not found." };

  const isWhatsApp = target.lastInboundAt !== null;
  let sentWaMessageId: string | undefined;

  if (isWhatsApp) {
    if (!isWithinServiceWindow(target.lastInboundAt)) {
      return { error: "Can't forward — outside WhatsApp's 24h reply window for that conversation." };
    }
    const connection = await prisma.whatsAppConnection.findUnique({
      where: { botId: target.botId },
      select: { phoneNumberId: true, accessToken: true },
    });
    if (!connection?.accessToken) {
      return { error: "That bot's WhatsApp connection isn't active." };
    }
    const accessToken = decrypt(connection.accessToken);
    try {
      sentWaMessageId =
        source.contentType === "IMAGE"
          ? await sendWhatsAppImageMessage(
              connection.phoneNumberId,
              target.visitorId,
              source.content,
              source.caption ?? undefined,
              accessToken,
            )
          : await sendWhatsAppTextMessage(connection.phoneNumberId, target.visitorId, source.content, accessToken);
    } catch (error) {
      console.error("[inbox] failed to forward message via WhatsApp", { messageId, targetConversationId, error });
      return { error: "Couldn't forward — try again." };
    }
  }

  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: target.id,
        role: "AGENT",
        content: source.content,
        contentType: source.contentType,
        caption: source.caption,
        channel: isWhatsApp ? "WHATSAPP" : "WEB",
        forwarded: true,
        waMessageId: sentWaMessageId,
        deliveryStatus: sentWaMessageId ? "SENT" : undefined,
      },
    }),
    prisma.conversation.update({ where: { id: target.id }, data: { status: "HANDOFF" } }),
  ]);

  return { error: null };
}

/** Blocks or unblocks a visitor — the engine permanently skips a blocked conversation (see
 * runWhatsAppTurn) and it's excluded from "new message" push notifications, but inbound messages
 * still get stored so the seller keeps a record. See Conversation.blocked's schema doc comment
 * for why this is enforced entirely on our side. */
export async function setConversationBlocked(conversationId: string, blocked: boolean): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { bot: { select: { userId: true } } },
  });
  if (!conversation || conversation.bot.userId !== session.user.id) return { error: "Conversation not found." };

  await prisma.conversation.update({ where: { id: conversationId }, data: { blocked } });
  return { error: null };
}

/** Hands a conversation back to normal — clears HANDOFF (or just closes out an OPEN one the
 * seller considers done). The conversation itself is never re-created (see runWhatsAppTurn: one
 * row per number, permanently) — the *next* message from this visitor reuses this same row, with
 * the engine reset back to Start so it reads as a fresh interaction rather than staying mute. */
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

/** Immediately resets this conversation's bot flow back to Start and reopens it — the explicit,
 * right-now counterpart to what already happens lazily the next time a RESOLVED conversation
 * gets a new inbound message. Mainly useful to hand a HANDOFF conversation straight back to the
 * bot without waiting for (or requiring) the customer to message again first. */
export async function restartBotForConversation(conversationId: string): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      bot: {
        select: { userId: true, flows: { where: { isActive: true }, take: 1, select: { graph: true } } },
      },
    },
  });
  if (!conversation || conversation.bot.userId !== session.user.id) return { error: "Conversation not found." };

  const flowRow = conversation.bot.flows[0];
  if (!flowRow) return { error: "This bot has no active flow to restart." };

  const graph = adaptPersistedGraph(parseFlowGraph(flowRow.graph) ?? defaultFlowGraph());
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { engineState: createInitialState(graph), status: "OPEN" },
  });
  return { error: null };
}

/** Permanently deletes a conversation and its full transcript (Message rows cascade — see the
 * schema). Unlike archiving, this can't be undone. */
export async function deleteConversation(conversationId: string): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { bot: { select: { userId: true } } },
  });
  if (!conversation || conversation.bot.userId !== session.user.id) return { error: "Conversation not found." };

  await prisma.conversation.delete({ where: { id: conversationId } });
  return { error: null };
}

/** Permanently deletes every conversation in `conversationIds` (and their transcripts) in one
 * go — the "Delete all" bulk action for whatever the Inbox's current filter/search/folder has
 * narrowed the list down to; the caller decides which ids that is, this just enforces ownership.
 * Scoped to bots the signed-in user owns via the relation filter, so an id for someone else's
 * conversation is silently skipped rather than deleted — same trust boundary as the single-
 * conversation delete above, just batched. Unlike archiving, this can't be undone. */
export async function deleteConversations(conversationIds: string[]): Promise<{ error: string | null; deletedCount: number }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in.", deletedCount: 0 };
  if (conversationIds.length === 0) return { error: null, deletedCount: 0 };

  const result = await prisma.conversation.deleteMany({
    where: { id: { in: conversationIds }, bot: { userId: session.user.id } },
  });
  return { error: null, deletedCount: result.count };
}

/** Archiving is purely an Inbox organization concept (see Conversation.archived's schema doc
 * comment) — it hides a conversation from the default view without touching `status`, so it has
 * no effect on whether the bot keeps replying. */
export async function setConversationArchived(conversationId: string, archived: boolean): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { bot: { select: { userId: true } } },
  });
  if (!conversation || conversation.bot.userId !== session.user.id) return { error: "Conversation not found." };

  await prisma.conversation.update({ where: { id: conversationId }, data: { archived } });
  return { error: null };
}

export type FolderSummary = { id: string; name: string };

/** All of this seller's folders, spanning every bot — folders aren't scoped to one bot since the
 * Inbox itself already spans all of them. */
export async function listFolders(): Promise<FolderSummary[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  return prisma.conversationFolder.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function createFolder(name: string): Promise<{ folder: FolderSummary | null; error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { folder: null, error: "Not signed in." };

  const trimmed = name.trim();
  if (!trimmed) return { folder: null, error: "Folder name can't be empty." };

  try {
    const folder = await prisma.conversationFolder.create({
      data: { userId: session.user.id, name: trimmed },
      select: { id: true, name: true },
    });
    return { folder, error: null };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { folder: null, error: "You already have a folder with that name." };
    }
    throw error;
  }
}

/** Deletes a folder — conversations inside it aren't deleted, just unassigned (see the schema's
 * onDelete: SetNull on Conversation.folder). */
export async function deleteFolder(folderId: string): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const folder = await prisma.conversationFolder.findUnique({ where: { id: folderId }, select: { userId: true } });
  if (!folder || folder.userId !== session.user.id) return { error: "Folder not found." };

  await prisma.conversationFolder.delete({ where: { id: folderId } });
  return { error: null };
}

/** Moves a conversation into `folderId`, or out of any folder when null. */
export async function assignConversationToFolder(
  conversationId: string,
  folderId: string | null,
): Promise<{ error: string | null }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { bot: { select: { userId: true } } },
  });
  if (!conversation || conversation.bot.userId !== session.user.id) return { error: "Conversation not found." };

  if (folderId) {
    const folder = await prisma.conversationFolder.findUnique({ where: { id: folderId }, select: { userId: true } });
    if (!folder || folder.userId !== session.user.id) return { error: "Folder not found." };
  }

  await prisma.conversation.update({ where: { id: conversationId }, data: { folderId } });
  return { error: null };
}

export type ExportResult = { text: string | null; error: string | null };

const MAX_EXPORT_CONVERSATIONS = 500;

function formatExportTimestamp(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function exportRoleLabel(role: "BOT" | "USER" | "AGENT", visitorId: string): string {
  if (role === "USER") return visitorId;
  if (role === "AGENT") return "You";
  return "Bot";
}

function exportMessageLine(
  message: {
    role: "BOT" | "USER" | "AGENT";
    content: string;
    contentType: "TEXT" | "IMAGE";
    caption: string | null;
    createdAt: Date;
  },
  visitorId: string,
): string {
  const body = message.contentType === "IMAGE" ? `[Image${message.caption ? `: ${message.caption}` : ""}]` : message.content;
  return `[${formatExportTimestamp(message.createdAt)}] ${exportRoleLabel(message.role, visitorId)}: ${body}`;
}

/**
 * Exports full transcripts as one plain-text document — meant to be downloaded and, e.g., pasted
 * into a chat with an AI assistant to review reply/logic issues against real conversations, not
 * just the Studio Test drawer's synthetic ones. `conversationIds` omitted or empty exports every
 * conversation across every bot this seller owns (capped at MAX_EXPORT_CONVERSATIONS, newest
 * first); otherwise only those ids — still scoped to bots this seller owns, same as every other
 * action here. An inbound image's actual bytes are never included (that data: URI would make the
 * export enormous and isn't useful pasted into a chat) — just a bracketed placeholder and its
 * caption, if any.
 */
export async function exportConversationsAsText(conversationIds?: string[]): Promise<ExportResult> {
  const session = await auth();
  if (!session?.user?.id) return { text: null, error: "Not signed in." };

  const conversations = await prisma.conversation.findMany({
    where: {
      bot: { userId: session.user.id },
      ...(conversationIds && conversationIds.length > 0 ? { id: { in: conversationIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT_CONVERSATIONS,
    select: {
      visitorId: true,
      status: true,
      createdAt: true,
      lastInboundAt: true,
      bot: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true, contentType: true, caption: true, createdAt: true },
      },
    },
  });

  if (conversations.length === 0) return { text: null, error: "No conversations to export." };

  const sections = conversations.map((conversation) => {
    const channel = conversation.lastInboundAt !== null ? "WhatsApp" : "Web preview";
    const header = [
      `Bot: ${conversation.bot.name} · Visitor: ${conversation.visitorId} · Channel: ${channel} · Status: ${conversation.status}`,
      `Started: ${formatExportTimestamp(conversation.createdAt)}`,
    ].join("\n");
    const body =
      conversation.messages.length > 0
        ? conversation.messages.map((m) => exportMessageLine(m, conversation.visitorId)).join("\n")
        : "(no messages)";
    return `${"=".repeat(60)}\n${header}\n${"-".repeat(60)}\n${body}`;
  });

  const text = [
    `Chatmeo export — ${new Date().toISOString()}`,
    `${conversations.length} conversation${conversations.length === 1 ? "" : "s"}`,
    "",
    ...sections,
  ].join("\n\n");

  return { text, error: null };
}
