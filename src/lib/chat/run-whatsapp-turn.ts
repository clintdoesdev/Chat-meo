import { adaptPersistedGraph } from "@/engine/adapt-graph";
import { createInitialState, step } from "@/engine/executor";
import { parseEngineState } from "@/engine/state-schema";
import type { EngineDeps, EngineStatus, LlmChatMessage, Reply } from "@/engine/types";
import { attachAiNodeDocuments } from "@/lib/chat/attach-ai-documents";
import { conversationStatusFor, type RunTurnDeps } from "@/lib/chat/run-turn";
import { parseFlowGraph } from "@/lib/flow-schema";
import { defaultFlowGraph } from "@/lib/flow-types";
import { prisma } from "@/lib/prisma";
import { runPythonBotTurn } from "@/lib/python-bot/run-turn";
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
  /** Set only when the webhook already downloaded an inbound image/document/video/audio (see
   * downloadWhatsAppMedia in meta-graph.ts) — persisted as a Message with that contentType
   * instead of `message`'s placeholder text. The flow-walking engine only understands text, so
   * this is only ever passed alongside runEngine: false, same as any other non-text message type. */
  media?: { dataUri: string; kind: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO"; caption: string | null; fileName: string | null };
};

export type RunWhatsAppTurnResult =
  | { kind: "stored_only"; blocked: boolean; conversationId: string }
  | {
      kind: "success";
      conversationId: string;
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
        select: {
          flows: { where: { isActive: true }, take: 1, select: { id: true, graph: true } },
          pythonBot: { select: { code: true, enabled: true } },
        },
      })
    : null;
  // Python Bot mode (see PythonBot in prisma/schema.prisma) bypasses the Flow graph entirely —
  // when enabled, `graph` deliberately stays null even if the bot also happens to have an active
  // flow (e.g. left over from before Python Bot mode was turned on), so nothing below ever falls
  // back to running both.
  const pythonBotCode = bot?.pythonBot?.enabled ? bot.pythonBot.code : null;
  const flowRow = pythonBotCode ? undefined : bot?.flows[0];
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
    data: params.media
      ? {
          conversationId: conversation.id,
          role: "USER",
          content: params.media.dataUri,
          contentType: params.media.kind,
          caption: params.media.caption,
          fileName: params.media.fileName,
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
  if ((!graph && !pythonBotCode) || conversation.status === "HANDOFF" || conversation.blocked) {
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
    return { kind: "stored_only", blocked: conversation.blocked, conversationId: conversation.id };
  }

  if (pythonBotCode) {
    const result = await runPythonBotTurn({
      conversationId: conversation.id,
      pythonState: conversation.pythonState,
      message: params.message,
      code: pythonBotCode,
      botId: params.botId,
    });
    const withinWindow = isWithinServiceWindow(lastInboundAt);
    const replies: Reply[] = result.replies.map((content) => ({ content }));
    const replyMessageIds = await persistWhatsAppReplies(conversation.id, replies, withinWindow, params.botId);

    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastInboundAt } });

    console.log("[whatsapp] python bot turn", {
      botId: params.botId,
      conversationId: conversation.id,
      replyCount: replies.length,
      handoff: result.handoff,
      withinWindow,
    });

    return { kind: "success", conversationId: conversation.id, replies, status: result.handoff ? "HANDOFF" : "AWAITING_INPUT", withinWindow, replyMessageIds };
  }
  if (!graph) {
    // Unreachable: the gate above already returns "stored_only" whenever neither graph nor
    // pythonBotCode is set. Narrows `graph` for everything below rather than a non-null
    // assertion.
    return { kind: "stored_only", blocked: conversation.blocked, conversationId: conversation.id };
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
  const replyMessageIds = await persistWhatsAppReplies(conversation.id, output.replies, withinWindow, params.botId);

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

  return { kind: "success", conversationId: conversation.id, replies: output.replies, status: output.state.status, withinWindow, replyMessageIds };
}

/** Shared by both the Flow graph path and the Python Bot path: persists a turn's outbound
 * replies as Message rows, respecting Meta's 24h service window exactly the same way regardless
 * of which engine produced them — see OUTSIDE_WINDOW_WARNING's doc comment above. Returns each
 * reply's own Message row id (in order), or an empty array when the window suppressed them, so
 * processInboundMessage can back-fill Message.waMessageId once it knows what Meta's send call
 * actually returned. */
async function persistWhatsAppReplies(
  conversationId: string,
  replies: Reply[],
  withinWindow: boolean,
  botId: string,
): Promise<string[]> {
  if (replies.length === 0) return [];

  if (!withinWindow) {
    console.warn("[whatsapp] suppressing reply, outside 24h service window", { botId, conversationId });
    await prisma.message.createMany({
      data: replies.map((reply) => ({
        conversationId,
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
    return [];
  }

  // Sequential create()s rather than one createMany() — unlike createMany, this hands back each
  // row's own id, which processInboundMessage needs (in the same order as `replies`) to
  // back-fill Message.waMessageId once it knows what Meta's send call actually returned.
  const replyMessageIds: string[] = [];
  for (const reply of replies) {
    const row = await prisma.message.create({
      data: {
        conversationId,
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
  return replyMessageIds;
}
