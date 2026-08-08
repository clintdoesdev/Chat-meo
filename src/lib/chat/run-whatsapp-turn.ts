import { adaptPersistedGraph } from "@/engine/adapt-graph";
import { createInitialState, step } from "@/engine/executor";
import { parseEngineState } from "@/engine/state-schema";
import type { EngineDeps, EngineStatus, LlmChatMessage, Reply } from "@/engine/types";
import { attachAiNodeDocuments } from "@/lib/chat/attach-ai-documents";
import { conversationStatusFor, type RunTurnDeps } from "@/lib/chat/run-turn";
import { parseFlowGraph } from "@/lib/flow-schema";
import { defaultFlowGraph } from "@/lib/flow-types";
import { prisma } from "@/lib/prisma";

// Mirrors run-turn.ts's constant of the same name.
const MAX_HISTORY_MESSAGES = 12;

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
};

export type RunWhatsAppTurnResult =
  | { kind: "stored_only" }
  | { kind: "success"; replies: Reply[]; status: EngineStatus };

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
 */
export async function runWhatsAppTurn(params: RunWhatsAppTurnParams, deps: RunTurnDeps): Promise<RunWhatsAppTurnResult> {
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

  let conversation = await prisma.conversation.findFirst({
    where: { botId: params.botId, visitorId: params.visitorId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        botId: params.botId,
        visitorId: params.visitorId,
        ...(graph ? { engineState: createInitialState(graph) } : {}),
      },
    });
  }

  // Fetched before persisting this turn's inbound message, same reasoning as run-turn.ts: the
  // executor's own local history (which prepends that same message) shouldn't end up duplicated
  // in the merge below. Skipped entirely when there's no flow to run, since nothing will read it.
  const priorHistory: LlmChatMessage[] = graph
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

  if (!graph) {
    console.log("[whatsapp] stored inbound message, engine not run", {
      botId: params.botId,
      conversationId: conversation.id,
      reason: shouldRunEngine ? "no_active_flow" : "connection_paused",
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

  if (output.replies.length > 0) {
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
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { engineState: output.state, status: conversationStatusFor(output.state.status) },
  });

  console.log("[whatsapp] turn", {
    botId: params.botId,
    conversationId: conversation.id,
    replyCount: output.replies.length,
    status: output.state.status,
  });

  return { kind: "success", replies: output.replies, status: output.state.status };
}
