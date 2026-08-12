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
  /** False when the connection is paused (WhatsAppConnection.isActive) — the message still gets
   * stored for the seller's inbox, but the flow is never loaded and the engine never runs,
   * regardless of whether an active flow exists. Defaults to true. */
  runEngine?: boolean;
  /** When the customer actually sent this, per Meta's own timestamp — see
   * InboundWhatsAppMessage.receivedAt. Defaults to now for callers that don't have one. */
  receivedAt?: Date;
};

export type RunWhatsAppTurnResult =
  | { kind: "stored_only" }
  | { kind: "success"; replies: Reply[]; status: EngineStatus; withinWindow: boolean };

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
    graph && conversation.status !== "HANDOFF"
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
    data: { conversationId: conversation.id, role: "USER", content: params.message, channel: "WHATSAPP" },
  });

  // A HANDOFF conversation stays that way for good — step() would no-op on it anyway (see
  // executor.ts), but skipping the engine here also avoids loading the flow graph/history for a
  // turn that was never going to produce a reply. The message above is still stored either way,
  // so the seller sees it in the Inbox and can reply there themselves.
  if (!graph || conversation.status === "HANDOFF") {
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastInboundAt } });
    console.log("[whatsapp] stored inbound message, engine not run", {
      botId: params.botId,
      conversationId: conversation.id,
      reason: conversation.status === "HANDOFF" ? "handoff" : shouldRunEngine ? "no_active_flow" : "connection_paused",
    });
    return { kind: "stored_only" };
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

  if (output.replies.length > 0) {
    if (withinWindow) {
      await prisma.message.createMany({
        data: output.replies.map((reply) => ({
          conversationId: conversation.id,
          role: "BOT" as const,
          content: reply.content,
          promptTokens: reply.promptTokens ?? null,
          completionTokens: reply.completionTokens ?? null,
          channel: "WHATSAPP" as const,
        })),
      });
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
          content: `${OUTSIDE_WINDOW_WARNING} (Intended reply: "${reply.content}")`,
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

  return { kind: "success", replies: output.replies, status: output.state.status, withinWindow };
}
