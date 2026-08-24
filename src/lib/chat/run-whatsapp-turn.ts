import { adaptPersistedGraph } from "@/engine/adapt-graph";
import { createInitialState, step } from "@/engine/executor";
import { parseEngineState } from "@/engine/state-schema";
import type { EngineDeps, EngineStatus, LlmChatMessage, Reply } from "@/engine/types";
import { attachAiNodeDocuments } from "@/lib/chat/attach-ai-documents";
import { conversationStatusFor, type RunTurnDeps } from "@/lib/chat/run-turn";
import { parseFlowGraph } from "@/lib/flow-schema";
import { defaultFlowGraph } from "@/lib/flow-types";
import { prisma } from "@/lib/prisma";
import { isWithinServiceWindow } from "@/lib/whatsapp/service-window";

// Mirrors run-turn.ts's constant of the same name.
const MAX_HISTORY_MESSAGES = 12;

const OUTSIDE_WINDOW_WARNING = "Bot reply not sent — outside 24h window, customer needs to message first.";

export type RunWhatsAppTurnParams = {
  botId: string;
  /** The customer's WhatsApp wa_id — this channel's equivalent of the widget's visitorId, and
   * likewise used to find/create this customer's open Conversation. */
  visitorId: string;
  message: string;
  /** Meta's own message id for this inbound message — persisted on the Message row so the
   * Inbox's "reply to this message" action can later pass it back as WhatsApp's own
   * `context.message_id`, making that reply show as a real quoted reply on the customer's phone
   * (see sendWhatsAppTextMessage in meta-graph.ts). */
  waMessageId?: string;
  /** False when the connection is paused (WhatsAppConnection.isActive) — the message still gets
   * stored for the seller's inbox, but the flow is never loaded and the engine never runs,
   * regardless of whether an active flow exists. Defaults to true. */
  runEngine?: boolean;
  /** When the customer actually sent this, per Meta's own timestamp — see
   * InboundWhatsAppMessage.receivedAt. Defaults to now for callers that don't have one. */
  receivedAt?: Date;
  /** Set only when the webhook already downloaded an inbound image (see downloadWhatsAppMedia in
   * meta-graph.ts) — persisted as an IMAGE-content Message instead of `message`'s placeholder
   * text. The flow-walking engine only understands text, so this is only ever passed alongside
   * runEngine: false, same as any other non-text message type. */
  image?: { dataUri: string; caption: string | null };
};

export type RunWhatsAppTurnResult =
  | { kind: "stored_only"; blocked: boolean }
  | {
      kind: "success";
      replies: Reply[];
      status: EngineStatus;
      withinWindow: boolean;
      /** Parallel array to `replies` (only populated when `withinWindow` — the out-of-window
       * branch persists a warning message instead, never actually sent) — each reply's own
       * Message row id, so the webhook route can back-fill Message.waMessageId once it knows
       * what Meta's send call returned for that reply (see processInboundMessage in
       * src/app/api/webhooks/whatsapp/route.ts). */
      replyMessageIds: string[];
    };

/**
 * The WhatsApp webhook's counterpart to runChatTurn (src/lib/chat/run-turn.ts) — same engine,
 * same Conversation/Message persistence, just keyed by botId (the webhook already resolved the
 * bot via WhatsAppConnection.phoneNumberId, so there's no BotApiKey/public-key lookup here) and
 * tagging every message it writes with channel: "WHATSAPP".
 *
 * Unlike runChatTurn, the inbound message is *always* persisted — even when the bot has no
 * active flow to run — since the webhook's job is to keep the seller's inbox complete regardless
 * of whether the engine can actually respond. In that case this returns "stored_only" and the
 * caller sends no reply back to the customer, the same as it would for a paused connection.
 *
 * Also tracks Conversation.lastInboundAt and, when the engine does produce replies, whether
 * they're still inside Meta's 24h customer-service window (see service-window.ts) — outside it,
 * a normal session message would just be rejected by Graph API, so this persists a warning
 * Message instead of the actual reply and tells the caller (via `withinWindow: false`) not to
 * attempt sending. Template messages (Meta's supported way to reach a customer outside the
 * window) aren't implemented yet — beta scope is skip-and-log, not broken-and-throw.
 */
export async function runWhatsAppTurn(params: RunWhatsAppTurnParams, deps: RunTurnDeps): Promise<RunWhatsAppTurnResult> {
  const inboundAt = params.receivedAt ?? new Date();

  const shouldRunEngine = params.runEngine !== false;
  const bot = shouldRunEngine
    ? await prisma.bot.findUnique({
        where: { id: params.botId },
        select: { flows: { where: { isActive: true }, take: 1, select: { id: true, graph: true } } },
      })
    : null;
  const flowRow = bot?.flows[0];
  const graph = flowRow ? adaptPersistedGraph(parseFlowGraph(flowRow.graph) ?? defaultFlowGraph()) : null;
  if (graph && flowRow) await attachAiNodeDocuments(graph, flowRow.id);

  // One Conversation row per (bot, visitor) — permanently, regardless of status. A different
  // visitorId (a different WhatsApp number messaging in) always gets its own conversation, but
  // this same customer's messages must never fragment into multiple rows in the Inbox. Status is
  // deliberately not filtered here: excluding RESOLVED (as this used to) meant a flow finishing
  // naturally caused the very next message to find nothing, open a brand-new conversation, and
  // split that customer's history into a growing list of near-duplicate "sub-conversations".
  let conversation = await prisma.conversation.findFirst({
    where: { botId: params.botId, visitorId: params.visitorId },
    orderBy: { createdAt: "desc" },
  });

  let lastInboundAt: Date;
  if (!conversation) {
    lastInboundAt = inboundAt;
    conversation = await prisma.conversation.create({
      data: {
        botId: params.botId,
        visitorId: params.visitorId,
        lastInboundAt,
        ...(graph ? { engineState: createInitialState(graph) } : {}),
      },
    });
  } else {
    // An out-of-order/replayed webhook delivery shouldn't be able to rewind the window back
    // past a more recent message we've already recorded.
    lastInboundAt = conversation.lastInboundAt && conversation.lastInboundAt > inboundAt ? conversation.lastInboundAt : inboundAt;
    // A RESOLVED conversation's flow already ran to completion (step() would no-op on its ENDED
    // state forever, same as HANDOFF) — reusing the row but restarting the engine from Start is
    // what makes this next message read as a fresh interaction instead of going nowhere, while
    // keeping it in the same thread rather than a new one. HANDOFF is untouched here: that one
    // stays quiet until the seller resolves it themselves (see resolveConversation).
    if (conversation.status === "RESOLVED" && graph) {
      conversation = { ...conversation, engineState: createInitialState(graph), status: "OPEN" };
    }
  }

  // Fetched before persisting this turn's inbound message, same reasoning as run-turn.ts: the
  // executor's own local history (which prepends that same message) shouldn't end up duplicated
  // in the merge below. Skipped whenever the engine won't run this turn (no flow, or already
  // handed off — see below), since nothing will read it.
  const priorHistory: LlmChatMessage[] =
    graph && conversation.status !== "HANDOFF" && !conversation.blocked
      ? (
          await prisma.message.findMany({
            where: { conversationId: conversation.id },
            orderBy: { createdAt: "desc" },
            take: MAX_HISTORY_MESSAGES,
          })
        )
          .reverse()
          .map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content }))
      : [];

  await prisma.message.create({
    data: params.image
      ? {
          conversationId: conversation.id,
          role: "USER",
          content: params.image.dataUri,
          contentType: "IMAGE",
          caption: params.image.caption,
          channel: "WHATSAPP",
          waMessageId: params.waMessageId,
        }
      : {
          conversationId: conversation.id,
          role: "USER",
          content: params.message,
          channel: "WHATSAPP",
          waMessageId: params.waMessageId,
        },
  });

  // A HANDOFF conversation stays that way for good — step() would no-op on it anyway (see
  // executor.ts), but skipping the engine here also avoids loading the flow graph/history for a
  // turn that was never going to produce a reply. A blocked conversation is the seller's own
  // "stop bothering me" — same skip, permanently, until they unblock it (setConversationBlocked
  // in src/lib/actions/inbox.ts). The message above is still stored either way, so the seller
  // sees it in the Inbox and can reply there themselves (or just has a record of it).
  if (!graph || conversation.status === "HANDOFF" || conversation.blocked) {
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastInboundAt } });
    console.log("[whatsapp] stored inbound message, engine not run", {
      botId: params.botId,
      conversationId: conversation.id,
      reason: conversation.blocked
        ? "blocked"
        : conversation.status === "HANDOFF"
          ? "handoff"
          : shouldRunEngine
            ? "no_active_flow"
            : "connection_paused",
    });
    return { kind: "stored_only", blocked: conversation.blocked };
  }

  const state = parseEngineState(conversation.engineState, graph);

  const engineDeps: EngineDeps = {
    llm: (args) => deps.llm({ ...args, history: [...priorHistory, ...args.history].slice(-MAX_HISTORY_MESSAGES) }),
    classify: (args) =>
      deps.classify({ ...args, history: [...priorHistory, ...args.history].slice(-MAX_HISTORY_MESSAGES) }),
    fetch,
    logger: console,
    conversationId: conversation.id,
    // The engine itself doesn't know or care which webhook-delivered channel this is — see
    // EngineChannel's doc comment in src/engine/types.ts. "webhook" just means "not our own
    // hosted widget," which is exactly what WhatsApp is here.
    channel: "webhook",
  };

  const output = await step(graph, state, params.message, engineDeps);
  const withinWindow = isWithinServiceWindow(lastInboundAt);

  const replyMessageIds: string[] = [];
  if (output.replies.length > 0) {
    if (withinWindow) {
      // Sequential create()s rather than one createMany() — unlike createMany, this hands back
      // each row's own id, which processInboundMessage needs (in the same order as `replies`) to
      // back-fill Message.waMessageId once it knows what Meta's send call actually returned.
      for (const reply of output.replies) {
        const row = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "BOT",
            content: reply.content,
            contentType: reply.contentType ?? "TEXT",
            caption: reply.caption ?? null,
            promptTokens: reply.promptTokens ?? null,
            completionTokens: reply.completionTokens ?? null,
            channel: "WHATSAPP",
          },
          select: { id: true },
        });
        replyMessageIds.push(row.id);
      }
    } else {
      console.warn("[whatsapp] suppressing reply, outside 24h service window", {
        botId: params.botId,
        conversationId: conversation.id,
        lastInboundAt,
      });
      await prisma.message.createMany({
        data: output.replies.map((reply) => ({
          conversationId: conversation.id,
          role: "BOT" as const,
          // An image reply's raw `data:` URI has no place embedded in this warning's text — its
          // caption (or a bare placeholder) stands in for it instead, same as engine/executor.ts's
          // own local history summary does for the same reason.
          content: `${OUTSIDE_WINDOW_WARNING} (Intended reply: "${
            reply.contentType === "IMAGE" ? (reply.caption ?? "[image]") : reply.content
          }")`,
          channel: "WHATSAPP" as const,
        })),
      });
    }
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { engineState: output.state, status: conversationStatusFor(output.state.status), lastInboundAt },
  });

  console.log("[whatsapp] turn", {
    botId: params.botId,
    conversationId: conversation.id,
    replyCount: output.replies.length,
    status: output.state.status,
    withinWindow,
  });

  return { kind: "success", replies: output.replies, status: output.state.status, withinWindow, replyMessageIds };
}
